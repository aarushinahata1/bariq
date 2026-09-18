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
import { eq, and, desc, asc, sql, gte, lte, ilike, or, inArray } from "drizzle-orm";
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
      // appointments.doctorId and prescriptions.doctorId are NOT NULL foreign keys to
      // users with no cascade, so the DELETE below fails outright for any doctor who
      // has ever been booked — which surfaced as an opaque 500. Past clinical records
      // must not be deleted to make room for it either, so refuse explicitly and let
      // the route turn this into an actionable message.
      const [history] = await tx.select({ cnt: sql<number>`count(*)::int` })
        .from(appointments)
        .where(and(eq(appointments.clinicId, this.clinicId), eq(appointments.doctorId, userId)));
      if ((history?.cnt ?? 0) > 0) {
        throw Object.assign(
          new Error(`This doctor has ${history!.cnt} appointment record(s) that must be kept`),
          { code: "DOCTOR_HAS_HISTORY", count: history!.cnt },
        );
      }

      await tx.delete(doctorProfiles)
        .where(and(eq(doctorProfiles.userId, userId), this.doctorInThisClinic(userId)));
      await tx.delete(users)
        .where(and(eq(users.id, userId), eq(users.clinicId, this.clinicId)));
    });
  }

  // ── Patients ──────────────────────────────────────────────────────────────

  async getPatients(
    search?: string,
    filters?: { status?: string; source?: string; limit?: number },
  ): Promise<(Patient & { lastAppointmentStatus?: string | null })[]> {
    const appointmentStatuses = ["booked", "checked_in", "in_progress", "completed", "cancelled", "no_show"];
    const conditions: any[] = [eq(patients.clinicId, this.clinicId)];

    if (search) {
      // ILIKE, not LIKE: Postgres LIKE is case-sensitive, so searching "john" never
      // matched "John Doe" — the same case-insensitive match the medicine search uses.
      // % and _ are escaped so a stray wildcard in the box doesn't match everything.
      const term = search.replace(/[\\%_]/g, c => `\\${c}`);
      conditions.push(or(ilike(patients.name, `%${term}%`), ilike(patients.phone, `%${term}%`)));
    }

    // EXISTS instead of loading every matching appointment id into Node and
    // re-injecting them as a giant IN (...) list — that second round trip grew with
    // the clinic's entire appointment history.
    if (filters?.status && appointmentStatuses.includes(filters.status)) {
      conditions.push(sql`EXISTS (
        SELECT 1 FROM ${appointments}
        WHERE ${appointments.patientId} = ${patients.id}
          AND ${appointments.clinicId} = ${this.clinicId}
          AND ${appointments.status} = ${filters.status}
      )`);
    }

    if (filters?.source) conditions.push(eq(patients.source, filters.source));

    // Hard ceiling so one clinic's list can never become an unbounded scan-and-ship;
    // the UI filters client-side, so this is the safety net, not the pagination.
    const limit = Math.min(Math.max(1, filters?.limit ?? 5000), 5000);

    // The "last appointment status" badge used to cost a second query that pulled
    // EVERY appointment belonging to EVERY returned patient just to read the newest
    // one per patient. A LATERAL does that inside the same scan, touching one index
    // row per patient instead.
    const rows = await db
      .select({
        patient: patients,
        lastAppointmentStatus: sql<string | null>`last_appt.status`,
      })
      .from(patients)
      .leftJoin(
        sql`LATERAL (
          SELECT a.status
          FROM ${appointments} a
          WHERE a.patient_id = ${patients.id} AND a.clinic_id = ${this.clinicId}
          ORDER BY a.date DESC, a.id DESC
          LIMIT 1
        ) AS last_appt`,
        sql`true`,
      )
      .where(and(...conditions))
      .orderBy(desc(patients.createdAt))
      .limit(limit);

    return rows.map(r => ({ ...r.patient, lastAppointmentStatus: r.lastAppointmentStatus ?? null }));
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

  async getAppointments(filters: {
    date?: Date; doctorId?: string; status?: string; patientId?: number;
    from?: Date; to?: Date; limit?: number;
  }): Promise<(Appointment & { patient: Patient; doctor: Omit<User, "passwordHash"> | null; bill?: Bill | null })[]> {
    let conditions: any[] = [eq(appointments.clinicId, this.clinicId)];

    if (filters.date) {
      // Use a fixed 24 h window from the passed timestamp rather than setHours(),
      // which is server-timezone-dependent.  Callers (routes.ts) are responsible
      // for passing the correct day-start timestamp (IST midnight for Indian clinics).
      const startOfDay = new Date(filters.date);
      const endOfDay = new Date(filters.date.getTime() + 24 * 60 * 60 * 1000 - 1);
      conditions.push(and(gte(appointments.date, startOfDay), lte(appointments.date, endOfDay)));
    }
    // Explicit window (used by the Appointments page's tabs) — keeps "all appointments
    // ever" off the wire while still letting the UI reach any range it asks for.
    if (filters.from) conditions.push(gte(appointments.date, filters.from));
    if (filters.to) conditions.push(lte(appointments.date, filters.to));
    if (filters.doctorId) conditions.push(eq(appointments.doctorId, filters.doctorId));
    if (filters.patientId) conditions.push(eq(appointments.patientId, filters.patientId));
    if (filters.status) {
      const statuses = filters.status.split(",");
      conditions.push(sql`${appointments.status} IN (${sql.join(statuses.map(s => sql`${s}`), sql`, `)})`);
    }

    // Hard ceiling on rows per request. This endpoint used to be unbounded: with no
    // filters it serialised every appointment the clinic had ever taken, each with a
    // full patient row, a full user row and a bill attached.
    const limit = Math.min(Math.max(1, filters.limit ?? 1000), 2000);

    // Explicit projection rather than `select()`: the bare form returns every column
    // of all four joined tables, including patient columns no list view reads and the
    // doctor's entire user row. Same data the callers use, a fraction of the bytes.
    const rows = await db
      .select({
        appointment: appointments,
        patient: {
          id: patients.id,
          clinicId: patients.clinicId,
          name: patients.name,
          phone: patients.phone,
          email: patients.email,
          source: patients.source,
          status: patients.status,
          funnelStage: patients.funnelStage,
          dateOfBirth: patients.dateOfBirth,
          gender: patients.gender,
          bloodGroup: patients.bloodGroup,
          allergies: patients.allergies,
          createdAt: patients.createdAt,
        },
        doctor: {
          id: users.id,
          name: users.name,
          firstName: users.firstName,
          lastName: users.lastName,
          role: users.role,
        },
        bill: bills,
      })
      .from(appointments)
      .leftJoin(patients, eq(patients.id, appointments.patientId))
      .leftJoin(users, eq(users.id, appointments.doctorId))
      .leftJoin(bills, and(eq(bills.appointmentId, appointments.id), eq(bills.clinicId, this.clinicId)))
      .where(and(...conditions))
      // `date` alone isn't a reliable sort key: the booking form has no time picker, so
      // every walk-in appointment on a given day gets the same default time-of-day
      // (istDateToInstant's 9:00 AM default) and Postgres then breaks that tie in
      // unspecified/unstable order — which is what made queue numbers look shuffled
      // in this list. queuePosition (asc; NULLS LAST is Postgres's default for ASC) is
      // the actual queue order, and id is a final tiebreaker for full determinism.
      .orderBy(desc(appointments.date), asc(appointments.queuePosition), asc(appointments.id))
      .limit(limit);

    return rows.map(r => ({
      ...r.appointment,
      patient: {
        ...(r.patient as any),
        source: r.patient?.source || "internal",
        status: r.patient?.status || "active",
        funnelStage: r.patient?.funnelStage || "new",
      },
      // doctorId is a hard FK but the referenced user can still be deleted, so this
      // leftJoin can legitimately come back empty — callers must handle null.
      doctor: r.doctor?.id ? r.doctor : null,
      bill: r.bill || null,
    })) as any;
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
    // An id from another clinic (or an already-deleted one) matches nothing, and the
    // non-null assertion handed that `undefined` back as a valid Appointment.
    if (!row) throw new Error("Appointment not found");
    return row;
  }

  async deleteAppointment(id: number): Promise<void> {
    // bills.appointmentId and prescriptions.appointmentId are NOT NULL foreign keys
    // with no cascade, so deleting the appointment on its own raised a FK violation
    // for any visit that had been billed or prescribed for — which is most of them.
    // Same dependency-order delete deletePatient already does.
    await db.transaction(async (tx) => {
      await tx.delete(prescriptions)
        .where(and(eq(prescriptions.clinicId, this.clinicId), eq(prescriptions.appointmentId, id)));
      await tx.delete(bills)
        .where(and(eq(bills.clinicId, this.clinicId), eq(bills.appointmentId, id)));
      await tx.delete(appointments)
        .where(and(eq(appointments.id, id), eq(appointments.clinicId, this.clinicId)));
    });
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
    // Whole-day subtraction in raw ms, for the same reason the weeklyData loop below
    // does it: `today` is an IST-midnight instant, and setDate() reads/writes it
    // through the server's local calendar, which shifts the bucket off IST.
    const weekStart = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);

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

    // Everything below is aggregated by Postgres and comes back as a handful of rows.
    // This used to pull every appointment for the week, every paid bill for the week,
    // and a full four-table join of today's appointments (with patient, doctor and bill
    // rows attached) into Node just to count them and average two timestamps — on every
    // 60s poll, from every open dashboard, growing with each clinic's volume. The
    // numbers are identical; the bytes crossing the wire are not.
    const IST_INTERVAL = sql`interval '5 hours 30 minutes'`;

    const [weekByDay, weekRevenueByDay, pendingTotal, liveQueues, liveWait, sourceCounts, rangeApptStats, rangeCollected] = await Promise.all([
      // One row per IST day: appointment count + average wait for consultations that
      // actually started that day.
      db.select({
        day: sql<string>`to_char((${appointments.date} + ${IST_INTERVAL})::date, 'YYYY-MM-DD')`,
        patients: sql<number>`count(*)::int`,
        avgWait: sql<number>`COALESCE(ROUND(AVG(
          CASE WHEN ${appointments.checkInTime} IS NOT NULL AND ${appointments.consultationStartTime} IS NOT NULL
               THEN EXTRACT(EPOCH FROM (${appointments.consultationStartTime} - ${appointments.checkInTime})) / 60
          END
        )), 0)::int`,
      }).from(appointments)
        .where(and(eq(appointments.clinicId, this.clinicId), gte(appointments.date, weekStart), lte(appointments.date, endOfToday)))
        .groupBy(sql`(${appointments.date} + ${IST_INTERVAL})::date`),

      db.select({
        day: sql<string>`to_char((${bills.billingDate} + ${IST_INTERVAL})::date, 'YYYY-MM-DD')`,
        revenue: sql<number>`COALESCE(SUM(${bills.amount}), 0)::int`,
      }).from(bills)
        .where(and(eq(bills.clinicId, this.clinicId), gte(bills.billingDate, weekStart), lte(bills.billingDate, endOfToday), eq(bills.status, "paid")))
        .groupBy(sql`(${bills.billingDate} + ${IST_INTERVAL})::date`),

      // Aggregated in SQL rather than pulling every bill this clinic has ever
      // issued into Node just to sum one field — that scan only grows over a
      // clinic's lifetime, and this query re-runs on every dashboard poll.
      db.select({ total: sql<number>`COALESCE(SUM(${bills.amount}), 0)::int` })
        .from(bills).where(and(eq(bills.clinicId, this.clinicId), eq(bills.status, "pending"))),

      // Today's waiting count per doctor, with the doctor's name and consult time —
      // only doctors who actually have someone waiting come back.
      db.select({
        doctorId: appointments.doctorId,
        doctorName: users.name,
        avgConsultationTime: doctorProfiles.avgConsultationTime,
        waitingCount: sql<number>`count(*)::int`,
      }).from(appointments)
        .leftJoin(users, eq(users.id, appointments.doctorId))
        .leftJoin(doctorProfiles, eq(doctorProfiles.userId, appointments.doctorId))
        .where(and(
          eq(appointments.clinicId, this.clinicId),
          gte(appointments.date, today), lte(appointments.date, endOfToday),
          inArray(appointments.status, ["booked", "checked_in", "in_progress"]),
        ))
        .groupBy(appointments.doctorId, users.name, doctorProfiles.avgConsultationTime)
        // GROUP BY output order is unspecified, and this list is re-rendered on every
        // dashboard refresh — without an explicit order the doctor cards reshuffle.
        .orderBy(desc(sql`count(*)`), users.name),

      // Live average wait: elapsed minutes for everyone checked in and not yet seen.
      db.select({
        avgMinutes: sql<number>`COALESCE(ROUND(AVG(
          GREATEST(0, EXTRACT(EPOCH FROM (NOW() - COALESCE(${appointments.checkInTime}, ${appointments.date}))) / 60)
        )), 0)::int`,
      }).from(appointments)
        .where(and(
          eq(appointments.clinicId, this.clinicId),
          gte(appointments.date, today), lte(appointments.date, endOfToday),
          eq(appointments.status, "checked_in"),
        )),

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

    // Stitch the per-day rows onto the 7-day axis (missing days = zero).
    const apptsByDay = new Map(weekByDay.map(r => [r.day, r]));
    const revenueByDay = new Map(weekRevenueByDay.map(r => [r.day, r.revenue]));

    const weeklyData = [];
    let totalRevenue = 0;
    for (let i = 6; i >= 0; i--) {
      // `today` is already an IST-midnight instant — subtract whole days by raw ms
      // instead of setDate()/setHours(), which reset to the server's local (UTC)
      // midnight and silently shift every bucket ~5.5h off its IST calendar day.
      const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      // Shift by the IST offset before formatting so the label (and the key matched
      // against the SQL buckets, which are grouped in IST) reflects the IST date —
      // date-fns' format() reads local (server/UTC) getters otherwise.
      const istDay = new Date(d.getTime() + IST_MS);
      const key = istDay.toISOString().slice(0, 10);
      const dayRevenue = (revenueByDay.get(key) ?? 0) / 100;
      totalRevenue += dayRevenue;
      weeklyData.push({
        date: format(istDay, "MMM dd"),
        patients: apptsByDay.get(key)?.patients ?? 0,
        avgWait: apptsByDay.get(key)?.avgWait ?? 0,
        revenue: dayRevenue,
      });
    }

    // Pending is always the current outstanding balance across all time — it doesn't
    // make sense to scope "how much is currently owed" to a reporting date range the
    // way "how much did we collect in this period" does.
    const totalPending = pendingTotal[0]?.total ?? 0;
    const rangeCollectedAmount = rangeCollected[0]?.total ?? 0;

    const activeQueues = liveQueues.map(q => ({
      doctorId: q.doctorId,
      doctorName: q.doctorName,
      waitingCount: q.waitingCount,
      currentWaitTime: q.waitingCount * (q.avgConsultationTime || 15),
    }));

    const sourceDistribution = sourceCounts.map(r => ({ name: r.source || "other", value: r.cnt }));

    // Live average wait, not the historical weeklyData figure: the old avgWaitTime
    // (today's bucket of weeklyData) only measures checkInTime→consultationStartTime
    // gaps for consultations that have already STARTED — so on a slow morning, or
    // whenever nobody has been called in yet, it sits frozen at 0 (or a stale earlier
    // value) while people physically checked in keep waiting longer with nothing
    // reflecting it. This instead measures elapsed wait, right now, for everyone
    // currently checked in and not yet seen.
    const avgWaitTime = liveWait[0]?.avgMinutes ?? 0;

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
