import type { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import memorystore from "memorystore";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { clinics, users, type Clinic } from "@shared/schema";
import { eq } from "drizzle-orm";

const MemoryStore = memorystore(session);

// Extend session type
declare module "express-session" {
  interface SessionData {
    clinicId?: number;
    isSuperAdmin?: boolean;
  }
}

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || "admin@tirthontech.com";
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || "TirthonAdmin2024!";

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
      store: new MemoryStore({ checkPeriod: 86400000 }),
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

  // ── Current session info ───────────────────────────────────────────────────
  app.get("/api/auth/me", async (req, res) => {
    if (req.session.isSuperAdmin) {
      return res.json({ isSuperAdmin: true, email: SUPER_ADMIN_EMAIL });
    }
    if (!req.session.clinicId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const clinic = await getClinic(req.session.clinicId);
    if (!clinic) return res.status(401).json({ message: "Clinic not found" });
    const { passwordHash: _, ...safe } = clinic;
    res.json(safe);
  });

  // ── Signup ────────────────────────────────────────────────────────────────
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

      req.session.clinicId = clinic!.id;
      const { passwordHash: _, ...safe } = clinic!;
      res.status(201).json(safe);
    } catch (err: any) {
      console.error("Signup error:", err);
      res.status(500).json({ message: "Signup failed" });
    }
  });

  // ── Login ─────────────────────────────────────────────────────────────────
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      // Super admin check
      if (email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase() && password === SUPER_ADMIN_PASSWORD) {
        req.session.isSuperAdmin = true;
        req.session.clinicId = undefined;
        return res.json({ isSuperAdmin: true });
      }

      const [clinic] = await db.select().from(clinics).where(eq(clinics.email, email.toLowerCase().trim()));
      if (!clinic) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      const valid = await verifyPassword(password, clinic.passwordHash);
      if (!valid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      req.session.clinicId = clinic.id;
      req.session.isSuperAdmin = false;
      const { passwordHash: _, ...safe } = clinic;
      res.json(safe);
    } catch (err) {
      console.error("Login error:", err);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // ── Logout ────────────────────────────────────────────────────────────────
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => res.json({ success: true }));
  });
}
