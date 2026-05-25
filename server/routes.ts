import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { getStorage } from "./storage";
import { api } from "@shared/routes";
import { notifications, patients, appointments, users, bills, clinics, clinicPayments, prescriptions, clinicSettings, doctorProfiles } from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, desc, sql, count, sum } from "drizzle-orm";
import { z } from "zod";
import { setupAuth, requireAuth, requireSuperAdmin } from "./auth";
import { nanoid } from "nanoid";
import bcrypt from "bcryptjs";

function storage(req: Request) {
  return getStorage(req.session.clinicId!);
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
      res.json(await storage(req).updatePatient(id, req.body));
    } catch (err) {
      res.status(400).json({ message: "Failed to update patient" });
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
      const { name, ...profileUpdates } = req.body;
      if (name) await storage(req).updateUser(userId, { name });
      res.json(await storage(req).updateDoctorProfile(userId, profileUpdates));
    } catch (err) {
      res.status(400).json({ message: "Failed to update doctor profile" });
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

      const today = new Date(); today.setHours(0, 0, 0, 0);
      const todaysAppts = await storage(req).getAppointments({ date: today, doctorId: data.doctorId });
      const maxQueue = todaysAppts.reduce((m, a) => Math.max(m, a.queueNumber || 0), 0);
      const maxPos = todaysAppts.reduce((m, a) => Math.max(m, a.queuePosition || 0), 0);

      const appt = await storage(req).createAppointment({
        ...data,
        queueNumber: maxQueue + 1,
        queuePosition: maxPos + 1,
        queueToken: nanoid(8),
      } as any);
      res.status(201).json(appt);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      console.error(err);
      res.status(500).json({ message: "Failed to create appointment" });
    }
  });

  app.patch(api.appointments.update.path, requireAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const updates = req.body;
      const appt = await storage(req).getAppointment(id);
      if (!appt) return res.status(404).json({ message: "Appointment not found" });

      if (updates.status === "in_progress" && !appt.consultationStartTime) {
        updates.consultationStartTime = new Date();
      }
      if (updates.status === "completed") {
        if (!appt.checkInTime) updates.checkInTime = new Date();
        updates.completedAt = new Date();
        await db.update(patients)
          .set({ status: "active", funnelStage: "consulted", lastContactedAt: new Date() })
          .where(and(eq(patients.id, appt.patientId), eq(patients.clinicId, req.session.clinicId!)));
      }
      res.json(await storage(req).updateAppointment(id, updates));
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

  // ── QUEUE REORDER ─────────────────────────────────────────────────────────

  app.patch("/api/queue/reorder", requireAuth, async (req, res) => {
    try {
      const { orderedAppointmentIds } = req.body;
      if (!Array.isArray(orderedAppointmentIds)) {
        return res.status(400).json({ message: "orderedAppointmentIds array is required" });
      }
      await db.transaction(async (tx) => {
        for (let i = 0; i < orderedAppointmentIds.length; i++) {
          await tx.update(appointments)
            .set({ queuePosition: i + 1 })
            .where(and(eq(appointments.id, orderedAppointmentIds[i]), eq(appointments.clinicId, req.session.clinicId!)));
        }
      });
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
        const [patient] = await tx.select().from(patients).where(eq(patients.id, appt.patientId));
        const [doctor] = await tx.select().from(users).where(eq(users.id, appt.doctorId));
        if (!patient || !doctor) return null;

        const allDoctorAppts = await tx.select().from(appointments)
          .where(and(eq(appointments.doctorId, appt.doctorId), gte(appointments.date, today), lte(appointments.date, endOfDay)))
          .orderBy(appointments.date);

        const aheadInQueue = allDoctorAppts.filter(
          (a: any) => a.queuePosition !== null &&
            a.queuePosition! < (appt.queuePosition || 0) &&
            a.status !== "completed" && a.status !== "cancelled" && a.status !== "no_show"
        ).length;

        return {
          patientName: patient.name,
          doctorName: doctor.name || doctor.firstName || "Doctor",
          position: appt.status === "completed" ? 0 : aheadInQueue + 1,
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

      const [doctor] = await db.select().from(users).where(eq(users.id, doctorId));
      if (!doctor) return res.status(404).json({ message: "Doctor not found" });

      const todaysAppts = await db.select().from(appointments)
        .leftJoin(patients, eq(patients.id, appointments.patientId))
        .where(and(eq(appointments.doctorId, doctorId), gte(appointments.date, today), lte(appointments.date, endOfDay)))
        .orderBy(appointments.queuePosition);

      res.json({
        doctor,
        queue: todaysAppts.map(r => ({
          ...r.appointments,
          patientName: r.patients?.name || "Patient",
        })),
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to get public queue" });
    }
  });

  // ── NOTIFY DELAY ──────────────────────────────────────────────────────────

  app.post("/api/appointments/notify-delay", requireAuth, async (req, res) => {
    try {
      const { doctorId, delayMinutes } = req.body;
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
      res.status(201).json(await storage(req).createBill(req.body));
    } catch (err) {
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
      res.status(201).json(await storage(req).createPrescription(req.body));
    } catch (err) {
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
      const sentCount = await db.transaction(async (tx) => {
        let count = 0;
        for (const id of patientIds) {
          const [patient] = await tx.select().from(patients)
            .where(and(eq(patients.id, id), eq(patients.clinicId, req.session.clinicId!)));
          if (patient) {
            const msg = message.replace(/{name}/g, patient.name);
            console.log(`[CRM] ${channel} → ${patient.name} (${patient.phone}): ${msg}`);
            await tx.insert(notifications).values({
              clinicId: req.session.clinicId!,
              patientId: patient.id,
              type: `${channel}_marketing`,
              message: msg,
            });
            count++;
          }
        }
        return count;
      });
      res.json({ success: true, count: sentCount });
    } catch (err) {
      res.status(500).json({ message: "Failed to send bulk messages" });
    }
  });

  // ── SETTINGS ─────────────────────────────────────────────────────────────

  app.get("/api/settings", requireAuth, async (req, res) => {
    try {
      const settings = await storage(req).getAllSettings();
      const masked = Object.fromEntries(
        Object.entries(settings).map(([k, v]) => {
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
      if (!["whatsapp", "sms"].includes(key)) return res.status(400).json({ message: "Unknown settings key" });
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

  app.post("/api/payments", requireAuth, async (req, res) => {
    try {
      const { amount, utr } = req.body;
      if (!amount || !utr) return res.status(400).json({ message: "Amount and UTR are required" });
      const [payment] = await db.insert(clinicPayments).values({
        clinicId: req.session.clinicId!,
        amount: Math.round(Number(amount) * 100),
        utr: String(utr).trim(),
        status: "pending",
        paidAt: new Date(),
      }).returning();
      res.status(201).json(payment);
    } catch (err) {
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
      const [payment] = await db.update(clinicPayments)
        .set({ status, notes })
        .where(eq(clinicPayments.id, id))
        .returning();
      if (!payment) return res.status(404).json({ message: "Payment not found" });

      // Activate clinic when payment approved
      if (status === "approved") {
        const existing = await db.select().from(clinics).where(eq(clinics.id, payment.clinicId));
        const clinic = existing[0];
        if (clinic) {
          const subEnds = new Date();
          subEnds.setMonth(subEnds.getMonth() + 1);
          await db.update(clinics)
            .set({ planStatus: "active", subscriptionEndsAt: subEnds })
            .where(eq(clinics.id, payment.clinicId));
        }
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
