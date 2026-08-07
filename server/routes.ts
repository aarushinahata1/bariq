import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { getStorage } from "./storage";
import * as waWeb from "./whatsapp-web";
import { api } from "@shared/routes";
import { notifications, patients, appointments, users, bills, clinics, clinicPayments, prescriptions, clinicSettings, doctorProfiles, insertBillSchema, insertPrescriptionSchema, medicines, pharmacyBills, medicineNames, pharmacySuppliers, pharmacyReturns, wastageRecords, dailyClosings, partners, insertDentalChartSchema, insertMedicineSchema, insertBodyChartSchema } from "@shared/schema";
import { db, pool } from "./db";
import { eq, and, gte, lte, desc, sql, count, sum, ilike, or, lt, inArray } from "drizzle-orm";
import { z } from "zod";
import { setupAuth, requireAuth, requireRole, requireSuperAdmin, requirePartner, requireActivePartner, hashPassword, generateReferralCode, invalidateClinicPlanCache } from "./auth";
import { nanoid } from "nanoid";
import bcrypt from "bcryptjs";
import pg from "pg";

// Seed 195K medicine names from CSV on first startup (skips if table already populated)
async function seedMedicineNames() {
  try {
    // Enable trigram extension so ILIKE '%q%' on 195K rows uses a GIN index (fast)
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS medicine_names_name_trgm_idx
      ON medicine_names USING GIN (name gin_trgm_ops)
    `);

    let csvPath: string;
    try {
      csvPath = join(dirname(fileURLToPath(import.meta.url)), "data", "medicine_names.csv");
    } catch {
      // CJS production bundle: import.meta.url undefined, fall back to cwd (Render runs from project root)
      csvPath = join(process.cwd(), "server", "data", "medicine_names.csv");
    }
    if (!existsSync(csvPath)) return;
    const [{ cnt }] = await db.select({ cnt: sql<number>`count(*)::int` }).from(medicineNames);
    if (cnt > 0) return;
    const lines = readFileSync(csvPath, "utf-8").split("\n").slice(1);
    const names = lines.map(l => l.trim()).filter(n => n.length > 0).map(name => ({ name }));
    console.log(`[medicine-names] Seeding ${names.length} names...`);
    const BATCH = 5000;
    for (let i = 0; i < names.length; i += BATCH) {
      await db.insert(medicineNames).values(names.slice(i, i + BATCH)).onConflictDoNothing();
    }
    console.log(`[medicine-names] Done.`);
  } catch (err) {
    console.error("[medicine-names] Seed failed:", err);
  }
}

function storage(req: Request) {
  return getStorage(req.session.clinicId!);
}

// ── SSE real-time queue push ───────────────────────────────────────────────────
// doctorId → set of active SSE response objects for that doctor's queue
const sseClients = new Map<string, Set<Response>>();

// doctorId → cached /api/public-queue payload. Every patient watching this doctor
// (plus the waiting-room TV board) reads the same cached snapshot instead of each
// triggering their own full-day appointment scan. Invalidated on every update via
// deliverQueueUpdate below; the TTL is just a safety net.
const publicQueueCache = new Map<string, { data: any; ts: number }>();
const PUBLIC_QUEUE_CACHE_TTL_MS = 5000;

// sseClients/publicQueueCache are in-memory, so they're per PROCESS. This app
// deploys to Cloud Run, which runs multiple instances under concurrent load and
// cold-starts fresh ones after scaling to zero — so a browser's SSE connection
// and the staff mutation that should push to it routinely land on different
// instances. A plain in-memory broadcast would silently miss that browser, which
// would then just sit on the 60s poll fallback until its next refresh — the board
// "isn't live" in practice even though the SSE wiring looks correct on paper.
//
// Fix: route every update through Postgres NOTIFY instead of writing to
// sseClients directly. Every instance keeps one dedicated LISTEN connection
// (startQueueListener, below) and NOTIFY reaches all of them — including the
// instance that triggered it — so deliverQueueUpdate() always runs on every
// live instance exactly once per update, regardless of where it originated.
//
// Caveat: this needs a session-level Postgres connection. If DATABASE_URL points
// at a transaction-mode connection pooler (e.g. Supabase's port-6543 "Transaction"
// pooler), LISTEN/NOTIFY silently doesn't work there — use the direct connection
// (or a session-mode pooler) instead. Failures are logged loudly below rather than
// swallowed, specifically so this is diagnosable instead of just "not live."
const QUEUE_NOTIFY_CHANNEL = "queue_updates";

// Local-only delivery — clears this process's cache entry and pushes to SSE
// clients connected to THIS instance. Only ever called from the LISTEN handler
// below, never directly from route handlers (use broadcastQueueUpdate for that).
function deliverQueueUpdate(doctorId: string) {
  publicQueueCache.delete(doctorId);
  const clients = sseClients.get(doctorId);
  if (!clients?.size) return;
  const payload = `data: ${JSON.stringify({ type: "update", ts: Date.now() })}\n\n`;
  clients.forEach(res => {
    try { res.write(payload); } catch { /* client already disconnected */ }
  });
}

// Call this from route handlers when a doctor's queue changes — it reaches every
// server instance, not just this one.
function broadcastQueueUpdate(doctorId: string) {
  pool.query(`SELECT pg_notify($1, $2)`, [QUEUE_NOTIFY_CHANNEL, doctorId]).catch(err => {
    console.error("[queue-notify] Failed to publish cross-instance update, falling back to local-only delivery:", err);
    deliverQueueUpdate(doctorId); // at least this instance's own clients stay live
  });
}

// One dedicated, long-lived connection per instance for LISTEN — deliberately NOT
// pulled from the query pool (a pooled connection can be silently recycled mid-way,
// which would drop the subscription without warning). Reconnects with backoff if
// the connection ever drops.
function startQueueListener() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

  client.on("notification", (msg) => {
    if (msg.channel === QUEUE_NOTIFY_CHANNEL && msg.payload) {
      deliverQueueUpdate(msg.payload);
    }
  });

  client.on("error", (err) => {
    console.error("[queue-notify] LISTEN connection error, reconnecting in 5s:", err.message);
    client.end().catch(() => {});
    setTimeout(startQueueListener, 5000);
  });

  client.connect()
    .then(() => client.query(`LISTEN ${QUEUE_NOTIFY_CHANNEL}`))
    .then(() => console.log("[queue-notify] Listening for cross-instance queue updates"))
    .catch((err) => {
      console.error("[queue-notify] Failed to start LISTEN, retrying in 5s:", err.message);
      setTimeout(startQueueListener, 5000);
    });
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// Returns start and end of "today" in IST (UTC+5:30) as UTC Date objects.
// The server runs in UTC on Render, but clinics are in India, so all "today"
// filters must use IST midnight boundaries or appointments booked after
// midnight IST (but still UTC-previous-day) will go missing.
function dayRangeIST(): { start: Date; end: Date } {
  const nowIST = new Date(Date.now() + IST_OFFSET_MS);
  const s = new Date(nowIST); s.setUTCHours(0, 0, 0, 0);
  const e = new Date(nowIST); e.setUTCHours(23, 59, 59, 999);
  return { start: new Date(s.getTime() - IST_OFFSET_MS), end: new Date(e.getTime() - IST_OFFSET_MS) };
}

// Given a "YYYY-MM-DD" calendar date, returns the [start, end] UTC instants bounding
// that IST calendar day — the SAME bucket appointments for that date must land in.
// Every place that assigns or looks up queueNumber/queuePosition "for a given date"
// goes through this (or istDateKey below) so desktop, kiosk, and preview requests
// always agree on which appointments share a day, regardless of the input's shape
// (a plain "YYYY-MM-DD" string vs. an already-resolved appointment.date instant).
function istDayRange(dateStr: string): { start: Date; end: Date } {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const start = new Date(Date.UTC(y, mo - 1, d) - IST_OFFSET_MS);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1) };
}

// Inverse of istDayRange: given an appointment's stored `date` instant, returns the
// "YYYY-MM-DD" IST calendar date it belongs to.
function istDateKey(instant: Date): string {
  return new Date(instant.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

// Extends a subscription/trial end date by one plan period. Renews from the existing
// end date when it's still in the future (a renewal before expiry keeps the paid-for
// remaining time instead of discarding it); otherwise renews from now.
function extendPlanEnd(currentEndsAt: Date | null | undefined, planType: string | null | undefined, days?: number): Date {
  const base = currentEndsAt && currentEndsAt > new Date() ? new Date(currentEndsAt) : new Date();
  if (days != null) base.setDate(base.getDate() + days);
  else if (planType === "quarterly") base.setMonth(base.getMonth() + 3);
  else if (planType === "annual") base.setFullYear(base.getFullYear() + 1);
  else base.setMonth(base.getMonth() + 1);
  return base;
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  setupAuth(app);
  startQueueListener();

  // ── PATIENTS ──────────────────────────────────────────────────────────────

  app.get(api.patients.list.path, requireAuth, async (req, res) => {
    try {
      const search = req.query.search as string | undefined;
      const status = req.query.status as string | undefined;
      const source = req.query.source as string | undefined;
      res.json(await storage(req).getPatients(search, { status, source }));
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to fetch patients" });
    }
  });

  app.patch("/api/patients/:id", requireAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      // Strip clinicId so callers cannot reassign a patient to another clinic
      const { clinicId: _cid, ...safeUpdates } = req.body;
      res.json(await storage(req).updatePatient(id, safeUpdates));
    } catch (err) {
      res.status(400).json({ message: "Failed to update patient" });
    }
  });

  app.delete("/api/patients/:id", requireAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid patient ID" });
      // Capture which doctors' queues this touches before the appointments are gone,
      // so their cached public boards/SSE clients get refreshed instead of going stale.
      const affectedDoctors = await db.selectDistinct({ doctorId: appointments.doctorId })
        .from(appointments)
        .where(and(eq(appointments.clinicId, req.session.clinicId!), eq(appointments.patientId, id)));
      await storage(req).deletePatient(id);
      affectedDoctors.forEach(d => broadcastQueueUpdate(d.doctorId));
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to delete patient" });
    }
  });

  app.post(api.patients.create.path, requireAuth, async (req, res) => {
    try {
      const input = api.patients.create.input.parse(req.body);
      res.status(201).json(await storage(req).createPatient(input));
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.get(api.patients.get.path, requireAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid patient ID" });
      const patient = await storage(req).getPatient(id);
      if (!patient) return res.status(404).json({ message: "Patient not found" });
      const patientAppts = await storage(req).getAppointments({ patientId: patient.id });
      res.json({ ...patient, appointments: patientAppts });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to fetch patient" });
    }
  });

  // ── DOCTORS ───────────────────────────────────────────────────────────────

  app.get(api.doctors.list.path, requireAuth, async (req, res) => {
    try {
      res.json(await storage(req).getDoctors());
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch doctors" });
    }
  });

  app.post(api.doctors.create.path, requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const { doctorProfile, ...userInput } = api.doctors.create.input.parse(req.body);
      res.status(201).json(await storage(req).createDoctor(userInput, doctorProfile));
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      console.error(err);
      res.status(500).json({ message: "Failed to create doctor" });
    }
  });

  app.put(api.doctors.updateProfile.path, requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const userId = req.params.id;
      // Confirm the doctor belongs to this clinic before updating
      const doctor = await storage(req).getUser(userId);
      if (!doctor) return res.status(404).json({ message: "Doctor not found" });
      const { name, ...profileUpdates } = req.body;
      if (name) await storage(req).updateUser(userId, { name });
      const updated = await storage(req).updateDoctorProfile(userId, profileUpdates);
      // avgConsultationTime/isAvailable are embedded in the cached public queue board
      // (used for "estimated wait"), so a profile edit must refresh it too.
      broadcastQueueUpdate(userId);
      res.json(updated);
    } catch (err) {
      res.status(400).json({ message: "Failed to update doctor profile" });
    }
  });

  app.delete("/api/doctors/:id", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const userId = req.params.id;
      const doctor = await storage(req).getUser(userId);
      if (!doctor) return res.status(404).json({ message: "Doctor not found" });
      await storage(req).deleteDoctor(userId);
      broadcastQueueUpdate(userId);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to delete doctor" });
    }
  });

  // ── APPOINTMENTS ──────────────────────────────────────────────────────────

  app.get(api.appointments.list.path, requireAuth, async (req, res) => {
    try {
      // new Date("YYYY-MM-DD") is parsed as UTC midnight, but appointments are
      // created from IST browsers and stored as IST midnight in UTC (18:30 UTC the
      // previous day).  Subtract the IST offset so the filter window starts at
      // IST midnight, matching what the browser stored.
      let date: Date | undefined;
      if (req.query.date) {
        const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
        date = new Date(new Date(req.query.date as string).getTime() - IST_OFFSET_MS);
      }
      const doctorId = req.query.doctorId as string | undefined;
      const status = req.query.status as string | undefined;
      const patientId = req.query.patientId ? Number(req.query.patientId) : undefined;
      res.json(await storage(req).getAppointments({ date, doctorId, status, patientId }));
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch appointments" });
    }
  });

  app.post(api.appointments.create.path, requireAuth, async (req, res) => {
    try {
      const data = api.appointments.create.input.parse(req.body);
      const appointmentDate = new Date(data.date);
      const todayStartIST = dayRangeIST().start;
      if (appointmentDate < todayStartIST && data.status !== "checked_in") {
        return res.status(400).json({ message: "Cannot book appointments in the past" });
      }

      // Verify patient and doctor both belong to this clinic
      const patient = await storage(req).getPatient(data.patientId);
      if (!patient) return res.status(403).json({ message: "Patient not found in this clinic" });
      const doctor = await storage(req).getUser(data.doctorId);
      if (!doctor || doctor.role !== "doctor") return res.status(403).json({ message: "Doctor not found in this clinic" });

      const [doctorProfile] = await db.select().from(doctorProfiles).where(eq(doctorProfiles.userId, data.doctorId));
      if (doctorProfile?.isAvailable === false) {
        const name = doctor.name || "This doctor";
        return res.status(400).json({ message: `Dr. ${name} is currently unavailable and not accepting appointments.` });
      }

      // Bucket by IST calendar day (not server-local setHours, which corrupts the
      // bucket whenever the server's TZ differs from IST — see istDayRange).
      const { start: apptDateOnly, end: apptEndOfDay } = istDayRange(istDateKey(appointmentDate));

      let appt: any;
      if (data.isQuickCheck) {
        appt = await storage(req).createAppointment({ ...data, queueNumber: null, queuePosition: null, queueToken: null } as any);
      } else {
        // Advisory lock on (clinicId, doctorId) serializes concurrent queue-position assignments
        // for the same doctor so two simultaneous requests never get identical positions.
        appt = await db.transaction(async (tx) => {
          await tx.execute(sql`SELECT pg_advisory_xact_lock(${req.session.clinicId!}::int, hashtext(${data.doctorId})::int)`);

          // Prevent duplicate bookings: check for an existing active appointment
          // for the same patient+doctor on the same calendar day. This catches
          // two tabs submitting simultaneously — the second one loses the lock and
          // sees the row the first one already inserted.
          const [existingAppt] = await tx.select({ id: appointments.id })
            .from(appointments)
            .where(and(
              eq(appointments.clinicId, req.session.clinicId!),
              eq(appointments.patientId, data.patientId),
              eq(appointments.doctorId, data.doctorId),
              gte(appointments.date, apptDateOnly),
              lte(appointments.date, apptEndOfDay),
              sql`${appointments.status} NOT IN ('cancelled', 'no_show', 'completed')`
            ));
          if (existingAppt) throw Object.assign(new Error("Duplicate"), { code: "DUPLICATE_APPOINTMENT" });

          const [maxRow] = await tx.select({
            maxNum: sql<number>`COALESCE(MAX(${appointments.queueNumber}), 0)::int`,
            maxPos: sql<number>`COALESCE(MAX(${appointments.queuePosition}), 0)::int`,
          }).from(appointments).where(and(
            eq(appointments.clinicId, req.session.clinicId!),
            eq(appointments.doctorId, data.doctorId),
            gte(appointments.date, apptDateOnly),
            lte(appointments.date, apptEndOfDay),
          ));
          const [row] = await tx.insert(appointments).values({
            ...data,
            clinicId: req.session.clinicId!,
            queueNumber: (maxRow?.maxNum ?? 0) + 1,
            queuePosition: (maxRow?.maxPos ?? 0) + 1,
            queueToken: nanoid(8),
          }).returning();
          return row!;
        });
      }
      if (appt?.doctorId) broadcastQueueUpdate(appt.doctorId);
      res.status(201).json(appt);
    } catch (err: any) {
      if (err?.code === "DUPLICATE_APPOINTMENT") return res.status(409).json({ message: "This patient already has an active appointment with this doctor on this date." });
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      console.error(err);
      res.status(500).json({ message: "Failed to create appointment" });
    }
  });

  app.patch(api.appointments.update.path, requireAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { clinicId: _cid, patientId: _pid, ...updates } = req.body;
      const clinicId = req.session.clinicId!;

      // Unlike creation (which validates doctorId belongs to this clinic), an update
      // could otherwise reassign an appointment to an arbitrary doctor id — including
      // one from a different clinic — so re-check it here too.
      if (updates.doctorId !== undefined) {
        const targetDoctor = await storage(req).getUser(updates.doctorId);
        if (!targetDoctor || targetDoctor.role !== "doctor") {
          return res.status(403).json({ message: "Doctor not found in this clinic" });
        }
      }

      // Drizzle's timestamp columns expect a Date instance, not the ISO string
      // that comes over the wire as JSON — coerce it or every reschedule 500s.
      if (updates.date !== undefined) {
        updates.date = new Date(updates.date);
      }

      // Build set-clause with COALESCE for timestamps so concurrent updates are idempotent:
      // the first writer wins and subsequent writers cannot overwrite an already-set timestamp.
      const setClause: any = { ...updates };
      if (updates.status === "checked_in") {
        setClause.checkInTime = sql`COALESCE(${appointments.checkInTime}, NOW())`;
      }
      if (updates.status === "in_progress") {
        setClause.consultationStartTime = sql`COALESCE(${appointments.consultationStartTime}, NOW())`;
      }
      if (updates.status === "completed") {
        setClause.completedAt = sql`NOW()`;
      }

      let updated: typeof appointments.$inferSelect | undefined;

      if (updates.date !== undefined) {
        // Rescheduling moves the appointment to a different day's queue, so it needs
        // a fresh queue number/position/token scoped to that day — otherwise the
        // patient's token is wiped and never replaced (dead queue link).
        updated = await db.transaction(async (tx) => {
          const [existing] = await tx.select().from(appointments)
            .where(and(eq(appointments.id, id), eq(appointments.clinicId, clinicId)));
          if (!existing) return undefined;

          const doctorId = existing.doctorId;
          await tx.execute(sql`SELECT pg_advisory_xact_lock(${clinicId}::int, hashtext(${doctorId})::int)`);

          const { start: dayStart, end: dayEnd } = istDayRange(istDateKey(updates.date));
          const [maxRow] = await tx.select({
            maxNum: sql<number>`COALESCE(MAX(${appointments.queueNumber}), 0)::int`,
            maxPos: sql<number>`COALESCE(MAX(${appointments.queuePosition}), 0)::int`,
          }).from(appointments).where(and(
            eq(appointments.clinicId, clinicId),
            eq(appointments.doctorId, doctorId),
            gte(appointments.date, dayStart),
            lte(appointments.date, dayEnd),
          ));

          setClause.queueNumber = (maxRow?.maxNum ?? 0) + 1;
          setClause.queuePosition = (maxRow?.maxPos ?? 0) + 1;
          setClause.queueToken = nanoid(8);
          // Clear stale timing fields from whatever day this appointment was on before
          if (setClause.checkInTime === undefined) setClause.checkInTime = null;
          if (setClause.consultationStartTime === undefined) setClause.consultationStartTime = null;
          if (setClause.completedAt === undefined) setClause.completedAt = null;

          const [row] = await tx.update(appointments)
            .set(setClause)
            .where(and(eq(appointments.id, id), eq(appointments.clinicId, clinicId)))
            .returning();
          return row;
        });
      } else {
        const [row] = await db.update(appointments)
          .set(setClause)
          .where(and(eq(appointments.id, id), eq(appointments.clinicId, clinicId)))
          .returning();
        updated = row;
      }

      if (!updated) return res.status(404).json({ message: "Appointment not found" });

      if (updates.status === "completed") {
        await db.update(patients)
          .set({ status: "active", funnelStage: "consulted", lastContactedAt: new Date() })
          .where(and(eq(patients.id, updated.patientId), eq(patients.clinicId, clinicId)));
      }

      if (updated.doctorId) broadcastQueueUpdate(updated.doctorId);
      res.json(updated);
    } catch (err) {
      console.error("Failed to update appointment:", err);
      res.status(400).json({ message: "Failed to update appointment" });
    }
  });

  app.delete("/api/appointments/:id", requireAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const clinicId = req.session.clinicId!;
      const [existing] = await db.select({ doctorId: appointments.doctorId })
        .from(appointments)
        .where(and(eq(appointments.id, id), eq(appointments.clinicId, clinicId)));
      await storage(req).deleteAppointment(id);
      if (existing?.doctorId) broadcastQueueUpdate(existing.doctorId);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ message: "Failed to delete appointment" });
    }
  });

  // GET /api/appointments/queue-preview — next queue number for a doctor+date (auth required)
  app.get("/api/appointments/queue-preview", requireAuth, async (req, res) => {
    try {
      const { doctorId, date: dateParam } = req.query as { doctorId?: string; date?: string };
      if (!doctorId || !dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
        return res.status(400).json({ message: "doctorId and a valid date (YYYY-MM-DD) are required" });
      }

      const clinicId = req.session.clinicId!;
      // Same IST-day bucket the create/reschedule handlers use, so this preview always
      // matches the queue number actually assigned when the appointment is booked.
      const { start: targetStart, end: targetEnd } = istDayRange(dateParam);

      const [maxRow] = await db.select({
        maxNum: sql<number>`COALESCE(MAX(${appointments.queueNumber}), 0)::int`,
      }).from(appointments).where(and(
        eq(appointments.clinicId, clinicId),
        eq(appointments.doctorId, doctorId),
        gte(appointments.date, targetStart),
        lte(appointments.date, targetEnd),
      ));

      const [activeRow] = await db.select({
        activeCount: sql<number>`COUNT(*)::int`,
      }).from(appointments).where(and(
        eq(appointments.clinicId, clinicId),
        eq(appointments.doctorId, doctorId),
        gte(appointments.date, targetStart),
        lte(appointments.date, targetEnd),
        inArray(appointments.status, ["booked", "checked_in"]),
      ));

      res.json({
        nextQueueNumber: (maxRow?.maxNum ?? 0) + 1,
        activeAhead: activeRow?.activeCount ?? 0,
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to get queue preview" });
    }
  });

  // ── QUEUE REORDER ─────────────────────────────────────────────────────────

  app.patch("/api/queue/reorder", requireAuth, async (req, res) => {
    try {
      const { orderedAppointmentIds } = req.body;
      if (
        !Array.isArray(orderedAppointmentIds) ||
        orderedAppointmentIds.length === 0 ||
        !orderedAppointmentIds.every((id: unknown) => Number.isInteger(id)) ||
        new Set(orderedAppointmentIds).size !== orderedAppointmentIds.length
      ) {
        return res.status(400).json({ message: "orderedAppointmentIds must be a non-empty array of unique integers" });
      }

      const clinicId = req.session.clinicId!;
      let doctorId: string | null = null;
      let validationError: string | null = null;

      await db.transaction(async (tx) => {
        const existing = await tx
          .select({ id: appointments.id, queuePosition: appointments.queuePosition, doctorId: appointments.doctorId })
          .from(appointments)
          .where(and(
            inArray(appointments.id, orderedAppointmentIds),
            eq(appointments.clinicId, clinicId)
          ));

        // Every id must resolve within this clinic, and all must belong to the same
        // doctor — otherwise the position-pool reassignment below would merge two
        // different doctors' queues and corrupt both.
        if (existing.length !== orderedAppointmentIds.length) {
          validationError = "One or more appointments were not found";
          return;
        }
        const doctorIds = new Set(existing.map(a => a.doctorId));
        if (doctorIds.size > 1) {
          validationError = "All appointments must belong to the same doctor";
          return;
        }
        doctorId = existing[0].doctorId;

        // Same advisory lock used everywhere else queue positions are assigned, so a
        // reorder can never interleave with a concurrent create/reschedule/reorder for
        // this doctor and produce duplicate positions.
        await tx.execute(sql`SELECT pg_advisory_xact_lock(${clinicId}::int, hashtext(${doctorId})::int)`);

        // Re-use the same pool of position values (sorted) and re-assign them
        // to the new order so no other patients' positions are displaced.
        const sortedPositions = existing
          .map(a => a.queuePosition ?? 0)
          .sort((a, b) => a - b);

        for (let i = 0; i < orderedAppointmentIds.length; i++) {
          await tx.update(appointments)
            .set({ queuePosition: sortedPositions[i] })
            .where(and(
              eq(appointments.id, orderedAppointmentIds[i]),
              eq(appointments.clinicId, clinicId)
            ));
        }
      });

      if (validationError) return res.status(400).json({ message: validationError });

      // Push real-time update to all SSE clients watching this doctor's queue
      if (doctorId) broadcastQueueUpdate(doctorId);

      res.json({ success: true });
    } catch (err) {
      console.error("reorder error:", err);
      res.status(500).json({ message: "Failed to reorder queue" });
    }
  });

  // ── PUBLIC QUEUE (no auth) ────────────────────────────────────────────────

  // Resolves a patient's private token to their own identity + static booking info.
  // Fetched once per page load (not polled) — live queue position/status is derived
  // client-side from the shared /api/public-queue/:doctorId board instead, so this
  // no longer needs to scan the doctor's full day of appointments per request.
  app.get("/api/queue/:token", async (req, res) => {
    try {
      const token = req.params.token;
      const { start: today } = dayRangeIST();

      const result = await db.transaction(async (tx) => {
        const [appt] = await tx.select().from(appointments).where(eq(appointments.queueToken, token));
        if (!appt) return null;

        // Always scope patient and doctor to the appointment's own clinic
        const [patient] = await tx.select().from(patients)
          .where(and(eq(patients.id, appt.patientId), eq(patients.clinicId, appt.clinicId!)));
        const [doctor] = await tx.select().from(users)
          .where(and(eq(users.id, appt.doctorId), eq(users.clinicId, appt.clinicId!)));
        if (!patient || !doctor) return null;

        // Link expires when appointment date is before today's IST calendar day and not
        // yet completed. Compare the raw instant directly against today's IST-midnight
        // boundary — do NOT re-zero it with setHours(), which resets to the server's
        // local time (UTC) and silently misclassifies same-day IST appointments as
        // expired depending on what time they were booked (the exact bug this replaced).
        const expired = new Date(appt.date) < today && appt.status !== "completed";

        return {
          id: appt.id,
          expired,
          patientName: patient.name,
          doctorName: doctor.name || doctor.firstName || "Doctor",
          doctorId: appt.doctorId,
          status: appt.status,
          queueNumber: appt.queueNumber,
          queuePosition: appt.queuePosition,
        };
      });

      if (!result) return res.status(404).json({ message: "Queue not found" });
      res.json(result);
    } catch (err) {
      res.status(500).json({ message: "Failed to get queue status" });
    }
  });

  // ── PUBLIC DOCTOR QUEUE DISPLAY ───────────────────────────────────────────

  app.get("/api/public-queue/:doctorId", async (req, res) => {
    try {
      const doctorId = req.params.doctorId;

      const cached = publicQueueCache.get(doctorId);
      if (cached && Date.now() - cached.ts < PUBLIC_QUEUE_CACHE_TTL_MS) {
        return res.json(cached.data);
      }

      const { start: today, end: endOfDay } = dayRangeIST();

      // Explicit column projection — this is a no-auth endpoint read by every patient's
      // browser and the waiting-room TV, so it must never leak passwordHash/email
      // (bare `.select()` on `users` pulls every column) or, on the appointments side,
      // each patient's private queueToken/reason/notes/vitals.
      const [doctorRow] = await db.select({
        id: users.id,
        name: users.name,
        firstName: users.firstName,
        lastName: users.lastName,
        clinicId: users.clinicId,
        specialization: doctorProfiles.specialization,
        avgConsultationTime: doctorProfiles.avgConsultationTime,
      }).from(users)
        .leftJoin(doctorProfiles, eq(doctorProfiles.userId, users.id))
        .where(and(eq(users.id, doctorId), eq(users.role, "doctor")));
      if (!doctorRow) return res.status(404).json({ message: "Doctor not found" });

      const clinicId = doctorRow.clinicId!;
      const todaysAppts = await db.select({
        id: appointments.id,
        queueNumber: appointments.queueNumber,
        queuePosition: appointments.queuePosition,
        status: appointments.status,
        patientName: patients.name,
      }).from(appointments)
        .leftJoin(patients, and(eq(patients.id, appointments.patientId), eq(patients.clinicId, clinicId)))
        .where(and(
          eq(appointments.doctorId, doctorId),
          eq(appointments.clinicId, clinicId),
          gte(appointments.date, today),
          lte(appointments.date, endOfDay)
        ))
        .orderBy(appointments.queuePosition);

      const payload = {
        doctor: {
          id: doctorRow.id,
          name: doctorRow.name,
          firstName: doctorRow.firstName,
          lastName: doctorRow.lastName,
          doctorProfile: { specialization: doctorRow.specialization, avgConsultationTime: doctorRow.avgConsultationTime },
        },
        queue: todaysAppts.map(r => ({
          id: r.id,
          queueNumber: r.queueNumber,
          queuePosition: r.queuePosition,
          status: r.status,
          patientName: r.patientName || "Patient",
        })),
      };
      publicQueueCache.set(doctorId, { data: payload, ts: Date.now() });
      res.json(payload);
    } catch (err) {
      res.status(500).json({ message: "Failed to get public queue" });
    }
  });

  // ── SSE ENDPOINT (real-time queue updates, no auth required) ─────────────

  app.get("/api/sse/doctor/:doctorId", (req, res) => {
    const { doctorId } = req.params;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering
    res.flushHeaders();

    // Initial connection confirmation
    res.write("data: connected\n\n");

    if (!sseClients.has(doctorId)) sseClients.set(doctorId, new Set());
    sseClients.get(doctorId)!.add(res);

    // Keepalive ping every 25 seconds to prevent proxy/browser timeouts
    const ping = setInterval(() => {
      try { res.write(": ping\n\n"); } catch { clearInterval(ping); }
    }, 25000);

    req.on("close", () => {
      clearInterval(ping);
      sseClients.get(doctorId)?.delete(res);
    });
  });

  // ── NOTIFY DELAY ──────────────────────────────────────────────────────────

  app.post("/api/doctors/:id/delay", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const doctorId = req.params.id;
      const { delayMinutes } = req.body;
      const { start: today, end: endOfDay } = dayRangeIST();

      const waitingAppts = await db.select().from(appointments)
        .where(and(
          eq(appointments.clinicId, req.session.clinicId!),
          eq(appointments.doctorId, doctorId),
          eq(appointments.status, "checked_in"),
          gte(appointments.date, today),
          lte(appointments.date, endOfDay),
        ));

      let notifiedCount = 0;
      for (const appt of waitingAppts) {
        await db.insert(notifications).values({
          clinicId: req.session.clinicId!,
          patientId: appt.patientId,
          type: "delay_notification",
          message: `Your doctor will be delayed by approximately ${delayMinutes} minutes.`,
        });
        notifiedCount++;
      }
      res.json({ success: true, notifiedCount });
    } catch (err) {
      res.status(500).json({ message: "Failed to send notifications" });
    }
  });

  // ── DOCTOR CONSOLE ────────────────────────────────────────────────────────
  // GET /api/doctor-console/:doctorId — aggregated view for the doctor's active console
  // Returns current in_progress patient (full detail) + today's queue overview

  app.get("/api/doctor-console/:doctorId", requireAuth, async (req, res) => {
    try {
      const { doctorId } = req.params;
      const clinicId = req.session.clinicId!;
      const { start: today, end: endOfDay } = dayRangeIST();

      // Fetch doctor info
      const [doctorRow] = await db.select().from(users)
        .leftJoin(doctorProfiles, eq(doctorProfiles.userId, users.id))
        .where(and(eq(users.id, doctorId), eq(users.clinicId, clinicId)));
      if (!doctorRow) return res.status(404).json({ message: "Doctor not found" });

      // Fetch today's full queue for this doctor
      const todayQueue = await db.select().from(appointments)
        .leftJoin(patients, and(eq(patients.id, appointments.patientId), eq(patients.clinicId, clinicId)))
        .where(and(
          eq(appointments.doctorId, doctorId),
          eq(appointments.clinicId, clinicId),
          gte(appointments.date, today),
          lte(appointments.date, endOfDay),
        ))
        .orderBy(appointments.queuePosition);

      // Current patient is the first in_progress appointment
      const currentRow = todayQueue.find(r => r.appointments.status === "in_progress");

      let currentAppointment: any = null;
      if (currentRow) {
        const appt = currentRow.appointments;
        const patient = currentRow.patients;

        // Fetch prescription for this appointment
        const [prescription] = await db.select().from(prescriptions)
          .where(and(eq(prescriptions.appointmentId, appt.id), eq(prescriptions.clinicId, clinicId)));

        // Bill for this specific visit, plus this patient's total outstanding balance
        // across all their bills — the doctor console had no billing visibility at
        // all before this, so a doctor had no way to know a patient hadn't paid, or
        // was carrying dues from an earlier visit.
        const [currentBill] = await db.select({ id: bills.id, amount: bills.amount, status: bills.status })
          .from(bills)
          .where(and(eq(bills.appointmentId, appt.id), eq(bills.clinicId, clinicId)));
        const [pendingRow] = await db.select({ total: sql<number>`COALESCE(SUM(${bills.amount}), 0)::int` })
          .from(bills)
          .where(and(eq(bills.patientId, appt.patientId), eq(bills.clinicId, clinicId), eq(bills.status, "pending")));

        // Past encounters: appointments joined with prescriptions (left join so visits without Rx still appear)
        const pastEncounterRows = await db.select({
          appointmentId: appointments.id,
          date: appointments.date,
          status: appointments.status,
          reason: appointments.reason,
          vitals: appointments.vitals,
          prescriptionId: prescriptions.id,
          chiefComplaints: prescriptions.chiefComplaints,
          diagnosis: prescriptions.diagnosis,
          medications: prescriptions.medications,
          rxNotes: prescriptions.notes,
          prescriptionCreatedAt: prescriptions.createdAt,
        }).from(appointments)
          .leftJoin(prescriptions, and(
            eq(prescriptions.appointmentId, appointments.id),
            eq(prescriptions.clinicId, clinicId),
          ))
          .where(and(
            eq(appointments.patientId, appt.patientId),
            eq(appointments.clinicId, clinicId),
            sql`${appointments.id} != ${appt.id}`,
            sql`${appointments.status} IN ('completed', 'in_progress')`,
          ))
          .orderBy(desc(appointments.date))
          .limit(15);

        currentAppointment = {
          id: appt.id,
          queueNumber: appt.queueNumber,
          queueToken: appt.queueToken,
          reason: appt.reason,
          notes: appt.notes,
          consultationStartTime: appt.consultationStartTime,
          checkInTime: appt.checkInTime,
          vitals: appt.vitals,
          status: appt.status,
          bill: currentBill || null,
          patientPendingTotal: pendingRow?.total ?? 0,
          patient: patient ? {
            id: patient.id,
            name: patient.name,
            phone: patient.phone,
            email: patient.email,
            dateOfBirth: patient.dateOfBirth,
            gender: patient.gender,
            bloodGroup: patient.bloodGroup,
            allergies: patient.allergies,
            address: patient.address,
          } : null,
          prescription: prescription || null,
          pastEncounters: pastEncounterRows,
          pastVisitsCount: pastEncounterRows.length,
        };
      }

      // Queue overview (all statuses for today)
      const queueOverview = todayQueue.map(r => ({
        id: r.appointments.id,
        queueNumber: r.appointments.queueNumber,
        queuePosition: r.appointments.queuePosition,
        status: r.appointments.status,
        patientName: r.patients?.name || "Patient",
        checkInTime: r.appointments.checkInTime,
        consultationStartTime: r.appointments.consultationStartTime,
      }));

      const waitingCount = todayQueue.filter(r =>
        r.appointments.status === "booked" || r.appointments.status === "checked_in"
      ).length;

      res.json({
        doctor: {
          id: doctorRow.users.id,
          name: doctorRow.users.name || `${doctorRow.users.firstName || ""} ${doctorRow.users.lastName || ""}`.trim(),
          specialization: doctorRow.doctor_profiles?.specialization,
          avgConsultationTime: doctorRow.doctor_profiles?.avgConsultationTime,
        },
        currentAppointment,
        queue: queueOverview,
        waitingCount,
      });
    } catch (err) {
      console.error("[doctor-console]", err);
      res.status(500).json({ message: "Failed to fetch doctor console data" });
    }
  });

  // ── BILLING ───────────────────────────────────────────────────────────────

  app.get("/api/bills", requireAuth, async (req, res) => {
    try {
      const patientId = req.query.patientId ? Number(req.query.patientId) : undefined;
      const appointmentId = req.query.appointmentId ? Number(req.query.appointmentId) : undefined;
      res.json(await storage(req).getBills({ patientId, appointmentId }));
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch bills" });
    }
  });

  app.post("/api/bills", requireAuth, async (req, res) => {
    try {
      const data = insertBillSchema.parse(req.body);
      const appt = await storage(req).getAppointment(data.appointmentId);
      if (!appt) return res.status(403).json({ message: "Appointment not found in this clinic" });
      // The patientId on the bill must match the appointment's own patient — otherwise
      // an unrelated (or cross-clinic) patientId in the request body would silently
      // misattribute this bill's billing history to the wrong patient.
      if (data.patientId !== appt.patientId) {
        return res.status(400).json({ message: "patientId does not match the appointment's patient" });
      }
      res.status(201).json(await storage(req).createBill(data));
    } catch (err: any) {
      // PostgreSQL unique_violation — bills have a unique index on appointmentId
      if (err?.code === "23505") return res.status(409).json({ message: "A bill already exists for this appointment" });
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(400).json({ message: "Failed to create bill" });
    }
  });

  app.get("/api/bills/:id", requireAuth, async (req, res) => {
    try {
      const bill = await storage(req).getBill(Number(req.params.id));
      if (!bill) return res.status(404).json({ message: "Bill not found" });
      res.json(bill);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch bill" });
    }
  });

  app.patch("/api/bills/:id", requireAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { status, paymentMethod, notes } = req.body;
      const [updated] = await db.update(bills)
        .set({ status, paymentMethod, notes })
        .where(and(eq(bills.id, id), eq(bills.clinicId, req.session.clinicId!)))
        .returning();
      if (!updated) return res.status(404).json({ message: "Bill not found" });
      res.json(updated);
    } catch (err) {
      res.status(400).json({ message: "Failed to update bill" });
    }
  });

  // ── PRESCRIPTIONS ─────────────────────────────────────────────────────────

  app.get("/api/prescriptions", requireAuth, async (req, res) => {
    try {
      const appointmentId = req.query.appointmentId ? Number(req.query.appointmentId) : undefined;
      const patientId = req.query.patientId ? Number(req.query.patientId) : undefined;
      res.json(await storage(req).getPrescriptions({ appointmentId, patientId }));
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch prescriptions" });
    }
  });

  app.post("/api/prescriptions", requireAuth, async (req, res) => {
    try {
      const data = insertPrescriptionSchema.parse(req.body);
      // Verify the appointment belongs to this clinic
      const appt = await storage(req).getAppointment(data.appointmentId);
      if (!appt) return res.status(403).json({ message: "Appointment not found in this clinic" });
      res.status(201).json(await storage(req).createPrescription(data));
    } catch (err: any) {
      if (err?.code === "23505") return res.status(409).json({ message: "A prescription already exists for this appointment" });
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(400).json({ message: "Failed to create prescription" });
    }
  });

  // PATCH /api/prescriptions/:id — update an existing prescription
  app.patch("/api/prescriptions/:id", requireAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { chiefComplaints, diagnosis, medications, notes } = req.body;
      const [row] = await db.update(prescriptions)
        .set({
          chiefComplaints: chiefComplaints?.trim() || null,
          diagnosis: diagnosis?.trim() || null,
          medications: medications || [],
          notes: notes?.trim() || null,
        })
        .where(and(eq(prescriptions.id, id), eq(prescriptions.clinicId, req.session.clinicId!)))
        .returning();
      if (!row) return res.status(404).json({ message: "Prescription not found" });
      res.json(row);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to update prescription" });
    }
  });

  // DELETE /api/prescriptions/:id — delete a prescription
  app.delete("/api/prescriptions/:id", requireAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const [deleted] = await db.delete(prescriptions)
        .where(and(eq(prescriptions.id, id), eq(prescriptions.clinicId, req.session.clinicId!)))
        .returning();
      if (!deleted) return res.status(404).json({ message: "Prescription not found" });
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to delete prescription" });
    }
  });

  // ── DENTAL CHART ──────────────────────────────────────────────────────────
  // Opt-in module — gated client-side on clinic_settings["modules"].dental so it stays
  // invisible to the non-dental clinics that make up most of this app's user base.

  app.get("/api/dental-charts/:patientId", requireAuth, async (req, res) => {
    try {
      const patientId = Number(req.params.patientId);
      const [patient] = await db.select().from(patients)
        .where(and(eq(patients.id, patientId), eq(patients.clinicId, req.session.clinicId!)));
      if (!patient) return res.status(404).json({ message: "Patient not found" });
      const chart = await storage(req).getDentalChart(patientId);
      res.json(chart || { patientId, dentitionType: "permanent", teeth: {}, treatmentLog: [], notes: null });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch dental chart" });
    }
  });

  app.put("/api/dental-charts/:patientId", requireAuth, async (req, res) => {
    try {
      const patientId = Number(req.params.patientId);
      const [patient] = await db.select().from(patients)
        .where(and(eq(patients.id, patientId), eq(patients.clinicId, req.session.clinicId!)));
      if (!patient) return res.status(404).json({ message: "Patient not found" });
      const data = insertDentalChartSchema.omit({ clinicId: true, patientId: true }).partial().parse(req.body);
      const chart = await storage(req).upsertDentalChart(patientId, data);
      res.json(chart);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Failed to save dental chart" });
    }
  });

  // ── ORTHO / PHYSIO BODY CHART ─────────────────────────────────────────────
  // Opt-in module — gated client-side on clinic_settings["modules"].ortho, same pattern as dental.

  app.get("/api/body-charts/:patientId", requireAuth, async (req, res) => {
    try {
      const patientId = Number(req.params.patientId);
      const [patient] = await db.select().from(patients)
        .where(and(eq(patients.id, patientId), eq(patients.clinicId, req.session.clinicId!)));
      if (!patient) return res.status(404).json({ message: "Patient not found" });
      const chart = await storage(req).getBodyChart(patientId);
      res.json(chart || { patientId, regions: {}, treatmentLog: [], notes: null });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch body chart" });
    }
  });

  app.put("/api/body-charts/:patientId", requireAuth, async (req, res) => {
    try {
      const patientId = Number(req.params.patientId);
      const [patient] = await db.select().from(patients)
        .where(and(eq(patients.id, patientId), eq(patients.clinicId, req.session.clinicId!)));
      if (!patient) return res.status(404).json({ message: "Patient not found" });
      const data = insertBodyChartSchema.omit({ clinicId: true, patientId: true }).partial().parse(req.body);
      const chart = await storage(req).upsertBodyChart(patientId, data);
      res.json(chart);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Failed to save body chart" });
    }
  });

  // ── DASHBOARD ─────────────────────────────────────────────────────────────

  app.get(api.dashboard.stats.path, requireAuth, async (req, res) => {
    try {
      const rangeParam = (req.query.range as string) || "today";
      let dashboardRange: { start: Date | null; end: Date | null };
      if (rangeParam === "all") {
        dashboardRange = { start: null, end: null };
      } else if (rangeParam === "yesterday") {
        const { start: todayStart } = dayRangeIST();
        dashboardRange = istDayRange(istDateKey(new Date(todayStart.getTime() - 1)));
      } else if (rangeParam === "week") {
        const { start: todayStart, end: todayEnd } = dayRangeIST();
        dashboardRange = { start: new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000), end: todayEnd };
      } else if (rangeParam === "month") {
        const { start: todayStart, end: todayEnd } = dayRangeIST();
        const nowIST = new Date(Date.now() + IST_OFFSET_MS);
        const monthStart = new Date(Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), 1) - IST_OFFSET_MS);
        dashboardRange = { start: monthStart, end: todayEnd };
      } else {
        dashboardRange = dayRangeIST();
      }
      res.json(await storage(req).getDashboardStats(dashboardRange));
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // ── CRM ───────────────────────────────────────────────────────────────────

  app.post("/api/crm/send-bulk", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const { patientIds, message, channel } = req.body;

      if (!Array.isArray(patientIds) || patientIds.length === 0) {
        return res.status(400).json({ message: "Select at least one patient" });
      }
      if (!message?.trim()) {
        return res.status(400).json({ message: "Message cannot be empty" });
      }
      if (!["whatsapp", "sms"].includes(channel)) {
        return res.status(400).json({ message: "Invalid channel" });
      }

      // Read real credentials from clinic settings
      const settings = (await storage(req).getSetting(channel)) as Record<string, any> | null;
      if (!settings?.enabled) {
        const label = channel === "whatsapp" ? "WhatsApp" : "SMS";
        return res.status(400).json({
          message: `${label} is not configured. Go to Settings → ${label} API, enter your credentials and toggle it on.`,
        });
      }

      let sentCount = 0;
      const failures: string[] = [];

      for (const id of patientIds) {
        const [patient] = await db.select().from(patients)
          .where(and(eq(patients.id, Number(id)), eq(patients.clinicId, req.session.clinicId!)));
        if (!patient) continue;

        const msg = message.replace(/{name}/g, patient.name);
        const digits = patient.phone.replace(/\D/g, "");
        const intlPhone = digits.length === 10 ? `91${digits}` : digits;

        try {
          if (channel === "whatsapp") {
            await sendWhatsAppMessage(settings, intlPhone, msg, req.session.clinicId!);
          } else {
            await sendSmsMessage(settings, intlPhone, msg);
          }
          await db.insert(notifications).values({
            clinicId: req.session.clinicId!,
            patientId: patient.id,
            type: `${channel}_marketing`,
            message: msg,
          });
          sentCount++;
        } catch (sendErr: any) {
          failures.push(`${patient.name}: ${sendErr.message || "send failed"}`);
        }
      }

      if (sentCount === 0 && failures.length > 0) {
        return res.status(502).json({ message: failures[0] });
      }

      res.json({ success: true, count: sentCount, failures });
    } catch (err) {
      console.error("[CRM send-bulk]", err);
      res.status(500).json({ message: "Failed to send bulk messages" });
    }
  });

  async function sendWhatsAppMessage(settings: Record<string, any>, phone: string, message: string, clinicId?: number) {
    const { provider, accessToken, phoneNumberId } = settings;

    if (provider === "web") {
      if (!clinicId) throw new Error("Clinic ID required for WhatsApp Web");
      await waWeb.sendMessage(clinicId, phone, message);
      return;
    }

    if (!accessToken || !phoneNumberId) {
      throw new Error("WhatsApp Access Token and Phone Number ID are required in Settings");
    }

    if (!provider || provider === "meta") {
      const r = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phone,
          type: "text",
          text: { body: message, preview_url: false },
        }),
      });
      if (!r.ok) {
        const err: any = await r.json().catch(() => ({}));
        throw new Error(err?.error?.message || `WhatsApp API error ${r.status}`);
      }
      return;
    }

    if (provider === "twilio") {
      const { accountSid } = settings;
      if (!accountSid) throw new Error("Twilio Account SID is required");
      const r = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: "Basic " + Buffer.from(`${accountSid}:${accessToken}`).toString("base64"),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            From: `whatsapp:+${settings.fromNumber || phoneNumberId}`,
            To: `whatsapp:+${phone}`,
            Body: message,
          }).toString(),
        }
      );
      if (!r.ok) {
        const err: any = await r.json().catch(() => ({}));
        throw new Error(err?.message || `Twilio error ${r.status}`);
      }
      return;
    }

    throw new Error(`WhatsApp provider "${provider}" is not supported yet`);
  }

  async function sendSmsMessage(settings: Record<string, any>, phone: string, message: string) {
    const { provider, apiKey, senderId } = settings;

    if (!apiKey) throw new Error("SMS API Key is required in Settings");

    if (!provider || provider === "msg91") {
      const r = await fetch("https://api.msg91.com/api/v2/sendsms", {
        method: "POST",
        headers: {
          authkey: apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sender: senderId || "BRIQ",
          route: "4",
          country: "91",
          sms: [{ message, to: [phone] }],
        }),
      });
      if (!r.ok) throw new Error(`MSG91 error ${r.status}`);
      return;
    }

    if (provider === "fast2sms") {
      const r = await fetch("https://www.fast2sms.com/dev/bulkV2", {
        method: "POST",
        headers: {
          authorization: apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          route: "q",
          message,
          language: "english",
          flash: 0,
          numbers: phone.replace(/^91/, ""),
        }),
      });
      if (!r.ok) throw new Error(`Fast2SMS error ${r.status}`);
      return;
    }

    if (provider === "textlocal") {
      const r = await fetch("https://api.textlocal.in/send/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          apikey: apiKey,
          numbers: phone,
          message,
          sender: senderId || "TXTLCL",
        }).toString(),
      });
      if (!r.ok) throw new Error(`Textlocal error ${r.status}`);
      return;
    }

    if (provider === "twilio") {
      const { accountSid, fromNumber } = settings;
      if (!accountSid) throw new Error("Twilio Account SID is required");
      const r = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: "Basic " + Buffer.from(`${accountSid}:${apiKey}`).toString("base64"),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            From: fromNumber || "",
            To: `+${phone}`,
            Body: message,
          }).toString(),
        }
      );
      if (!r.ok) {
        const err: any = await r.json().catch(() => ({}));
        throw new Error(err?.message || `Twilio SMS error ${r.status}`);
      }
      return;
    }

    throw new Error(`SMS provider "${provider}" is not supported yet`);
  }

  // ── PATIENT SELF-REGISTRATION (kiosk / QR walk-in) ───────────────────────

  // GET  /api/kiosk/:token  — clinic info + available doctors for the form (no auth)
  // Accepts optional ?date=YYYY-MM-DD to load slots for a specific date (defaults to today).
  app.get("/api/kiosk/:token", async (req, res) => {
    try {
      const { token } = req.params;

      // Find the clinic that owns this registration token using SQL filter (avoids full table scan)
      const [tokenRow] = await db.select().from(clinicSettings)
        .where(and(
          eq(clinicSettings.key, "registrationToken"),
          sql`${clinicSettings.value}::text = ${JSON.stringify(token)}`
        ));
      if (!tokenRow) return res.status(404).json({ message: "Invalid registration link" });

      const clinicId = tokenRow.clinicId;

      const [profileRow] = await db.select().from(clinicSettings)
        .where(and(eq(clinicSettings.clinicId, clinicId), eq(clinicSettings.key, "clinicProfile")));
      const profile = (profileRow?.value as any) || {};

      // Determine the target date — default to today (IST), clamp past dates to today
      const todayMidnight = dayRangeIST().start;
      let targetDate: Date;
      const dateParam = req.query.date as string | undefined;
      if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
        const [y, mo, d] = dateParam.split("-").map(Number);
        targetDate = new Date(Date.UTC(y, mo - 1, d));
        if (targetDate < todayMidnight) targetDate = new Date(todayMidnight);
      } else {
        targetDate = new Date(todayMidnight);
      }

      const dayName = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][targetDate.getDay()];

      const doctorRows = await db.select().from(users)
        .leftJoin(doctorProfiles, eq(doctorProfiles.userId, users.id))
        .where(and(eq(users.clinicId, clinicId), eq(users.role, "doctor")));

      const list = doctorRows.map(r => {
        const avail = (r.doctor_profiles?.availability as any)?.[dayName];
        const availableToday = avail?.enabled === true && (r.doctor_profiles?.isAvailable !== false);
        return {
          id: r.users.id,
          name: r.users.name || [r.users.firstName, r.users.lastName].filter(Boolean).join(" ") || "Doctor",
          specialization: r.doctor_profiles?.specialization || "General Physician",
          availableToday,
        };
      }).filter(d => d.availableToday);

      res.json({
        clinic: { name: profile.clinicName || "Clinic", tagline: profile.tagline || null, address: profile.address || null },
        doctors: list,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to load registration info" });
    }
  });

  // GET /api/kiosk/:token/queue-preview — returns the next queue number for a doctor+date (no auth)
  app.get("/api/kiosk/:token/queue-preview", async (req, res) => {
    try {
      const { token } = req.params;
      const { doctorId, date: dateParam } = req.query as { doctorId?: string; date?: string };
      if (!doctorId) return res.status(400).json({ message: "doctorId is required" });

      const [tokenRow] = await db.select().from(clinicSettings)
        .where(and(
          eq(clinicSettings.key, "registrationToken"),
          sql`${clinicSettings.value}::text = ${JSON.stringify(token)}`
        ));
      if (!tokenRow) return res.status(404).json({ message: "Invalid registration link" });
      const clinicId = tokenRow.clinicId;

      // Same IST-day bucket the kiosk registration handler below (and desktop
      // create/reschedule) use, so this preview always matches the number actually
      // assigned — and the same bucket a walk-in registered after midnight IST lands in.
      const { start: todayStartIST } = dayRangeIST();
      const dateKey = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : istDateKey(new Date());
      const requestedRange = istDayRange(dateKey);
      const { start: targetStart, end: targetEnd } = requestedRange.start < todayStartIST
        ? dayRangeIST()
        : requestedRange;

      const [maxRow] = await db.select({
        maxNum: sql<number>`COALESCE(MAX(${appointments.queueNumber}), 0)::int`,
      }).from(appointments).where(and(
        eq(appointments.clinicId, clinicId),
        eq(appointments.doctorId, doctorId),
        gte(appointments.date, targetStart),
        lte(appointments.date, targetEnd),
      ));

      // Count only patients still actively waiting — this is the real "ahead of you" number
      const [activeRow] = await db.select({
        activeCount: sql<number>`COUNT(*)::int`,
      }).from(appointments).where(and(
        eq(appointments.clinicId, clinicId),
        eq(appointments.doctorId, doctorId),
        gte(appointments.date, targetStart),
        lte(appointments.date, targetEnd),
        inArray(appointments.status, ["booked", "checked_in"]),
      ));

      res.json({
        nextQueueNumber: (maxRow?.maxNum ?? 0) + 1,
        activeAhead: activeRow?.activeCount ?? 0,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to get queue preview" });
    }
  });

  // GET /api/kiosk/:token/lookup?phone=... — returns existing patient names for this phone (no auth, names only)
  app.get("/api/kiosk/:token/lookup", async (req, res) => {
    try {
      const { token } = req.params;
      const phone = req.query.phone as string;
      if (!phone) return res.json({ patients: [] });
      const digits = phone.replace(/\D/g, "").slice(-10);
      if (digits.length < 10) return res.json({ patients: [] });

      const [tokenRow] = await db.select().from(clinicSettings)
        .where(and(
          eq(clinicSettings.key, "registrationToken"),
          sql`${clinicSettings.value}::text = ${JSON.stringify(token)}`
        ));
      if (!tokenRow) return res.json({ patients: [] });

      const matches = await db.select({ id: patients.id, name: patients.name })
        .from(patients)
        .where(and(
          eq(patients.clinicId, tokenRow.clinicId),
          sql`RIGHT(REGEXP_REPLACE(${patients.phone}, '[^0-9]', '', 'g'), 10) = ${digits}`
        ));

      res.json({ patients: matches.map(p => ({ id: p.id, name: p.name })) });
    } catch (err) {
      console.error(err);
      res.json({ patients: [] });
    }
  });

  // POST /api/kiosk/:token  — register patient + create appointment (no auth)
  app.post("/api/kiosk/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const { name, phone, doctorId, reason, date: dateParam, patientId: existingPatientId } = req.body;

      if (!name?.trim() || !phone || !doctorId) {
        return res.status(400).json({ message: "Name, phone number, and doctor selection are required" });
      }
      const normalizedPhone = String(phone).replace(/\D/g, "");
      if (normalizedPhone.length < 10) {
        return res.status(400).json({ message: "Please enter a valid 10-digit phone number" });
      }
      const last10 = normalizedPhone.slice(-10);

      // Resolve clinic from token using SQL filter (avoids full table scan)
      const [tokenRow] = await db.select().from(clinicSettings)
        .where(and(
          eq(clinicSettings.key, "registrationToken"),
          sql`${clinicSettings.value}::text = ${JSON.stringify(token)}`
        ));
      if (!tokenRow) return res.status(404).json({ message: "Invalid registration link" });
      const clinicId = tokenRow.clinicId;

      // Verify doctor belongs to this clinic (read-only — safe outside transaction)
      const [doctor] = await db.select().from(users)
        .where(and(eq(users.id, doctorId), eq(users.clinicId, clinicId), eq(users.role, "doctor")));
      if (!doctor) return res.status(404).json({ message: "Doctor not found" });
      const doctorName = doctor.name || [doctor.firstName, doctor.lastName].filter(Boolean).join(" ") || "Doctor";

      // Resolve the target booking date — reject past dates. Uses the same IST-day
      // bucket as desktop create/reschedule and the kiosk preview above, so a walk-in
      // registered at 2 AM IST lands in "today," not the UTC-previous day, and never
      // collides with a desktop-booked queue number for the same clinical day.
      const { start: todayStartIST } = dayRangeIST();
      const dateKey = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : istDateKey(new Date());
      const { start: targetStart, end: targetEnd } = istDayRange(dateKey);
      if (targetStart < todayStartIST) {
        return res.status(400).json({ message: "Cannot book appointments in the past" });
      }
      // Store the appointment at 9 AM IST on the target day.
      const appointmentDate = new Date(targetStart.getTime() + 9 * 60 * 60 * 1000);

      // All mutating DB ops run inside a single transaction with two advisory locks:
      //   Lock 1 (clinicId, hash(phone)) — prevents concurrent duplicate patient creation
      //   Lock 2 (clinicId, hash(doctorId)) — prevents concurrent duplicate queue positions
      // Locks are acquired in a fixed order (phone first, then doctor) to avoid deadlocks.
      const result = await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(${clinicId}::int, hashtext(${last10})::int)`);
        await tx.execute(sql`SELECT pg_advisory_xact_lock(${clinicId}::int, hashtext(${doctorId})::int)`);

        // Find or create patient
        // If caller passed a specific patientId (from phone-lookup selection), use it —
        // but only if its phone actually matches the phone submitted in this request.
        // Without this check, anyone with the public kiosk link could pass any patientId
        // in this clinic (small sequential ints, easily guessed) and book an appointment
        // — and see that patient's name in the response — regardless of what phone
        // number they actually typed in.
        let patient: typeof patients.$inferSelect | undefined;
        if (existingPatientId) {
          const [byId] = await tx.select().from(patients)
            .where(and(eq(patients.clinicId, clinicId), eq(patients.id, Number(existingPatientId))));
          if (byId && byId.phone.replace(/\D/g, "").slice(-10) === last10) {
            patient = byId;
          }
        }
        if (!patient) {
          const [byPhone] = await tx.select().from(patients)
            .where(and(
              eq(patients.clinicId, clinicId),
              sql`RIGHT(REGEXP_REPLACE(${patients.phone}, '[^0-9]', '', 'g'), 10) = ${last10}`
            ));
          patient = byPhone;
        }
        if (!patient) {
          const [created] = await tx.insert(patients)
            .values({ clinicId, name: name.trim(), phone: last10, source: "walk_in", status: "lead", funnelStage: "new" })
            .returning();
          patient = created!;
        }

        // Check for an already-active appointment today
        const [existingAppt] = await tx.select().from(appointments)
          .where(and(
            eq(appointments.clinicId, clinicId),
            eq(appointments.patientId, patient.id),
            eq(appointments.doctorId, doctorId),
            gte(appointments.date, targetStart),
            lte(appointments.date, targetEnd)
          ))
          .orderBy(desc(appointments.createdAt));

        if (existingAppt && !["completed", "cancelled", "no_show"].includes(existingAppt.status)) {
          return { alreadyRegistered: true as const, patient, appt: existingAppt };
        }

        // Compute queue position atomically inside the locked transaction
        const [maxRow] = await tx.select({
          maxPos: sql<number>`COALESCE(MAX(${appointments.queuePosition}), 0)::int`,
          maxNum: sql<number>`COALESCE(MAX(${appointments.queueNumber}), 0)::int`,
        }).from(appointments).where(and(
          eq(appointments.clinicId, clinicId),
          eq(appointments.doctorId, doctorId),
          gte(appointments.date, targetStart),
          lte(appointments.date, targetEnd),
        ));

        const queueToken = nanoid(8);
        const [newAppt] = await tx.insert(appointments).values({
          clinicId, patientId: patient.id, doctorId,
          date: appointmentDate, status: "booked",
          reason: reason?.trim() || null,
          queueNumber: (maxRow?.maxNum ?? 0) + 1,
          queuePosition: (maxRow?.maxPos ?? 0) + 1,
          queueToken,
        }).returning();

        return { alreadyRegistered: false as const, patient, appt: newAppt! };
      });

      if (result.alreadyRegistered) {
        return res.json({
          alreadyRegistered: true,
          id: result.appt.id,
          patientName: result.patient.name,
          doctorName,
          queueNumber: result.appt.queueNumber,
          queuePosition: result.appt.queuePosition,
          queueToken: result.appt.queueToken,
          queueUrl: `${req.protocol}://${req.get("host")}/patient-queue/${result.appt.queueToken}`,
        });
      }

      broadcastQueueUpdate(doctorId);

      res.status(201).json({
        alreadyRegistered: false,
        id: result.appt.id,
        patientName: result.patient.name,
        doctorName,
        queueNumber: result.appt.queueNumber,
        queuePosition: result.appt.queuePosition,
        queueToken: result.appt.queueToken,
        queueUrl: `${req.protocol}://${req.get("host")}/patient-queue/${result.appt.queueToken}`,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to register. Please try again." });
    }
  });

  // ── PHARMACY ──────────────────────────────────────────────────────────────

  // GET /api/pharmacy/stats
  app.get("/api/pharmacy/stats", requireAuth, requireRole("admin", "pharmacist"), async (req, res) => {
    try {
      const clinicId = req.session.clinicId!;
      const { start: todayStart, end: todayEnd } = dayRangeIST();
      // First-of-month boundary in IST, not server-local (UTC) — same reasoning as
      // dayRangeIST: a server running in UTC would otherwise start the month ~5.5h early.
      const nowIST = new Date(Date.now() + IST_OFFSET_MS);
      const monthStart = new Date(Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), 1) - IST_OFFSET_MS);
      const thirtyDaysFromNow = new Date(); thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      const thirtyDaysStr = thirtyDaysFromNow.toISOString().split("T")[0];

      const [
        [totalMeds],
        [lowStock],
        [expiringSoon],
        [todaySales],
        [monthSales],
      ] = await Promise.all([
        db.select({ count: count() }).from(medicines)
          .where(and(eq(medicines.clinicId, clinicId), eq(medicines.isActive, true))),
        db.select({ count: count() }).from(medicines)
          .where(and(eq(medicines.clinicId, clinicId), eq(medicines.isActive, true),
            sql`${medicines.stockQty} <= ${medicines.minStockQty}`)),
        db.select({ count: count() }).from(medicines)
          .where(and(eq(medicines.clinicId, clinicId), eq(medicines.isActive, true),
            sql`${medicines.expiryDate} IS NOT NULL AND ${medicines.expiryDate} <= ${thirtyDaysStr} AND ${medicines.expiryDate} >= CURRENT_DATE`)),
        db.select({ total: sql<number>`COALESCE(SUM(${pharmacyBills.totalAmount}), 0)::int` })
          .from(pharmacyBills)
          .where(and(eq(pharmacyBills.clinicId, clinicId),
            gte(pharmacyBills.createdAt, todayStart), lte(pharmacyBills.createdAt, todayEnd))),
        db.select({ total: sql<number>`COALESCE(SUM(${pharmacyBills.totalAmount}), 0)::int` })
          .from(pharmacyBills)
          .where(and(eq(pharmacyBills.clinicId, clinicId),
            gte(pharmacyBills.createdAt, monthStart))),
      ]);

      res.json({
        totalMedicines: totalMeds?.count ?? 0,
        lowStockCount: lowStock?.count ?? 0,
        expiringSoonCount: expiringSoon?.count ?? 0,
        todaySales: todaySales?.total ?? 0,
        monthSales: monthSales?.total ?? 0,
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch pharmacy stats" });
    }
  });

  // GET /api/pharmacy/medicines
  app.get("/api/pharmacy/medicines", requireAuth, requireRole("admin", "pharmacist"), async (req, res) => {
    try {
      const clinicId = req.session.clinicId!;
      const { search, category, lowStock, expiringSoon } = req.query as Record<string, string>;
      const conditions = [eq(medicines.clinicId, clinicId), eq(medicines.isActive, true)];
      if (search) conditions.push(or(ilike(medicines.name, `%${search}%`), ilike(medicines.genericName, `%${search}%`))!);
      if (category && category !== "all") conditions.push(eq(medicines.category, category));
      if (lowStock === "true") conditions.push(sql`${medicines.stockQty} <= ${medicines.minStockQty}`);
      if (expiringSoon === "true") {
        const d = new Date(); d.setDate(d.getDate() + 30);
        conditions.push(sql`${medicines.expiryDate} IS NOT NULL AND ${medicines.expiryDate} <= ${d.toISOString().split("T")[0]} AND ${medicines.expiryDate} >= CURRENT_DATE`);
      }
      const rows = await db.select().from(medicines).where(and(...conditions)).orderBy(medicines.name);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch medicines" });
    }
  });

  // POST /api/pharmacy/medicines
  app.post("/api/pharmacy/medicines", requireAuth, requireRole("admin", "pharmacist"), async (req, res) => {
    try {
      const clinicId = req.session.clinicId!;
      // Rejects negative price/stock/GST — previously unvalidated, letting negative
      // costPrice/sellingPrice/stockQty into the DB and corrupting downstream math.
      const data = insertMedicineSchema.omit({ clinicId: true }).parse(req.body);
      const [med] = await db.insert(medicines).values({ ...data, clinicId }).returning();
      res.json(med);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(400).json({ message: err?.message || "Failed to create medicine" });
    }
  });

  // PUT /api/pharmacy/medicines/:id
  app.put("/api/pharmacy/medicines/:id", requireAuth, requireRole("admin", "pharmacist"), async (req, res) => {
    try {
      const clinicId = req.session.clinicId!;
      const { id } = req.params;
      const data = insertMedicineSchema.omit({ clinicId: true }).partial().parse(req.body);
      const [med] = await db.update(medicines)
        .set(data)
        .where(and(eq(medicines.id, Number(id)), eq(medicines.clinicId, clinicId))).returning();
      if (!med) return res.status(404).json({ message: "Medicine not found" });
      res.json(med);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(400).json({ message: err?.message || "Failed to update medicine" });
    }
  });

  // PATCH /api/pharmacy/medicines/:id/reorder — toggle reorderedAt timestamp
  app.patch("/api/pharmacy/medicines/:id/reorder", requireAuth, requireRole("admin", "pharmacist"), async (req, res) => {
    try {
      const clinicId = req.session.clinicId!;
      const id = Number(req.params.id);
      const [existing] = await db.select({ reorderedAt: medicines.reorderedAt })
        .from(medicines).where(and(eq(medicines.id, id), eq(medicines.clinicId, clinicId)));
      if (!existing) return res.status(404).json({ message: "Medicine not found" });
      const newVal = existing.reorderedAt ? null : new Date();
      await db.update(medicines).set({ reorderedAt: newVal })
        .where(and(eq(medicines.id, id), eq(medicines.clinicId, clinicId)));
      res.json({ reorderedAt: newVal });
    } catch (err) {
      res.status(500).json({ message: "Failed to toggle reorder status" });
    }
  });

  // DELETE /api/pharmacy/medicines/:id (soft delete)
  app.delete("/api/pharmacy/medicines/:id", requireAuth, requireRole("admin", "pharmacist"), async (req, res) => {
    try {
      const clinicId = req.session.clinicId!;
      await db.update(medicines).set({ isActive: false })
        .where(and(eq(medicines.id, Number(req.params.id)), eq(medicines.clinicId, clinicId)));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete medicine" });
    }
  });

  // GET /api/pharmacy/bills
  app.get("/api/pharmacy/bills", requireAuth, requireRole("admin", "pharmacist"), async (req, res) => {
    try {
      const clinicId = req.session.clinicId!;
      const rows = await db.select().from(pharmacyBills)
        .where(eq(pharmacyBills.clinicId, clinicId))
        .orderBy(desc(pharmacyBills.createdAt))
        .limit(100);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch pharmacy bills" });
    }
  });

  // POST /api/pharmacy/bills
  app.post("/api/pharmacy/bills", requireAuth, requireRole("admin", "pharmacist"), async (req, res) => {
    try {
      const clinicId = req.session.clinicId!;
      const { items, discountPercent: rawDiscountPercent, patientId: rawPatientId, ...rest } = req.body;

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: "Bill must have at least one item" });
      }
      const discountPercent = Math.min(100, Math.max(0, Number(rawDiscountPercent) || 0));
      const patientId = rawPatientId != null ? Number(rawPatientId) : null;
      if (patientId != null) {
        const [patient] = await db.select({ id: patients.id }).from(patients)
          .where(and(eq(patients.id, patientId), eq(patients.clinicId, clinicId)));
        if (!patient) return res.status(403).json({ message: "Patient not found in this clinic" });
      }

      const todayIST = istDateKey(new Date());

      const bill = await db.transaction(async (tx) => {
        let subtotal = 0;
        let gstTotal = 0;
        const resolvedItems: any[] = [];

        for (const item of items as any[]) {
          const qty = Number(item.qty);
          if (!item.medicineId || !Number.isInteger(qty) || qty <= 0) {
            throw Object.assign(new Error("Each item needs a valid medicine and a positive quantity"), { isStockError: true });
          }
          // Row lock so two concurrent bills for the same medicine can't both read the
          // same stockQty, both pass the check below, and both succeed — oversold stock.
          const [med] = await tx.select({
            stockQty: medicines.stockQty, name: medicines.name, unit: medicines.unit,
            sellingPrice: medicines.sellingPrice, gstPercent: medicines.gstPercent, expiryDate: medicines.expiryDate,
          }).from(medicines)
            .where(and(eq(medicines.id, item.medicineId), eq(medicines.clinicId, clinicId)))
            .for("update");
          if (!med) throw Object.assign(new Error("Medicine not found"), { isStockError: true });
          if (qty > med.stockQty) {
            throw Object.assign(new Error(`Insufficient stock for ${med.name}`), { isStockError: true });
          }
          if (med.expiryDate && med.expiryDate < todayIST) {
            throw Object.assign(new Error(`${med.name} is expired and cannot be dispensed`), { isStockError: true });
          }

          await tx.update(medicines)
            .set({ stockQty: sql`${medicines.stockQty} - ${qty}` })
            .where(and(eq(medicines.id, item.medicineId), eq(medicines.clinicId, clinicId)));

          // Price/GST/totals are recomputed from the medicine record here, never taken
          // from the client — otherwise any authenticated user could bill an arbitrary
          // amount by editing the request body.
          const base = med.sellingPrice * qty;
          const gstAmount = Math.round(base * (med.gstPercent ?? 0) / 100);
          subtotal += base;
          gstTotal += gstAmount;
          resolvedItems.push({
            medicineId: item.medicineId, name: med.name, unit: med.unit,
            sellingPrice: med.sellingPrice, gstPercent: med.gstPercent,
            qty, gstAmount, total: base + gstAmount,
          });
        }

        const discountAmount = Math.round((subtotal + gstTotal) * discountPercent / 100);
        const totalAmount = subtotal + gstTotal - discountAmount;

        const [bill] = await tx.insert(pharmacyBills)
          .values({
            ...rest,
            patientId,
            items: resolvedItems,
            subtotal, discountPercent, discountAmount, gstTotal, totalAmount,
            clinicId,
          }).returning();
        return bill!;
      });
      res.json(bill);
    } catch (err: any) {
      if (err?.isStockError) return res.status(400).json({ message: err.message });
      console.error(err);
      res.status(400).json({ message: err?.message || "Failed to create pharmacy bill" });
    }
  });

  // ── PHARMACY: SUPPLIERS ───────────────────────────────────────────────────

  app.get("/api/pharmacy/suppliers", requireAuth, requireRole("admin", "pharmacist"), async (req, res) => {
    try {
      const clinicId = req.session.clinicId!;
      const rows = await db.select().from(pharmacySuppliers)
        .where(and(eq(pharmacySuppliers.clinicId, clinicId), eq(pharmacySuppliers.isActive, true)))
        .orderBy(pharmacySuppliers.name);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch suppliers" });
    }
  });

  app.post("/api/pharmacy/suppliers", requireAuth, requireRole("admin", "pharmacist"), async (req, res) => {
    try {
      const clinicId = req.session.clinicId!;
      const { name, contactPerson, phone, email, address, paymentTerms, leadTimeDays, notes } = req.body;
      if (!name?.trim()) return res.status(400).json({ message: "Supplier name is required" });
      const [row] = await db.insert(pharmacySuppliers)
        .values({ clinicId, name: name.trim(), contactPerson, phone, email, address, paymentTerms, leadTimeDays: leadTimeDays || null, notes })
        .returning();
      res.json(row);
    } catch (err: any) {
      res.status(400).json({ message: err?.message || "Failed to create supplier" });
    }
  });

  app.put("/api/pharmacy/suppliers/:id", requireAuth, requireRole("admin", "pharmacist"), async (req, res) => {
    try {
      const clinicId = req.session.clinicId!;
      const id = Number(req.params.id);
      const { name, contactPerson, phone, email, address, paymentTerms, leadTimeDays, notes } = req.body;
      const [row] = await db.update(pharmacySuppliers)
        .set({ name, contactPerson, phone, email, address, paymentTerms, leadTimeDays: leadTimeDays || null, notes })
        .where(and(eq(pharmacySuppliers.id, id), eq(pharmacySuppliers.clinicId, clinicId)))
        .returning();
      if (!row) return res.status(404).json({ message: "Supplier not found" });
      res.json(row);
    } catch (err: any) {
      res.status(400).json({ message: err?.message || "Failed to update supplier" });
    }
  });

  app.delete("/api/pharmacy/suppliers/:id", requireAuth, requireRole("admin", "pharmacist"), async (req, res) => {
    try {
      const clinicId = req.session.clinicId!;
      await db.update(pharmacySuppliers)
        .set({ isActive: false })
        .where(and(eq(pharmacySuppliers.id, Number(req.params.id)), eq(pharmacySuppliers.clinicId, clinicId)));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete supplier" });
    }
  });

  // ── PHARMACY: RETURNS ─────────────────────────────────────────────────────

  app.get("/api/pharmacy/returns", requireAuth, requireRole("admin", "pharmacist"), async (req, res) => {
    try {
      const clinicId = req.session.clinicId!;
      const rows = await db.select().from(pharmacyReturns)
        .where(eq(pharmacyReturns.clinicId, clinicId))
        .orderBy(desc(pharmacyReturns.createdAt))
        .limit(100);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch returns" });
    }
  });

  app.post("/api/pharmacy/returns", requireAuth, requireRole("admin", "pharmacist"), async (req, res) => {
    try {
      const clinicId = req.session.clinicId!;
      const { originalBillId, patientName, patientPhone, items, totalAmount, refundMethod, reason } = req.body;
      if (!items?.length) return res.status(400).json({ message: "No items to return" });
      const record = await db.transaction(async (tx) => {
        for (const item of (items as any[])) {
          if (!item.medicineId) continue;
          await tx.update(medicines)
            .set({ stockQty: sql`${medicines.stockQty} + ${item.qty}` })
            .where(and(eq(medicines.id, item.medicineId), eq(medicines.clinicId, clinicId)));
        }
        const [row] = await tx.insert(pharmacyReturns)
          .values({ clinicId, originalBillId: originalBillId || null, patientName, patientPhone, items, totalAmount, refundMethod, reason })
          .returning();
        return row!;
      });
      res.json(record);
    } catch (err: any) {
      res.status(400).json({ message: err?.message || "Failed to process return" });
    }
  });

  // ── PHARMACY: WASTAGE ─────────────────────────────────────────────────────

  app.get("/api/pharmacy/wastage", requireAuth, requireRole("admin", "pharmacist"), async (req, res) => {
    try {
      const clinicId = req.session.clinicId!;
      const rows = await db.select().from(wastageRecords)
        .where(eq(wastageRecords.clinicId, clinicId))
        .orderBy(desc(wastageRecords.createdAt))
        .limit(100);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch wastage records" });
    }
  });

  app.post("/api/pharmacy/wastage", requireAuth, requireRole("admin", "pharmacist"), async (req, res) => {
    try {
      const clinicId = req.session.clinicId!;
      const { medicineId, medicineName, batchNo, qty, unit, costPrice, reason, notes } = req.body;
      if (!medicineName) return res.status(400).json({ message: "Medicine name is required" });
      if (!qty || qty <= 0) return res.status(400).json({ message: "Quantity must be greater than 0" });
      const totalCost = Math.round((costPrice || 0) * qty);
      const record = await db.transaction(async (tx) => {
        if (medicineId) {
          const [med] = await tx.select({ stockQty: medicines.stockQty })
            .from(medicines)
            .where(and(eq(medicines.id, Number(medicineId)), eq(medicines.clinicId, clinicId)));
          if (!med) throw new Error("Medicine not found");
          if (med.stockQty < qty) throw Object.assign(new Error(`Insufficient stock (${med.stockQty} available)`), { isStockError: true });
          await tx.update(medicines)
            .set({ stockQty: sql`${medicines.stockQty} - ${qty}` })
            .where(and(eq(medicines.id, Number(medicineId)), eq(medicines.clinicId, clinicId)));
        }
        const [row] = await tx.insert(wastageRecords)
          .values({ clinicId, medicineId: medicineId ? Number(medicineId) : null, medicineName, batchNo: batchNo || null, qty, unit: unit || "Strip", costPrice: costPrice || 0, totalCost, reason: reason || "expired", notes: notes || null })
          .returning();
        return row!;
      });
      res.json(record);
    } catch (err: any) {
      if (err?.isStockError) return res.status(400).json({ message: err.message });
      res.status(400).json({ message: err?.message || "Failed to log wastage" });
    }
  });

  // ── PHARMACY: DAILY CLOSING ───────────────────────────────────────────────

  app.get("/api/pharmacy/closing/today", requireAuth, requireRole("admin", "pharmacist"), async (req, res) => {
    try {
      const clinicId = req.session.clinicId!;
      // Both halves of this response must agree on the same IST calendar day — they
      // previously didn't (bill/return totals used server-local/UTC boundaries while
      // the closing-record lookup used IST), so sales made 00:00-05:30 IST were
      // attributed to the wrong day between the two.
      const { start: todayStart, end: todayEnd } = dayRangeIST();
      const todayStr = istDateKey(new Date());

      const [dayBills, dayReturns, existing] = await Promise.all([
        db.select({ paymentMethod: pharmacyBills.paymentMethod, totalAmount: pharmacyBills.totalAmount })
          .from(pharmacyBills)
          .where(and(eq(pharmacyBills.clinicId, clinicId), gte(pharmacyBills.createdAt, todayStart), lte(pharmacyBills.createdAt, todayEnd))),
        db.select({ totalAmount: pharmacyReturns.totalAmount })
          .from(pharmacyReturns)
          .where(and(eq(pharmacyReturns.clinicId, clinicId), gte(pharmacyReturns.createdAt, todayStart), lte(pharmacyReturns.createdAt, todayEnd))),
        db.select().from(dailyClosings)
          .where(and(eq(dailyClosings.clinicId, clinicId), eq(dailyClosings.closingDate, todayStr))),
      ]);

      const cashExpected = dayBills.filter(b => (b.paymentMethod || "cash") === "cash").reduce((s, b) => s + b.totalAmount, 0);
      const upiTotal = dayBills.filter(b => b.paymentMethod === "upi").reduce((s, b) => s + b.totalAmount, 0);
      const cardTotal = dayBills.filter(b => b.paymentMethod === "card").reduce((s, b) => s + b.totalAmount, 0);
      const onlineTotal = dayBills.filter(b => b.paymentMethod === "online").reduce((s, b) => s + b.totalAmount, 0);
      const totalSales = dayBills.reduce((s, b) => s + b.totalAmount, 0);
      const totalReturns = dayReturns.reduce((s, r) => s + r.totalAmount, 0);

      res.json({
        date: todayStr,
        cashExpected, upiTotal, cardTotal, onlineTotal,
        totalSales, totalReturns, netSales: totalSales - totalReturns,
        billCount: dayBills.length,
        existingClosing: existing[0] || null,
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch today's summary" });
    }
  });

  app.get("/api/pharmacy/closing", requireAuth, requireRole("admin", "pharmacist"), async (req, res) => {
    try {
      const clinicId = req.session.clinicId!;
      const rows = await db.select().from(dailyClosings)
        .where(eq(dailyClosings.clinicId, clinicId))
        .orderBy(desc(dailyClosings.closingDate))
        .limit(30);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch closing records" });
    }
  });

  app.post("/api/pharmacy/closing", requireAuth, requireRole("admin", "pharmacist"), async (req, res) => {
    try {
      const clinicId = req.session.clinicId!;
      const { closingDate, cashExpected, cashActual, upiTotal, cardTotal, onlineTotal, totalSales, totalReturns, notes } = req.body;
      const [row] = await db.insert(dailyClosings)
        .values({ clinicId, closingDate, cashExpected, cashActual, upiTotal, cardTotal, onlineTotal, totalSales, totalReturns, notes: notes || null })
        .onConflictDoUpdate({
          target: [dailyClosings.clinicId, dailyClosings.closingDate],
          set: { cashExpected, cashActual, upiTotal, cardTotal, onlineTotal, totalSales, totalReturns, notes: notes || null },
        })
        .returning();
      res.json(row);
    } catch (err: any) {
      res.status(400).json({ message: err?.message || "Failed to save closing" });
    }
  });

  // ── PHARMACY: GST EXPORT ──────────────────────────────────────────────────

  app.get("/api/pharmacy/gst-export", requireAuth, requireRole("admin", "pharmacist"), async (req, res) => {
    try {
      const clinicId = req.session.clinicId!;
      const month = (req.query.month as string) || istDateKey(new Date()).slice(0, 7);
      const [year, mon] = month.split("-").map(Number);
      // IST month boundaries, not server-local — bookend via istDayRange on day 1 of
      // this month and day 1 of next month, so it's correct regardless of days-in-month.
      const from = istDayRange(`${month}-01`).start;
      const nextMonth = mon === 12 ? `${year + 1}-01` : `${year}-${String(mon + 1).padStart(2, "0")}`;
      const to = new Date(istDayRange(`${nextMonth}-01`).start.getTime() - 1);

      const [billRows, medRows] = await Promise.all([
        db.select({ items: pharmacyBills.items })
          .from(pharmacyBills)
          .where(and(eq(pharmacyBills.clinicId, clinicId), gte(pharmacyBills.createdAt, from), lte(pharmacyBills.createdAt, to))),
        db.select({ id: medicines.id, hsnCode: medicines.hsnCode })
          .from(medicines)
          .where(eq(medicines.clinicId, clinicId)),
      ]);

      const hsnByMedId = new Map(medRows.map(m => [m.id, m.hsnCode || ""]));

      type HsnEntry = { hsnCode: string; gstRate: number; qty: number; taxableValue: number; gstAmount: number; total: number };
      const hsnMap = new Map<string, HsnEntry>();

      for (const bill of billRows) {
        for (const item of (bill.items as any[])) {
          const hsn = hsnByMedId.get(item.medicineId) || item.hsnCode || "N/A";
          const gstRate = item.gstPercent ?? 0;
          const key = `${hsn}_${gstRate}`;
          const itemTotal = item.total ?? 0;
          const gstAmt = item.gstAmount ?? 0;
          const taxable = itemTotal - gstAmt;
          if (!hsnMap.has(key)) hsnMap.set(key, { hsnCode: hsn, gstRate, qty: 0, taxableValue: 0, gstAmount: 0, total: 0 });
          const e = hsnMap.get(key)!;
          e.qty += item.qty ?? 1;
          e.taxableValue += taxable;
          e.gstAmount += gstAmt;
          e.total += itemTotal;
        }
      }

      const rows = Array.from(hsnMap.values()).sort((a, b) => a.hsnCode.localeCompare(b.hsnCode));
      const csvLines = [
        "HSN Code,GST Rate (%),Total Qty,Taxable Value (Rs),GST Amount (Rs),Invoice Total (Rs),CGST (Rs),SGST (Rs)",
        ...rows.map(r => {
          const cgst = Math.round(r.gstAmount / 2);
          const sgst = r.gstAmount - cgst;
          return [r.hsnCode, r.gstRate, r.qty, (r.taxableValue / 100).toFixed(2), (r.gstAmount / 100).toFixed(2), (r.total / 100).toFixed(2), (cgst / 100).toFixed(2), (sgst / 100).toFixed(2)].join(",");
        }),
      ].join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="gst-report-${month}.csv"`);
      res.send(csvLines);
    } catch (err) {
      res.status(500).json({ message: "Failed to generate GST export" });
    }
  });

  // ── PHARMACY: CONSUMPTION RATES ───────────────────────────────────────────

  app.get("/api/pharmacy/consumption", requireAuth, requireRole("admin", "pharmacist"), async (req, res) => {
    try {
      const clinicId = req.session.clinicId!;
      const from = new Date(Date.now() - 30 * 86400000);
      const billRows = await db.select({ items: pharmacyBills.items })
        .from(pharmacyBills)
        .where(and(eq(pharmacyBills.clinicId, clinicId), gte(pharmacyBills.createdAt, from)));

      const qtyMap = new Map<number, number>();
      for (const bill of billRows) {
        for (const item of (bill.items as any[])) {
          if (!item.medicineId) continue;
          qtyMap.set(item.medicineId, (qtyMap.get(item.medicineId) || 0) + (item.qty || 0));
        }
      }
      const result = Array.from(qtyMap.entries()).map(([medicineId, totalQty30d]) => ({
        medicineId,
        totalQty30d,
        dailyRate: Math.round((totalQty30d / 30) * 10) / 10,
      }));
      res.json(result);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch consumption data" });
    }
  });

  // ── WHATSAPP WEB ──────────────────────────────────────────────────────────

  app.get("/api/whatsapp-web/status", requireAuth, (req, res) => {
    res.json(waWeb.getStatus(req.session.clinicId!));
  });

  app.post("/api/whatsapp-web/connect", requireAuth, async (req, res) => {
    try {
      await waWeb.initClient(req.session.clinicId!);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Failed to start WhatsApp Web client" });
    }
  });

  app.post("/api/whatsapp-web/disconnect", requireAuth, async (req, res) => {
    try {
      await waWeb.disconnectClient(req.session.clinicId!);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Failed to disconnect" });
    }
  });

  // ── SETTINGS ─────────────────────────────────────────────────────────────

  app.get("/api/settings", requireAuth, async (req, res) => {
    try {
      let settings = await storage(req).getAllSettings();
      // Auto-generate a stable public registration token on first access.
      // ON CONFLICT DO NOTHING ensures that if two concurrent requests both see no token,
      // only one insert wins; we then re-read the winner so both callers return the same token.
      if (!settings.registrationToken) {
        const regToken = nanoid(12);
        await db.insert(clinicSettings)
          .values({ clinicId: req.session.clinicId!, key: "registrationToken", value: regToken, updatedAt: new Date() })
          .onConflictDoNothing();
        const savedToken = await storage(req).getSetting("registrationToken");
        settings = { ...settings, registrationToken: savedToken ?? regToken };
      }
      const masked = Object.fromEntries(
        Object.entries(settings).map(([k, v]) => {
          if (k === "registrationToken") return [k, v]; // always expose — it's intentionally public
          if (v && typeof v === "object") {
            const safe: Record<string, any> = {};
            for (const [field, val] of Object.entries(v as Record<string, any>)) {
              safe[field] = (field === "apiKey" || field === "token" || field === "accessToken") && val
                ? "••••••••" + String(val).slice(-4)
                : val;
            }
            return [k, safe];
          }
          return [k, v];
        })
      );
      res.json(masked);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.patch("/api/settings/:key", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const { key } = req.params;
      if (!["whatsapp", "sms", "clinicProfile", "modules"].includes(key)) return res.status(400).json({ message: "Unknown settings key" });
      const existing = (await storage(req).getSetting(key)) || {};
      const merged: Record<string, any> = { ...existing };
      for (const [field, val] of Object.entries(req.body)) {
        if (typeof val === "string" && val.startsWith("••••••••")) continue;
        merged[field] = val;
      }
      const saved = await storage(req).upsertSetting(key, merged);
      res.json({ success: true, key: saved.key });
    } catch (err) {
      res.status(500).json({ message: "Failed to save settings" });
    }
  });

  // ── CLINIC PAYMENT SUBMISSION (from clinic) ────────────────────────────────

  // Authoritative plan prices (paise) — client-sent amount is ignored
  const PLAN_PRICES: Record<string, number> = {
    monthly: 499900,
    quarterly: 1299900,
    annual: 4999900,
  };

  app.post("/api/payments", requireAuth, async (req, res) => {
    try {
      const { utr, planType, referralCode } = req.body;
      if (!utr) return res.status(400).json({ message: "UTR is required" });
      const resolvedPlan = (PLAN_PRICES[planType] ? planType : "monthly") as string;
      const resolvedAmount = PLAN_PRICES[resolvedPlan];

      // Optional referral code entered at payment time — only links if the clinic
      // isn't already attributed to a partner from signup. Best-effort, never blocks payment.
      if (referralCode && String(referralCode).trim()) {
        const [clinic] = await db.select().from(clinics).where(eq(clinics.id, req.session.clinicId!));
        if (clinic && !clinic.partnerId) {
          const [partner] = await db.select().from(partners)
            .where(eq(partners.referralCode, String(referralCode).trim().toUpperCase()));
          if (partner && partner.status === "active") {
            await db.update(clinics).set({ partnerId: partner.id }).where(eq(clinics.id, req.session.clinicId!));
          }
        }
      }

      // SELECT FOR UPDATE inside a transaction — serializes concurrent submissions so only
      // one pending payment is created even if the user double-clicks or opens two tabs.
      const payment = await db.transaction(async (tx) => {
        const existing = await tx.select().from(clinicPayments)
          .where(and(eq(clinicPayments.clinicId, req.session.clinicId!), eq(clinicPayments.status, "pending")))
          .for("update");
        if (existing.length > 0) throw Object.assign(new Error("DUPLICATE_PENDING"), { isDuplicate: true });
        const [p] = await tx.insert(clinicPayments).values({
          clinicId: req.session.clinicId!,
          amount: resolvedAmount,
          utr: String(utr).trim(),
          planType: resolvedPlan,
          status: "pending",
          paidAt: new Date(),
        }).returning();
        return p!;
      });

      res.status(201).json(payment);
    } catch (err: any) {
      if (err?.isDuplicate) return res.status(400).json({ message: "You already have a pending payment request" });
      res.status(500).json({ message: "Failed to submit payment" });
    }
  });

  app.get("/api/payments", requireAuth, async (req, res) => {
    try {
      const payments = await db.select().from(clinicPayments)
        .where(eq(clinicPayments.clinicId, req.session.clinicId!))
        .orderBy(desc(clinicPayments.createdAt));
      res.json(payments);
    } catch (err) {
      console.error("[payments GET]", err);
      res.status(500).json({ message: "Failed to fetch payments" });
    }
  });

  // ══ PARTNER DASHBOARD ════════════════════════════════════════════════════

  app.get("/api/partner/stats", requireActivePartner, async (req, res) => {
    try {
      const partnerId = req.session.partnerId!;
      const now = new Date();
      const [partner] = await db.select().from(partners).where(eq(partners.id, partnerId));
      const rows = await db.select().from(clinics).where(eq(clinics.partnerId, partnerId));
      const clinicIds = rows.map(c => c.id);

      const total = rows.length;
      const active = rows.filter(c => c.planStatus === "active" && (!c.subscriptionEndsAt || c.subscriptionEndsAt >= now)).length;
      const trial = rows.filter(c => c.planStatus === "trial" && (!c.trialEndsAt || c.trialEndsAt >= now)).length;
      const expired = rows.filter(c =>
        (c.planStatus === "trial" && c.trialEndsAt && c.trialEndsAt < now) ||
        (c.planStatus === "active" && c.subscriptionEndsAt && c.subscriptionEndsAt < now) ||
        c.planStatus === "expired" || c.planStatus === "cancelled"
      ).length;

      // Revenue attributed to this partner's clinics — approved payments only.
      // paidCount = distinct clinics that have EVER paid (may differ from `active`,
      // since a clinic that paid once but later lapsed still counts as a conversion).
      let totalRevenue = 0;
      let paidCount = 0;
      if (clinicIds.length > 0) {
        const approvedPayments = await db.select().from(clinicPayments)
          .where(and(inArray(clinicPayments.clinicId, clinicIds), eq(clinicPayments.status, "approved")));
        totalRevenue = approvedPayments.reduce((s, p) => s + p.amount, 0) / 100;
        paidCount = new Set(approvedPayments.map(p => p.clinicId)).size;
      }
      const commissionPercent = partner?.commissionPercent ?? 0;
      const commissionEarned = Math.round(totalRevenue * commissionPercent) / 100;

      res.json({ registered: total, paidCount, total, active, trial, expired, totalRevenue, commissionPercent, commissionEarned });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to fetch partner stats" });
    }
  });

  app.get("/api/partner/clients", requireActivePartner, async (req, res) => {
    try {
      const partnerId = req.session.partnerId!;
      const now = new Date();
      const rows = await db.select().from(clinics)
        .where(eq(clinics.partnerId, partnerId))
        .orderBy(desc(clinics.createdAt));

      const clinicIds = rows.map(c => c.id);
      const allPayments = clinicIds.length > 0
        ? await db.select().from(clinicPayments).where(inArray(clinicPayments.clinicId, clinicIds))
        : [];
      const paidByClinic = new Map<number, number>();
      for (const p of allPayments) {
        if (p.status !== "approved") continue;
        paidByClinic.set(p.clinicId, (paidByClinic.get(p.clinicId) ?? 0) + p.amount);
      }

      const enriched = rows.map(c => {
        const { passwordHash: _, ...safe } = c;
        const isExpired = (c.planStatus === "trial" && c.trialEndsAt && c.trialEndsAt < now) ||
          (c.planStatus === "active" && c.subscriptionEndsAt && c.subscriptionEndsAt < now);
        const totalPaid = (paidByClinic.get(c.id) ?? 0) / 100;
        return { ...safe, isExpired, totalPaid, hasPaid: totalPaid > 0 };
      });

      res.json(enriched);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to fetch clients" });
    }
  });

  // ══ SUPER ADMIN ══════════════════════════════════════════════════════════

  app.get("/api/admin/clinics", requireSuperAdmin, async (_req, res) => {
    try {
      const now = new Date();

      // 3 aggregate queries instead of 3N individual queries
      const [allClinics, patientCounts, apptCounts, allPayments, allPartners] = await Promise.all([
        db.select().from(clinics).orderBy(desc(clinics.createdAt)),
        db.select({ clinicId: patients.clinicId, cnt: sql<number>`count(*)::int` })
          .from(patients).groupBy(patients.clinicId),
        db.select({ clinicId: appointments.clinicId, cnt: sql<number>`count(*)::int` })
          .from(appointments).groupBy(appointments.clinicId),
        db.select().from(clinicPayments),
        db.select().from(partners),
      ]);

      const patientCountMap = new Map(patientCounts.map(r => [r.clinicId, r.cnt]));
      const apptCountMap = new Map(apptCounts.map(r => [r.clinicId, r.cnt]));
      const partnerMap = new Map(allPartners.map(p => [p.id, p]));
      const paymentsByClinic = new Map<number, typeof allPayments>();
      for (const p of allPayments) {
        if (!paymentsByClinic.has(p.clinicId)) paymentsByClinic.set(p.clinicId, []);
        paymentsByClinic.get(p.clinicId)!.push(p);
      }

      const enriched = allClinics.map(c => {
        const payments = paymentsByClinic.get(c.id) ?? [];
        const totalPaid = payments.filter(p => p.status === "approved").reduce((s, p) => s + p.amount, 0);
        const { passwordHash: _, ...safe } = c;
        const isExpired = (c.planStatus === "trial" && c.trialEndsAt && c.trialEndsAt < now) ||
          (c.planStatus === "active" && c.subscriptionEndsAt && c.subscriptionEndsAt < now);
        const partner = c.partnerId ? partnerMap.get(c.partnerId) : undefined;
        return {
          ...safe,
          patientCount: patientCountMap.get(c.id) ?? 0,
          apptCount: apptCountMap.get(c.id) ?? 0,
          totalPaid: totalPaid / 100,
          isExpired,
          partnerName: partner?.name ?? null,
          partnerReferralCode: partner?.referralCode ?? null,
          daysLeft: c.planStatus === "trial" && c.trialEndsAt
            ? Math.ceil((c.trialEndsAt.getTime() - now.getTime()) / 86400000)
            : c.subscriptionEndsAt
              ? Math.ceil((c.subscriptionEndsAt.getTime() - now.getTime()) / 86400000)
              : null,
        };
      });

      res.json(enriched);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to fetch clinics" });
    }
  });

  app.get("/api/admin/stats", requireSuperAdmin, async (_req, res) => {
    try {
      const now = new Date();
      const allClinics = await db.select().from(clinics);
      const total = allClinics.length;
      const trial = allClinics.filter(c => c.planStatus === "trial" && (!c.trialEndsAt || c.trialEndsAt > now)).length;
      // Excludes clinics whose subscription has lapsed but haven't been lazily synced to
      // "expired" yet (sync only happens when that clinic's own session hits an API
      // route) — without this exclusion those clinics were counted as both active AND
      // expired below, inflating both totals past the true clinic count.
      const active = allClinics.filter(c => c.planStatus === "active" && (!c.subscriptionEndsAt || c.subscriptionEndsAt >= now)).length;
      const expired = allClinics.filter(c =>
        c.planStatus === "expired" || c.planStatus === "cancelled" ||
        (c.planStatus === "trial" && c.trialEndsAt && c.trialEndsAt < now) ||
        (c.planStatus === "active" && c.subscriptionEndsAt && c.subscriptionEndsAt < now)
      ).length;

      const allPayments = await db.select().from(clinicPayments);
      const pending = allPayments.filter(p => p.status === "pending").length;
      const thisMonth = new Date(); thisMonth.setDate(1); thisMonth.setHours(0, 0, 0, 0);
      const monthRevenue = allPayments
        .filter(p => p.status === "approved" && p.createdAt && p.createdAt >= thisMonth)
        .reduce((s, p) => s + p.amount, 0) / 100;
      const totalRevenue = allPayments
        .filter(p => p.status === "approved")
        .reduce((s, p) => s + p.amount, 0) / 100;

      // Monthly data (last 6 months)
      const monthlyData: { month: string; revenue: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(); d.setMonth(d.getMonth() - i); d.setDate(1); d.setHours(0, 0, 0, 0);
        const end = new Date(d); end.setMonth(end.getMonth() + 1);
        const rev = allPayments
          .filter(p => p.status === "approved" && p.createdAt && p.createdAt >= d && p.createdAt < end)
          .reduce((s, p) => s + p.amount, 0) / 100;
        monthlyData.push({ month: d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }), revenue: rev });
      }

      res.json({ total, trial, active, expired, pending, monthRevenue, totalRevenue, monthlyData });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch admin stats" });
    }
  });

  app.get("/api/admin/payments", requireSuperAdmin, async (_req, res) => {
    try {
      const rows = await db.select().from(clinicPayments)
        .leftJoin(clinics, eq(clinics.id, clinicPayments.clinicId))
        .orderBy(desc(clinicPayments.createdAt));
      res.json(rows.map(r => ({ ...r.clinic_payments, clinicName: r.clinics?.name, clinicEmail: r.clinics?.email })));
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch payments" });
    }
  });

  app.patch("/api/admin/payments/:id", requireSuperAdmin, async (req, res) => {
    try {
      const { status, notes } = req.body;
      if (!["approved", "rejected"].includes(status)) {
        return res.status(400).json({ message: "status must be 'approved' or 'rejected'" });
      }
      const id = Number(req.params.id);

      const payment = await db.transaction(async (tx) => {
        // Row lock so two concurrent approve/reject requests for the same payment can't
        // both pass the pending-status check and both activate the clinic.
        const [current] = await tx.select().from(clinicPayments).where(eq(clinicPayments.id, id)).for("update");
        if (!current) throw Object.assign(new Error("Payment not found"), { code: "NOT_FOUND" });
        if (current.status !== "pending") throw Object.assign(new Error("Only pending payments can be approved or rejected"), { code: "NOT_PENDING" });

        const [updated] = await tx.update(clinicPayments)
          .set({ status, notes })
          .where(eq(clinicPayments.id, id))
          .returning();

        // Activate clinic when payment approved — same transaction as the status update
        // so a crash between the two can't leave the payment "approved" but the clinic
        // still expired/trial.
        if (status === "approved") {
          const [clinic] = await tx.select().from(clinics).where(eq(clinics.id, updated!.clinicId)).for("update");
          const subEnds = extendPlanEnd(clinic?.planStatus === "active" ? clinic.subscriptionEndsAt : null, updated!.planType);
          await tx.update(clinics)
            .set({ planStatus: "active", subscriptionEndsAt: subEnds })
            .where(eq(clinics.id, updated!.clinicId));
        }
        return updated!;
      });
      if (payment.status === "approved") invalidateClinicPlanCache(payment.clinicId);
      res.json(payment);
    } catch (err: any) {
      if (err?.code === "NOT_FOUND") return res.status(404).json({ message: err.message });
      if (err?.code === "NOT_PENDING") return res.status(400).json({ message: err.message });
      res.status(500).json({ message: "Failed to update payment" });
    }
  });

  // POST /api/admin/payments — manually record a payment and immediately activate the clinic
  app.post("/api/admin/payments", requireSuperAdmin, async (req, res) => {
    try {
      const { clinicId, planType, amount, utr, notes } = req.body;
      if (!clinicId || !planType) return res.status(400).json({ message: "clinicId and planType are required" });

      const amountPaise = Math.round(Number(amount) || 0);
      if (amountPaise <= 0) return res.status(400).json({ message: "amount must be greater than zero" });

      const [clinic] = await db.select().from(clinics).where(eq(clinics.id, Number(clinicId)));
      if (!clinic) return res.status(404).json({ message: "Clinic not found" });
      // Renewing before expiry keeps the remaining paid time instead of discarding it.
      const subEnds = extendPlanEnd(clinic.planStatus === "active" ? clinic.subscriptionEndsAt : null, planType);

      const [payment] = await db.insert(clinicPayments).values({
        clinicId: Number(clinicId),
        amount: amountPaise,
        planType,
        utr: utr?.trim() || null,
        notes: notes?.trim() || null,
        status: "approved",
        paidAt: new Date(),
      }).returning();

      await db.update(clinics)
        .set({ planStatus: "active", subscriptionEndsAt: subEnds })
        .where(eq(clinics.id, Number(clinicId)));
      invalidateClinicPlanCache(Number(clinicId));

      res.status(201).json(payment);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to record payment" });
    }
  });

  app.patch("/api/admin/clinics/:id", requireSuperAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { action, days, plan } = req.body;

      const [clinic] = await db.select().from(clinics).where(eq(clinics.id, id));
      if (!clinic) return res.status(404).json({ message: "Clinic not found" });

      let updates: Record<string, any> = {};
      if (action === "activate") {
        // Renewing before expiry keeps the remaining paid time instead of discarding it.
        const subEnds = extendPlanEnd(clinic.planStatus === "active" ? clinic.subscriptionEndsAt : null, plan);
        updates = { planStatus: "active", subscriptionEndsAt: subEnds };
      } else if (action === "extend-trial") {
        // Refuse on a currently-active paying clinic — this action used to force
        // planStatus back to "trial" even for them, orphaning their real
        // subscriptionEndsAt (isPlanExpired stops consulting it once planStatus isn't
        // "active"). Also extends from the existing trialEndsAt when still in the
        // future, so a second click adds time instead of resetting it.
        if (clinic.planStatus === "active") {
          return res.status(400).json({ message: "Clinic is on an active paid plan — extending the trial would clobber it" });
        }
        const trialEnds = extendPlanEnd(clinic.trialEndsAt, undefined, days || 7);
        updates = { planStatus: "trial", trialEndsAt: trialEnds };
      } else if (action === "expire") {
        updates = { planStatus: "expired" };
      } else {
        return res.status(400).json({ message: "Unknown action" });
      }

      const [updated] = await db.update(clinics).set(updates).where(eq(clinics.id, id)).returning();
      if (!updated) return res.status(404).json({ message: "Clinic not found" });
      invalidateClinicPlanCache(id);
      const { passwordHash: _, ...safe } = updated;
      res.json(safe);
    } catch (err) {
      res.status(500).json({ message: "Failed to update clinic" });
    }
  });

  app.delete("/api/admin/clinics/:id", requireSuperAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      // Must delete in FK dependency order before deleting the clinic
      await db.transaction(async (tx) => {
        await tx.delete(notifications).where(eq(notifications.clinicId, id));
        await tx.delete(prescriptions).where(eq(prescriptions.clinicId, id));
        await tx.delete(bills).where(eq(bills.clinicId, id));
        await tx.delete(appointments).where(eq(appointments.clinicId, id));
        // Delete doctor profiles before deleting users
        const clinicUsers = await tx.select({ id: users.id }).from(users).where(eq(users.clinicId, id));
        for (const u of clinicUsers) {
          await tx.delete(doctorProfiles).where(eq(doctorProfiles.userId, u.id));
        }
        await tx.delete(users).where(eq(users.clinicId, id));
        await tx.delete(patients).where(eq(patients.clinicId, id));
        await tx.delete(clinicSettings).where(eq(clinicSettings.clinicId, id));
        await tx.delete(clinicPayments).where(eq(clinicPayments.clinicId, id));
        await tx.delete(clinics).where(eq(clinics.id, id));
      });
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to delete clinic" });
    }
  });

  // ── ADMIN: PARTNER MANAGEMENT ──────────────────────────────────────────────

  app.get("/api/admin/partners", requireSuperAdmin, async (_req, res) => {
    try {
      const [allPartners, allClinics, allPayments] = await Promise.all([
        db.select().from(partners).orderBy(desc(partners.createdAt)),
        db.select().from(clinics),
        db.select().from(clinicPayments).where(eq(clinicPayments.status, "approved")),
      ]);

      const now = new Date();
      const clinicsByPartner = new Map<number, typeof allClinics>();
      for (const c of allClinics) {
        if (!c.partnerId) continue;
        if (!clinicsByPartner.has(c.partnerId)) clinicsByPartner.set(c.partnerId, []);
        clinicsByPartner.get(c.partnerId)!.push(c);
      }
      const revenueByClinic = new Map<number, number>();
      for (const p of allPayments) {
        revenueByClinic.set(p.clinicId, (revenueByClinic.get(p.clinicId) ?? 0) + p.amount);
      }

      const enriched = allPartners.map(p => {
        const { passwordHash: _, ...safe } = p;
        const clientClinics = clinicsByPartner.get(p.id) ?? [];
        const activeClients = clientClinics.filter(c =>
          c.planStatus === "active" && (!c.subscriptionEndsAt || c.subscriptionEndsAt >= now)
        ).length;
        const paidClients = clientClinics.filter(c => (revenueByClinic.get(c.id) ?? 0) > 0).length;
        const totalRevenue = clientClinics.reduce((s, c) => s + (revenueByClinic.get(c.id) ?? 0), 0) / 100;
        const commissionOwed = Math.round(totalRevenue * p.commissionPercent) / 100;
        return { ...safe, clientCount: clientClinics.length, activeClients, paidClients, totalRevenue, commissionOwed };
      });

      res.json(enriched);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to fetch partners" });
    }
  });

  app.post("/api/admin/partners", requireSuperAdmin, async (req, res) => {
    try {
      const { name, email, password, phone, commissionPercent } = req.body;
      if (!name || !email || !password) {
        return res.status(400).json({ message: "Name, email and password are required" });
      }
      if (String(password).length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }
      const existing = await db.select().from(partners).where(eq(partners.email, String(email).toLowerCase().trim()));
      if (existing.length > 0) {
        return res.status(400).json({ message: "A partner with this email already exists" });
      }

      const passwordHash = await hashPassword(password);
      const referralCode = await generateReferralCode();

      // Admin-created partners are pre-approved — the approval step only guards
      // self-service signups via /api/auth/partner-signup.
      const [partner] = await db.insert(partners).values({
        name: String(name).trim(),
        email: String(email).toLowerCase().trim(),
        passwordHash,
        phone: phone?.trim() || null,
        referralCode,
        commissionPercent: commissionPercent != null ? Math.min(100, Math.max(0, Number(commissionPercent) || 0)) : undefined,
        status: "active",
      }).returning();

      const { passwordHash: _, ...safe } = partner!;
      res.status(201).json(safe);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to create partner" });
    }
  });

  app.patch("/api/admin/partners/:id", requireSuperAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { action, status, commissionPercent, name, phone } = req.body;

      let updates: Record<string, any> = {};
      if (action === "regenerate-code") {
        updates.referralCode = await generateReferralCode();
      } else if (status === "active" || status === "inactive") {
        updates.status = status;
      } else {
        if (commissionPercent != null) updates.commissionPercent = Math.min(100, Math.max(0, Number(commissionPercent) || 0));
        if (name) updates.name = String(name).trim();
        if (phone !== undefined) updates.phone = phone?.trim() || null;
        if (Object.keys(updates).length === 0) return res.status(400).json({ message: "No valid fields to update" });
      }

      const [updated] = await db.update(partners).set(updates).where(eq(partners.id, id)).returning();
      if (!updated) return res.status(404).json({ message: "Partner not found" });
      const { passwordHash: _, ...safe } = updated;
      res.json(safe);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to update partner" });
    }
  });

  app.delete("/api/admin/partners/:id", requireSuperAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      await db.transaction(async (tx) => {
        // Unlink referred clinics rather than touching their data
        await tx.update(clinics).set({ partnerId: null }).where(eq(clinics.partnerId, id));
        await tx.delete(partners).where(eq(partners.id, id));
      });
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to delete partner" });
    }
  });

  // ── STAFF MANAGEMENT (receptionist / pharmacist) ──────────────────────────

  // GET /api/staff — list all non-doctor staff for this clinic
  app.get("/api/staff", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const rows = await db.select({
        id: users.id, name: users.name, email: users.email, role: users.role, createdAt: users.createdAt,
      }).from(users).where(and(
        eq(users.clinicId, req.session.clinicId!),
        sql`${users.role} IN ('receptionist','pharmacist','staff')`,
      )).orderBy(users.createdAt);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch staff" });
    }
  });

  // POST /api/staff — create a new staff member. Email is required (not just recorded) —
  // it's how this person logs in at /login, via the same users-table check as any other login.
  app.post("/api/staff", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const { name, email, role, password } = req.body;
      if (!name?.trim()) return res.status(400).json({ message: "Name is required" });
      if (!email?.trim()) return res.status(400).json({ message: "Email is required so this staff member can log in" });
      if (!["receptionist", "pharmacist", "staff"].includes(role)) return res.status(400).json({ message: "Invalid role" });
      if (!password || password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });

      const passwordHash = await bcrypt.hash(password, 10);
      const [row] = await db.insert(users).values({
        clinicId: req.session.clinicId!,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role,
        passwordHash,
      }).returning({ id: users.id, name: users.name, email: users.email, role: users.role, createdAt: users.createdAt });
      res.status(201).json(row);
    } catch (err: any) {
      if (err?.code === "23505") return res.status(409).json({ message: "Email already exists" });
      res.status(500).json({ message: "Failed to create staff member" });
    }
  });

  // PUT /api/staff/:id — update name / password
  app.put("/api/staff/:id", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const { name, password } = req.body;
      const updates: Record<string, any> = {};
      if (name?.trim()) updates.name = name.trim();
      if (password && password.length >= 6) updates.passwordHash = await bcrypt.hash(password, 10);
      if (!Object.keys(updates).length) return res.status(400).json({ message: "Nothing to update" });
      const [row] = await db.update(users).set(updates)
        .where(and(eq(users.id, req.params.id), eq(users.clinicId, req.session.clinicId!)))
        .returning({ id: users.id, name: users.name, email: users.email, role: users.role, createdAt: users.createdAt });
      if (!row) return res.status(404).json({ message: "Staff not found" });
      res.json(row);
    } catch (err) {
      res.status(500).json({ message: "Failed to update staff" });
    }
  });

  // DELETE /api/staff/:id
  app.delete("/api/staff/:id", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      await db.delete(users).where(and(eq(users.id, req.params.id), eq(users.clinicId, req.session.clinicId!)));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete staff" });
    }
  });

  // ── MEDICINE NAMES (master autocomplete list) ─────────────────────────────

  // GET /api/medicine-names?q=para — returns up to 15 matches, prefix-first ordering
  app.get("/api/medicine-names", requireAuth, async (req, res) => {
    try {
      const q = String(req.query.q || "").trim();
      if (q.length < 2) return res.json([]);
      const rows = await db
        .select({ name: medicineNames.name })
        .from(medicineNames)
        .where(ilike(medicineNames.name, `%${q}%`))
        .orderBy(
          sql`CASE WHEN ${medicineNames.name} ILIKE ${q + "%"} THEN 0 ELSE 1 END`,
          medicineNames.name,
        )
        .limit(15);
      res.json(rows.map(r => r.name));
    } catch (err) {
      res.status(500).json({ message: "Failed to search medicine names" });
    }
  });

  // POST /api/medicine-names — add a custom medicine to the master list
  app.post("/api/medicine-names", requireAuth, async (req, res) => {
    try {
      const name = String(req.body.name || "").trim();
      if (!name) return res.status(400).json({ message: "Name is required" });
      await db.insert(medicineNames).values({ name }).onConflictDoNothing();
      res.json({ name });
    } catch (err) {
      res.status(500).json({ message: "Failed to add medicine name" });
    }
  });

  // Seed medicine names in background (non-blocking)
  seedMedicineNames().catch(() => {});

  return httpServer;
}
