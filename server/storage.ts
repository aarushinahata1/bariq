import { db } from "./db";
import {
  users, patients, appointments, doctorProfiles, notifications, prescriptions, bills, clinicSettings,
  clinics, clinicPayments, dentalCharts, bodyCharts,
  type User, type UpsertUser, type Patient, type InsertPatient,
  type Appointment, type InsertAppointment, type DoctorProfile,
  type Notification, type Prescription, type InsertPrescription,
  type Bill, type InsertBill, type ClinicSetting, type Clinic, type ClinicPayment,
  type DentalChart, type InsertDentalChart, type BodyChart, type InsertBodyChart,
} from "@shared/schema";
import { eq, and, desc, sql, gte, lte, like, or, inArray } from "drizzle-orm";
import { format } from "date-fns";

export class DatabaseStorage {
  constructor(private readonly clinicId: number) {}

  // ── Settings ──────────────────────────────────────────────────────────────

  async getSetting(key: string): Promise<any> {
    const [row] = await db.select().from(clinicSettings)
      .where(and(eq(clinicSettings.clinicId, this.clinicId), eq(clinicSettings.key, key)));
    return row?.value ?? null;
  }

  async upsertSetting(key: string, value: any): Promise<ClinicSetting> {
    const [row] = await db.insert(clinicSettings)
      .values({ clinicId: this.clinicId, key, value, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [clinicSettings.clinicId, clinicSettings.key],
        set: { value, updatedAt: new Date() },
      })
      .returning();
    return row!;
  }

  async getAllSettings(): Promise<Record<string, any>> {
    const rows = await db.select().from(clinicSettings)
      .where(eq(clinicSettings.clinicId, this.clinicId));
    return Object.fromEntries(rows.map(r => [r.key, r.value]));
  }

  // ── Users / Doctors ───────────────────────────────────────────────────────

  async getUser(id: string): Promise<User | undefined> {
    const [row] = await db.select().from(users)
      .where(and(eq(users.id, id), eq(users.clinicId, this.clinicId)));
    return row;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [row] = await db.select().from(users)
      .where(and(eq(users.email, email), eq(users.clinicId, this.clinicId)));
    return row;
  }

  async createUser(user: UpsertUser): Promise<User> {
    const [row] = await db.insert(users).values({ ...user, clinicId: this.clinicId }).returning();
    return row!;
  }

  async updateUser(id: string, updates: Partial<UpsertUser>): Promise<User> {
    const [row] = await db.update(users)
      .set(updates)
      .where(and(eq(users.id, id), eq(users.clinicId, this.clinicId)))
      .returning();
    if (!row) throw new Error("User not found");
    return row;
  }

  async getDoctors(): Promise<(Omit<User, "passwordHash"> & { doctorProfile: DoctorProfile | null })[]> {
    const rows = await db
      .select()
      .from(users)
      .leftJoin(doctorProfiles, eq(doctorProfiles.userId, users.id))
      .where(and(eq(users.role, "doctor"), eq(users.clinicId, this.clinicId)));
    return rows.map(r => {
      const { passwordHash, ...safeUser } = r.users;
      return { ...safeUser, doctorProfile: r.doctor_profiles || null };
    });
  }

  async createDoctor(userInput: UpsertUser, profile?: any): Promise<Omit<User, "passwordHash">> {
    const user = await db.transaction(async (tx) => {
      // role is forced here, not trusted from userInput — see insertUserSchema.
      const [row] = await tx.insert(users).values({ ...userInput, clinicId: this.clinicId, role: "doctor" }).returning();
      const profileData = profile
        ? { ...profile, userId: row!.id }
        : { userId: row!.id, specialization: "General Practice" };
      await tx.insert(doctorProfiles).values(profileData);
      return row!;
    });
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }

  async createDoctorProfile(profile: any): Promise<DoctorProfile> {
    const [row] = await db.insert(doctorProfiles).values(profile).returning();
    return row!;
  }

