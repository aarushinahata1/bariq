import { pgTable, text, integer, serial, timestamp, boolean, jsonb, index, uniqueIndex, primaryKey } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ── Tenants ───────────────────────────────────────────────────────────────────

export const clinics = pgTable("clinics", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  phone: text("phone"),
  address: text("address"),
  planStatus: text("plan_status", { enum: ["trial", "active", "expired", "cancelled"] }).default("trial").notNull(),
  trialEndsAt: timestamp("trial_ends_at"),
  subscriptionEndsAt: timestamp("subscription_ends_at"),
  createdAt: timestamp("created_at").$defaultFn(() => new Date()),
});

export const clinicPayments = pgTable("clinic_payments", {
  id: serial("id").primaryKey(),
  clinicId: integer("clinic_id").references(() => clinics.id).notNull(),
  amount: integer("amount").notNull(),
  utr: text("utr"),
  planType: text("plan_type"),
  status: text("status", { enum: ["pending", "approved", "rejected"] }).default("pending").notNull(),
  notes: text("notes"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").$defaultFn(() => new Date()),
});

// ── Session store ─────────────────────────────────────────────────────────────

export const sessions = pgTable(
  "sessions",
  {
    sid: text("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => ({
    expireIdx: index("IDX_session_expire").on(table.expire),
  })
);

// ── Clinic-scoped settings ────────────────────────────────────────────────────

export const clinicSettings = pgTable("clinic_settings", {
  clinicId: integer("clinic_id").references(() => clinics.id).notNull(),
  key: text("key").notNull(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at").$defaultFn(() => new Date()),
}, (t) => ({
  pk: primaryKey({ columns: [t.clinicId, t.key] }),
}));

// ── Staff (doctors / receptionists) ──────────────────────────────────────────

export const users = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  clinicId: integer("clinic_id").references(() => clinics.id),
  email: text("email"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  profileImageUrl: text("profile_image_url"),
  role: text("role", { enum: ["admin", "doctor", "receptionist", "staff"] }).default("staff").notNull(),
  name: text("name"),
  createdAt: timestamp("created_at").$defaultFn(() => new Date()),
  updatedAt: timestamp("updated_at").$defaultFn(() => new Date()),
});

export const appointmentStatus = ["booked", "checked_in", "in_progress", "completed", "cancelled", "no_show"] as const;

export const doctorProfiles = pgTable("doctor_profiles", {
  id: serial("id").primaryKey(),
  userId: text("user_id").references(() => users.id).notNull(),
  specialization: text("specialization"),
  avgConsultationTime: integer("avg_consultation_time").default(15),
  consultationFee: integer("consultation_fee").default(15000),
  availability: jsonb("availability").$type<{
    [key: string]: { slots: { start: string; end: string }[]; enabled: boolean }
  }>().default({
    "monday": { slots: [{ start: "09:00", end: "12:00" }, { start: "15:00", end: "17:00" }], enabled: true },
    "tuesday": { slots: [{ start: "09:00", end: "12:00" }, { start: "15:00", end: "17:00" }], enabled: true },
    "wednesday": { slots: [{ start: "09:00", end: "12:00" }, { start: "15:00", end: "17:00" }], enabled: true },
    "thursday": { slots: [{ start: "09:00", end: "12:00" }, { start: "15:00", end: "17:00" }], enabled: true },
    "friday": { slots: [{ start: "09:00", end: "12:00" }, { start: "15:00", end: "17:00" }], enabled: true },
    "saturday": { slots: [{ start: "09:00", end: "12:00" }], enabled: false },
    "sunday": { slots: [{ start: "09:00", end: "12:00" }], enabled: false },
  }),
  isAvailable: boolean("is_available").default(true),
});

// ── Patients ──────────────────────────────────────────────────────────────────

export const patients = pgTable("patients", {
  id: serial("id").primaryKey(),
  clinicId: integer("clinic_id").references(() => clinics.id),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  notes: text("notes"),
  source: text("source").default("internal"),
  referralSource: text("referral_source"),
  status: text("status").default("lead"),
  funnelStage: text("funnel_stage").default("new"),
  lastContactedAt: timestamp("last_contacted_at"),
  createdAt: timestamp("created_at").$defaultFn(() => new Date()),
}, (t) => ({
  clinicIdx: index("patients_clinic_id_idx").on(t.clinicId),
}));

// ── Billing ───────────────────────────────────────────────────────────────────

export const bills = pgTable("bills", {
  id: serial("id").primaryKey(),
  clinicId: integer("clinic_id").references(() => clinics.id),
  appointmentId: integer("appointment_id").references(() => appointments.id).notNull(),
  patientId: integer("patient_id").references(() => patients.id).notNull(),
  amount: integer("amount").notNull(),
  status: text("status", { enum: ["pending", "paid", "cancelled"] }).default("pending").notNull(),
  billingDate: timestamp("billing_date").$defaultFn(() => new Date()).notNull(),
  paymentMethod: text("payment_method"),
  notes: text("notes"),
  createdAt: timestamp("created_at").$defaultFn(() => new Date()),
}, (t) => ({
  clinicIdx: index("bills_clinic_id_idx").on(t.clinicId),
  apptIdx: uniqueIndex("bills_appointment_id_unique").on(t.appointmentId),
  billingDateIdx: index("bills_billing_date_idx").on(t.clinicId, t.billingDate),
}));

// ── Appointments ──────────────────────────────────────────────────────────────

export const appointments = pgTable("appointments", {
  id: serial("id").primaryKey(),
  clinicId: integer("clinic_id").references(() => clinics.id),
  patientId: integer("patient_id").references(() => patients.id).notNull(),
  doctorId: text("doctor_id").references(() => users.id).notNull(),
  date: timestamp("date").notNull(),
  status: text("status", { enum: appointmentStatus }).default("booked").notNull(),
  reason: text("reason"),
  notes: text("notes"),
  queueNumber: integer("queue_number"),
  queuePosition: integer("queue_position"),
  queueToken: text("queue_token"),
  isQuickCheck: boolean("is_quick_check").default(false),
  checkInTime: timestamp("check_in_time"),
  consultationStartTime: timestamp("consultation_start_time"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").$defaultFn(() => new Date()),
}, (t) => ({
  clinicDateIdx: index("appointments_clinic_date_idx").on(t.clinicId, t.date),
  clinicDoctorIdx: index("appointments_clinic_doctor_idx").on(t.clinicId, t.doctorId),
  tokenIdx: index("appointments_queue_token_idx").on(t.queueToken),
  patientIdx: index("appointments_patient_id_idx").on(t.clinicId, t.patientId),
}));

// ── Notifications ─────────────────────────────────────────────────────────────

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  clinicId: integer("clinic_id").references(() => clinics.id),
  patientId: integer("patient_id").references(() => patients.id).notNull(),
  type: text("type").notNull(),
  message: text("message").notNull(),
  sentAt: timestamp("sent_at").$defaultFn(() => new Date()),
});

