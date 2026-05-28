import { db } from "./db";
import {
  users, patients, appointments, doctorProfiles, notifications, prescriptions, bills, clinicSettings,
  clinics, clinicPayments,
  type User, type UpsertUser, type Patient, type InsertPatient,
  type Appointment, type InsertAppointment, type DoctorProfile,
  type Notification, type Prescription, type InsertPrescription,
  type Bill, type InsertBill, type ClinicSetting, type Clinic, type ClinicPayment,
} from "@shared/schema";
import { eq, and, desc, sql, gte, lte, like, or } from "drizzle-orm";
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

  async getDoctors(): Promise<(User & { doctorProfile: DoctorProfile | null })[]> {
    const rows = await db
      .select()
      .from(users)
      .leftJoin(doctorProfiles, eq(doctorProfiles.userId, users.id))
      .where(and(eq(users.role, "doctor"), eq(users.clinicId, this.clinicId)));
    return rows.map(r => ({ ...r.users, doctorProfile: r.doctor_profiles || null }));
  }

  async createDoctor(userInput: UpsertUser, profile?: any): Promise<User> {
    return await db.transaction(async (tx) => {
      const [user] = await tx.insert(users).values({ ...userInput, clinicId: this.clinicId }).returning();
      const profileData = profile
        ? { ...profile, userId: user!.id }
        : { userId: user!.id, specialization: "General Practice" };
      await tx.insert(doctorProfiles).values(profileData);
      return user!;
    });
  }

  async createDoctorProfile(profile: any): Promise<DoctorProfile> {
    const [row] = await db.insert(doctorProfiles).values(profile).returning();
    return row!;
  }

  async updateDoctorProfile(userId: string, profile: Partial<DoctorProfile>): Promise<DoctorProfile> {
    const [row] = await db.update(doctorProfiles)
      .set(profile)
      .where(eq(doctorProfiles.userId, userId))
      .returning();
    return row!;
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

  // ── Appointments ──────────────────────────────────────────────────────────

  async getAppointments(filters: { date?: Date; doctorId?: string; status?: string; patientId?: number }): Promise<(Appointment & { patient: Patient; doctor: User; bill?: Bill | null })[]> {
    let conditions: any[] = [eq(appointments.clinicId, this.clinicId)];

    if (filters.date) {
      const startOfDay = new Date(filters.date); startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(filters.date); endOfDay.setHours(23, 59, 59, 999);
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
      .leftJoin(patients, and(eq(patients.id, appointments.patientId), eq(patients.clinicId, this.clinicId)))
      .leftJoin(users, and(eq(users.id, appointments.doctorId), eq(users.clinicId, this.clinicId)))
      .leftJoin(bills, and(eq(bills.appointmentId, appointments.id), eq(bills.clinicId, this.clinicId)))
      .where(and(...conditions))
      .orderBy(desc(appointments.date));

    return rows.map(r => ({
      ...r.appointments,
      patient: {
        ...r.patients!,
        source: r.patients?.source || "internal",
        status: r.patients?.status || "active",
        funnelStage: r.patients?.funnelStage || "new",
      },
      doctor: r.users!,
      bill: r.bills || null,
    }));
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

  // ── Dashboard ─────────────────────────────────────────────────────────────

  async getDashboardStats(): Promise<any> {
    const today = new Date(); today.setHours(0, 0, 0, 0);

    const todaysAppts = await this.getAppointments({ date: today });
    const completed = todaysAppts.filter(a => a.status === "completed").length;

    const weeklyData = [];
    let totalRevenue = 0;

    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
      const dayEnd = new Date(d); dayEnd.setHours(23, 59, 59, 999);

      const dayAppts = await db.select().from(appointments)
        .where(and(eq(appointments.clinicId, this.clinicId), gte(appointments.date, d), lte(appointments.date, dayEnd)));

      const dayBills = await db.select().from(bills)
        .where(and(eq(bills.clinicId, this.clinicId), gte(bills.billingDate, d), lte(bills.billingDate, dayEnd), eq(bills.status, "paid")));

      const dayRevenue = dayBills.reduce((acc, b) => acc + b.amount, 0) / 100;
      totalRevenue += dayRevenue;

      const waitTimes = dayAppts
        .filter(a => a.checkInTime && a.consultationStartTime)
        .map(a => (a.consultationStartTime!.getTime() - a.checkInTime!.getTime()) / 60000);

      const avgWait = waitTimes.length > 0
        ? Math.round(waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length)
        : 0;

      weeklyData.push({ date: format(d, "MMM dd"), patients: dayAppts.length, avgWait, revenue: dayRevenue });
    }

    const allBills = await db.select().from(bills).where(eq(bills.clinicId, this.clinicId));
    const totalPending = allBills.filter(b => b.status === "pending").reduce((acc, b) => acc + b.amount, 0);
    const totalCollected = allBills.filter(b => b.status === "paid").reduce((acc, b) => acc + b.amount, 0);

    const doctors = await this.getDoctors();
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

    const allPatients = await this.getPatients();
    const sourceDistribution = allPatients.reduce((acc: any, p) => {
      acc[p.source || "other"] = (acc[p.source || "other"] || 0) + 1;
      return acc;
    }, {});

    return {
      dailyPatients: todaysAppts.length,
      completedToday: completed,
      avgWaitTime: weeklyData[weeklyData.length - 1]?.avgWait ?? 0,
      totalRevenue,
      totalPending: totalPending / 100,
      totalCollected: totalCollected / 100,
      weeklyData,
      activeQueues,
      sourceDistribution: Object.entries(sourceDistribution).map(([name, value]) => ({ name, value })),
    };
  }
}

export function getStorage(clinicId: number) {
  return new DatabaseStorage(clinicId);
}