  // doctorProfiles has no clinicId column of its own, so tenant-scoping has to go
  // through a subquery on users — route-layer callers already pre-check ownership via
  // getUser(), but this keeps the guarantee here too rather than relying solely on that.
  private doctorInThisClinic(userId: string) {
    return inArray(doctorProfiles.userId, db.select({ id: users.id }).from(users)
      .where(and(eq(users.id, userId), eq(users.clinicId, this.clinicId))));
  }

  async updateDoctorProfile(userId: string, profile: Partial<DoctorProfile>): Promise<DoctorProfile> {
    const [row] = await db.update(doctorProfiles)
      .set(profile)
      .where(and(eq(doctorProfiles.userId, userId), this.doctorInThisClinic(userId)))
      .returning();
    if (!row) throw new Error("Doctor not found");
    return row;
  }

  async deleteDoctor(userId: string): Promise<void> {
    await db.transaction(async (tx) => {
      // Cancel all active/upcoming appointments for this doctor
      await tx.update(appointments)
        .set({ status: "cancelled" })
        .where(and(
          eq(appointments.clinicId, this.clinicId),
          eq(appointments.doctorId, userId),
          sql`${appointments.status} IN ('booked', 'checked_in')`
        ));
      await tx.delete(doctorProfiles)
        .where(and(eq(doctorProfiles.userId, userId), this.doctorInThisClinic(userId)));
      await tx.delete(users)
        .where(and(eq(users.id, userId), eq(users.clinicId, this.clinicId)));
    });
  }

  // ── Patients ──────────────────────────────────────────────────────────────

  async getPatients(search?: string, filters?: { status?: string; source?: string }): Promise<(Patient & { lastAppointmentStatus?: string | null })[]> {
    const appointmentStatuses = ["booked", "checked_in", "in_progress", "completed", "cancelled", "no_show"];
    let conditions: any[] = [eq(patients.clinicId, this.clinicId)];

    if (search) {
      conditions.push(or(like(patients.name, `%${search}%`), like(patients.phone, `%${search}%`)));
    }

    if (filters?.status && appointmentStatuses.includes(filters.status)) {
      const rows = await db.select({ patientId: appointments.patientId })
        .from(appointments)
        .where(and(eq(appointments.clinicId, this.clinicId), sql`${appointments.status} = ${filters.status}`));
      const ids = Array.from(new Set(rows.map(r => r.patientId)));
      if (ids.length > 0) {
        conditions.push(sql`${patients.id} IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})`);
      } else {
        return [];
      }
    }

    if (filters?.source) conditions.push(eq(patients.source, filters.source));

    const patientRows = await db.select().from(patients)
      .where(and(...conditions))
      .orderBy(desc(patients.createdAt));

    const patientIds = patientRows.map(p => p.id);
    if (patientIds.length === 0) return patientRows.map(p => ({ ...p, lastAppointmentStatus: null }));

    const latestAppts = await db.select({
      patientId: appointments.patientId,
      status: appointments.status,
      date: appointments.date,
    }).from(appointments)
      .where(and(
        eq(appointments.clinicId, this.clinicId),
        sql`${appointments.patientId} IN (${sql.join(patientIds.map(id => sql`${id}`), sql`, `)})`,
      ))
      .orderBy(desc(appointments.date));

    const latestStatusMap = new Map<number, string>();
    for (const appt of latestAppts) {
      if (!latestStatusMap.has(appt.patientId)) latestStatusMap.set(appt.patientId, appt.status);
    }

    return patientRows.map(p => ({ ...p, lastAppointmentStatus: latestStatusMap.get(p.id) || null }));
  }

  async getPatient(id: number): Promise<Patient | undefined> {
    const [row] = await db.select().from(patients)
      .where(and(eq(patients.id, id), eq(patients.clinicId, this.clinicId)));
    return row;
  }

  async createPatient(patient: InsertPatient): Promise<Patient> {
    const [row] = await db.insert(patients).values({ ...patient, clinicId: this.clinicId }).returning();
    return row!;
  }

