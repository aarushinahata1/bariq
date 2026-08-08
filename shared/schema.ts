import { pgTable, text, integer, serial, timestamp, boolean, jsonb, index, uniqueIndex, primaryKey, date } from "drizzle-orm/pg-core";
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
  partnerId: integer("partner_id").references(() => partners.id),
  createdAt: timestamp("created_at").$defaultFn(() => new Date()),
});

// ── Partners (referral program) ────────────────────────────────────────────────

export const partners = pgTable("partners", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  phone: text("phone"),
  referralCode: text("referral_code").unique().notNull(),
  commissionPercent: integer("commission_percent").default(10).notNull(),
  // New partners start "pending" until a super admin approves them — only then can
  // their referral code be used to attribute clinics, and their dashboard unlocks.
  status: text("status", { enum: ["pending", "active", "inactive"] }).default("pending").notNull(),
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
  role: text("role", { enum: ["admin", "doctor", "receptionist", "staff", "pharmacist"] }).default("staff").notNull(),
  passwordHash: text("password_hash"),
  name: text("name"),
  createdAt: timestamp("created_at").$defaultFn(() => new Date()),
  updatedAt: timestamp("updated_at").$defaultFn(() => new Date()),
}, (t) => ({
  // Nullable-safe: Postgres allows unlimited NULLs under a unique index, only
  // non-null duplicates are rejected.
  // Login looks up staff by email alone (no clinic context yet), so this must be
  // globally unique, not just per-clinic.
  emailUniq: uniqueIndex("users_email_unique").on(t.email),
}));

export const appointmentStatus = ["booked", "checked_in", "in_progress", "completed", "cancelled", "no_show"] as const;