// ── Prescriptions ─────────────────────────────────────────────────────────────

export const prescriptions = pgTable("prescriptions", {
  id: serial("id").primaryKey(),
  clinicId: integer("clinic_id").references(() => clinics.id),
  appointmentId: integer("appointment_id").references(() => appointments.id).notNull(),
  patientId: integer("patient_id").references(() => patients.id).notNull(),
  doctorId: text("doctor_id").references(() => users.id).notNull(),
  medications: jsonb("medications").$type<{ name: string; dosage: string; duration: string; instructions: string }[]>().default([]),
  notes: text("notes"),
  createdAt: timestamp("created_at").$defaultFn(() => new Date()),
});

// ── Relations ─────────────────────────────────────────────────────────────────

export const clinicsRelations = relations(clinics, ({ many }) => ({
  users: many(users),
  patients: many(patients),
  payments: many(clinicPayments),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  clinic: one(clinics, { fields: [users.clinicId], references: [clinics.id] }),
  doctorProfile: one(doctorProfiles, { fields: [users.id], references: [doctorProfiles.userId] }),
  appointments: many(appointments),
}));

export const doctorProfilesRelations = relations(doctorProfiles, ({ one }) => ({
  user: one(users, { fields: [doctorProfiles.userId], references: [users.id] }),
}));

