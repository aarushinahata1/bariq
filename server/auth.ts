import crypto from "crypto";
import type { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import bcrypt from "bcryptjs";
import { db, pool } from "./db";
import { clinics, type Clinic } from "@shared/schema";
import { eq } from "drizzle-orm";

const PgSession = connectPgSimple(session);

declare module "express-session" {
  interface SessionData {
    clinicId?: number;
    isSuperAdmin?: boolean;
  }
}

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || "admin@tirthontech.com";
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || "TirthonAdmin2024!";

// Timing-safe string comparison — prevents timing attacks on password checks
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
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
  return { ...clinic, planStatus: "expired" };
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.clinicId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.isSuperAdmin) {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
}

export function setupAuth(app: Express) {
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "bariq-dev-secret-2024",
      store: new PgSession({
        pool,
        tableName: "sessions",
        createTableIfMissing: false,
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
    if (!req.session.clinicId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    let clinic = await getClinic(req.session.clinicId);
    if (!clinic) return res.status(401).json({ message: "Clinic not found" });

    // Keep DB in sync — auto-expire if trial/subscription dates have passed
    clinic = await syncPlanStatus(clinic);

    const { passwordHash: _, ...safe } = clinic;
    res.json(safe);
  });

  // ── Signup ───────────────────────────────────────────────────────────────
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { name, email, password, phone, address } = req.body;
      if (!name || !email || !password) {
        return res.status(400).json({ message: "Name, email and password are required" });
      }
      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }
      const existing = await db.select().from(clinics).where(eq(clinics.email, email.toLowerCase().trim()));
      if (existing.length > 0) {
        return res.status(400).json({ message: "An account with this email already exists" });
      }
      const passwordHash = await hashPassword(password);
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 7);

      const [clinic] = await db.insert(clinics).values({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        passwordHash,
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        planStatus: "trial",
        trialEndsAt,
      }).returning();

      // Regenerate session after signup to prevent session fixation
      req.session.regenerate((err) => {
        if (err) {
          console.error("Session regenerate error:", err);
          return res.status(500).json({ message: "Signup failed" });
        }
        req.session.clinicId = clinic!.id;
        const { passwordHash: _, ...safe } = clinic!;
        res.status(201).json(safe);
      });
    } catch (err: any) {
      console.error("Signup error:", err);
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
          res.json({ isSuperAdmin: true });
        });
      }

      const [clinic] = await db.select().from(clinics).where(eq(clinics.email, email.toLowerCase().trim()));
      if (!clinic) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      const valid = await verifyPassword(password, clinic.passwordHash);
      if (!valid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Regenerate session after login to prevent session fixation
      req.session.regenerate((err) => {
        if (err) {
          console.error("Session regenerate error:", err);
          return res.status(500).json({ message: "Login failed" });
        }
        req.session.clinicId = clinic.id;
        req.session.isSuperAdmin = false;
        const { passwordHash: _, ...safe } = clinic;
        res.json(safe);
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
      const clinic = await getClinic(req.session.clinicId);
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