export const doctorProfiles = pgTable("doctor_profiles", {
  id: serial("id").primaryKey(),
  userId: text("user_id").references(() => users.id).notNull(),
  specialization: text("specialization"),
  avgConsultationTime: integer("avg_consultation_time").default(15),
  consultationFee: integer("consultation_fee").default(15000),
  availability: jsonb("availability").$type<{
    [key: string]: { enabled: boolean }
  }>().default({
    "monday": { enabled: true },
    "tuesday": { enabled: true },
    "wednesday": { enabled: true },
    "thursday": { enabled: true },
    "friday": { enabled: true },
    "saturday": { enabled: false },
    "sunday": { enabled: false },
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
  // Patient demographics for clinical use
  dateOfBirth: date("date_of_birth"),
  gender: text("gender"),
  bloodGroup: text("blood_group"),
  allergies: text("allergies"),
  address: text("address"),
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
  isQuickCheck: boolean("is_quick_check").default(false),
  checkInTime: timestamp("check_in_time"),
  consultationStartTime: timestamp("consultation_start_time"),
  completedAt: timestamp("completed_at"),
  vitals: jsonb("vitals").$type<{ bp?: string; pulse?: number; temperature?: number; weight?: number; spO2?: number; height?: number }>(),
  createdAt: timestamp("created_at").$defaultFn(() => new Date()),
}, (t) => ({
  clinicDateIdx: index("appointments_clinic_date_idx").on(t.clinicId, t.date),
  clinicDoctorIdx: index("appointments_clinic_doctor_idx").on(t.clinicId, t.doctorId),
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
  chiefComplaints: text("chief_complaints"),
  diagnosis: text("diagnosis"),
  medications: jsonb("medications").$type<{ name: string; dosage: string; frequency: string; duration: string; timing: string; instructions: string }[]>().default([]),
  notes: text("notes"),
  createdAt: timestamp("created_at").$defaultFn(() => new Date()),
}, (t) => ({
  apptIdx: uniqueIndex("prescriptions_appointment_id_unique").on(t.appointmentId),
}));

// ── Dental Charts ─────────────────────────────────────────────────────────────
// Opt-in module (see clinic_settings key "modules") — most clinics never touch this table.

export const toothConditions = [
  "healthy", "caries", "filled", "crown", "missing", "rct",
  "implant", "extraction_planned", "fractured", "impacted", "bridge",
] as const;

export type ToothState = {
  condition: typeof toothConditions[number];
  surfaces?: string[];
  note?: string;
  updatedAt?: string;
};

export type DentalTreatmentLogEntry = {
  id: string;
  date: string;
  teeth: string[];
  procedure: string;
  note?: string;
};

export const dentalCharts = pgTable("dental_charts", {
  id: serial("id").primaryKey(),
  clinicId: integer("clinic_id").references(() => clinics.id, { onDelete: "cascade" }).notNull(),
  patientId: integer("patient_id").references(() => patients.id, { onDelete: "cascade" }).notNull(),
  dentitionType: text("dentition_type", { enum: ["permanent", "primary"] }).default("permanent").notNull(),
  teeth: jsonb("teeth").$type<Record<string, ToothState>>().default({}),
  treatmentLog: jsonb("treatment_log").$type<DentalTreatmentLogEntry[]>().default([]),
  notes: text("notes"),
  createdAt: timestamp("created_at").$defaultFn(() => new Date()),
  updatedAt: timestamp("updated_at").$defaultFn(() => new Date()),
}, (t) => ({
  clinicIdx: index("dental_charts_clinic_id_idx").on(t.clinicId),
  patientUniq: uniqueIndex("dental_charts_patient_unique").on(t.patientId),
}));

export const dentalChartsRelations = relations(dentalCharts, ({ one }) => ({
  patient: one(patients, { fields: [dentalCharts.patientId], references: [patients.id] }),
}));

export const insertDentalChartSchema = createInsertSchema(dentalCharts).omit({ id: true, createdAt: true, updatedAt: true });
export type DentalChart = typeof dentalCharts.$inferSelect;
export type InsertDentalChart = z.infer<typeof insertDentalChartSchema>;

// ── Ortho / Physio Body Charts ──────────────────────────────────────────────────
// Opt-in module (see clinic_settings key "modules") — most clinics never touch this table.

export const bodyRegionConditions = [
  "normal", "pain", "sprain_strain", "fracture", "post_surgery",
  "inflammation", "reduced_rom", "swelling", "numbness", "chronic",
] as const;

export type BodyRegionState = {
  condition: typeof bodyRegionConditions[number];
  severity?: "mild" | "moderate" | "severe";
  note?: string;
  updatedAt?: string;
};

export type BodyTreatmentLogEntry = {
  id: string;
  date: string;
  regions: string[];
  procedure: string;
  note?: string;
};

export const bodyCharts = pgTable("body_charts", {
  id: serial("id").primaryKey(),
  clinicId: integer("clinic_id").references(() => clinics.id, { onDelete: "cascade" }).notNull(),
  patientId: integer("patient_id").references(() => patients.id, { onDelete: "cascade" }).notNull(),
  regions: jsonb("regions").$type<Record<string, BodyRegionState>>().default({}),
  treatmentLog: jsonb("treatment_log").$type<BodyTreatmentLogEntry[]>().default([]),
  notes: text("notes"),
  createdAt: timestamp("created_at").$defaultFn(() => new Date()),
  updatedAt: timestamp("updated_at").$defaultFn(() => new Date()),
}, (t) => ({
  clinicIdx: index("body_charts_clinic_id_idx").on(t.clinicId),
  patientUniq: uniqueIndex("body_charts_patient_unique").on(t.patientId),
}));

export const bodyChartsRelations = relations(bodyCharts, ({ one }) => ({
  patient: one(patients, { fields: [bodyCharts.patientId], references: [patients.id] }),
}));

export const insertBodyChartSchema = createInsertSchema(bodyCharts).omit({ id: true, createdAt: true, updatedAt: true });
export type BodyChart = typeof bodyCharts.$inferSelect;
export type InsertBodyChart = z.infer<typeof insertBodyChartSchema>;

// ── Pharmacy ──────────────────────────────────────────────────────────────────

export const medicines = pgTable("medicines", {
  id: serial("id").primaryKey(),
  clinicId: integer("clinic_id").references(() => clinics.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  genericName: text("generic_name"),
  category: text("category").notNull().default("General"),
  manufacturer: text("manufacturer"),
  batchNo: text("batch_no"),
  expiryDate: date("expiry_date"),
  costPrice: integer("cost_price").notNull().default(0),
  sellingPrice: integer("selling_price").notNull().default(0),
  stockQty: integer("stock_qty").notNull().default(0),
  minStockQty: integer("min_stock_qty").notNull().default(10),
  unit: text("unit").notNull().default("Strip"),
  hsnCode: text("hsn_code"),
  gstPercent: integer("gst_percent").notNull().default(12),
  isActive: boolean("is_active").notNull().default(true),
  supplierName: text("supplier_name"),
  reorderQty: integer("reorder_qty"),
  reorderedAt: timestamp("reordered_at"),
  createdAt: timestamp("created_at").$defaultFn(() => new Date()),
}, (t) => ({
  clinicIdx: index("medicines_clinic_id_idx").on(t.clinicId),
}));

export const pharmacyBills = pgTable("pharmacy_bills", {
  id: serial("id").primaryKey(),
  clinicId: integer("clinic_id").references(() => clinics.id, { onDelete: "cascade" }).notNull(),
  patientId: integer("patient_id").references(() => patients.id, { onDelete: "set null" }),
  patientName: text("patient_name"),
  patientPhone: text("patient_phone"),
  appointmentId: integer("appointment_id").references(() => appointments.id, { onDelete: "set null" }),
  items: jsonb("items").notNull().default([]),
  subtotal: integer("subtotal").notNull().default(0),
  discountPercent: integer("discount_percent").notNull().default(0),
  discountAmount: integer("discount_amount").notNull().default(0),
  gstTotal: integer("gst_total").notNull().default(0),
  totalAmount: integer("total_amount").notNull().default(0),
  paymentMethod: text("payment_method").default("cash"),
  status: text("status").notNull().default("paid"),
  notes: text("notes"),
  createdAt: timestamp("created_at").$defaultFn(() => new Date()),
}, (t) => ({
  clinicIdx: index("pharmacy_bills_clinic_id_idx").on(t.clinicId),
  clinicDateIdx: index("pharmacy_bills_clinic_date_idx").on(t.clinicId, t.createdAt),
}));

// ── Pharmacy: Suppliers ───────────────────────────────────────────────────────

export const pharmacySuppliers = pgTable("pharmacy_suppliers", {
  id: serial("id").primaryKey(),
  clinicId: integer("clinic_id").references(() => clinics.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  contactPerson: text("contact_person"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  paymentTerms: text("payment_terms"),
  leadTimeDays: integer("lead_time_days"),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").$defaultFn(() => new Date()),
}, (t) => ({
  clinicIdx: index("pharmacy_suppliers_clinic_id_idx").on(t.clinicId),
}));

// ── Pharmacy: Returns ─────────────────────────────────────────────────────────

export const pharmacyReturns = pgTable("pharmacy_returns", {
  id: serial("id").primaryKey(),
  clinicId: integer("clinic_id").references(() => clinics.id, { onDelete: "cascade" }).notNull(),
  originalBillId: integer("original_bill_id").references(() => pharmacyBills.id, { onDelete: "set null" }),
  patientName: text("patient_name"),
  patientPhone: text("patient_phone"),
  items: jsonb("items").notNull().default([]),
  totalAmount: integer("total_amount").notNull().default(0),
  refundMethod: text("refund_method").default("cash"),
  reason: text("reason"),
  createdAt: timestamp("created_at").$defaultFn(() => new Date()),
}, (t) => ({
  clinicIdx: index("pharmacy_returns_clinic_id_idx").on(t.clinicId),
}));

// ── Pharmacy: Wastage / Write-offs ────────────────────────────────────────────

export const wastageRecords = pgTable("wastage_records", {
  id: serial("id").primaryKey(),
  clinicId: integer("clinic_id").references(() => clinics.id, { onDelete: "cascade" }).notNull(),
  medicineId: integer("medicine_id").references(() => medicines.id, { onDelete: "set null" }),
  medicineName: text("medicine_name").notNull(),
  batchNo: text("batch_no"),
  qty: integer("qty").notNull(),
  unit: text("unit").notNull(),
  costPrice: integer("cost_price").notNull().default(0),
  totalCost: integer("total_cost").notNull().default(0),
  reason: text("reason").notNull().default("expired"),
  notes: text("notes"),
  createdAt: timestamp("created_at").$defaultFn(() => new Date()),
}, (t) => ({
  clinicIdx: index("wastage_records_clinic_id_idx").on(t.clinicId),
}));

// ── Pharmacy: Daily Cash Closing ──────────────────────────────────────────────

export const dailyClosings = pgTable("daily_closings", {
  id: serial("id").primaryKey(),
  clinicId: integer("clinic_id").references(() => clinics.id, { onDelete: "cascade" }).notNull(),
  closingDate: date("closing_date").notNull(),
  cashExpected: integer("cash_expected").notNull().default(0),
  cashActual: integer("cash_actual").notNull().default(0),
  upiTotal: integer("upi_total").notNull().default(0),
  cardTotal: integer("card_total").notNull().default(0),
  onlineTotal: integer("online_total").notNull().default(0),
  totalSales: integer("total_sales").notNull().default(0),
  totalReturns: integer("total_returns").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").$defaultFn(() => new Date()),
}, (t) => ({
  clinicIdx: index("daily_closings_clinic_id_idx").on(t.clinicId),
  dateUniq: uniqueIndex("daily_closings_clinic_date_unique").on(t.clinicId, t.closingDate),
}));

// ── Relations ─────────────────────────────────────────────────────────────────

export const clinicsRelations = relations(clinics, ({ one, many }) => ({
  users: many(users),
  patients: many(patients),
  payments: many(clinicPayments),
  partner: one(partners, { fields: [clinics.partnerId], references: [partners.id] }),
}));

export const partnersRelations = relations(partners, ({ many }) => ({
  clinics: many(clinics),
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

// ── Medicine Master List ──────────────────────────────────────────────────────

export const medicineNames = pgTable("medicine_names", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at").$defaultFn(() => new Date()),
});

// ── Insert schemas ────────────────────────────────────────────────────────────

export const insertClinicSchema = z.object({
  name: z.string().min(2, "Clinic name required"),
  email: z.string().email("Valid email required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  phone: z.string().optional(),
  address: z.string().optional(),
  referralCode: z.string().optional(),
});

export const insertPartnerSchema = z.object({
  name: z.string().min(2, "Name required"),
  email: z.string().email("Valid email required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  phone: z.string().optional(),
});

export const insertPrescriptionSchema = createInsertSchema(prescriptions).omit({ id: true, createdAt: true });
// Used only for doctor creation (POST /api/doctors) — role and passwordHash are
// deliberately not accepted from the client. Role is forced server-side to "doctor"
// (see storage.ts createDoctor); doctors don't have an individual login path today,
// so passwordHash has no legitimate client-supplied value here.
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true, passwordHash: true, role: true });
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
export const insertAppointmentSchema = createInsertSchema(appointments).omit({ id: true, createdAt: true, queueNumber: true, queuePosition: true }).extend({
  doctorId: z.string().min(1, "Doctor is required"),
  patientId: z.coerce.number().min(1, "Patient is required"),
  date: z.coerce.date(),
});
export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, sentAt: true });
export const insertBillSchema = createInsertSchema(bills).omit({ id: true, createdAt: true, billingDate: true }).extend({
  amount: z.coerce.number().int().min(1, "Amount must be greater than zero"),
});

// ── Types ─────────────────────────────────────────────────────────────────────

export type Clinic = typeof clinics.$inferSelect;
export type ClinicPayment = typeof clinicPayments.$inferSelect;
export type Partner = typeof partners.$inferSelect;
export type InsertPartner = z.infer<typeof insertPartnerSchema>;
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

export const insertMedicineSchema = createInsertSchema(medicines).omit({ id: true, createdAt: true }).extend({
  name: z.string().min(1, "Medicine name is required"),
  sellingPrice: z.coerce.number().min(0),
  costPrice: z.coerce.number().min(0),
  stockQty: z.coerce.number().min(0),
  minStockQty: z.coerce.number().min(0),
  gstPercent: z.coerce.number().min(0),
});
export const insertPharmacyBillSchema = createInsertSchema(pharmacyBills).omit({ id: true, createdAt: true });

export type Medicine = typeof medicines.$inferSelect;
export type InsertMedicine = z.infer<typeof insertMedicineSchema>;
export type PharmacyBill = typeof pharmacyBills.$inferSelect;
export type InsertPharmacyBill = z.infer<typeof insertPharmacyBillSchema>;
export type PharmacySupplier = typeof pharmacySuppliers.$inferSelect;
export type PharmacyReturn = typeof pharmacyReturns.$inferSelect;
export type WastageRecord = typeof wastageRecords.$inferSelect;
export type DailyClosing = typeof dailyClosings.$inferSelect;
