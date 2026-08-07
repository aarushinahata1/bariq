import crypto from "crypto";
import type { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import bcrypt from "bcryptjs";
import { db, pool } from "./db";
import { clinics, partners, users, type Clinic, type Partner } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const PgSession = connectPgSimple(session);

declare module "express-session" {
  interface SessionData {
    clinicId?: number;
    isSuperAdmin?: boolean;
    partnerId?: number;
    // Set only for staff (receptionist/pharmacist/etc.) logins — absent for the
    // clinic-owner session, which is treated as "admin" wherever role is read.
    userId?: string;
    role?: string;
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} environment variable is required`);
  return value;
}

const SUPER_ADMIN_EMAIL = requireEnv("SUPER_ADMIN_EMAIL");
const SUPER_ADMIN_PASSWORD = requireEnv("SUPER_ADMIN_PASSWORD");

// A fixed bcrypt hash (of an arbitrary placeholder, cost 10) with no corresponding
// real account — compared against on login when no clinic/partner matches the given
// email, purely to burn roughly the same time as a real password check would.
const DUMMY_BCRYPT_HASH = "$2a$10$CwTycUXWue0Thq9StjUM0uJ8Q4wF5C0Ie6C7z2joNa9DE1NpZ2K5m";

// Timing-safe string comparison — prevents timing attacks on password checks.
// Hashes both inputs to a fixed-length digest first so there's no length-mismatch
// branch to time (crypto.timingSafeEqual throws on unequal-length buffers, and an
// early `a.length !== b.length` return would itself leak length via timing).
function timingSafeEqual(a: string, b: string): boolean {
  const aHash = crypto.createHash("sha256").update(a).digest();
  const bHash = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(aHash, bHash);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function getClinic(id: number): Promise<Clinic | undefined> {
  const [row] = await db.select().from(clinics).where(eq(clinics.id, id));
  return row;
}

// Short-TTL cache for the plan-expiry check below, which otherwise runs a full
// `clinics` SELECT on every single authenticated /api request — on top of
// whatever the endpoint itself queries. A plan flipping to expired/active is not
// time-critical (same tradeoff the public-queue cache elsewhere already makes),
// so a few seconds of staleness here is a good trade for cutting that read in
// most requests. Keyed by clinicId; per-process, same as the other in-memory
// caches in this app.
const clinicPlanCache = new Map<number, { clinic: Clinic; ts: number }>();
const CLINIC_PLAN_CACHE_TTL_MS = 30_000;

async function getClinicForPlanCheck(id: number): Promise<Clinic | undefined> {
  const cached = clinicPlanCache.get(id);
  if (cached && Date.now() - cached.ts < CLINIC_PLAN_CACHE_TTL_MS) return cached.clinic;
  const clinic = await getClinic(id);
  if (clinic) clinicPlanCache.set(id, { clinic, ts: Date.now() });
  else clinicPlanCache.delete(id);
  return clinic;
}

export async function getPartner(id: number): Promise<Partner | undefined> {
  const [row] = await db.select().from(partners).where(eq(partners.id, id));
  return row;
}

// Generates a unique, human-shareable referral code (e.g. "BRQ-7K2P9X"), retrying on collision
export async function generateReferralCode(): Promise<string> {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O/0/I/1 — avoids look-alike confusion
  for (let attempt = 0; attempt < 10; attempt++) {
    let code = "";
    for (let i = 0; i < 6; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
    const full = `BRQ-${code}`;
    const [existing] = await db.select().from(partners).where(eq(partners.referralCode, full));
    if (!existing) return full;
  }
  throw new Error("Failed to generate a unique referral code");
}

// Returns true when a clinic's plan has lapsed (by dates), regardless of stored planStatus
function isPlanExpired(clinic: Clinic): boolean {
  const now = new Date();
  if (clinic.planStatus === "expired" || clinic.planStatus === "cancelled") return true;
  if (clinic.planStatus === "trial" && clinic.trialEndsAt && clinic.trialEndsAt < now) return true;
  if (clinic.planStatus === "active" && clinic.subscriptionEndsAt && clinic.subscriptionEndsAt < now) return true;
  return false;
}

// Auto-expires a clinic's plan in the DB if dates have passed, returns updated clinic
async function syncPlanStatus(clinic: Clinic): Promise<Clinic> {
  const now = new Date();
  const needsExpiry =
    (clinic.planStatus === "trial" && clinic.trialEndsAt && clinic.trialEndsAt < now) ||
    (clinic.planStatus === "active" && clinic.subscriptionEndsAt && clinic.subscriptionEndsAt < now);
  if (!needsExpiry) return clinic;
  await db.update(clinics).set({ planStatus: "expired" }).where(eq(clinics.id, clinic.id));
  clinicPlanCache.delete(clinic.id);
  return { ...clinic, planStatus: "expired" };
}

// Called by routes.ts wherever a clinic's plan/status is updated directly (payment
// approval, admin plan edits) so the cache below doesn't keep serving a stale
// pre-update row for up to CLINIC_PLAN_CACHE_TTL_MS.
export function invalidateClinicPlanCache(clinicId: number): void {
  clinicPlanCache.delete(clinicId);
}

// Single source of truth for the shape of a "logged into a clinic" response —
// used by both GET /api/auth/me and every login branch that ends in a clinic
// session. Login.tsx caches the login response directly as the /api/auth/me
// query result, so the two MUST match shape exactly or the client's auth state
// goes stale until the next background refetch.
async function buildClinicSessionResponse(
  clinicId: number,
  userId?: string | null,
  role?: string | null,
  userName?: string | null
) {
  let clinic = await getClinic(clinicId);
  if (!clinic) return null;
  clinic = await syncPlanStatus(clinic);
  const { passwordHash: _, ...safe } = clinic;
  return { ...safe, role: role ?? "admin", userId: userId ?? null, userName: userName ?? null };
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.clinicId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

// Server-verified role check — session.role is only ever set at login time from
// the users table (never trusted from the client). No session.userId means the
// clinic-owner session, which always counts as "admin".
export function requireRole(...allowed: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.clinicId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const role = req.session.role || "admin";
    if (!allowed.includes(role)) {
      return res.status(403).json({ message: "Forbidden — insufficient permissions for this action" });
    }
    next();
  };
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.isSuperAdmin) {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
}

export function requirePartner(req: Request, res: Response, next: NextFunction) {
  if (!req.session.partnerId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

// Stricter than requirePartner — also blocks partners still awaiting admin approval
// or deactivated, for endpoints that expose real dashboard data (clients, revenue).
export async function requireActivePartner(req: Request, res: Response, next: NextFunction) {
  if (!req.session.partnerId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const partner = await getPartner(req.session.partnerId);
  if (!partner) return res.status(401).json({ message: "Partner not found" });
  if (partner.status === "pending") {
    return res.status(403).json({ message: "Your partner account is awaiting admin approval" });
  }
  if (partner.status === "inactive") {
    return res.status(403).json({ message: "Your partner account has been deactivated" });
  }
  next();
}

export function setupAuth(app: Express) {
  app.use(
    session({
      secret: (() => {
        const s = process.env.SESSION_SECRET;
        if (!s) throw new Error("SESSION_SECRET environment variable is required");
        return s;
      })(),
      store: new PgSession({
        pool,
        tableName: "sessions",
        createTableIfMissing: false,
        // Cookie isn't `rolling`, so cookie.expires is fixed at login and never
        // changes between requests — connect-pg-simple's touch() would otherwise
        // run an UPDATE on every single authenticated request writing that exact
        // same, unchanged expire value. Disabling it drops a no-op write per request.
        disableTouch: true,
      }),
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: "lax",
      },
    })
  );

  // ── Current session info ──────────────────────────────────────────────────
  app.get("/api/auth/me", async (req, res) => {
    if (req.session.isSuperAdmin) {
      return res.json({ isSuperAdmin: true, email: SUPER_ADMIN_EMAIL });
    }
    if (req.session.partnerId) {
      const partner = await getPartner(req.session.partnerId);
      if (!partner) return res.status(401).json({ message: "Partner not found" });
      const { passwordHash: _, ...safe } = partner;
      return res.json({ isPartner: true, ...safe });
    }
    if (!req.session.clinicId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    let userId: string | null = null;
    let role: string | null = null;
    let userName: string | null = null;
    if (req.session.userId) {
      const [user] = await db.select().from(users)
        .where(and(eq(users.id, req.session.userId), eq(users.clinicId, req.session.clinicId)));
      if (!user) return res.status(401).json({ message: "User not found" });
      userId = user.id;
      role = user.role;
      userName = user.name;
    }

    const body = await buildClinicSessionResponse(req.session.clinicId, userId, role, userName);
    if (!body) return res.status(401).json({ message: "Clinic not found" });
    res.json(body);
  });

  // ── Signup ───────────────────────────────────────────────────────────────
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { name, email, password, phone, address, referralCode } = req.body;
      if (!name || !email || !password) {
        return res.status(400).json({ message: "Name, email and password are required" });
      }
      if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }
      const existing = await db.select().from(clinics).where(eq(clinics.email, email.toLowerCase().trim()));
      if (existing.length > 0) {
        return res.status(400).json({ message: "An account with this email already exists" });
      }
      const passwordHash = await hashPassword(password);
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 7);

      // Optional referral code — best-effort link, invalid/unknown codes don't block signup
      let partnerId: number | null = null;
      if (referralCode && String(referralCode).trim()) {
        const [partner] = await db.select().from(partners)
          .where(eq(partners.referralCode, String(referralCode).trim().toUpperCase()));
        if (partner && partner.status === "active") partnerId = partner.id;
      }

      const [clinic] = await db.insert(clinics).values({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        passwordHash,
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        planStatus: "trial",
        trialEndsAt,
        partnerId,
      }).returning();

      // Regenerate session after signup to prevent session fixation
      req.session.regenerate((err) => {
        if (err) {
          console.error("Session regenerate error:", err);
          return res.status(500).json({ message: "Signup failed" });
        }
        req.session.clinicId = clinic!.id;
        const { passwordHash: _, ...safe } = clinic!;
        req.session.save((saveErr) => {
          if (saveErr) {
            console.error("Session save error:", saveErr);
            return res.status(500).json({ message: "Signup failed" });
          }
          res.status(201).json(safe);
        });
      });
    } catch (err: any) {
      console.error("Signup error:", err);
      res.status(500).json({ message: "Signup failed" });
    }
  });

  // ── Partner signup ─────────────────────────────────────────────────────────
  app.post("/api/auth/partner-signup", async (req, res) => {
    try {
      const { name, email, password, phone } = req.body;
      if (!name || !email || !password) {
        return res.status(400).json({ message: "Name, email and password are required" });
      }
      if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }
      const existing = await db.select().from(partners).where(eq(partners.email, email.toLowerCase().trim()));
      if (existing.length > 0) {
        return res.status(400).json({ message: "An account with this email already exists" });
      }
      const passwordHash = await hashPassword(password);
      const referralCode = await generateReferralCode();

      const [partner] = await db.insert(partners).values({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        passwordHash,
        phone: phone?.trim() || null,
        referralCode,
      }).returning();

      req.session.regenerate((err) => {
        if (err) {
          console.error("Session regenerate error:", err);
          return res.status(500).json({ message: "Signup failed" });
        }
        req.session.partnerId = partner!.id;
        const { passwordHash: _, ...safe } = partner!;
        req.session.save((saveErr) => {
          if (saveErr) {
            console.error("Session save error:", saveErr);
            return res.status(500).json({ message: "Signup failed" });
          }
          res.status(201).json({ isPartner: true, ...safe });
        });
      });
    } catch (err: any) {
      console.error("Partner signup error:", err);
      res.status(500).json({ message: "Signup failed" });
    }
  });

  // ── Login ────────────────────────────────────────────────────────────────
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      // Super admin — timing-safe comparison
      if (
        email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase() &&
        timingSafeEqual(password, SUPER_ADMIN_PASSWORD)
      ) {
        return req.session.regenerate((err) => {
          if (err) return res.status(500).json({ message: "Login failed" });
          req.session.isSuperAdmin = true;
          req.session.clinicId = undefined;
          req.session.save((saveErr) => {
            if (saveErr) return res.status(500).json({ message: "Login failed" });
            res.json({ isSuperAdmin: true });
          });
        });
      }

      const [clinic] = await db.select().from(clinics).where(eq(clinics.email, email.toLowerCase().trim()));
      if (clinic) {
        const valid = await verifyPassword(password, clinic.passwordHash);
        if (!valid) {
          return res.status(401).json({ message: "Invalid email or password" });
        }

        // Regenerate session after login to prevent session fixation
        return req.session.regenerate((err) => {
          if (err) {
            console.error("Session regenerate error:", err);
            return res.status(500).json({ message: "Login failed" });
          }
          req.session.clinicId = clinic.id;
          req.session.isSuperAdmin = false;
          req.session.partnerId = undefined;
          req.session.userId = undefined;
          req.session.role = undefined;
          req.session.save(async (saveErr) => {
            if (saveErr) {
              console.error("Session save error:", saveErr);
              return res.status(500).json({ message: "Login failed" });
            }
            const body = await buildClinicSessionResponse(clinic.id);
            res.json(body);
          });
        });
      }

      // No clinic owner with this email — try staff login (receptionist / pharmacist /
      // etc. accounts created via Settings → Staff & Roles).
      const [staffUser] = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim()));
      if (staffUser) {
        if (!staffUser.passwordHash) {
          // Account exists but has no password set (shouldn't happen for staff created
          // through the current flow, which requires one) — burn the same time as a
          // real check so this doesn't leak account existence via timing.
          await verifyPassword(password, DUMMY_BCRYPT_HASH);
          return res.status(401).json({ message: "Invalid email or password" });
        }
        const staffValid = await verifyPassword(password, staffUser.passwordHash);
        if (!staffValid) {
          return res.status(401).json({ message: "Invalid email or password" });
        }
        if (!staffUser.clinicId) {
          return res.status(401).json({ message: "This account is not linked to a clinic" });
        }

        return req.session.regenerate((err) => {
          if (err) {
            console.error("Session regenerate error:", err);
            return res.status(500).json({ message: "Login failed" });
          }
          req.session.clinicId = staffUser.clinicId!;
          req.session.userId = staffUser.id;
          req.session.role = staffUser.role;
          req.session.isSuperAdmin = false;
          req.session.partnerId = undefined;
          req.session.save(async (saveErr) => {
            if (saveErr) {
              console.error("Session save error:", saveErr);
              return res.status(500).json({ message: "Login failed" });
            }
            const body = await buildClinicSessionResponse(staffUser.clinicId!, staffUser.id, staffUser.role, staffUser.name);
            if (!body) return res.status(401).json({ message: "Clinic not found" });
            res.json(body);
          });
        });
      }

      // No clinic owner or staff account with this email — try partner login
      const [partner] = await db.select().from(partners).where(eq(partners.email, email.toLowerCase().trim()));
      if (!partner) {
        // No account at all for this email — run a dummy bcrypt compare so this
        // response takes roughly as long as the "wrong password" path above instead
        // of returning near-instantly, which would let an attacker infer account
        // existence purely from response timing despite the identical error message.
        await verifyPassword(password, DUMMY_BCRYPT_HASH);
        return res.status(401).json({ message: "Invalid email or password" });
      }
      const partnerValid = await verifyPassword(password, partner.passwordHash);
      if (!partnerValid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      // "pending" partners can still log in — the dashboard shows an awaiting-approval
      // screen. Only explicitly deactivated ("inactive") accounts are locked out.
      if (partner.status === "inactive") {
        return res.status(403).json({ message: "This partner account has been deactivated" });
      }

      req.session.regenerate((err) => {
        if (err) {
          console.error("Session regenerate error:", err);
          return res.status(500).json({ message: "Login failed" });
        }
        req.session.partnerId = partner.id;
        req.session.isSuperAdmin = false;
        req.session.clinicId = undefined;
        const { passwordHash: _, ...safe } = partner;
        req.session.save((saveErr) => {
          if (saveErr) {
            console.error("Session save error:", saveErr);
            return res.status(500).json({ message: "Login failed" });
          }
          res.json({ isPartner: true, ...safe });
        });
      });
    } catch (err) {
      console.error("Login error:", err);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // ── Logout ───────────────────────────────────────────────────────────────
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => res.json({ success: true }));
  });

  // ── Server-side plan enforcement ──────────────────────────────────────────
  // Runs AFTER auth routes (so /api/auth/* bypass it) but BEFORE all clinic routes.
  // Allows expired clinics to still reach GET/POST /api/payments so they can pay.
  app.use("/api", async (req: Request, res: Response, next: NextFunction) => {
    // No clinicId = public route or super admin — skip
    if (!req.session.clinicId) return next();

    // Let expired clinics view/submit payments (they need to pay to regain access)
    if (req.path === "/payments" || req.path.startsWith("/payments/")) return next();

    try {
      const clinic = await getClinicForPlanCheck(req.session.clinicId);
      if (!clinic) return res.status(401).json({ message: "Clinic not found" });

      if (isPlanExpired(clinic)) {
        // Auto-expire in DB if not already done
        await syncPlanStatus(clinic);
        return res.status(402).json({ message: "Subscription expired. Please renew to continue." });
      }
      next();
    } catch (err) {
      next(err);
    }
  });
}
