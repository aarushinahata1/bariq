import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { users, patients, appointments, doctorProfiles } from "../shared/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

async function seed() {
  // Find or create a doctor
  let [doctor] = await db.select().from(users).where(eq(users.role, "doctor"));
  if (!doctor) {
    [doctor] = await db
      .insert(users)
      .values({
        email: "dr.sharma@medqueue.app",
        firstName: "Ankit",
        lastName: "Sharma",
        name: "Dr. Ankit Sharma",
        role: "doctor",
      })
      .returning();

    await db.insert(doctorProfiles).values({
      userId: doctor!.id,
      specialization: "General Medicine",
      avgConsultationTime: 15,
      isAvailable: true,
    });
    console.log("Created doctor:", doctor!.name);
  } else {
    console.log("Using existing doctor:", doctor.name);
  }

  const peopleData = [
    { name: "Ravi Kumar", phone: "9876543210", reason: "Fever and cold" },
    { name: "Priya Patel", phone: "9876543211", reason: "Routine checkup" },
    { name: "Amit Singh", phone: "9876543212", reason: "Back pain" },
  ];

  const now = new Date();
  const baseTime = new Date(now);
  baseTime.setHours(9, 0, 0, 0);

  for (let i = 0; i < peopleData.length; i++) {
    const p = peopleData[i];

    const [patient] = await db
      .insert(patients)
      .values({ name: p.name, phone: p.phone, status: "active", source: "internal" })
      .returning();

    const appointmentTime = new Date(baseTime);
    appointmentTime.setMinutes(baseTime.getMinutes() + i * 20);

    const [appt] = await db
      .insert(appointments)
      .values({
        patientId: patient!.id,
        doctorId: doctor!.id,
        date: appointmentTime,
        status: "checked_in",
        reason: p.reason,
        queuePosition: i + 1,
        queueNumber: i + 1,
        queueToken: nanoid(12),
        checkInTime: new Date(),
      })
      .returning();

    console.log(
      `Added to queue #${i + 1}: ${p.name} — ${p.reason} (appointment ID: ${appt!.id})`
    );
  }

  console.log("\nDone! 3 people added to today's queue.");
  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
