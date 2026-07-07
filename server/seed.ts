import { db } from "./db";
import {
  clinics, users, doctorProfiles, patients, appointments, bills, prescriptions,
} from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { hashPassword } from "./auth";

const DAY = 86400000;
const now = new Date();
const today = new Date(now); today.setHours(0, 0, 0, 0);

function daysAgo(n: number, h = 10, m = 0) {
  const d = new Date(today.getTime() - n * DAY);
  d.setHours(h, m, 0, 0);
  return d;
}

async function seed() {
  console.log("Seeding...");

  // ── Demo Clinic ───────────────────────────────────────────────────────────
  const demoEmail = "demo@bariq.in";
  let clinic = (await db.select().from(clinics).where(eq(clinics.email, demoEmail)))[0];
  if (!clinic) {
    const passwordHash = await hashPassword("demo1234");
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 7);
    [clinic] = await db.insert(clinics).values({
      name: "BariQ Demo Clinic",
      email: demoEmail,
      passwordHash,
      phone: "9876500000",
      address: "123, Demo Street, Bangalore",
      planStatus: "active",
      trialEndsAt,
    }).returning();
    console.log(`  created demo clinic (id=${clinic!.id})`);
  } else {
    console.log(`  skip demo clinic (id=${clinic.id})`);
  }
  const clinicId = clinic!.id;

  // ── Doctors ───────────────────────────────────────────────────────────────
  const doctorData = [
    {
      user: { id: crypto.randomUUID(), email: "dr.sharma@bariq.in", name: "Priya Sharma", firstName: "Priya", lastName: "Sharma", role: "doctor" as const, clinicId },
      profile: { specialization: "General Physician", avgConsultationTime: 12, consultationFee: 50000 },
    },
    {
      user: { id: crypto.randomUUID(), email: "dr.mehta@bariq.in", name: "Rohan Mehta", firstName: "Rohan", lastName: "Mehta", role: "doctor" as const, clinicId },
      profile: { specialization: "Paediatrician", avgConsultationTime: 15, consultationFee: 60000 },
    },
    {
      user: { id: crypto.randomUUID(), email: "dr.iyer@bariq.in", name: "Kavitha Iyer", firstName: "Kavitha", lastName: "Iyer", role: "doctor" as const, clinicId },
      profile: { specialization: "Gynaecologist", avgConsultationTime: 20, consultationFee: 80000 },
    },
  ];

  const insertedDoctors: typeof doctorData = [];
  for (const d of doctorData) {
    const existing = await db.select().from(users)
      .where(and(eq(users.email, d.user.email), eq(users.clinicId, clinicId)));
    if (existing.length > 0) {
      insertedDoctors.push({ user: existing[0] as any, profile: d.profile });
      console.log(`  skip doctor ${d.user.email}`);
      continue;
    }
    const [u] = await db.insert(users).values(d.user).returning();
    await db.insert(doctorProfiles).values({ ...d.profile, userId: u!.id });
    insertedDoctors.push({ user: u as any, profile: d.profile });
    console.log(`  created doctor ${u!.name}`);
  }

  // ── Receptionist ──────────────────────────────────────────────────────────
  const recepEmail = "reception@bariq.in";
  const recepExists = await db.select().from(users)
    .where(and(eq(users.email, recepEmail), eq(users.clinicId, clinicId)));
  if (recepExists.length === 0) {
    await db.insert(users).values({ id: crypto.randomUUID(), email: recepEmail, name: "Sunita Rao", firstName: "Sunita", lastName: "Rao", role: "receptionist", clinicId });
    console.log("  created receptionist");
  }

  // ── Patients ──────────────────────────────────────────────────────────────
  const existingPatients = await db.select().from(patients).where(eq(patients.clinicId, clinicId));
  if (existingPatients.length > 0) {
    console.log(`  skip ${existingPatients.length} existing patients`);
    console.log("\nSeed complete! (partial — patients already exist)");
    return;
  }

  const patientRows = await db.insert(patients).values([
    { name: "Aarav Patel",    phone: "9876543210", email: "aarav.patel@gmail.com",    source: "internal",  status: "active", funnelStage: "consulted", notes: "Mild hypertension, on medication", clinicId },
    { name: "Sneha Reddy",    phone: "9123456780", email: "sneha.reddy@gmail.com",    source: "online",    status: "active", funnelStage: "consulted", clinicId },
    { name: "Karan Malhotra", phone: "9988776655", email: null,                       source: "referral",  status: "active", funnelStage: "consulted", referralSource: "Dr. Desai", clinicId },
    { name: "Preethi Nair",   phone: "9871234560", email: "preethi.n@yahoo.com",      source: "social",    status: "active", funnelStage: "consulted", clinicId },
    { name: "Vikram Singh",   phone: "9765432100", email: null,                       source: "internal",  status: "active", funnelStage: "new", clinicId },
    { name: "Ananya Joshi",   phone: "9654321001", email: "ananya.joshi@gmail.com",   source: "online",    status: "active", funnelStage: "consulted", clinicId },
    { name: "Ravi Kumar",     phone: "9543210012", email: null,                       source: "referral",  status: "active", funnelStage: "consulted", referralSource: "Family friend", clinicId },
    { name: "Deepika Verma",  phone: "9432100123", email: "deepika.v@hotmail.com",    source: "social",    status: "active", funnelStage: "consulted", clinicId },
    { name: "Arjun Bhat",     phone: "9321001234", email: null,                       source: "internal",  status: "lead",   funnelStage: "new", clinicId },
    { name: "Meera Pillai",   phone: "9210012345", email: "meera.pillai@gmail.com",   source: "online",    status: "active", funnelStage: "consulted", clinicId },
    { name: "Suresh Gupta",   phone: "9100123456", email: null,                       source: "internal",  status: "active", funnelStage: "new", clinicId },
    { name: "Lakshmi Rao",    phone: "9001234567", email: "lakshmi.rao@gmail.com",    source: "referral",  status: "active", funnelStage: "consulted", referralSource: "Apollo Hospital", clinicId },
  ]).returning();
  console.log(`  created ${patientRows.length} patients`);

  const [p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12] = patientRows;
  const [doc1, doc2, doc3] = insertedDoctors;

  // ── Appointments ──────────────────────────────────────────────────────────
  type ApptInsert = {
    patientId: number; doctorId: string; date: Date; clinicId: number;
    status: typeof import("@shared/schema").appointmentStatus[number];
    reason?: string; notes?: string; queueNumber: number; queuePosition: number;
    queueToken: string; checkInTime?: Date; consultationStartTime?: Date; completedAt?: Date;
  };

  function makeToken() { return crypto.randomUUID().slice(0, 8); }

  const appts: ApptInsert[] = [
    // 6 days ago
    { patientId: p1!.id, doctorId: doc1!.user.id, date: daysAgo(6, 9, 15), status: "completed", reason: "Routine checkup", notes: "BP 130/85", queueNumber: 1, queuePosition: 1, queueToken: makeToken(), checkInTime: daysAgo(6, 9, 10), consultationStartTime: daysAgo(6, 9, 20), completedAt: daysAgo(6, 9, 32), clinicId },
    { patientId: p3!.id, doctorId: doc1!.user.id, date: daysAgo(6, 10, 0), status: "completed", reason: "Fever & cold", queueNumber: 2, queuePosition: 2, queueToken: makeToken(), checkInTime: daysAgo(6, 9, 55), consultationStartTime: daysAgo(6, 10, 35), completedAt: daysAgo(6, 10, 47), clinicId },
    { patientId: p7!.id, doctorId: doc2!.user.id, date: daysAgo(6, 9, 30), status: "completed", reason: "Child vaccination", queueNumber: 1, queuePosition: 1, queueToken: makeToken(), checkInTime: daysAgo(6, 9, 25), consultationStartTime: daysAgo(6, 9, 35), completedAt: daysAgo(6, 9, 50), clinicId },
    // 5 days ago
    { patientId: p2!.id, doctorId: doc3!.user.id, date: daysAgo(5, 11, 0), status: "completed", reason: "Gynaecology consult", queueNumber: 1, queuePosition: 1, queueToken: makeToken(), checkInTime: daysAgo(5, 10, 50), consultationStartTime: daysAgo(5, 11, 10), completedAt: daysAgo(5, 11, 35), clinicId },
    { patientId: p5!.id, doctorId: doc1!.user.id, date: daysAgo(5, 9, 0), status: "no_show", reason: "Follow-up", queueNumber: 1, queuePosition: 1, queueToken: makeToken(), clinicId },
    { patientId: p8!.id, doctorId: doc1!.user.id, date: daysAgo(5, 10, 0), status: "completed", reason: "Diabetes review", queueNumber: 2, queuePosition: 2, queueToken: makeToken(), checkInTime: daysAgo(5, 9, 55), consultationStartTime: daysAgo(5, 10, 15), completedAt: daysAgo(5, 10, 30), clinicId },
    // 4 days ago
    { patientId: p4!.id, doctorId: doc3!.user.id, date: daysAgo(4, 10, 30), status: "completed", reason: "Prenatal checkup", queueNumber: 1, queuePosition: 1, queueToken: makeToken(), checkInTime: daysAgo(4, 10, 20), consultationStartTime: daysAgo(4, 10, 40), completedAt: daysAgo(4, 11, 5), clinicId },
    { patientId: p6!.id, doctorId: doc2!.user.id, date: daysAgo(4, 9, 0), status: "completed", reason: "Child fever", queueNumber: 1, queuePosition: 1, queueToken: makeToken(), checkInTime: daysAgo(4, 8, 55), consultationStartTime: daysAgo(4, 9, 10), completedAt: daysAgo(4, 9, 25), clinicId },
    { patientId: p10!.id, doctorId: doc1!.user.id, date: daysAgo(4, 11, 0), status: "cancelled", reason: "General OPD", queueNumber: 3, queuePosition: 3, queueToken: makeToken(), clinicId },
    // 3 days ago
    { patientId: p9!.id, doctorId: doc1!.user.id, date: daysAgo(3, 9, 0), status: "completed", reason: "Chest pain", notes: "ECG normal", queueNumber: 1, queuePosition: 1, queueToken: makeToken(), checkInTime: daysAgo(3, 8, 50), consultationStartTime: daysAgo(3, 9, 5), completedAt: daysAgo(3, 9, 20), clinicId },
    { patientId: p11!.id, doctorId: doc2!.user.id, date: daysAgo(3, 10, 0), status: "completed", reason: "Child growth checkup", queueNumber: 1, queuePosition: 1, queueToken: makeToken(), checkInTime: daysAgo(3, 9, 58), consultationStartTime: daysAgo(3, 10, 15), completedAt: daysAgo(3, 10, 33), clinicId },
    // 2 days ago
    { patientId: p12!.id, doctorId: doc3!.user.id, date: daysAgo(2, 11, 0), status: "completed", reason: "PCOS consult", queueNumber: 1, queuePosition: 1, queueToken: makeToken(), checkInTime: daysAgo(2, 10, 55), consultationStartTime: daysAgo(2, 11, 10), completedAt: daysAgo(2, 11, 35), clinicId },
    { patientId: p1!.id, doctorId: doc1!.user.id, date: daysAgo(2, 10, 0), status: "completed", reason: "BP follow-up", queueNumber: 2, queuePosition: 2, queueToken: makeToken(), checkInTime: daysAgo(2, 9, 55), consultationStartTime: daysAgo(2, 10, 12), completedAt: daysAgo(2, 10, 25), clinicId },
    // Yesterday
    { patientId: p3!.id, doctorId: doc1!.user.id, date: daysAgo(1, 9, 30), status: "completed", reason: "General OPD", queueNumber: 1, queuePosition: 1, queueToken: makeToken(), checkInTime: daysAgo(1, 9, 25), consultationStartTime: daysAgo(1, 9, 38), completedAt: daysAgo(1, 9, 52), clinicId },
    { patientId: p2!.id, doctorId: doc3!.user.id, date: daysAgo(1, 11, 0), status: "completed", reason: "Follow-up", queueNumber: 2, queuePosition: 2, queueToken: makeToken(), checkInTime: daysAgo(1, 10, 55), consultationStartTime: daysAgo(1, 11, 20), completedAt: daysAgo(1, 11, 45), clinicId },
    { patientId: p5!.id, doctorId: doc2!.user.id, date: daysAgo(1, 10, 0), status: "no_show", reason: "Vaccination", queueNumber: 1, queuePosition: 1, queueToken: makeToken(), clinicId },
    // Today – live queue
    { patientId: p4!.id,  doctorId: doc1!.user.id, date: new Date(today.getTime() + 9*3600000),   status: "completed",   reason: "Routine checkup", queueNumber: 1, queuePosition: 1, queueToken: makeToken(), checkInTime: new Date(today.getTime() + 8.9*3600000), consultationStartTime: new Date(today.getTime() + 9.1*3600000), completedAt: new Date(today.getTime() + 9.3*3600000), clinicId },
    { patientId: p6!.id,  doctorId: doc1!.user.id, date: new Date(today.getTime() + 9.5*3600000), status: "in_progress", reason: "Chest cold", queueNumber: 2, queuePosition: 2, queueToken: makeToken(), checkInTime: new Date(today.getTime() + 9.4*3600000), consultationStartTime: new Date(today.getTime() + 9.6*3600000), clinicId },
    { patientId: p8!.id,  doctorId: doc1!.user.id, date: new Date(today.getTime() + 10*3600000),  status: "checked_in",  reason: "Diabetes review", queueNumber: 3, queuePosition: 3, queueToken: makeToken(), checkInTime: new Date(today.getTime() + 9.8*3600000), clinicId },
    { patientId: p10!.id, doctorId: doc1!.user.id, date: new Date(today.getTime() + 10.5*3600000),status: "checked_in",  reason: "Hypertension", queueNumber: 4, queuePosition: 4, queueToken: makeToken(), checkInTime: new Date(today.getTime() + 10.2*3600000), clinicId },
    { patientId: p12!.id, doctorId: doc2!.user.id, date: new Date(today.getTime() + 9*3600000),   status: "completed",   reason: "Child fever", queueNumber: 1, queuePosition: 1, queueToken: makeToken(), checkInTime: new Date(today.getTime() + 8.9*3600000), consultationStartTime: new Date(today.getTime() + 9.1*3600000), completedAt: new Date(today.getTime() + 9.25*3600000), clinicId },
    { patientId: p7!.id,  doctorId: doc2!.user.id, date: new Date(today.getTime() + 9.5*3600000), status: "in_progress", reason: "Vaccination", queueNumber: 2, queuePosition: 2, queueToken: makeToken(), checkInTime: new Date(today.getTime() + 9.45*3600000), consultationStartTime: new Date(today.getTime() + 9.55*3600000), clinicId },
    { patientId: p9!.id,  doctorId: doc2!.user.id, date: new Date(today.getTime() + 10*3600000),  status: "booked",      reason: "Follow-up", queueNumber: 3, queuePosition: 3, queueToken: makeToken(), clinicId },
    { patientId: p11!.id, doctorId: doc3!.user.id, date: new Date(today.getTime() + 10*3600000),  status: "checked_in",  reason: "Gynaecology OPD", queueNumber: 1, queuePosition: 1, queueToken: makeToken(), checkInTime: new Date(today.getTime() + 9.85*3600000), clinicId },
    { patientId: p2!.id,  doctorId: doc3!.user.id, date: new Date(today.getTime() + 10.5*3600000),status: "booked",      reason: "PCOS follow-up", queueNumber: 2, queuePosition: 2, queueToken: makeToken(), clinicId },
  ];

  const insertedAppts = await db.insert(appointments).values(appts).returning();
  console.log(`  created ${insertedAppts.length} appointments`);

  // ── Bills ──────────────────────────────────────────────────────────────────
  const completedAppts = insertedAppts.filter(a => a.status === "completed");
  const billsData = completedAppts.map((a, i) => {
    const doc = insertedDoctors.find(d => d.user.id === a.doctorId);
    const fee = doc?.profile.consultationFee ?? 50000;
    const paid = i % 5 !== 4;
    return {
      appointmentId: a.id,
      patientId: a.patientId,
      clinicId,
      amount: fee,
      status: (paid ? "paid" : "pending") as "paid" | "pending",
      paymentMethod: paid ? (["cash", "upi", "card"][i % 3] as string) : null,
      billingDate: a.completedAt ?? a.date,
    };
  });

  const insertedBills = await db.insert(bills).values(billsData).returning();
  console.log(`  created ${insertedBills.length} bills`);

  // ── Prescriptions ──────────────────────────────────────────────────────────
  const rxAppts = completedAppts.slice(0, 10);
  const rxData = rxAppts.map((a, i) => ({
    appointmentId: a.id,
    patientId: a.patientId,
    doctorId: a.doctorId,
    clinicId,
    notes: ["Take rest and drink plenty of fluids.", "Monitor BP daily.", "Follow-up in 2 weeks.", "Avoid spicy food.", "Complete the full antibiotic course."][i % 5],
    medications: [
      [{ name: "Paracetamol", dosage: "500mg", frequency: "1-0-1", duration: "5 days", timing: "After Food", instructions: "" }, { name: "Cetirizine", dosage: "10mg", frequency: "0-0-1", duration: "3 days", timing: "Bedtime", instructions: "" }],
      [{ name: "Amlodipine", dosage: "5mg", frequency: "1-0-0", duration: "30 days", timing: "Before Food", instructions: "" }],
      [{ name: "Metformin", dosage: "500mg", frequency: "1-0-1", duration: "30 days", timing: "With Food", instructions: "" }, { name: "Glimepiride", dosage: "1mg", frequency: "1-0-0", duration: "30 days", timing: "Before Food", instructions: "" }],
      [{ name: "Amoxicillin", dosage: "250mg", frequency: "TDS", duration: "7 days", timing: "After Food", instructions: "" }, { name: "Ibuprofen", dosage: "400mg", frequency: "BD", duration: "3 days", timing: "After Food", instructions: "" }],
      [{ name: "Omeprazole", dosage: "20mg", frequency: "1-0-0", duration: "14 days", timing: "Empty Stomach", instructions: "" }],
    ][i % 5],
  }));

  const insertedRx = await db.insert(prescriptions).values(rxData).returning();
  console.log(`  created ${insertedRx.length} prescriptions`);

  console.log("\nSeed complete!");
  console.log(`  Clinic:       ${clinic!.name} (id=${clinicId})`);
  console.log(`  Email:        demo@bariq.in`);
  console.log(`  Password:     demo1234`);
  console.log(`  Doctors:      ${insertedDoctors.length}`);
  console.log(`  Patients:     ${patientRows.length}`);
  console.log(`  Appointments: ${insertedAppts.length}`);
  console.log(`  Bills:        ${insertedBills.length}`);
  console.log(`  Prescriptions:${insertedRx.length}`);
}

seed().catch(console.error).finally(() => process.exit(0));
