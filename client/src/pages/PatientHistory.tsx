import { usePatient, useUpdatePatient, useDeletePatient } from "@/hooks/use-patients";
import { useAppointments, useCreateAppointment } from "@/hooks/use-appointments";
import { useDoctors } from "@/hooks/use-doctors";
import { useParams, useLocation } from "wouter";
import { Loading } from "@/components/ui/loading";
import { Card, CardContent } from "@/components/ui/card";
import { format, differenceInYears } from "date-fns";
import { useState, useEffect, useMemo } from "react";
import {
  History, Calendar, Phone, Mail, FileText, Clock,
  ArrowLeft, ChevronRight, Pencil, Check, X,
  Pill, Receipt, CalendarPlus, Activity, Trash2,
  AlertTriangle, Printer, MapPin, ChevronDown, ChevronUp, Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

// ── Constants ──────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  checked_in: "bg-emerald-100 text-emerald-700",
  in_progress: "bg-teal-100 text-teal-700",
  booked: "bg-slate-100 text-slate-700",
  no_show: "bg-orange-100 text-orange-700",
};

const STATUS_LABELS: Record<string, string> = {
  completed: "Consulted",
  checked_in: "Paid",
  in_progress: "In Progress",
  no_show: "No Show",
  booked: "Booked",
  cancelled: "Cancelled",
};

const DOT_COLORS: Record<string, string> = {
  completed: "bg-green-500",
  cancelled: "bg-red-500",
  no_show: "bg-orange-500",
  in_progress: "bg-teal-600",
  checked_in: "bg-emerald-500",
  booked: "bg-slate-400",
};

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
const GENDER_OPTIONS = ["Male", "Female", "Other", "Prefer not to say"];

// ── Helpers ────────────────────────────────────────────────────────────────────

function calcAge(dob: string | null | undefined): string {
  if (!dob) return "";
  try {
    return `${differenceInYears(new Date(), new Date(dob))} yrs`;
  } catch {
    return "";
  }
}