  async updatePatient(id: number, updates: Partial<InsertPatient>): Promise<Patient> {
    const [updated] = await db.update(patients)
      .set(updates)
      .where(and(eq(patients.id, id), eq(patients.clinicId, this.clinicId)))
      .returning();
    if (!updated) throw new Error("Patient not found");
    return updated;
  }

  async deletePatient(id: number): Promise<void> {
    await db.transaction(async (tx) => {
      const apptRows = await tx.select({ id: appointments.id }).from(appointments)
        .where(and(eq(appointments.clinicId, this.clinicId), eq(appointments.patientId, id)));
      const apptIds = apptRows.map(a => a.id);
      if (apptIds.length > 0) {
        await tx.delete(prescriptions).where(inArray(prescriptions.appointmentId, apptIds));
        await tx.delete(bills).where(inArray(bills.appointmentId, apptIds));
      }
      await tx.delete(notifications)
        .where(and(eq(notifications.clinicId, this.clinicId), eq(notifications.patientId, id)));
      await tx.delete(appointments)
        .where(and(eq(appointments.clinicId, this.clinicId), eq(appointments.patientId, id)));
      await tx.delete(patients)
        .where(and(eq(patients.id, id), eq(patients.clinicId, this.clinicId)));
    });
  }

  // ── Appointments ──────────────────────────────────────────────────────────

  async getAppointments(filters: { date?: Date; doctorId?: string; status?: string; patientId?: number }): Promise<(Appointment & { patient: Patient; doctor: Omit<User, "passwordHash"> | null; bill?: Bill | null })[]> {
    let conditions: any[] = [eq(appointments.clinicId, this.clinicId)];

    if (filters.date) {
      // Use a fixed 24 h window from the passed timestamp rather than setHours(),
      // which is server-timezone-dependent.  Callers (routes.ts) are responsible
      // for passing the correct day-start timestamp (IST midnight for Indian clinics).
      const startOfDay = new Date(filters.date);
      const endOfDay = new Date(filters.date.getTime() + 24 * 60 * 60 * 1000 - 1);
      conditions.push(and(gte(appointments.date, startOfDay), lte(appointments.date, endOfDay)));
    }
    if (filters.doctorId) conditions.push(eq(appointments.doctorId, filters.doctorId));
    if (filters.patientId) conditions.push(eq(appointments.patientId, filters.patientId));
    if (filters.status) {
      const statuses = filters.status.split(",");
      conditions.push(sql`${appointments.status} IN (${sql.join(statuses.map(s => sql`${s}`), sql`, `)})`);
    }

    const rows = await db
      .select()
      .from(appointments)
      .leftJoin(patients, eq(patients.id, appointments.patientId))
      .leftJoin(users, eq(users.id, appointments.doctorId))
      .leftJoin(bills, and(eq(bills.appointmentId, appointments.id), eq(bills.clinicId, this.clinicId)))
      .where(and(...conditions))
      .orderBy(desc(appointments.date));

    return rows.map(r => {
      // doctorId is a hard FK but the referenced user can still be deleted (deleteDoctor
      // only cascades booked/checked_in appointments to "cancelled", not the FK itself),
      // so this leftJoin can legitimately come back empty — callers must handle null.
      let doctor: Omit<User, "passwordHash"> | null = null;
      if (r.users) {
        const { passwordHash, ...safeDoctor } = r.users;
        doctor = safeDoctor;
      }
      return {
        ...r.appointments,
        patient: {
          ...r.patients!,
          source: r.patients?.source || "internal",
          status: r.patients?.status || "active",
          funnelStage: r.patients?.funnelStage || "new",
        },
        doctor,
        bill: r.bills || null,
      };
    });
  }

  async getAppointment(id: number): Promise<Appointment | undefined> {
    const [row] = await db.select().from(appointments)
      .where(and(eq(appointments.id, id), eq(appointments.clinicId, this.clinicId)));
    return row;
  }