export const patientsRelations = relations(patients, ({ one, many }) => ({
  clinic: one(clinics, { fields: [patients.clinicId], references: [clinics.id] }),
  appointments: many(appointments),
}));

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  clinic: one(clinics, { fields: [appointments.clinicId], references: [clinics.id] }),
  patient: one(patients, { fields: [appointments.patientId], references: [patients.id] }),
  doctor: one(users, { fields: [appointments.doctorId], references: [users.id] }),
  bill: one(bills, { fields: [appointments.id], references: [bills.appointmentId] }),
}));

export const billsRelations = relations(bills, ({ one }) => ({
  appointment: one(appointments, { fields: [bills.appointmentId], references: [appointments.id] }),
  patient: one(patients, { fields: [bills.patientId], references: [patients.id] }),
}));

export const prescriptionsRelations = relations(prescriptions, ({ one }) => ({
  appointment: one(appointments, { fields: [prescriptions.appointmentId], references: [appointments.id] }),
  patient: one(patients, { fields: [prescriptions.patientId], references: [patients.id] }),
  doctor: one(users, { fields: [prescriptions.doctorId], references: [users.id] }),
}));

// ── Insert schemas ────────────────────────────────────────────────────────────

export const insertClinicSchema = z.object({
  name: z.string().min(2, "Clinic name required"),
  email: z.string().email("Valid email required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  phone: z.string().optional(),
  address: z.string().optional(),
});

export const insertPrescriptionSchema = createInsertSchema(prescriptions).omit({ id: true, createdAt: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDoctorProfileSchema = createInsertSchema(doctorProfiles).omit({ id: true });
export const insertPatientSchema = createInsertSchema(patients).omit({ id: true, createdAt: true }).extend({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(1, "Phone is required").refine(v => {
    const digits = v.replace(/\D/g, "");
    if (digits.length === 10) return /^[6-9]/.test(digits);
    if (digits.length === 12) return digits.startsWith("91") && /^[6-9]/.test(digits.slice(2));
    return false;
  }, "Enter a valid 10-digit mobile number"),
});
export const insertAppointmentSchema = createInsertSchema(appointments).omit({ id: true, createdAt: true, queueNumber: true, queuePosition: true, queueToken: true }).extend({
  doctorId: z.string().min(1, "Doctor is required"),
  patientId: z.coerce.number().min(1, "Patient is required"),
  date: z.coerce.date(),
});
export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, sentAt: true });
export const insertBillSchema = createInsertSchema(bills).omit({ id: true, createdAt: true, billingDate: true });

// ── Types ─────────────────────────────────────────────────────────────────────

export type Clinic = typeof clinics.$inferSelect;
export type ClinicPayment = typeof clinicPayments.$inferSelect;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpsertUser = typeof users.$inferInsert;
export type DoctorProfile = typeof doctorProfiles.$inferSelect;
export type Patient = typeof patients.$inferSelect;
export type InsertPatient = z.infer<typeof insertPatientSchema>;
export type Appointment = typeof appointments.$inferSelect;
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type Notification = typeof notifications.$inferSelect;
export type Prescription = typeof prescriptions.$inferSelect;
export type InsertPrescription = z.infer<typeof insertPrescriptionSchema>;
export type Bill = typeof bills.$inferSelect;
export type InsertBill = z.infer<typeof insertBillSchema>;
export type ClinicSetting = typeof clinicSettings.$inferSelect;

export type CreateUserRequest = InsertUser & { doctorProfile?: Partial<z.infer<typeof insertDoctorProfileSchema>> };
export type UpdateAppointmentRequest = Partial<InsertAppointment> & { status?: typeof appointmentStatus[number] };