function buildPrescriptionHtml(rx: any, patient: any, apt: any, clinicProfile?: any): string {
  const esc = (s: unknown) => String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const meds: any[] = rx.medications || [];
  const rows = meds.map(m => `<tr>
    <td style="padding:9px 10px;border-bottom:1px solid #f1f5f9;font-weight:600">${esc(m.name || "")}</td>
    <td style="padding:9px 10px;border-bottom:1px solid #f1f5f9">${esc(m.dosage || "")}</td>
    <td style="padding:9px 10px;border-bottom:1px solid #f1f5f9">${esc(m.frequency || "")}</td>
    <td style="padding:9px 10px;border-bottom:1px solid #f1f5f9">${esc(m.duration || "")}</td>
    <td style="padding:9px 10px;border-bottom:1px solid #f1f5f9">${esc(m.timing || "")}</td>
    <td style="padding:9px 10px;border-bottom:1px solid #f1f5f9;color:#64748b">${esc(m.instructions || "")}</td>
  </tr>`).join("");

  const clinicName = esc(clinicProfile?.clinicName || "");
  const cTagline = clinicProfile?.tagline ? `<p style="font-size:11px;color:#64748b;font-style:italic;margin-top:2px">${esc(clinicProfile.tagline)}</p>` : "";
  const cAddr = clinicProfile?.address ? `<p style="font-size:12px;color:#475569;line-height:1.5;margin-top:3px">${esc(clinicProfile.address).replace(/\n/g,"<br>")}</p>` : "";
  const cPhone = clinicProfile?.phone ? `<p style="font-size:12px;color:#475569;margin-top:3px">${esc(clinicProfile.phone)}</p>` : "";
  const doctorName = esc(apt.doctor?.name || "");
  const quals = clinicProfile?.qualifications ? esc(clinicProfile.qualifications) : "";
  const regNo = clinicProfile?.registrationNo ? `Reg. No. ${esc(clinicProfile.registrationNo)}` : "";

  const dobLine = patient.dateOfBirth
    ? `<div class="field"><label>Age</label><span>${differenceInYears(new Date(), new Date(patient.dateOfBirth))} yrs</span></div>`
    : "";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Prescription – ${esc(patient.name)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#1e293b;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{max-width:760px;margin:0 auto}
.accent{height:5px;background:linear-gradient(90deg,#0f766e,#0891b2)}
.header{display:flex;justify-content:space-between;align-items:flex-start;padding:18px 36px 14px;border-bottom:2px solid #e2e8f0}
.clinic-name{font-size:21px;font-weight:900;color:#0f766e;letter-spacing:-.3px;margin-bottom:4px}
.dr-col{text-align:right}
.dr-name{font-size:16px;font-weight:800;color:#0f172a}
.dr-sub{font-size:11px;color:#64748b;margin-top:3px}
.body{padding:16px 36px 28px}
.doc-label{text-align:center;font-size:9px;font-weight:800;letter-spacing:.25em;color:#94a3b8;text-transform:uppercase;margin-bottom:14px}
.info-row{display:flex;gap:24px;flex-wrap:wrap;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 16px;margin-bottom:16px}
.field{min-width:130px}.field label{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;display:block;margin-bottom:2px}.field span{font-weight:700;font-size:13px;color:#0f172a}
.allergy{background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 14px;margin-bottom:14px;color:#dc2626;font-weight:700;font-size:13px}
.rp{font-size:34px;font-style:italic;font-weight:900;color:#0d9488;margin-bottom:10px;line-height:1}
table{width:100%;border-collapse:collapse}
th{background:#0f766e;color:#fff;padding:8px 10px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:.08em}
tr:nth-child(even){background:#f8fafc}
td{padding:8px 10px;border-bottom:1px solid #f1f5f9;font-size:13px}
.notes{margin-top:14px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px 14px;font-size:13px;color:#78350f;font-style:italic}
.bottom-row{display:flex;justify-content:space-between;align-items:flex-end;padding-top:16px;border-top:1px dashed #e2e8f0;margin-top:28px}
.branding{font-size:8px;color:#cbd5e1}
.sig{text-align:center;min-width:180px}
.sig-line{border-top:1.5px solid #94a3b8;margin-bottom:7px;height:40px}
.sig-name{font-size:13px;font-weight:700;color:#0f172a}
.sig-sub{font-size:10px;color:#64748b;margin-top:2px}
@media print{button{display:none}.body{padding:10px 24px}.header{padding:12px 24px 10px}}
</style></head><body>
<div class="page">
  <div class="accent"></div>
  <div class="header">
    <div>
      ${clinicName ? `<p class="clinic-name">${clinicName}</p>${cTagline}${cAddr}${cPhone}` : `<p class="clinic-name">Medical Prescription</p>`}
    </div>
    <div class="dr-col">
      ${doctorName ? `<p class="dr-name">Dr. ${doctorName}</p>` : ""}
      ${quals ? `<p class="dr-sub">${quals}</p>` : ""}
      ${regNo ? `<p class="dr-sub">${regNo}</p>` : ""}
    </div>
  </div>
  <div class="body">
    <p class="doc-label">Medical Prescription · ${format(new Date(apt.date), "dd MMMM yyyy")}</p>
    <div class="info-row">
      <div class="field"><label>Patient</label><span>${esc(patient.name)}</span></div>
      <div class="field"><label>Phone</label><span>${esc(patient.phone)}</span></div>
      ${dobLine}
      ${patient.gender ? `<div class="field"><label>Gender</label><span>${esc(patient.gender)}</span></div>` : ""}
      ${patient.bloodGroup ? `<div class="field"><label>Blood Group</label><span>${esc(patient.bloodGroup)}</span></div>` : ""}
    </div>
    ${patient.allergies ? `<div class="allergy">⚠ ALLERGIES: ${esc(patient.allergies)}</div>` : ""}
    ${rx.chiefComplaints ? `<p style="margin-bottom:8px;font-size:13px"><b>Chief Complaints:</b> ${esc(rx.chiefComplaints)}</p>` : ""}
    ${rx.diagnosis ? `<p style="margin-bottom:12px;font-size:13px;background:#dbeafe;border:1px solid #bfdbfe;border-radius:8px;padding:8px 12px;font-weight:700;color:#1d4ed8"><b>Diagnosis:</b> ${esc(rx.diagnosis)}</p>` : ""}
    <p class="rp">&#8478;</p>
    <table>
      <thead><tr><th>Medicine</th><th>Dose</th><th>Frequency</th><th>Duration</th><th>Timing</th><th>Instructions</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${rx.notes ? `<div class="notes">${esc(rx.notes)}</div>` : ""}
    <div class="bottom-row">
      <span class="branding">Powered by BariQ</span>
      <div class="sig">
        <div class="sig-line"></div>
        <p class="sig-name">Dr. ${doctorName || "-"}</p>
        ${quals ? `<p class="sig-sub">${quals}</p>` : `<p class="sig-sub">Digital Prescription</p>`}
      </div>
    </div>
  </div>
</div>
<script>window.onload=()=>window.print();</script>
</body></html>`;
}

function buildSummaryHtml(
  patient: any,
  appointments: any[],
  prescriptionsByAppt: Map<number, any[]>,
  bills: any[],
  clinicProfile?: any
): string {
  const esc = (s: unknown) => String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const totalSpent = bills.filter(b => b.status === "paid").reduce((a, b) => a + b.amount, 0);
  const lastVisit = appointments[0] ? format(new Date(appointments[0].date), "MMM dd, yyyy") : "-";
  const age = calcAge(patient.dateOfBirth);

  const clinicName = esc(clinicProfile?.clinicName || "");
  const cTagline = clinicProfile?.tagline ? `<p style="font-size:11px;color:#64748b;font-style:italic;margin-top:2px">${esc(clinicProfile.tagline)}</p>` : "";
  const cAddr = clinicProfile?.address ? `<p style="font-size:12px;color:#475569;line-height:1.5;margin-top:3px">${esc(clinicProfile.address).replace(/\n/g,"<br>")}</p>` : "";
  const cPhone = clinicProfile?.phone ? `<p style="font-size:12px;color:#475569;margin-top:3px">${esc(clinicProfile.phone)}</p>` : "";

  const visitRows = appointments.map(apt => {
    const rx = prescriptionsByAppt.get(apt.id)?.[0];
    const v = apt.vitals || {};
    return `<tr>
      <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9">${format(new Date(apt.date), "dd MMM yyyy")}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9">Dr. ${esc(apt.doctor?.name || "-")}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9">${esc(apt.reason || "-")}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9">${esc(STATUS_LABELS[apt.status] || apt.status)}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9">${esc(rx?.diagnosis || "-")}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9">${esc(v.bp || "-")} ${v.pulse ? `/ ${v.pulse} bpm` : ""}</td>
    </tr>`;
  }).join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Patient Summary – ${esc(patient.name)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#1e293b;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{max-width:900px;margin:0 auto}
.accent{height:5px;background:linear-gradient(90deg,#0f766e,#0891b2)}
.header{display:flex;justify-content:space-between;align-items:flex-start;padding:18px 36px 14px;border-bottom:2px solid #e2e8f0}
.clinic-name{font-size:21px;font-weight:900;color:#0f766e;letter-spacing:-.3px;margin-bottom:4px}
.doc-info{text-align:right}
.doc-title{font-size:14px;font-weight:800;color:#1e293b}
.doc-date{font-size:12px;color:#64748b;margin-top:4px}
.body{padding:16px 36px 28px}
.section-title{font-size:12px;font-weight:800;color:#334155;text-transform:uppercase;letter-spacing:.08em;border-bottom:2px solid #e2e8f0;padding-bottom:6px;margin:20px 0 12px}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px}
.field label{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;display:block;margin-bottom:2px}.field span{font-weight:700;font-size:13px;color:#0f172a}
.allergy{background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 14px;margin-bottom:16px;color:#dc2626;font-weight:700;font-size:13px}
.stat-row{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px}
.stat{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px 18px}
.stat .val{font-size:20px;font-weight:900;color:#0f766e}.stat .lbl{font-size:10px;text-transform:uppercase;color:#94a3b8;letter-spacing:.08em;margin-top:2px}
table{width:100%;border-collapse:collapse}
thead th{background:#0f766e;color:#fff;padding:8px 10px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:.08em}
tbody tr:nth-child(even){background:#f8fafc}
tbody td{padding:7px 10px;border-bottom:1px solid #f1f5f9;font-size:12.5px}
.footer{padding:10px 36px 16px;text-align:center}
.branding{font-size:8px;color:#cbd5e1}
@media print{button{display:none}.body{padding:10px 24px}.header{padding:12px 24px 10px}}
</style></head><body>
<div class="page">
  <div class="accent"></div>
  <div class="header">
    <div>
      ${clinicName ? `<p class="clinic-name">${clinicName}</p>${cTagline}${cAddr}${cPhone}` : `<p class="clinic-name">Patient Medical Record</p>`}
    </div>
    <div class="doc-info">
      <p class="doc-title">Patient Medical Record</p>
      <p class="doc-date">Generated on ${format(new Date(), "dd MMMM yyyy")}</p>
    </div>
  </div>
  <div class="body">
    ${patient.allergies ? `<div class="allergy">⚠ KNOWN ALLERGIES: ${esc(patient.allergies)}</div>` : ""}
    <p class="section-title">Patient Profile</p>
    <div class="grid">
      <div class="field"><label>Full Name</label><span>${esc(patient.name)}</span></div>
      <div class="field"><label>Phone</label><span>${esc(patient.phone)}</span></div>
      ${patient.email ? `<div class="field"><label>Email</label><span>${esc(patient.email)}</span></div>` : ""}
      ${patient.dateOfBirth ? `<div class="field"><label>Date of Birth</label><span>${format(new Date(patient.dateOfBirth), "MMM dd, yyyy")} (${age})</span></div>` : ""}
      ${patient.gender ? `<div class="field"><label>Gender</label><span>${esc(patient.gender)}</span></div>` : ""}
      ${patient.bloodGroup ? `<div class="field"><label>Blood Group</label><span>${esc(patient.bloodGroup)}</span></div>` : ""}
      ${patient.address ? `<div class="field"><label>Address</label><span>${esc(patient.address)}</span></div>` : ""}
    </div>
    ${patient.notes ? `<p style="color:#475569;margin-bottom:12px;font-size:13px"><b>Clinical Notes:</b> ${esc(patient.notes)}</p>` : ""}
    <p class="section-title">Visit Summary</p>
    <div class="stat-row">
      <div class="stat"><div class="val">${appointments.length}</div><div class="lbl">Total Visits</div></div>
      <div class="stat"><div class="val">${lastVisit}</div><div class="lbl">Last Visit</div></div>
      <div class="stat"><div class="val">₹${(totalSpent / 100).toFixed(0)}</div><div class="lbl">Total Spent</div></div>
    </div>
    <p class="section-title">Visit History</p>
    <table>
      <thead><tr><th>Date</th><th>Doctor</th><th>Reason</th><th>Status</th><th>Diagnosis</th><th>BP / Pulse</th></tr></thead>
      <tbody>${visitRows}</tbody>
    </table>
  </div>
  <div class="footer">
    <p class="branding">Powered by BariQ</p>
  </div>
</div>
<script>window.onload=()=>window.print();</script>
</body></html>`;
}

// ── FollowUpDialog ─────────────────────────────────────────────────────────────

function FollowUpDialog({ patient, onClose }: { patient: any; onClose: () => void }) {
  const { toast } = useToast();
  const createAppointment = useCreateAppointment();
  const { data: doctors } = useDoctors();
  const [doctorId, setDoctorId] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [reason, setReason] = useState("Follow-up visit");

  const handleSubmit = () => {
    if (!doctorId || !date) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }
    const [y, mo, d] = date.split("-").map(Number);
    const appointmentDate = new Date(y, mo - 1, d, 9, 0);
    createAppointment.mutate({
      patientId: patient.id, doctorId,
      date: appointmentDate.toISOString(),
      status: "booked", reason, isQuickCheck: false,
    }, {
      onSuccess: () => {
        toast({ title: "Follow-up booked!", description: `Scheduled for ${format(appointmentDate, "MMM d")}` });
        onClose();
      },
      onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-4 py-2">
      <div className="bg-teal-50 p-4 rounded-xl">
        <p className="font-semibold text-blue-900">{patient.name}</p>
        <p className="text-sm text-teal-700">{patient.phone}</p>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Doctor *</label>
        <Select value={doctorId} onValueChange={setDoctorId}>
          <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Select doctor" /></SelectTrigger>
          <SelectContent>{doctors?.map(d => <SelectItem key={d.id} value={d.id}>Dr. {d.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Date *</label>
        <Input type="date" value={date} min={format(new Date(), "yyyy-MM-dd")} onChange={e => setDate(e.target.value)} className="rounded-xl h-11" />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Reason</label>
        <Input value={reason} onChange={e => setReason(e.target.value)} className="rounded-xl h-11" />
      </div>
      <Button onClick={handleSubmit} disabled={createAppointment.isPending} className="w-full rounded-xl h-11 bg-teal-600 hover:bg-teal-700">
        {createAppointment.isPending ? "Booking..." : "Book Follow-up"}
      </Button>
    </div>
  );
}

// ── VitalsEditor ──────────────────────────────────────────────────────────────

function VitalsEditor({ vitals, onSave, onCancel }: {
  vitals: any;
  onSave: (v: any) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    bp: vitals?.bp || "",
    pulse: vitals?.pulse?.toString() || "",
    temperature: vitals?.temperature?.toString() || "",
    weight: vitals?.weight?.toString() || "",
    spO2: vitals?.spO2?.toString() || "",
    height: vitals?.height?.toString() || "",
  });

  type VField = keyof typeof form;
  const vf = (label: string, key: VField, placeholder: string) => (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">{label}</label>
      <Input value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder={placeholder} className="h-8 text-sm rounded-lg" />
    </div>
  );

  const handleSave = () => {
    const out: any = {};
    if (form.bp.trim()) out.bp = form.bp.trim();
    if (form.pulse) out.pulse = parseFloat(form.pulse);
    if (form.temperature) out.temperature = parseFloat(form.temperature);
    if (form.weight) out.weight = parseFloat(form.weight);
    if (form.spO2) out.spO2 = parseFloat(form.spO2);
    if (form.height) out.height = parseFloat(form.height);
    onSave(out);
  };

  return (
    <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 mb-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-blue-500 mb-3">Record Vitals</p>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {vf("BP (mmHg)", "bp", "120/80")}
        {vf("Pulse (bpm)", "pulse", "72")}
        {vf("Temp (°F)", "temperature", "98.6")}
        {vf("Weight (kg)", "weight", "65")}
        {vf("SpO₂ (%)", "spO2", "98")}
        {vf("Height (cm)", "height", "170")}
      </div>
      <div className="flex gap-2">
        <Button size="sm" className="rounded-lg bg-blue-600 hover:bg-blue-700 h-8 text-xs" onClick={handleSave}>
          <Check className="w-3 h-3 mr-1" /> Save
        </Button>
        <Button size="sm" variant="outline" className="rounded-lg h-8 text-xs" onClick={onCancel}>
          <X className="w-3 h-3 mr-1" /> Cancel
        </Button>
      </div>
    </div>
  );
}

// ── PrescriptionCard ──────────────────────────────────────────────────────────

function PrescriptionCard({ rx, patient, apt, onDeleted, clinicProfile }: {
  rx: any;
  patient: any;
  apt: any;
  onDeleted: () => void;
  clinicProfile?: any;
}) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { toast } = useToast();
  const meds: any[] = rx.medications || [];

  const handlePrint = () => {
    const html = buildPrescriptionHtml(rx, patient, apt, clinicProfile);
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
  };

  const handleDelete = async () => {
    const res = await fetch(`/api/prescriptions/${rx.id}`, { method: "DELETE", credentials: "include" });
    if (res.ok) {
      onDeleted();
      toast({ title: "Prescription deleted" });
    } else {
      toast({ title: "Failed to delete prescription", variant: "destructive" });
    }
    setConfirmDelete(false);
  };

  return (
    <>
      <div className="p-3 rounded-xl bg-purple-50 border border-purple-100 mb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-purple-600">
            <Pill className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold uppercase">Prescription</span>
            {meds.length > 0 && (
              <span className="text-[10px] bg-purple-200 text-purple-700 px-1.5 py-0.5 rounded-full font-bold">{meds.length} meds</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setExpanded(e => !e)} className="p-1 rounded-lg hover:bg-purple-100 text-purple-400" title={expanded ? "Collapse" : "Expand all"}>
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            <button onClick={handlePrint} className="p-1 rounded-lg hover:bg-purple-100 text-purple-400" title="Print prescription">
              <Printer className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setConfirmDelete(true)} className="p-1 rounded-lg hover:bg-red-100 text-red-400" title="Delete prescription">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {rx.chiefComplaints && <p className="text-[11px] text-purple-700 mb-1"><span className="font-bold">Complaints:</span> {rx.chiefComplaints}</p>}
        {rx.diagnosis && <p className="text-[11px] text-purple-800 font-semibold mb-2"><span className="font-bold">Dx:</span> {rx.diagnosis}</p>}

        <div className="space-y-1.5">
          {(expanded ? meds : meds.slice(0, 3)).map((med, i) => (
            <div key={i} className="flex items-start justify-between text-xs gap-2">
              <span className="font-semibold text-purple-900 min-w-0">{med.name}</span>
              <span className="text-purple-600 text-right shrink-0">
                {[med.dosage, med.frequency, med.duration, med.timing].filter(Boolean).join(" · ")}
              </span>
            </div>
          ))}
          {expanded && meds.map((med, i) =>
            med.instructions ? (
              <p key={`i${i}`} className="text-[10px] text-purple-500 italic ml-2">↳ {med.instructions}</p>
            ) : null
          )}
          {!expanded && meds.length > 3 && (
            <button onClick={() => setExpanded(true)} className="text-xs text-purple-500 hover:text-purple-700 font-medium">
              +{meds.length - 3} more medicines
            </button>
          )}
        </div>
        {rx.notes && <p className="text-xs text-purple-600 italic mt-2 border-t border-purple-100 pt-2">{rx.notes}</p>}
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Prescription?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the prescription for this visit. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction className="rounded-xl bg-red-600 hover:bg-red-700" onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

const EMPTY_EDIT = {
  name: "", phone: "", email: "", notes: "",
  dateOfBirth: "", gender: "", bloodGroup: "", allergies: "", address: "",
};

export default function PatientHistory() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const patientId = Number(id);

  const { data: patient, isLoading } = usePatient(patientId);
  const { data: patientAppointments } = useAppointments({ patientId }, { refetchInterval: false });
  const { data: settings } = useQuery<Record<string, any>>({
    queryKey: ["/api/settings"],
    queryFn: () => fetch("/api/settings", { credentials: "include" }).then(r => r.ok ? r.json() : {}),
  });
  const clinicProfile = settings?.clinicProfile;
  const updatePatient = useUpdatePatient();
  const deletePatient = useDeletePatient();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showFollowUp, setShowFollowUp] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Patient edit
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState(EMPTY_EDIT);

  useEffect(() => {
    if (patient) {
      setEditData({
        name: patient.name || "",
        phone: patient.phone || "",
        email: patient.email || "",
        notes: patient.notes || "",
        dateOfBirth: (patient as any).dateOfBirth || "",
        gender: (patient as any).gender || "",
        bloodGroup: (patient as any).bloodGroup || "",
        allergies: (patient as any).allergies || "",
        address: (patient as any).address || "",
      });
    }
  }, [patient]);

  // Timeline state
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingVitalsApptId, setEditingVitalsApptId] = useState<number | null>(null);
  const [editingNotesApptId, setEditingNotesApptId] = useState<number | null>(null);
  const [notesValue, setNotesValue] = useState("");

  // Data fetching
  const { data: prescriptions } = useQuery<any[]>({
    queryKey: ["/api/prescriptions", { patientId }],
    queryFn: async () => {
      const res = await fetch(`/api/prescriptions?patientId=${patientId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!patientId,
  });

  const { data: bills } = useQuery<any[]>({
    queryKey: ["/api/bills", { patientId }],
    queryFn: async () => {
      const res = await fetch(`/api/bills?patientId=${patientId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!patientId,
  });

  const prescriptionsByAppt = useMemo(() => {
    const map = new Map<number, any[]>();
    (prescriptions || []).forEach(p => {
      const arr = map.get(p.appointmentId) || [];
      arr.push(p);
      map.set(p.appointmentId, arr);
    });
    return map;
  }, [prescriptions]);

  const billsByAppt = useMemo(() => {
    const map = new Map<number, any>();
    (bills || []).forEach(b => map.set(b.appointmentId, b));
    return map;
  }, [bills]);

  const allAppointments = useMemo(() =>
    [...(patientAppointments || [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [patientAppointments]
  );

  const filteredAppointments = useMemo(() =>
    statusFilter === "all" ? allAppointments : allAppointments.filter(a => a.status === statusFilter),
    [allAppointments, statusFilter]
  );

  // Stats
  const totalVisits = allAppointments.length;
  const completedVisits = allAppointments.filter(a => a.status === "completed").length;
  const totalSpent = (bills || []).filter(b => b.status === "paid").reduce((acc, b) => acc + b.amount, 0);
  const lastVisit = allAppointments[0]?.date ?? null;

  const handleSave = async () => {
    if (!editData.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    const phoneDigits = editData.phone.replace(/\D/g, "");
    const validPhone = (phoneDigits.length === 10 && /^[6-9]/.test(phoneDigits)) ||
      (phoneDigits.length === 12 && phoneDigits.startsWith("91") && /^[6-9]/.test(phoneDigits.slice(2)));
    if (!validPhone) {
      toast({ title: "Invalid phone number", description: "Enter a valid 10-digit mobile number", variant: "destructive" });
      return;
    }
    try {
      await updatePatient.mutateAsync({
        id: patientId,
        updates: {
          name: editData.name.trim(),
          phone: editData.phone.trim(),
          email: editData.email.trim() || undefined,
          notes: editData.notes.trim() || undefined,
          dateOfBirth: editData.dateOfBirth || undefined,
          gender: editData.gender || undefined,
          bloodGroup: editData.bloodGroup || undefined,
          allergies: editData.allergies.trim() || undefined,
          address: editData.address.trim() || undefined,
        } as any,
      });
      queryClient.invalidateQueries({ queryKey: [api.patients.get.path, patientId] });
      setIsEditing(false);
      toast({ title: "Patient updated" });
    } catch {
      toast({ title: "Failed to update", variant: "destructive" });
    }
  };

  const handleSaveVitals = async (apptId: number, vitals: any) => {
    const res = await fetch(`/api/appointments/${apptId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vitals }),
      credentials: "include",
    });
    if (res.ok) {
      queryClient.invalidateQueries({ queryKey: [api.appointments.list.path] });
      setEditingVitalsApptId(null);
      toast({ title: "Vitals saved" });
    } else {
      toast({ title: "Failed to save vitals", variant: "destructive" });
    }
  };

  const handleSaveNotes = async (apptId: number) => {
    const res = await fetch(`/api/appointments/${apptId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: notesValue }),
      credentials: "include",
    });
    if (res.ok) {
      queryClient.invalidateQueries({ queryKey: [api.appointments.list.path] });
      setEditingNotesApptId(null);
      toast({ title: "Notes saved" });
    } else {
      toast({ title: "Failed to save notes", variant: "destructive" });
    }
  };

  const handlePrintSummary = () => {
    const html = buildSummaryHtml(patient, allAppointments, prescriptionsByAppt, bills || [], clinicProfile);
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
  };

  const ef = (key: keyof typeof EMPTY_EDIT) => (e: { target: { value: string } }) =>
    setEditData(d => ({ ...d, [key]: e.target.value }));

  if (isLoading) return <Loading />;
  if (!patient) return <div className="p-8 text-slate-500">Patient not found.</div>;

  const pt = patient as any;
  const age = calcAge(pt.dateOfBirth);

  return (
    <>
      <div className="mb-5">
        <Button variant="ghost" onClick={() => setLocation("/patients")} className="text-slate-500 hover:text-slate-900 -ml-2">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Patients
        </Button>
      </div>

      {/* Allergy Banner */}
      {pt.allergies && (
        <div className="mb-5 flex items-start gap-3 p-4 rounded-2xl bg-red-50 border border-red-200">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-black text-red-700 text-sm">KNOWN ALLERGIES</p>
            <p className="text-red-600 text-sm mt-0.5">{pt.allergies}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ── Left Panel ─────────────────────────────────────────────────────── */}
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-2xl border border-slate-100 shadow-sm overflow-hidden bg-white">
            <div className="h-20 bg-gradient-to-r from-teal-600 to-blue-600" />
            <div className="p-5 -mt-10">
              <div className="w-20 h-20 rounded-2xl bg-white p-1 shadow-xl mb-4">
                <div className="w-full h-full rounded-[14px] bg-slate-100 flex items-center justify-center text-3xl">👤</div>
              </div>

              {isEditing ? (
                <div className="space-y-3 mb-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1 block">Full Name *</label>
                    <Input value={editData.name} onChange={ef("name")} className="rounded-xl h-9 text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-semibold text-slate-500 mb-1 block">Phone *</label>
                      <Input value={editData.phone} onChange={ef("phone")} className="rounded-xl h-9 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 mb-1 block">Date of Birth</label>
                      <Input type="date" value={editData.dateOfBirth} onChange={ef("dateOfBirth")} className="rounded-xl h-9 text-sm" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-semibold text-slate-500 mb-1 block">Gender</label>
                      <Select value={editData.gender} onValueChange={v => setEditData(d => ({ ...d, gender: v }))}>
                        <SelectTrigger className="rounded-xl h-9 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>{GENDER_OPTIONS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 mb-1 block">Blood Group</label>
                      <Select value={editData.bloodGroup} onValueChange={v => setEditData(d => ({ ...d, bloodGroup: v }))}>
                        <SelectTrigger className="rounded-xl h-9 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>{BLOOD_GROUPS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1 block">Email</label>
                    <Input value={editData.email} onChange={ef("email")} placeholder="Email (optional)" className="rounded-xl h-9 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1 block">Address</label>
                    <Input value={editData.address} onChange={ef("address")} placeholder="Address" className="rounded-xl h-9 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-black text-red-500 mb-1 block">⚠ Allergies</label>
                    <Input
                      value={editData.allergies}
                      onChange={ef("allergies")}
                      placeholder="Penicillin, Aspirin, Sulfa drugs..."
                      className="rounded-xl h-9 text-sm border-red-200 focus-visible:ring-red-300"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1 block">Clinical Notes</label>
                    <Textarea
                      value={editData.notes}
                      onChange={ef("notes")}
                      placeholder="Chronic conditions, past history..."
                      className="rounded-xl text-sm min-h-[72px] resize-none"
                    />
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="text-xl font-black text-slate-900 mb-1">{patient.name}</h2>
                  <div className="flex items-center gap-1.5 flex-wrap mb-3">
                    {age && <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{age}</span>}
                    {pt.gender && <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{pt.gender}</span>}
                    {pt.bloodGroup && <span className="text-xs font-black text-red-600 bg-red-50 px-2 py-0.5 rounded-full">{pt.bloodGroup}</span>}
                  </div>
                  <p className="text-slate-400 text-xs mb-4">#PAT-{patient.id}</p>

                  <div className="space-y-2.5 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center shrink-0"><Phone className="w-3.5 h-3.5 text-slate-400" /></div>
                      <a href={`tel:${patient.phone}`} className="text-sm font-medium hover:text-teal-700 text-slate-700">{patient.phone}</a>
                    </div>
                    {patient.email && (
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center shrink-0"><Mail className="w-3.5 h-3.5 text-slate-400" /></div>
                        <span className="text-sm text-slate-600">{patient.email}</span>
                      </div>
                    )}
                    {pt.dateOfBirth && (
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center shrink-0"><Calendar className="w-3.5 h-3.5 text-slate-400" /></div>
                        <span className="text-sm text-slate-600">{format(new Date(pt.dateOfBirth), "MMM d, yyyy")}</span>
                      </div>
                    )}
                    {pt.address && (
                      <div className="flex items-start gap-3">
                        <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center shrink-0 mt-0.5"><MapPin className="w-3.5 h-3.5 text-slate-400" /></div>
                        <span className="text-sm text-slate-500 leading-snug">{pt.address}</span>
                      </div>
                    )}
                    {patient.notes && (
                      <div className="flex items-start gap-3">
                        <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center shrink-0 mt-0.5"><FileText className="w-3.5 h-3.5 text-slate-400" /></div>
                        <p className="text-sm text-slate-500 italic leading-snug">{patient.notes}</p>
                      </div>
                    )}
                  </div>
                </>
              )}

              <div className="flex gap-2">
                {isEditing ? (
                  <>
                    <Button size="sm" onClick={handleSave} disabled={updatePatient.isPending} className="rounded-xl bg-teal-600 text-white flex-1 h-9">
                      <Check className="w-3.5 h-3.5 mr-1.5" /> {updatePatient.isPending ? "Saving..." : "Save"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setIsEditing(false)} className="rounded-xl h-9">
                      <X className="w-3.5 h-3.5 mr-1.5" /> Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setIsEditing(true)} className="rounded-xl text-slate-500 flex-1 h-9">
                      <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit Profile
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowDeleteConfirm(true)} className="rounded-xl text-red-500 border-red-100 hover:bg-red-50 h-9">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3">
            {([
              { label: "Total Visits", value: String(totalVisits), icon: Activity, color: "text-teal-700 bg-teal-50" },
              { label: "Completed", value: String(completedVisits), icon: Check, color: "text-green-600 bg-green-50" },
              { label: "Total Spent", value: `₹${(totalSpent / 100).toFixed(0)}`, icon: Receipt, color: "text-purple-600 bg-purple-50" },
              { label: "Last Visit", value: lastVisit ? format(new Date(lastVisit), "MMM d") : "-", icon: Calendar, color: "text-blue-600 bg-blue-50" },
            ] as const).map(stat => (
              <div key={stat.label} className="bg-white rounded-2xl border border-slate-100 p-3 text-center shadow-sm">
                <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center mx-auto mb-2", stat.color)}>
                  <stat.icon className="w-4 h-4" />
                </div>
                <p className="text-base font-black text-slate-900">{stat.value}</p>
                <p className="text-[10px] text-slate-400 font-medium">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div className="space-y-2">
            <Button onClick={() => setShowFollowUp(true)} className="w-full rounded-2xl h-11 bg-teal-600 hover:bg-teal-700 shadow-lg shadow-teal-600/20">
              <CalendarPlus className="w-4 h-4 mr-2" /> Book Follow-up
            </Button>
            <Button variant="outline" onClick={handlePrintSummary} className="w-full rounded-2xl h-10 text-slate-500 border-slate-200 hover:bg-slate-50">
              <Printer className="w-4 h-4 mr-2" /> Print Patient Summary
            </Button>
          </div>
        </div>

        {/* ── Right Panel / Timeline ─────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-slate-900">Medical History</h3>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="rounded-xl h-9 w-44 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Visits ({totalVisits})</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="booked">Booked</SelectItem>
                  <SelectItem value="checked_in">Checked In</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="no_show">No Show</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {filteredAppointments.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-slate-100">
              <History className="w-16 h-16 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-400 font-semibold">
                {statusFilter === "all" ? "No appointment history" : `No ${STATUS_LABELS[statusFilter] || statusFilter} appointments`}
              </p>
              {statusFilter === "all" && (
                <Button onClick={() => setShowFollowUp(true)} size="sm" className="mt-4 rounded-xl bg-teal-600">
                  <CalendarPlus className="w-4 h-4 mr-2" /> Book First Appointment
                </Button>
              )}
            </div>
          ) : (
            <div className="relative space-y-5 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
              {filteredAppointments.map((apt) => {
                const apptPrescriptions = prescriptionsByAppt.get(apt.id) || [];
                const apptBill = billsByAppt.get(apt.id);
                const vitals = (apt as any).vitals;
                const isEditingVitals = editingVitalsApptId === apt.id;
                const isEditingNotes = editingNotesApptId === apt.id;

                return (
                  <div key={apt.id} className="relative flex items-start gap-5 group">
                    <div className="absolute left-0 mt-2 w-10 h-10 rounded-full bg-white border-4 border-slate-50 shadow-sm flex items-center justify-center z-10">
                      <div className={cn("w-2.5 h-2.5 rounded-full", DOT_COLORS[apt.status] || "bg-slate-400")} />
                    </div>

                    <div className="flex-1 ml-12">
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                        {format(new Date(apt.date), "MMMM dd, yyyy")}
                      </div>
                      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm group-hover:shadow-md transition-shadow p-5">
                        {/* Header */}
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="font-bold text-slate-900">Dr. {apt.doctor?.name}</h4>
                            <p className="text-xs text-teal-700 font-medium">{apt.reason || "General Consultation"}</p>
                          </div>
                          <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0", STATUS_COLORS[apt.status] || "bg-slate-100 text-slate-700")}>
                            {STATUS_LABELS[apt.status] || apt.status}
                          </span>
                        </div>

                        {/* Vitals display + edit trigger */}
                        {!isEditingVitals && (
                          <div className="flex items-center gap-1.5 flex-wrap mb-3">
                            {vitals?.bp && <span className="text-[11px] bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-medium">🩸 {vitals.bp}</span>}
                            {vitals?.pulse && <span className="text-[11px] bg-pink-50 text-pink-600 px-2 py-0.5 rounded-full font-medium">❤️ {vitals.pulse} bpm</span>}
                            {vitals?.temperature && <span className="text-[11px] bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full font-medium">🌡️ {vitals.temperature}°F</span>}
                            {vitals?.weight && <span className="text-[11px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">⚖️ {vitals.weight} kg</span>}
                            {vitals?.spO2 && <span className="text-[11px] bg-cyan-50 text-cyan-600 px-2 py-0.5 rounded-full font-medium">💨 {vitals.spO2}%</span>}
                            {vitals?.height && <span className="text-[11px] bg-green-50 text-green-600 px-2 py-0.5 rounded-full font-medium">📏 {vitals.height} cm</span>}
                            <button
                              onClick={() => { setEditingVitalsApptId(apt.id); setEditingNotesApptId(null); }}
                              className="text-[10px] text-slate-400 hover:text-blue-500 px-2 py-0.5 rounded-full border border-dashed border-slate-200 hover:border-blue-300 transition-colors"
                            >
                              {vitals?.bp ? "Edit vitals" : "+ Add vitals"}
                            </button>
                          </div>
                        )}

                        {/* Vitals editor */}
                        {isEditingVitals && (
                          <VitalsEditor
                            vitals={vitals}
                            onSave={(v) => handleSaveVitals(apt.id, v)}
                            onCancel={() => setEditingVitalsApptId(null)}
                          />
                        )}

                        {/* Clinical Notes */}
                        {isEditingNotes ? (
                          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 mb-3">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Clinical Notes</p>
                            <Textarea
                              value={notesValue}
                              onChange={e => setNotesValue(e.target.value)}
                              className="rounded-xl text-sm min-h-[72px] resize-none mb-2"
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <Button size="sm" className="rounded-lg h-7 text-xs bg-teal-600 hover:bg-teal-700" onClick={() => handleSaveNotes(apt.id)}>
                                <Check className="w-3 h-3 mr-1" /> Save
                              </Button>
                              <Button size="sm" variant="outline" className="rounded-lg h-7 text-xs" onClick={() => setEditingNotesApptId(null)}>
                                <X className="w-3 h-3 mr-1" /> Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div
                            className="p-3 rounded-xl bg-slate-50 border border-slate-100 mb-3 group/notes cursor-pointer hover:bg-slate-100 transition-colors"
                            onClick={() => {
                              setEditingNotesApptId(apt.id);
                              setNotesValue(apt.notes || "");
                              setEditingVitalsApptId(null);
                            }}
                          >
                            <div className="flex items-center gap-2 mb-1 text-slate-400">
                              <FileText className="w-3 h-3" />
                              <span className="text-[10px] font-bold uppercase">Clinical Notes</span>
                              <Pencil className="w-3 h-3 ml-auto opacity-0 group-hover/notes:opacity-100 transition-opacity" />
                            </div>
                            <p className="text-sm text-slate-600 italic">
                              {apt.notes
                                ? `"${apt.notes}"`
                                : <span className="text-slate-300 not-italic">Click to add clinical notes...</span>
                              }
                            </p>
                          </div>
                        )}

                        {/* Prescriptions */}
                        {apptPrescriptions.map(rx => (
                          <PrescriptionCard
                            key={rx.id}
                            rx={rx}
                            patient={patient}
                            apt={apt}
                            clinicProfile={clinicProfile}
                            onDeleted={() => queryClient.invalidateQueries({ queryKey: ["/api/prescriptions", { patientId }] })}
                          />
                        ))}

                        {/* Bill */}
                        {apptBill && (
                          <div className={cn(
                            "flex items-center justify-between p-3 rounded-xl border text-xs",
                            apptBill.status === "paid" ? "bg-green-50 border-green-100" : "bg-yellow-50 border-yellow-100"
                          )}>
                            <div className="flex items-center gap-2">
                              <Receipt className={cn("w-3.5 h-3.5", apptBill.status === "paid" ? "text-green-600" : "text-yellow-600")} />
                              <span className={cn("font-semibold", apptBill.status === "paid" ? "text-green-700" : "text-yellow-700")}>
                                {apptBill.status === "paid" ? "Paid" : "Pending"} · ₹{(apptBill.amount / 100).toFixed(0)}
                                {apptBill.paymentMethod && ` · ${apptBill.paymentMethod.toUpperCase()}`}
                              </span>
                            </div>
                            {apptBill.status !== "paid" && (
                              <button
                                onClick={async () => {
                                  const res = await fetch(`/api/bills/${apptBill.id}`, {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ status: "paid", paymentMethod: "cash" }),
                                    credentials: "include",
                                  });
                                  if (res.ok) {
                                    queryClient.invalidateQueries({ queryKey: ["/api/bills", { patientId }] });
                                    toast({ title: "Marked as paid" });
                                  } else {
                                    toast({ title: "Error", description: "Failed to mark bill as paid", variant: "destructive" });
                                  }
                                }}
                                className="px-2 py-0.5 rounded-lg bg-yellow-200 text-yellow-800 font-semibold hover:bg-yellow-300 transition-colors whitespace-nowrap"
                              >
                                Mark Paid
                              </button>
                            )}
                          </div>
                        )}

                        <div className="mt-3 flex items-center gap-4 text-xs text-slate-400">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3 h-3" />
                            {format(new Date(apt.date), "hh:mm a")}
                          </div>
                          {apt.queuePosition && (
                            <div className="flex items-center gap-1.5">
                              <ChevronRight className="w-3 h-3" />
                              Queue #{apt.queuePosition}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Follow-up Dialog */}
      <Dialog open={showFollowUp} onOpenChange={setShowFollowUp}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader><DialogTitle>Book Follow-up Appointment</DialogTitle></DialogHeader>
          <FollowUpDialog patient={patient} onClose={() => setShowFollowUp(false)} />
        </DialogContent>
      </Dialog>

      {/* Delete Patient */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Patient?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{patient.name}</strong> and all their appointments, bills, and prescriptions. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-red-600 hover:bg-red-700"
              onClick={() => {
                deletePatient.mutate(patientId, {
                  onSuccess: () => { toast({ title: "Patient deleted" }); setLocation("/patients"); },
                  onError: () => toast({ title: "Failed to delete patient", variant: "destructive" }),
                });
              }}
            >
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