  async createAppointment(appt: InsertAppointment): Promise<Appointment> {
    const [row] = await db.insert(appointments).values({ ...appt, clinicId: this.clinicId }).returning();
    return row!;
  }

  async updateAppointment(id: number, updates: Partial<InsertAppointment>): Promise<Appointment> {
    const [row] = await db.update(appointments)
      .set(updates)
      .where(and(eq(appointments.id, id), eq(appointments.clinicId, this.clinicId)))
      .returning();
    return row!;
  }

  async deleteAppointment(id: number): Promise<void> {
    await db.delete(appointments)
      .where(and(eq(appointments.id, id), eq(appointments.clinicId, this.clinicId)));
  }

  // ── Bills ─────────────────────────────────────────────────────────────────

  async getBills(filters: { patientId?: number; appointmentId?: number }): Promise<Bill[]> {
    let conditions: any[] = [eq(bills.clinicId, this.clinicId)];
    if (filters.patientId) conditions.push(eq(bills.patientId, filters.patientId));
    if (filters.appointmentId) conditions.push(eq(bills.appointmentId, filters.appointmentId));
    return db.select().from(bills).where(and(...conditions)).orderBy(desc(bills.createdAt));
  }

  async createBill(bill: InsertBill): Promise<Bill> {
    const [row] = await db.insert(bills).values({ ...bill, clinicId: this.clinicId }).returning();
    return row!;
  }

  async getBill(id: number): Promise<Bill | undefined> {
    const [row] = await db.select().from(bills)
      .where(and(eq(bills.id, id), eq(bills.clinicId, this.clinicId)));
    return row;
  }

  // ── Prescriptions ─────────────────────────────────────────────────────────

  async getPrescriptions(filters: { appointmentId?: number; patientId?: number }): Promise<Prescription[]> {
    let conditions: any[] = [eq(prescriptions.clinicId, this.clinicId)];
    if (filters.appointmentId) conditions.push(eq(prescriptions.appointmentId, filters.appointmentId));
    if (filters.patientId) conditions.push(eq(prescriptions.patientId, filters.patientId));
    return db.select().from(prescriptions).where(and(...conditions)).orderBy(desc(prescriptions.createdAt));
  }

  async createPrescription(prescription: InsertPrescription): Promise<Prescription> {
    const [row] = await db.insert(prescriptions).values({ ...prescription, clinicId: this.clinicId }).returning();
    return row!;
  }

  // ── Dental Charts ─────────────────────────────────────────────────────────

  async getDentalChart(patientId: number): Promise<DentalChart | undefined> {
    const [row] = await db.select().from(dentalCharts)
      .where(and(eq(dentalCharts.patientId, patientId), eq(dentalCharts.clinicId, this.clinicId)));
    return row;
  }

  async upsertDentalChart(patientId: number, updates: Partial<InsertDentalChart>): Promise<DentalChart> {
    const { clinicId: _cid, patientId: _pid, ...rest } = updates as any;
    const [row] = await db.insert(dentalCharts)
      .values({ clinicId: this.clinicId, patientId, ...rest, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: dentalCharts.patientId,
        set: { ...rest, updatedAt: new Date() },
      })
      .returning();
    return row!;
  }

  // ── Ortho / Physio Body Charts ───────────────────────────────────────────────

  async getBodyChart(patientId: number): Promise<BodyChart | undefined> {
    const [row] = await db.select().from(bodyCharts)
      .where(and(eq(bodyCharts.patientId, patientId), eq(bodyCharts.clinicId, this.clinicId)));
    return row;
  }

