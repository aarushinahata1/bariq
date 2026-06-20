import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { getStorage } from "./storage";
import * as waWeb from "./whatsapp-web";
import { api } from "@shared/routes";
import { notifications, patients, appointments, users, bills, clinics, clinicPayments, prescriptions, clinicSettings, doctorProfiles, insertBillSchema, insertPrescriptionSchema, medicines, pharmacyBills } from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, desc, sql, count, sum, ilike, or, lt } from "drizzle-orm";
import { z } from "zod";
import { setupAuth, requireAuth, requireSuperAdmin } from "./auth";
import { nanoid } from "nanoid";
import bcrypt from "bcryptjs";

function storage(req: Request) {
  return getStorage(req.session.clinicId!);
}

// ── SSE real-time queue push ───────────────────────────────────────────────────
// doctorId → set of active SSE response objects for that doctor's queue
const sseClients = new Map<string, Set<Response>>();

function broadcastQueueUpdate(doctorId: string) {
  const clients = sseClients.get(doctorId);
  if (!clients?.size) return;
  const payload = `data: ${JSON.stringify({ type: "update", ts: Date.now() })}\n\n`;
  clients.forEach(res => {
    try { res.write(payload); } catch { /* client already disconnected */ }
  });
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  setupAuth(app);

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
      await storage(req).deletePatient(id);
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

  app.post(api.doctors.create.path, requireAuth, async (req, res) => {
    try {
      const { doctorProfile, ...userInput } = api.doctors.create.input.parse(req.body);
      res.status(201).json(await storage(req).createDoctor(userInput, doctorProfile));
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      console.error(err);
      res.status(500).json({ message: "Failed to create doctor" });
    }
  });

  app.put(api.doctors.updateProfile.path, requireAuth, async (req, res) => {
    try {
      const userId = req.params.id;
      // Confirm the doctor belongs to this clinic before updating
      const doctor = await storage(req).getUser(userId);
      if (!doctor) return res.status(404).json({ message: "Doctor not found" });
      const { name, ...profileUpdates } = req.body;
      if (name) await storage(req).updateUser(userId, { name });
      res.json(await storage(req).updateDoctorProfile(userId, profileUpdates));
    } catch (err) {
      res.status(400).json({ message: "Failed to update doctor profile" });
    }
  });

  app.delete("/api/doctors/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.params.id;
      const doctor = await storage(req).getUser(userId);
      if (!doctor) return res.status(404).json({ message: "Doctor not found" });
      await storage(req).deleteDoctor(userId);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to delete doctor" });
    }
  });

  // ── APPOINTMENTS ──────────────────────────────────────────────────────────

  app.get(api.appointments.list.path, requireAuth, async (req, res) => {
    try {
      const date = req.query.date ? new Date(req.query.date as string) : undefined;
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
      const yesterday = new Date(); yesterday.setHours(0, 0, 0, 0);
      if (appointmentDate < yesterday && data.status !== "checked_in") {
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

      const apptDateOnly = new Date(data.date); apptDateOnly.setHours(0, 0, 0, 0);
      const apptEndOfDay = new Date(apptDateOnly); apptEndOfDay.setHours(23, 59, 59, 999);

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

      const [updated] = await db.update(appointments)
        .set(setClause)
        .where(and(eq(appointments.id, id), eq(appointments.clinicId, clinicId)))
        .returning();

      if (!updated) return res.status(404).json({ message: "Appointment not found" });

      if (updates.status === "completed") {
        await db.update(patients)
          .set({ status: "active", funnelStage: "consulted", lastContactedAt: new Date() })
          .where(and(eq(patients.id, updated.patientId), eq(patients.clinicId, clinicId)));
      }

      if (updated.doctorId) broadcastQueueUpdate(updated.doctorId);
      res.json(updated);
    } catch (err) {
      res.status(400).json({ message: "Failed to update appointment" });
    }
  });

  app.delete("/api/appointments/:id", requireAuth, async (req, res) => {
    try {
      await storage(req).deleteAppointment(Number(req.params.id));
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ message: "Failed to delete appointment" });
    }
  });

  // GET /api/appointments/queue-preview — next queue number for a doctor+date (auth required)
  app.get("/api/appointments/queue-preview", requireAuth, async (req, res) => {
    try {
      const { doctorId, date: dateParam } = req.query as { doctorId?: string; date?: string };
      if (!doctorId || !dateParam) return res.status(400).json({ message: "doctorId and date are required" });

      const clinicId = req.session.clinicId!;
      const [y, mo, d] = dateParam.split("-").map(Number);
      const targetDate = new Date(y, mo - 1, d);
      const targetStart = new Date(targetDate); targetStart.setHours(0, 0, 0, 0);
      const targetEnd = new Date(targetDate); targetEnd.setHours(23, 59, 59, 999);

      const [maxRow] = await db.select({
        maxNum: sql<number>`COALESCE(MAX(${appointments.queueNumber}), 0)::int`,
      }).from(appointments).where(and(
        eq(appointments.clinicId, clinicId),
        eq(appointments.doctorId, doctorId),
        gte(appointments.date, targetStart),
        lte(appointments.date, targetEnd),
      ));

      res.json({ nextQueueNumber: (maxRow?.maxNum ?? 0) + 1 });
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
        !orderedAppointmentIds.every((id: unknown) => Number.isInteger(id))
      ) {
        return res.status(400).json({ message: "orderedAppointmentIds must be a non-empty array of integers" });
      }

      let doctorId: string | null = null;

      await db.transaction(async (tx) => {
        // Fetch current positions for this set — we re-use the same position
        // values (just re-assigned to the new ordering) so other slots' patients
        // are never displaced.
        const existing = await tx
          .select({ id: appointments.id, queuePosition: appointments.queuePosition, doctorId: appointments.doctorId })
          .from(appointments)
          .where(and(
            sql`${appointments.id} IN (${sql.join(orderedAppointmentIds.map((id: number) => sql`${id}`), sql`, `)})`,
            eq(appointments.clinicId, req.session.clinicId!)
          ));

        if (existing.length > 0) doctorId = existing[0].doctorId;

        const sortedPositions = existing
          .map(a => a.queuePosition ?? 0)
          .sort((a, b) => a - b);

        for (let i = 0; i < orderedAppointmentIds.length; i++) {
          await tx.update(appointments)
            .set({ queuePosition: sortedPositions[i] ?? i + 1 })
            .where(and(
              eq(appointments.id, orderedAppointmentIds[i]),
              eq(appointments.clinicId, req.session.clinicId!)
            ));
        }
      });

      // Push real-time update to all SSE clients watching this doctor's queue
      if (doctorId) broadcastQueueUpdate(doctorId);

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to reorder queue" });
    }
  });

  // ── PUBLIC QUEUE (no auth) ────────────────────────────────────────────────

  app.get("/api/queue/:token", async (req, res) => {
    try {
      const token = req.params.token;
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const endOfDay = new Date(today); endOfDay.setHours(23, 59, 59, 999);

      const result = await db.transaction(async (tx) => {
        const [appt] = await tx.select().from(appointments).where(eq(appointments.queueToken, token));
        if (!appt) return null;

        // Always scope patient and doctor to the appointment's own clinic
        const [patient] = await tx.select().from(patients)
          .where(and(eq(patients.id, appt.patientId), eq(patients.clinicId, appt.clinicId!)));
        const [doctor] = await tx.select().from(users)
          .where(and(eq(users.id, appt.doctorId), eq(users.clinicId, appt.clinicId!)));
        if (!patient || !doctor) return null;

        // Link expires when appointment date is in the past and not yet completed
        const apptDate = new Date(appt.date); apptDate.setHours(0, 0, 0, 0);
        if (apptDate < today && appt.status !== "completed") {
          return {
            expired: true,
            status: appt.status,
            patientName: patient.name,
            doctorName: doctor.name || doctor.firstName || "Doctor",
            position: -1,
            aheadCount: -1,
            queuePosition: appt.queuePosition,
          };
        }

        // Scope to the appointment's clinic so position counts stay per-clinic
        const allDoctorAppts = await tx.select().from(appointments)
          .where(and(
            eq(appointments.doctorId, appt.doctorId),
            eq(appointments.clinicId, appt.clinicId!),
            gte(appointments.date, today),
            lte(appointments.date, endOfDay)
          ))
          .orderBy(appointments.queuePosition);

        // Only count patients still actively waiting (booked or paid/checked_in).
        // Excluding in_progress means: once the doctor starts seeing the patient
        // ahead of you, your position immediately reflects that you are next.
        const aheadCount = allDoctorAppts.filter(
          (a: any) => a.queuePosition !== null &&
            a.queuePosition! < (appt.queuePosition || 0) &&
            (a.status === "booked" || a.status === "checked_in")
        ).length;

        const isDone = appt.status === "completed" || appt.status === "cancelled" || appt.status === "no_show";

        return {
          expired: false,
          patientName: patient.name,
          doctorName: doctor.name || doctor.firstName || "Doctor",
          doctorId: appt.doctorId,
          position: isDone ? 0 : aheadCount + 1,
          aheadCount: isDone ? 0 : aheadCount,
          status: appt.status,
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
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const endOfDay = new Date(today); endOfDay.setHours(23, 59, 59, 999);

      const [doctorRow] = await db.select().from(users)
        .leftJoin(doctorProfiles, eq(doctorProfiles.userId, users.id))
        .where(and(eq(users.id, doctorId), eq(users.role, "doctor")));
      if (!doctorRow) return res.status(404).json({ message: "Doctor not found" });

      const clinicId = doctorRow.users.clinicId!;
      const todaysAppts = await db.select().from(appointments)
        .leftJoin(patients, and(eq(patients.id, appointments.patientId), eq(patients.clinicId, clinicId)))
        .where(and(
          eq(appointments.doctorId, doctorId),
          eq(appointments.clinicId, clinicId),
          gte(appointments.date, today),
          lte(appointments.date, endOfDay)
        ))
        .orderBy(appointments.queuePosition);

      res.json({
        doctor: { ...doctorRow.users, doctorProfile: doctorRow.doctor_profiles || null },
        queue: todaysAppts.map(r => ({
          ...r.appointments,
          patientName: r.patients?.name || "Patient",
        })),
      });
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

  app.post("/api/doctors/:id/delay", requireAuth, async (req, res) => {
    try {
      const doctorId = req.params.id;
      const { delayMinutes } = req.body;
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const endOfDay = new Date(today); endOfDay.setHours(23, 59, 59, 999);

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

  // ── DASHBOARD ─────────────────────────────────────────────────────────────

  app.get(api.dashboard.stats.path, requireAuth, async (req, res) => {
    try {
      res.json(await storage(req).getDashboardStats());
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // ── CRM ───────────────────────────────────────────────────────────────────

  app.post("/api/crm/send-bulk", requireAuth, async (req, res) => {
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

      // Find the clinic that owns this registration token
      const tokenRows = await db.select().from(clinicSettings)
        .where(eq(clinicSettings.key, "registrationToken"));
      const tokenRow = tokenRows.find((r: any) => r.value === token);
      if (!tokenRow) return res.status(404).json({ message: "Invalid registration link" });

      const clinicId = tokenRow.clinicId;

      const [profileRow] = await db.select().from(clinicSettings)
        .where(and(eq(clinicSettings.clinicId, clinicId), eq(clinicSettings.key, "clinicProfile")));
      const profile = (profileRow?.value as any) || {};

      // Determine the target date — default to today, clamp past dates to today
      const now = new Date();
      const todayMidnight = new Date(now); todayMidnight.setHours(0, 0, 0, 0);
      let targetDate: Date;
      const dateParam = req.query.date as string | undefined;
      if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
        const [y, mo, d] = dateParam.split("-").map(Number);
        targetDate = new Date(y, mo - 1, d);
        if (targetDate < todayMidnight) targetDate = new Date(todayMidnight);
      } else {
        targetDate = new Date(todayMidnight);
      }

      const isTargetToday = targetDate.toDateString() === todayMidnight.toDateString();
      const nowMins = isTargetToday ? now.getHours() * 60 + now.getMinutes() : 0;
      const dayName = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][targetDate.getDay()];

      const doctorRows = await db.select().from(users)
        .leftJoin(doctorProfiles, eq(doctorProfiles.userId, users.id))
        .where(and(eq(users.clinicId, clinicId), eq(users.role, "doctor")));

      const list = doctorRows.map(r => {
        const avail = (r.doctor_profiles?.availability as any)?.[dayName];
        const rawSlots: { start: string; end: string }[] =
          avail?.enabled && Array.isArray(avail?.slots) ? avail.slots : [];
        // For today: drop slots whose end time has already passed.
        // For future dates: show all slots.
        const activeSlots = isTargetToday
          ? rawSlots.filter(slot => {
              const [endH, endM] = slot.end.split(":").map(Number);
              return nowMins < endH * 60 + endM;
            })
          : rawSlots;
        return {
          id: r.users.id,
          name: r.users.name || [r.users.firstName, r.users.lastName].filter(Boolean).join(" ") || "Doctor",
          specialization: r.doctor_profiles?.specialization || "General Physician",
          slots: activeSlots,
        };
      });

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

      const tokenRows = await db.select().from(clinicSettings)
        .where(eq(clinicSettings.key, "registrationToken"));
      const tokenRow = tokenRows.find((r: any) => r.value === token);
      if (!tokenRow) return res.status(404).json({ message: "Invalid registration link" });
      const clinicId = tokenRow.clinicId;

      const now = new Date();
      const todayMidnight = new Date(now); todayMidnight.setHours(0, 0, 0, 0);
      let targetDate: Date;
      if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
        const [y, mo, d] = dateParam.split("-").map(Number);
        targetDate = new Date(y, mo - 1, d);
        if (targetDate < todayMidnight) targetDate = new Date(todayMidnight);
      } else {
        targetDate = new Date(todayMidnight);
      }
      const targetStart = new Date(targetDate); targetStart.setHours(0, 0, 0, 0);
      const targetEnd = new Date(targetDate); targetEnd.setHours(23, 59, 59, 999);

      const [maxRow] = await db.select({
        maxNum: sql<number>`COALESCE(MAX(${appointments.queueNumber}), 0)::int`,
      }).from(appointments).where(and(
        eq(appointments.clinicId, clinicId),
        eq(appointments.doctorId, doctorId),
        gte(appointments.date, targetStart),
        lte(appointments.date, targetEnd),
      ));

      res.json({ nextQueueNumber: (maxRow?.maxNum ?? 0) + 1 });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to get queue preview" });
    }
  });

  // POST /api/kiosk/:token  — register patient + create appointment (no auth)
  app.post("/api/kiosk/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const { name, phone, doctorId, reason, slotStart, date: dateParam } = req.body;

      if (!name?.trim() || !phone || !doctorId) {
        return res.status(400).json({ message: "Name, phone number, and doctor selection are required" });
      }
      const normalizedPhone = String(phone).replace(/\D/g, "");
      if (normalizedPhone.length < 10) {
        return res.status(400).json({ message: "Please enter a valid 10-digit phone number" });
      }
      const last10 = normalizedPhone.slice(-10);

      // Resolve clinic from token (read-only — safe outside transaction)
      const tokenRows = await db.select().from(clinicSettings)
        .where(eq(clinicSettings.key, "registrationToken"));
      const tokenRow = tokenRows.find((r: any) => r.value === token);
      if (!tokenRow) return res.status(404).json({ message: "Invalid registration link" });
      const clinicId = tokenRow.clinicId;

      // Verify doctor belongs to this clinic (read-only — safe outside transaction)
      const [doctor] = await db.select().from(users)
        .where(and(eq(users.id, doctorId), eq(users.clinicId, clinicId), eq(users.role, "doctor")));
      if (!doctor) return res.status(404).json({ message: "Doctor not found" });
      const doctorName = doctor.name || [doctor.firstName, doctor.lastName].filter(Boolean).join(" ") || "Doctor";

      // Resolve the target booking date — reject past dates
      const now = new Date();
      const todayMidnight = new Date(now); todayMidnight.setHours(0, 0, 0, 0);
      let targetDate: Date;
      if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
        const [y, mo, d] = dateParam.split("-").map(Number);
        targetDate = new Date(y, mo - 1, d);
        if (targetDate < todayMidnight) {
          return res.status(400).json({ message: "Cannot book appointments in the past" });
        }
      } else {
        targetDate = new Date(todayMidnight);
      }

      // Compute appointment date from availability (read-only — safe outside transaction)
      const [dpRow] = await db.select().from(doctorProfiles).where(eq(doctorProfiles.userId, doctorId));
      const targetStart = new Date(targetDate); targetStart.setHours(0, 0, 0, 0);
      const targetEnd = new Date(targetDate); targetEnd.setHours(23, 59, 59, 999);
      const isTargetToday = targetDate.toDateString() === todayMidnight.toDateString();
      const dayName = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][targetDate.getDay()];
      const availability = (dpRow?.availability as any)?.[dayName];
      let appointmentDate = new Date(targetDate);

      if (slotStart && /^\d{1,2}:\d{2}$/.test(slotStart)) {
        // Patient explicitly selected a slot on the chosen date
        const [slotH, slotM] = slotStart.split(":").map(Number);
        appointmentDate = new Date(targetDate);
        appointmentDate.setHours(slotH, slotM, 0, 0);
      } else if (availability?.slots?.length > 0) {
        // Auto-pick the first upcoming slot on the target date
        const nowMins = isTargetToday ? now.getHours() * 60 + now.getMinutes() : 0;
        for (const slot of (availability.slots as { start: string; end: string }[])) {
          const [endH, endM] = slot.end.split(":").map(Number);
          if (nowMins < endH * 60 + endM) {
            const [startH, startM] = slot.start.split(":").map(Number);
            appointmentDate = new Date(targetDate);
            appointmentDate.setHours(startH, startM, 0, 0);
            break;
          }
        }
      }

      // All mutating DB ops run inside a single transaction with two advisory locks:
      //   Lock 1 (clinicId, hash(phone)) — prevents concurrent duplicate patient creation
      //   Lock 2 (clinicId, hash(doctorId)) — prevents concurrent duplicate queue positions
      // Locks are acquired in a fixed order (phone first, then doctor) to avoid deadlocks.
      const result = await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(${clinicId}::int, hashtext(${last10})::int)`);
        await tx.execute(sql`SELECT pg_advisory_xact_lock(${clinicId}::int, hashtext(${doctorId})::int)`);

        // Find or create patient
        const [existingPatient] = await tx.select().from(patients)
          .where(and(
            eq(patients.clinicId, clinicId),
            sql`RIGHT(REGEXP_REPLACE(${patients.phone}, '[^0-9]', '', 'g'), 10) = ${last10}`
          ));
        let patient = existingPatient;
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
          patientName: result.patient.name,
          doctorName,
          queuePosition: result.appt.queuePosition,
          queueToken: result.appt.queueToken,
          queueUrl: `${req.protocol}://${req.get("host")}/patient-queue/${result.appt.queueToken}`,
        });
      }

      broadcastQueueUpdate(doctorId);

      res.status(201).json({
        alreadyRegistered: false,
        patientName: result.patient.name,
        doctorName,
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
  app.get("/api/pharmacy/stats", requireAuth, async (req, res) => {
    try {
      const clinicId = req.session.clinicId!;
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
      const thirtyDaysFromNow = new Date(); thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      const thirtyDaysStr = thirtyDaysFromNow.toISOString().split("T")[0];

      const [totalMeds] = await db.select({ count: count() }).from(medicines)
        .where(and(eq(medicines.clinicId, clinicId), eq(medicines.isActive, true)));

      const [lowStock] = await db.select({ count: count() }).from(medicines)
        .where(and(eq(medicines.clinicId, clinicId), eq(medicines.isActive, true),
          sql`${medicines.stockQty} <= ${medicines.minStockQty}`));

      const [expiringSoon] = await db.select({ count: count() }).from(medicines)
        .where(and(eq(medicines.clinicId, clinicId), eq(medicines.isActive, true),
          sql`${medicines.expiryDate} IS NOT NULL AND ${medicines.expiryDate} <= ${thirtyDaysStr} AND ${medicines.expiryDate} >= CURRENT_DATE`));

      const [todaySales] = await db.select({ total: sql<number>`COALESCE(SUM(${pharmacyBills.totalAmount}), 0)::int` })
        .from(pharmacyBills)
        .where(and(eq(pharmacyBills.clinicId, clinicId),
          gte(pharmacyBills.createdAt, todayStart), lte(pharmacyBills.createdAt, todayEnd)));

      const [monthSales] = await db.select({ total: sql<number>`COALESCE(SUM(${pharmacyBills.totalAmount}), 0)::int` })
        .from(pharmacyBills)
        .where(and(eq(pharmacyBills.clinicId, clinicId),
          gte(pharmacyBills.createdAt, new Date(new Date().getFullYear(), new Date().getMonth(), 1))));

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
  app.get("/api/pharmacy/medicines", requireAuth, async (req, res) => {
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
  app.post("/api/pharmacy/medicines", requireAuth, async (req, res) => {
    try {
      const clinicId = req.session.clinicId!;
      const [med] = await db.insert(medicines).values({ ...req.body, clinicId }).returning();
      res.json(med);
    } catch (err: any) {
      res.status(400).json({ message: err?.message || "Failed to create medicine" });
    }
  });

  // PUT /api/pharmacy/medicines/:id
  app.put("/api/pharmacy/medicines/:id", requireAuth, async (req, res) => {
    try {
      const clinicId = req.session.clinicId!;
      const { id } = req.params;
      const [med] = await db.update(medicines).set({ ...req.body })
        .where(and(eq(medicines.id, Number(id)), eq(medicines.clinicId, clinicId))).returning();
      if (!med) return res.status(404).json({ message: "Medicine not found" });
      res.json(med);
    } catch (err: any) {
      res.status(400).json({ message: err?.message || "Failed to update medicine" });
    }
  });

  // DELETE /api/pharmacy/medicines/:id (soft delete)
  app.delete("/api/pharmacy/medicines/:id", requireAuth, async (req, res) => {
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
  app.get("/api/pharmacy/bills", requireAuth, async (req, res) => {
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
  app.post("/api/pharmacy/bills", requireAuth, async (req, res) => {
    try {
      const clinicId = req.session.clinicId!;
      const { items, ...rest } = req.body;
      // Deduct stock for each item
      await db.transaction(async (tx) => {
        for (const item of (items as any[])) {
          if (item.medicineId) {
            await tx.update(medicines)
              .set({ stockQty: sql`${medicines.stockQty} - ${item.qty}` })
              .where(and(eq(medicines.id, item.medicineId), eq(medicines.clinicId, clinicId)));
          }
        }
        const [bill] = await tx.insert(pharmacyBills)
          .values({ ...rest, items, clinicId }).returning();
        res.json(bill);
      });
    } catch (err: any) {
      res.status(400).json({ message: err?.message || "Failed to create pharmacy bill" });
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

  app.patch("/api/settings/:key", requireAuth, async (req, res) => {
    try {
      const { key } = req.params;
      if (!["whatsapp", "sms", "clinicProfile"].includes(key)) return res.status(400).json({ message: "Unknown settings key" });
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
      const { utr, planType } = req.body;
      if (!utr) return res.status(400).json({ message: "UTR is required" });
      const resolvedPlan = (PLAN_PRICES[planType] ? planType : "monthly") as string;
      const resolvedAmount = PLAN_PRICES[resolvedPlan];

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

  // ══ SUPER ADMIN ══════════════════════════════════════════════════════════

  app.get("/api/admin/clinics", requireSuperAdmin, async (_req, res) => {
    try {
      const allClinics = await db.select().from(clinics).orderBy(desc(clinics.createdAt));
      const now = new Date();

      const enriched = await Promise.all(allClinics.map(async (c) => {
        const [{ value: patientCount }] = await db.select({ value: sql<number>`count(*)` }).from(patients).where(eq(patients.clinicId, c.id));
        const [{ value: apptCount }] = await db.select({ value: sql<number>`count(*)` }).from(appointments).where(eq(appointments.clinicId, c.id));
        const payments = await db.select().from(clinicPayments).where(eq(clinicPayments.clinicId, c.id));
        const totalPaid = payments.filter(p => p.status === "approved").reduce((s, p) => s + p.amount, 0);

        const { passwordHash: _, ...safe } = c;
        const isExpired = (c.planStatus === "trial" && c.trialEndsAt && c.trialEndsAt < now) ||
          (c.planStatus === "active" && c.subscriptionEndsAt && c.subscriptionEndsAt < now);

        return {
          ...safe,
          patientCount: Number(patientCount),
          apptCount: Number(apptCount),
          totalPaid: totalPaid / 100,
          isExpired,
          daysLeft: c.planStatus === "trial" && c.trialEndsAt
            ? Math.ceil((c.trialEndsAt.getTime() - now.getTime()) / 86400000)
            : c.subscriptionEndsAt
              ? Math.ceil((c.subscriptionEndsAt.getTime() - now.getTime()) / 86400000)
              : null,
        };
      }));

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
      const trial = allClinics.filter(c => c.planStatus === "trial" && c.trialEndsAt && c.trialEndsAt > now).length;
      const active = allClinics.filter(c => c.planStatus === "active").length;
      const expired = allClinics.filter(c =>
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
      const id = Number(req.params.id);
      const [current] = await db.select().from(clinicPayments).where(eq(clinicPayments.id, id));
      if (!current) return res.status(404).json({ message: "Payment not found" });
      if (current.status !== "pending") return res.status(400).json({ message: "Only pending payments can be approved or rejected" });
      const [payment] = await db.update(clinicPayments)
        .set({ status, notes })
        .where(eq(clinicPayments.id, id))
        .returning();
      if (!payment) return res.status(404).json({ message: "Payment not found" });

      // Activate clinic when payment approved
      if (status === "approved") {
        const subEnds = new Date();
        if (payment.planType === "quarterly") subEnds.setMonth(subEnds.getMonth() + 3);
        else if (payment.planType === "annual") subEnds.setFullYear(subEnds.getFullYear() + 1);
        else subEnds.setMonth(subEnds.getMonth() + 1);
        await db.update(clinics)
          .set({ planStatus: "active", subscriptionEndsAt: subEnds })
          .where(eq(clinics.id, payment.clinicId));
      }
      res.json(payment);
    } catch (err) {
      res.status(500).json({ message: "Failed to update payment" });
    }
  });

  app.patch("/api/admin/clinics/:id", requireSuperAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { action, days } = req.body;

      let updates: Record<string, any> = {};
      if (action === "activate") {
        const subEnds = new Date(); subEnds.setMonth(subEnds.getMonth() + 1);
        updates = { planStatus: "active", subscriptionEndsAt: subEnds };
      } else if (action === "extend-trial") {
        const trialEnds = new Date(); trialEnds.setDate(trialEnds.getDate() + (days || 7));
        updates = { planStatus: "trial", trialEndsAt: trialEnds };
      } else if (action === "expire") {
        updates = { planStatus: "expired" };
      } else {
        return res.status(400).json({ message: "Unknown action" });
      }

      const [updated] = await db.update(clinics).set(updates).where(eq(clinics.id, id)).returning();
      if (!updated) return res.status(404).json({ message: "Clinic not found" });
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

  return httpServer;
}