  async upsertBodyChart(patientId: number, updates: Partial<InsertBodyChart>): Promise<BodyChart> {
    const { clinicId: _cid, patientId: _pid, ...rest } = updates as any;
    const [row] = await db.insert(bodyCharts)
      .values({ clinicId: this.clinicId, patientId, ...rest, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: bodyCharts.patientId,
        set: { ...rest, updatedAt: new Date() },
      })
      .returning();
    return row!;
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────

  // `range` scopes the top "Patients"/"Completed"/"Collected" report cards — omit it
  // (or pass nulls) for all-time. Live/operational figures (today's queue, active
  // doctors, avgWaitTime, the 7-day trend charts) always stay tied to today/now
  // regardless of `range`, since those describe what's happening right now, not a
  // historical report.
  async getDashboardStats(range?: { start: Date | null; end: Date | null }): Promise<any> {
    const IST_MS = 5.5 * 60 * 60 * 1000;
    const nowIST = new Date(Date.now() + IST_MS);
    const s = new Date(nowIST); s.setUTCHours(0, 0, 0, 0);
    const e = new Date(nowIST); e.setUTCHours(23, 59, 59, 999);
    const today = new Date(s.getTime() - IST_MS);
    const endOfToday = new Date(e.getTime() - IST_MS);
    const weekStart = new Date(today); weekStart.setDate(weekStart.getDate() - 6);

    const rangeStart = range?.start ?? today;
    const rangeEnd = range?.end ?? endOfToday;
    const rangeApptConditions = [eq(appointments.clinicId, this.clinicId)];
    const rangeBillConditions = [eq(bills.clinicId, this.clinicId), eq(bills.status, "paid")];
    if (range?.start && range?.end) {
      rangeApptConditions.push(gte(appointments.date, range.start), lte(appointments.date, range.end));
      rangeBillConditions.push(gte(bills.billingDate, range.start), lte(bills.billingDate, range.end));
    } else if (!range) {
      rangeApptConditions.push(gte(appointments.date, rangeStart), lte(appointments.date, rangeEnd));
      rangeBillConditions.push(gte(bills.billingDate, rangeStart), lte(bills.billingDate, rangeEnd));
    }
    // else range = {start: null, end: null} ("all time") — no date bound added

    const [todaysAppts, weekAppts, weekPaidBills, pendingTotal, doctors, sourceCounts, rangeApptStats, rangeCollected] = await Promise.all([
      this.getAppointments({ date: today }),
      db.select({
        id: appointments.id,
        date: appointments.date,
        status: appointments.status,
        doctorId: appointments.doctorId,
        checkInTime: appointments.checkInTime,
        consultationStartTime: appointments.consultationStartTime,
      }).from(appointments)
        .where(and(eq(appointments.clinicId, this.clinicId), gte(appointments.date, weekStart), lte(appointments.date, endOfToday))),
      db.select({ amount: bills.amount, billingDate: bills.billingDate })
        .from(bills)
        .where(and(eq(bills.clinicId, this.clinicId), gte(bills.billingDate, weekStart), lte(bills.billingDate, endOfToday), eq(bills.status, "paid"))),
      // Aggregated in SQL rather than pulling every bill this clinic has ever
      // issued into Node just to sum one field — that scan only grows over a
      // clinic's lifetime, and this query re-runs on every dashboard poll (60s).
      db.select({ total: sql<number>`COALESCE(SUM(${bills.amount}), 0)::int` })
        .from(bills).where(and(eq(bills.clinicId, this.clinicId), eq(bills.status, "pending"))),
      this.getDoctors(),
      db.select({ source: patients.source, cnt: sql<number>`count(*)::int` })
        .from(patients)
        .where(eq(patients.clinicId, this.clinicId))
        .groupBy(patients.source),
      db.select({
        total: sql<number>`count(*)::int`,
        completed: sql<number>`count(*) filter (where ${appointments.status} = 'completed')::int`,
      }).from(appointments).where(and(...rangeApptConditions)),
      db.select({ total: sql<number>`COALESCE(SUM(${bills.amount}), 0)::int` })
        .from(bills).where(and(...rangeBillConditions)),
    ]);

    // Build weekly chart data from in-memory aggregation
    const weeklyData = [];
    let totalRevenue = 0;
    for (let i = 6; i >= 0; i--) {
      // `today` is already an IST-midnight instant — subtract whole days by raw ms
      // instead of setDate()/setHours(), which reset to the server's local (UTC)
      // midnight and silently shift every bucket ~5.5h off its IST calendar day.
      const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const dEnd = new Date(d.getTime() + 24 * 60 * 60 * 1000 - 1);
      const dayTs = d.getTime();
      const dEndTs = dEnd.getTime();

      const dayAppts = weekAppts.filter(a => {
        const t = new Date(a.date).getTime();
        return t >= dayTs && t <= dEndTs;
      });
      const dayBills = weekPaidBills.filter(b => {
        const t = new Date(b.billingDate).getTime();
        return t >= dayTs && t <= dEndTs;
      });

      const dayRevenue = dayBills.reduce((acc, b) => acc + b.amount, 0) / 100;
      totalRevenue += dayRevenue;

      const waitTimes = dayAppts
        .filter(a => a.checkInTime && a.consultationStartTime)
        .map(a => (new Date(a.consultationStartTime!).getTime() - new Date(a.checkInTime!).getTime()) / 60000);

      const avgWait = waitTimes.length > 0
        ? Math.round(waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length)
        : 0;

      // Shift by the IST offset before formatting so the label reflects the IST
      // calendar date — date-fns' format() reads local (server/UTC) getters otherwise.
      weeklyData.push({ date: format(new Date(d.getTime() + IST_MS), "MMM dd"), patients: dayAppts.length, avgWait, revenue: dayRevenue });
    }

    // Pending is always the current outstanding balance across all time — it doesn't
    // make sense to scope "how much is currently owed" to a reporting date range the
    // way "how much did we collect in this period" does.
    const totalPending = pendingTotal[0]?.total ?? 0;
    const rangeCollectedAmount = rangeCollected[0]?.total ?? 0;

    const activeQueues = doctors.map(doc => {
      const docAppts = todaysAppts.filter(a => a.doctorId === doc.id);
      const docWaiting = docAppts.filter(a => ["booked", "checked_in", "in_progress"].includes(a.status)).length;
      return {
        doctorId: doc.id,
        doctorName: doc.name,
        waitingCount: docWaiting,
        currentWaitTime: docWaiting * (doc.doctorProfile?.avgConsultationTime || 15),
      };
    }).filter(q => q.waitingCount > 0);

    const sourceDistribution = sourceCounts.map(r => ({ name: r.source || "other", value: r.cnt }));

    // Live average wait, not the historical weeklyData figure: the old avgWaitTime
    // (today's bucket of weeklyData) only measures checkInTime→consultationStartTime
    // gaps for consultations that have already STARTED — so on a slow morning, or
    // whenever nobody has been called in yet, it sits frozen at 0 (or a stale earlier
    // value) while people physically checked in keep waiting longer with nothing
    // reflecting it. This instead measures elapsed wait, right now, for everyone
    // currently checked in and not yet seen — it changes every time the dashboard
    // polls, same as the room actually looks.
    const now = Date.now();
    const currentlyWaiting = todaysAppts.filter(a => a.status === "checked_in");
    const liveWaitMinutes = currentlyWaiting.map(a => {
      const since = a.checkInTime ? new Date(a.checkInTime).getTime() : new Date(a.date).getTime();
      return Math.max(0, (now - since) / 60000);
    });
    const avgWaitTime = liveWaitMinutes.length > 0
      ? Math.round(liveWaitMinutes.reduce((a, b) => a + b, 0) / liveWaitMinutes.length)
      : 0;

    return {
      // These three respect the requested `range` (default: today); everything else
      // below stays tied to today/now regardless of it.
      dailyPatients: rangeApptStats[0]?.total ?? 0,
      completedToday: rangeApptStats[0]?.completed ?? 0,
      totalCollected: rangeCollectedAmount / 100,
      avgWaitTime,
      totalRevenue,
      totalPending: totalPending / 100,
      weeklyData,
      activeQueues,
      sourceDistribution,
    };
  }
}

export function getStorage(clinicId: number) {
  return new DatabaseStorage(clinicId);
}
