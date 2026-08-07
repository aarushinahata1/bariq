import { MedicineNameAutocomplete } from "@/components/MedicineNameAutocomplete";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAppointments, useUpdateAppointment } from "@/hooks/use-appointments";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useDoctors } from "@/hooks/use-doctors";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { GripVertical, Users, Banknote, Pill, Plus, Trash2, Phone, Copy, Check, ExternalLink, AlertTriangle, Share2, Search, X, ChevronDown, FileText, Printer } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Loading } from "@/components/ui/loading";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useRole } from "@/hooks/use-role";
import { Reorder, AnimatePresence } from "framer-motion";
import { api } from "@shared/routes";

// ── Print utilities ───────────────────────────────────────────────────────────

function esc(s: unknown): string {
  return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function openPrint(html: string, title: string) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.document.title = title;
}

// ── Prescription PDF builder ──────────────────────────────────────────────────

type PrescriptionMed = { name: string; dosage: string; frequency: string; duration: string; timing: string; instructions: string };

function buildPrescriptionHtml(
  patient: { name: string; phone?: string; age?: string },
  doctor: string,
  date: string,
  rx: { chiefComplaints?: string; diagnosis?: string; medications: PrescriptionMed[]; notes?: string },
  profile: Record<string, any>
): string {
  const clinicName = esc(profile?.clinicName || "Clinic");
  const tagline = profile?.tagline ? `<p class="clinic-sub">${esc(profile.tagline)}</p>` : "";
  const address = profile?.address ? `<p class="clinic-detail">${esc(profile.address).replace(/\n/g, "<br>")}</p>` : "";
  const phone = profile?.phone ? `<p class="clinic-detail">${esc(profile.phone)}</p>` : "";
  const doctorName = esc(profile?.doctorName || doctor);
  const quals = profile?.qualifications ? esc(profile.qualifications) : "";
  const regNo = profile?.registrationNo ? `Reg. No. ${esc(profile.registrationNo)}` : "";

  const medRows = rx.medications.map((m, i) => `
    <tr>
      <td class="num">${i + 1}</td>
      <td><strong>${esc(m.name)}</strong></td>
      <td>${esc(m.dosage)}</td>
      <td>${esc(m.frequency)}</td>
      <td>${esc(m.timing)}</td>
      <td>${esc(m.duration)}</td>
      <td>${esc(m.instructions)}</td>
    </tr>`).join("");

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Prescription – ${esc(patient.name)}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',system-ui,Arial,sans-serif;background:#fff;color:#1e293b;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{max-width:760px;margin:0 auto}
.accent{height:5px;background:linear-gradient(90deg,#0f766e,#0891b2)}
.header{display:flex;justify-content:space-between;align-items:flex-start;padding:20px 40px 16px;border-bottom:2px solid #e2e8f0}
.clinic-name{font-size:21px;font-weight:900;color:#0f766e;letter-spacing:-.3px;margin-bottom:4px}
.clinic-sub{font-size:11px;color:#64748b;font-style:italic;margin-top:2px}
.clinic-detail{font-size:12px;color:#475569;line-height:1.5;margin-top:3px}
.dr-col{text-align:right}
.dr-name{font-size:16px;font-weight:800;color:#0f172a}
.dr-sub{font-size:11px;color:#64748b;margin-top:3px}
.body{padding:18px 40px 28px}
.doc-label{text-align:center;font-size:9px;font-weight:800;letter-spacing:.25em;color:#94a3b8;text-transform:uppercase;margin-bottom:14px}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px 24px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 16px;margin-bottom:18px}
.info-row{display:flex;gap:6px;font-size:12.5px}
.lbl{color:#64748b;min-width:70px}.val{font-weight:600;color:#0f172a}
.section{margin-bottom:14px}
.sec-label{font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.15em;margin-bottom:6px}
.complaint-box{background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:10px 14px;font-size:13px;color:#78350f;line-height:1.6}
.diag-box{background:#dbeafe;border:1px solid #bfdbfe;border-radius:8px;padding:10px 14px;font-size:13.5px;font-weight:700;color:#1d4ed8}
.rp{font-size:36px;font-style:italic;font-weight:900;color:#0d9488;margin-bottom:12px;line-height:1}
table{width:100%;border-collapse:collapse;margin-bottom:18px;font-size:12.5px}
thead th{font-size:9px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:.1em;padding:8px 10px;background:#0f766e;text-align:left}
tbody td{padding:9px 10px;border-bottom:1px solid #f1f5f9;vertical-align:top}
tbody tr:nth-child(even){background:#f8fafc}
tbody tr:last-child td{border-bottom:none}
.num{color:#94a3b8;width:20px;font-size:11px}
.notes-lbl{font-size:9px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:.1em;margin-bottom:5px}
.notes-box{background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px 14px;font-size:13px;color:#78350f;line-height:1.65;margin-bottom:22px}
.bottom-row{display:flex;justify-content:space-between;align-items:flex-end;padding-top:20px;border-top:1px dashed #e2e8f0;margin-top:8px}
.branding{font-size:8px;color:#cbd5e1;padding-bottom:2px}
.sig-box{text-align:center;min-width:180px}
.sig-line{border-top:1.5px solid #94a3b8;margin-bottom:7px;height:40px}
.sig-name{font-size:12px;font-weight:700;color:#0f172a}
.sig-sub{font-size:10px;color:#64748b;margin-top:2px}
@media print{.body{padding:12px 28px}.header{padding:12px 28px 12px}}
</style></head><body>
<div class="page">
  <div class="accent"></div>
  <div class="header">
    <div>
      <p class="clinic-name">${clinicName}</p>
      ${tagline}${address}${phone}
    </div>
    <div class="dr-col">
      <p class="dr-name">Dr. ${doctorName}</p>
      ${quals ? `<p class="dr-sub">${quals}</p>` : ""}
      ${regNo ? `<p class="dr-sub">${regNo}</p>` : ""}
    </div>
  </div>
  <div class="body">
    <p class="doc-label">Medical Prescription</p>
    <div class="info-grid">
      <div class="info-row"><span class="lbl">Patient</span><span class="val">${esc(patient.name)}</span></div>
      <div class="info-row"><span class="lbl">Date</span><span class="val">${esc(date)}</span></div>
      ${patient.phone ? `<div class="info-row"><span class="lbl">Phone</span><span class="val">${esc(patient.phone)}</span></div>` : ""}
      ${patient.age ? `<div class="info-row"><span class="lbl">Age</span><span class="val">${esc(patient.age)}</span></div>` : ""}
    </div>
    ${rx.chiefComplaints ? `<div class="section"><p class="sec-label">Chief Complaints</p><div class="complaint-box">${esc(rx.chiefComplaints)}</div></div>` : ""}
    ${rx.diagnosis ? `<div class="section"><p class="sec-label">Diagnosis</p><div class="diag-box">${esc(rx.diagnosis)}</div></div>` : ""}
    <p class="rp">&#8478;</p>
    <table>
      <thead><tr><th></th><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Timing</th><th>Duration</th><th>Instructions</th></tr></thead>
      <tbody>${medRows}</tbody>
    </table>
    ${rx.notes ? `<div><p class="notes-lbl">Advice / Notes</p><div class="notes-box">${esc(rx.notes)}</div></div>` : ""}
    <div class="bottom-row">
      <span class="branding">Powered by BariQ</span>
      <div class="sig-box">
        <div class="sig-line"></div>
        <p class="sig-name">Dr. ${doctorName}</p>
        ${quals ? `<p class="sig-sub">${quals}</p>` : ""}
      </div>
    </div>
  </div>
</div>
<script>window.onload=function(){window.print()}</script>
</body></html>`;
}

function buildCombinedHtml(
  receipt: { patient: string; doctor: string; amount: string; date: string; paymentMethod: string },
  prescription: { medications: Array<{ name: string; dosage: string; frequency: string; duration: string; timing: string; instructions: string }>; notes: string } | null,
  profile: Record<string, any>
): string {
  const clinicName = esc(profile?.clinicName || "Clinic");
  const tagline = profile?.tagline ? `<p class="clinic-sub">${esc(profile.tagline)}</p>` : "";
  const address = profile?.address ? `<p class="clinic-detail">${esc(profile.address).replace(/\n/g, "<br>")}</p>` : "";
  const phone = profile?.phone ? `<p class="clinic-detail">${esc(profile.phone)}</p>` : "";
  const doctorDisplay = esc(profile?.doctorName || receipt.doctor);
  const quals = profile?.qualifications ? esc(profile.qualifications) : "";
  const regNo = profile?.registrationNo ? `Reg. No. ${esc(profile.registrationNo)}` : "";

  let rxSection: string;
  if (prescription) {
    const medsRows = prescription.medications.map((m, i) => `
      <tr>
        <td class="num">${i + 1}.</td>
        <td><strong>${esc(m.name)}</strong></td>
        <td>${esc(m.dosage)}</td>
        <td>${esc((m as any).frequency || "")}</td>
        <td>${esc(m.duration)}</td>
        <td>${esc(m.instructions)}</td>
      </tr>`).join("");
    rxSection = `
  <p class="rp">&#8478;</p>
  <table>
    <thead><tr><th style="width:24px"></th><th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th><th>Instructions</th></tr></thead>
    <tbody>${medsRows}</tbody>
  </table>
  ${prescription.notes ? `<div class="notes"><p class="nl">Notes &amp; Instructions</p><p class="nt">${esc(prescription.notes)}</p></div>` : ""}`;
  } else {
    const blankLines = Array(7).fill('<div class="wline"></div>').join("");
    rxSection = `
  <p class="rp">&#8478;</p>
  <div class="write-area">${blankLines}</div>
  <div class="notes-blank">
    <p class="nl">Notes &amp; Instructions</p>
    <div class="wline" style="margin-top:8px"></div>
    <div class="wline"></div>
  </div>`;
  }

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Bill &amp; Prescription – ${esc(receipt.patient)}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',system-ui,Arial,sans-serif;background:#fff;color:#1e293b;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{max-width:760px;margin:0 auto}
.accent{height:5px;background:linear-gradient(90deg,#0f766e,#0891b2)}
.header{display:flex;justify-content:space-between;align-items:flex-start;padding:20px 40px 16px;border-bottom:2px solid #e2e8f0}
.clinic-name{font-size:21px;font-weight:900;color:#0f766e;letter-spacing:-.3px;margin-bottom:4px}
.clinic-sub{font-size:11px;color:#64748b;font-style:italic;margin-top:2px}
.clinic-detail{font-size:12px;color:#475569;line-height:1.5;margin-top:3px}
.dr-col{text-align:right}
.dr-name{font-size:16px;font-weight:800;color:#0f172a}
.dr-sub{font-size:11px;color:#64748b;margin-top:3px}
.body{padding:18px 40px 28px}
.section-label{font-size:9px;font-weight:800;letter-spacing:.2em;color:#94a3b8;text-transform:uppercase;margin-bottom:8px}
.row{display:flex;justify-content:space-between;align-items:baseline;font-size:13px;padding:7px 0;border-bottom:1px solid #f1f5f9}
.row:last-child{border-bottom:none}
.lbl{color:#64748b}.val{font-weight:600;color:#0f172a}
.amount-box{display:flex;justify-content:space-between;align-items:center;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px 18px;margin:14px 0 20px}
.amount-label{font-size:12px;font-weight:600;color:#15803d}
.amount-method{font-size:12px;color:#16a34a;margin-top:2px}
.amount-value{font-size:26px;font-weight:900;color:#15803d}
.badge{display:inline-block;background:#dcfce7;color:#16a34a;font-size:9.5px;font-weight:700;padding:2px 8px;border-radius:20px;text-transform:uppercase;letter-spacing:.05em;margin-top:4px}
.divider{display:flex;align-items:center;gap:12px;margin:4px 0 20px}
.div-line{flex:1;height:1px;background:#e2e8f0}
.div-label{font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.2em}
.rp{font-size:34px;font-style:italic;font-weight:900;color:#0d9488;margin-bottom:14px;line-height:1}
table{width:100%;border-collapse:collapse;margin-bottom:22px}
thead th{font-size:9px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:.1em;padding:8px 10px;background:#0f766e;text-align:left}
tbody td{font-size:13px;padding:10px;border-bottom:1px solid #f1f5f9}
tbody tr:nth-child(even){background:#f8fafc}
tbody tr:last-child td{border-bottom:none}
.num{color:#94a3b8;width:24px;padding-right:6px;vertical-align:top}
.notes{background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;margin-bottom:24px}
.notes-blank{margin-bottom:24px}
.nl{font-size:9px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px}
.nt{font-size:13px;color:#78350f;line-height:1.65}
.write-area{margin-bottom:18px}
.wline{border-bottom:1px solid #cbd5e1;height:32px;margin-bottom:4px}
.bottom-row{display:flex;justify-content:space-between;align-items:flex-end;padding-top:20px;border-top:1px dashed #e2e8f0;margin-top:8px}
.branding{font-size:8px;color:#cbd5e1;padding-bottom:2px}
.sig-box{text-align:center;min-width:180px}
.sig-line{border-top:1.5px solid #94a3b8;margin-bottom:7px;height:40px}
.sig-name{font-size:12px;font-weight:700;color:#0f172a}
.sig-sub{font-size:10px;color:#64748b;margin-top:2px}
@media print{.body{padding:12px 28px}.header{padding:12px 28px 12px}}
</style></head><body>
<div class="page">
  <div class="accent"></div>
  <div class="header">
    <div>
      <p class="clinic-name">${clinicName}</p>
      ${tagline}${address}${phone}
    </div>
    <div class="dr-col">
      <p class="dr-name">Dr. ${doctorDisplay}</p>
      ${quals ? `<p class="dr-sub">${quals}</p>` : ""}
      ${regNo ? `<p class="dr-sub">${regNo}</p>` : ""}
    </div>
  </div>
  <div class="body">
    <p class="section-label">Bill Details</p>
    <div class="row"><span class="lbl">Patient</span><span class="val">${esc(receipt.patient)}</span></div>
    <div class="row"><span class="lbl">Doctor</span><span class="val">Dr. ${esc(receipt.doctor)}</span></div>
    <div class="row"><span class="lbl">Date &amp; Time</span><span class="val">${esc(receipt.date)}</span></div>
    <div class="amount-box">
      <div>
        <p class="amount-label">Amount Paid</p>
        <p class="amount-method">${esc(receipt.paymentMethod)}</p>
      </div>
      <div style="text-align:right">
        <p class="amount-value">&#8377;${esc(receipt.amount)}</p>
        <span class="badge">&#10003; Paid</span>
      </div>
    </div>
    <div class="divider">
      <div class="div-line"></div>
      <span class="div-label">Prescription</span>
      <div class="div-line"></div>
    </div>
    ${rxSection}
    <div class="bottom-row">
      <span class="branding">Powered by BariQ</span>
      <div class="sig-box">
        <div class="sig-line"></div>
        <p class="sig-name">Dr. ${doctorDisplay}</p>
        ${quals ? `<p class="sig-sub">${quals}</p>` : ""}
      </div>
    </div>
  </div>
</div>
<script>window.onload=function(){window.print()}</script>
</body></html>`;
}

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "card", label: "Card" },
  { value: "insurance", label: "Insurance" },
];

function doctorDisplayName(doctor: any): string {
  return (
    doctor?.name ||
    [doctor?.firstName, doctor?.lastName].filter(Boolean).join(" ") ||
    "Doctor"
  );
}

// ── Full Digital Prescription Writer ─────────────────────────────────────────

const FREQ_OPTIONS = ["1-0-1","1-1-1","1-0-0","0-0-1","0-1-0","SOS","BD","TDS","OD","QID","PRN"];
const TIMING_OPTIONS = ["After Food","Before Food","With Food","Empty Stomach","With Water","Bedtime"];
const EMPTY_MED = { name: "", dosage: "", frequency: "1-0-1", duration: "", timing: "After Food", instructions: "" };

function PrescriptionDialog({ appointment }: { appointment: any }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: settings } = useQuery<Record<string, any>>({ queryKey: ["/api/settings"] });
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form fields
  const [chiefComplaints, setChiefComplaints] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [meds, setMeds] = useState<typeof EMPTY_MED[]>([]);
  const [notes, setNotes] = useState("");

  // Load existing prescription for this appointment
  const { data: existingRx = [] } = useQuery<any[]>({
    queryKey: ["/api/prescriptions", "appt", appointment.id],
    queryFn: async () => {
      const r = await fetch(`/api/prescriptions?appointmentId=${appointment.id}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: open,
    staleTime: 0,
    gcTime: 0,
  });

  // Hydrate form when dialog opens / existing rx loads
  useEffect(() => {
    if (!open) return;
    const rx = existingRx[0];
    if (rx) {
      setChiefComplaints(rx.chiefComplaints || "");
      setDiagnosis(rx.diagnosis || "");
      setMeds((rx.medications || []).map((m: any) => ({ ...EMPTY_MED, ...m })));
      setNotes(rx.notes || "");
    } else {
      setChiefComplaints(""); setDiagnosis(""); setMeds([]); setNotes("");
    }
  }, [open, existingRx[0]?.id]);

  const addMed = () => setMeds(prev => [...prev, { ...EMPTY_MED }]);
  const removeMed = (i: number) => setMeds(prev => prev.filter((_, idx) => idx !== i));
  const updateMed = (i: number, field: string, val: string) =>
    setMeds(prev => prev.map((m, idx) => idx === i ? { ...m, [field]: val } : m));

  const handleSave = async (andPrint = false) => {
    if (meds.length === 0) { toast({ title: "Add at least one medication", variant: "destructive" }); return; }
    if (meds.some(m => !m.name.trim())) { toast({ title: "All medications must have a name", variant: "destructive" }); return; }
    setIsSaving(true);
    try {
      const body = {
        appointmentId: appointment.id,
        patientId: appointment.patientId,
        doctorId: appointment.doctorId,
        chiefComplaints: chiefComplaints.trim() || null,
        diagnosis: diagnosis.trim() || null,
        medications: meds,
        notes: notes.trim() || null,
      };
      const existing = existingRx[0];
      const res = await fetch(
        existing ? `/api/prescriptions/${existing.id}` : "/api/prescriptions",
        { method: existing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), credentials: "include" }
      );
      if (!res.ok) throw new Error((await res.json()).message || "Failed");
      queryClient.invalidateQueries({ queryKey: ["/api/prescriptions"] });
      toast({ title: existing ? "Prescription updated" : "Prescription saved" });

      if (andPrint) {
        const profile = settings?.clinicProfile || {};
        const html = buildPrescriptionHtml(
          { name: appointment.patient.name, phone: appointment.patient.phone },
          doctorDisplayName(appointment.doctor),
          format(new Date(appointment.date), "PPpp"),
          { chiefComplaints: chiefComplaints.trim(), diagnosis: diagnosis.trim(), medications: meds, notes: notes.trim() },
          profile
        );
        openPrint(html, `Prescription – ${appointment.patient.name}`);
      }
      setOpen(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to save prescription", variant: "destructive" });
    } finally { setIsSaving(false); }
  };

  const isExisting = existingRx.length > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="rounded-xl h-9 px-3 text-purple-600 border-purple-100 hover:bg-purple-50">
          <Pill className="w-4 h-4 mr-1.5" /> {isExisting ? "Edit Rx" : "Write Rx"}
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl sm:max-w-4xl max-h-[92vh] overflow-y-auto p-0">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div>
            <h2 className="font-bold text-slate-900 text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-600" />
              Digital Prescription
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {appointment.patient.name} · Queue #{appointment.queueNumber} · {format(new Date(appointment.date), "dd MMM yyyy")}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isExisting && <span className="px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold">Saved</span>}
            {/* This header is full-bleed (DialogContent uses p-0) and sits at z-10 above
                the dialog's own default close button, hiding it — so this dialog needs
                its own explicit close button to stay closeable on any screen size. */}
            <DialogClose className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
              <X className="w-5 h-5" />
              <span className="sr-only">Close</span>
            </DialogClose>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Chief Complaints & Diagnosis */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Chief Complaints</label>
              <Textarea
                placeholder="e.g. Fever since 2 days, headache, body ache..."
                value={chiefComplaints}
                onChange={e => setChiefComplaints(e.target.value)}
                className="rounded-xl resize-none h-20 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Diagnosis</label>
              <Textarea
                placeholder="e.g. Viral fever, URI, Hypertension..."
                value={diagnosis}
                onChange={e => setDiagnosis(e.target.value)}
                className="rounded-xl resize-none h-20 text-sm"
              />
            </div>
          </div>

          {/* Medicines */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <span className="text-purple-600 font-black text-xl italic" style={{ fontFamily: "serif" }}>℞</span>
                Medicines
              </h4>
              <Button size="sm" onClick={addMed} className="bg-purple-600 hover:bg-purple-700 rounded-lg h-8 px-3 text-xs">
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Medicine
              </Button>
            </div>

            {meds.length === 0 ? (
              <div className="text-center py-10 border-2 border-dashed border-slate-100 rounded-2xl">
                <Pill className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">No medicines added yet.</p>
                <Button size="sm" onClick={addMed} className="mt-3 bg-purple-600 hover:bg-purple-700 rounded-lg">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add First Medicine
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {meds.map((med, idx) => (
                  <div key={idx} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center">{idx + 1}</span>
                      <button onClick={() => removeMed(idx)} className="text-slate-300 hover:text-red-500 transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {/* Medicine name with master-list autocomplete */}
                      <div className="sm:col-span-2 space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Medicine Name *</label>
                        <MedicineNameAutocomplete
                          value={med.name}
                          onChange={v => updateMed(idx, "name", v)}
                          placeholder="e.g. Paracetamol 500mg"
                          className="rounded-lg h-9 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Dosage</label>
                        <Input placeholder="500mg / 1 tab" value={med.dosage} onChange={e => updateMed(idx, "dosage", e.target.value)} className="rounded-lg h-9 text-sm" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Frequency</label>
                        <select value={med.frequency} onChange={e => updateMed(idx, "frequency", e.target.value)} className="w-full border border-slate-200 rounded-lg h-9 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
                          {FREQ_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Duration</label>
                        <Input placeholder="5 days" value={med.duration} onChange={e => updateMed(idx, "duration", e.target.value)} className="rounded-lg h-9 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Timing</label>
                        <select value={med.timing} onChange={e => updateMed(idx, "timing", e.target.value)} className="w-full border border-slate-200 rounded-lg h-9 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
                          {TIMING_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Instructions</label>
                        <Input placeholder="Notes..." value={med.instructions} onChange={e => updateMed(idx, "instructions", e.target.value)} className="rounded-lg h-9 text-sm" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Advice / Notes */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Advice / Notes</label>
            <Textarea
              placeholder="Dietary restrictions, follow-up in X days, rest advice, precautions..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="rounded-xl resize-none h-20 text-sm"
            />
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 pt-1">
            <Button
              variant="outline"
              className="flex-1 rounded-xl h-11 gap-2"
              onClick={() => handleSave(false)}
              disabled={isSaving || meds.length === 0}
            >
              {isSaving ? "Saving…" : <><Check className="w-4 h-4" />{isExisting ? "Update" : "Save"}</>}
            </Button>
            <Button
              className="flex-1 rounded-xl h-11 bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-600/20 gap-2"
              onClick={() => handleSave(true)}
              disabled={isSaving || meds.length === 0}
            >
              <Printer className="w-4 h-4" />
              {isSaving ? "Saving…" : "Save & Print PDF"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ConsultationNotesDialog({ appointment, onComplete }: { appointment: any, onComplete: (notes: string) => void }) {
  const [notes, setNotes] = useState("");
  const [open, setOpen] = useState(false);

  const handleComplete = () => {
    onComplete(notes);
    setOpen(false);
    setNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="rounded-xl h-9 bg-green-600 hover:bg-green-700 text-white"
        >
          <Check className="w-4 h-4 mr-1.5" /> Consulted
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Complete Consultation</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="bg-green-50 p-4 rounded-xl">
            <p className="font-semibold text-green-900">{appointment.patient.name}</p>
            <p className="text-sm text-green-700">Dr. {doctorDisplayName(appointment.doctor)}</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              Clinical Notes <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <Textarea
              placeholder="Diagnosis, observations, follow-up instructions..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="rounded-xl resize-none h-28 text-sm"
              autoFocus
            />
          </div>
          <div className="flex gap-3">
            <Button
              onClick={handleComplete}
              className="flex-1 rounded-xl h-11 bg-green-600 hover:bg-green-700"
            >
              <Check className="w-4 h-4 mr-2" /> Mark as Consulted
            </Button>
            <Button
              variant="outline"
              className="rounded-xl h-11"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// livePosition = current index-based position in the displayed queue (not the stale DB value)
function SendQueueLinkDialog({ appointment, livePosition }: { appointment: any; livePosition: number }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const token = appointment.queueToken;
  const url = `${window.location.origin}/patient-queue/${token}`;
  const patientName = appointment.patient?.name || "Patient";
  const patientPhone = appointment.patient?.phone || "";
  const docName = doctorDisplayName(appointment.doctor);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({ title: "Queue link copied!", description: "Share this link with the patient." });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const phoneDigits = patientPhone.replace(/[^0-9]/g, "");
  const waPhone = phoneDigits.length === 10 ? "91" + phoneDigits : phoneDigits;
  const waMessage = encodeURIComponent(
    `Hi ${patientName}! Track your appointment with Dr. ${docName} live:\n${url}\n\nYou are currently #${livePosition} in the queue.`
  );
  const waUrl = waPhone
    ? `https://wa.me/${waPhone}?text=${waMessage}`
    : `https://wa.me/?text=${waMessage}`;

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-teal-600 bg-teal-50 hover:bg-teal-100 border border-teal-100 transition-colors"
        title="Send queue link to patient"
      >
        <Share2 className="w-3 h-3" />
        <span className="hidden sm:inline">Send Link</span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl sm:max-w-[420px]" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Send Queue Link</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-1 pb-2">
            {/* Patient card */}
            <div className="flex items-center gap-3 bg-teal-50 rounded-2xl p-4">
              <div className="w-11 h-11 rounded-xl bg-teal-600 text-white flex items-center justify-center font-black text-lg shrink-0">
                #{livePosition}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-teal-900 truncate">{patientName}</p>
                <p className="text-sm text-teal-600">Dr. {docName}</p>
              </div>
            </div>

            {/* Link */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Patient Queue Link</p>
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 select-all">
                <p className="text-xs text-slate-500 font-mono break-all leading-relaxed">{url}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1 rounded-xl h-10 bg-teal-600 hover:bg-teal-700"
                  onClick={handleCopy}
                >
                  {copied
                    ? <><Check className="w-4 h-4 mr-2" /> Copied!</>
                    : <><Copy className="w-4 h-4 mr-2" /> Copy Link</>}
                </Button>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors shrink-0"
                  title="Open link"
                >
                  <ExternalLink className="w-4 h-4 text-slate-500" />
                </a>
              </div>
            </div>

            {/* WhatsApp */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Share via</p>
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3.5 rounded-xl border border-green-200 bg-green-50 hover:bg-green-100 transition-colors group"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center shrink-0">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-green-900 text-sm">Send on WhatsApp</p>
                  <p className="text-xs text-green-700 truncate">{patientPhone || "No phone number saved"}</p>
                </div>
                <ExternalLink className="w-4 h-4 text-green-500 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity" />
              </a>
            </div>

            <p className="text-xs text-slate-400 text-center">
              This link updates live every 5 seconds. It expires at end of day.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function Queue() {
  const { can } = useRole();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: settings } = useQuery<Record<string, any>>({ queryKey: ["/api/settings"] });
  const [selectedDoctor, setSelectedDoctor] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [checkInTarget, setCheckInTarget] = useState<any>(null);
  const [checkInFee, setCheckInFee] = useState<string>("");
  const [checkInPaymentMethod, setCheckInPaymentMethod] = useState<string>("cash");
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [queueItems, setQueueItems] = useState<any[]>([]);
  const [receiptData, setReceiptData] = useState<{ patient: string; doctor: string; amount: string; date: string; paymentMethod: string } | null>(null);
  const [noShowTarget, setNoShowTarget] = useState<any>(null);

  const { data: doctors, isLoading: isDoctorsLoading } = useDoctors();
  const updateAppointment = useUpdateAppointment();

  const selectedDoctorProfile = useMemo(() => {
    if (!selectedDoctor || !doctors) return null;
    const doc = doctors.find((d) => String(d.id) === selectedDoctor);
    return doc?.doctorProfile ?? null;
  }, [selectedDoctor, doctors]);

  const { data: appointments, isLoading } = useAppointments(
    { date: selectedDate, doctorId: selectedDoctor || undefined },
    { keepPrevious: true }
  );

  const filteredAndSorted = useMemo(() => {
    if (!appointments) return [];
    const statuses = ["booked", "checked_in", "in_progress"];
    const items = appointments.filter(
      (apt) =>
        statuses.includes(apt.status) &&
        String(apt.doctorId) === selectedDoctor
    );

    return [...items].sort((a, b) => {
      const posA = a.queuePosition ?? Infinity;
      const posB = b.queuePosition ?? Infinity;
      return posA - posB;
    });
  }, [appointments, selectedDoctor]);

  // Refs to prevent the 30-second poll from overwriting an in-flight drag reorder
  const reorderTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPersistingRef = useRef(false);

  useEffect(() => {
    // If user is in the middle of a drag (debounce pending) or we're waiting
    // for the reorder API to respond, don't let the poll overwrite their changes.
    if (reorderTimeoutRef.current || isPersistingRef.current) return;
    setQueueItems(filteredAndSorted);
  }, [filteredAndSorted]);

  useEffect(() => {
    if (doctors?.length && !selectedDoctor) {
      setSelectedDoctor(String(doctors[0].id));
    }
  }, [doctors, selectedDoctor]);

  // SSE: live queue updates when doctor marks patient as consulted.
  // Skip invalidation if a drag-reorder is in-flight to avoid overwriting the local state.
  // Auto-reconnects on error with a 5-second delay so live updates survive transient drops.
  useEffect(() => {
    if (!selectedDoctor) return;
    let es: EventSource;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      es = new EventSource(`/api/sse/doctor/${selectedDoctor}`);
      es.onmessage = (e) => {
        if (e.data === "connected") return;
        if (reorderTimeoutRef.current || isPersistingRef.current) return;
        queryClient.invalidateQueries({ queryKey: [api.appointments.list.path] });
      };
      es.onerror = () => {
        es.close();
        reconnectTimer = setTimeout(connect, 5000);
      };
    };

    connect();

    return () => {
      es?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [selectedDoctor, queryClient]);

  useEffect(() => {
    if (checkInTarget && selectedDoctorProfile) {
      const fee = (selectedDoctorProfile.consultationFee ?? 15000) / 100;
      setCheckInFee(String(fee));
    }
  }, [checkInTarget, selectedDoctorProfile]);

  const persistReorder = useCallback(async (orderedIds: number[]) => {
    reorderTimeoutRef.current = null;
    isPersistingRef.current = true;
    try {
      const res = await fetch("/api/queue/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedAppointmentIds: orderedIds }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to reorder");
      // Refresh from server — isPersistingRef is cleared in finally so the
      // useEffect above will pick up the fresh data once it arrives.
      queryClient.invalidateQueries({ queryKey: [api.appointments.list.path] });
    } catch {
      toast({ title: "Error", description: "Failed to reorder queue", variant: "destructive" });
      // Roll back to last known good state
      setQueueItems(filteredAndSorted);
    } finally {
      isPersistingRef.current = false;
    }
  }, [filteredAndSorted, queryClient, toast]);

  const handleReorder = (newOrder: any[]) => {
    setQueueItems(newOrder);
    if (reorderTimeoutRef.current) clearTimeout(reorderTimeoutRef.current);
    reorderTimeoutRef.current = setTimeout(() => {
      persistReorder(newOrder.map((a) => a.id));
    }, 500);
  };

  const handleCheckIn = async () => {
    if (!checkInTarget) return;
    const parsedFee = parseFloat(checkInFee || "0");
    if (isNaN(parsedFee) || parsedFee < 0) {
      toast({ title: "Invalid amount", description: "Please enter a valid fee", variant: "destructive" });
      return;
    }
    const amountCents = Math.round(parsedFee * 100);
    setIsCheckingIn(true);
    try {
      const existingRes = await fetch(`/api/bills?appointmentId=${checkInTarget.id}`, { credentials: "include" });
      const existingBills = await existingRes.json();
      const hasBill = Array.isArray(existingBills) && existingBills.length > 0;

      if (!hasBill && amountCents > 0) {
        const billRes = await fetch("/api/bills", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            appointmentId: checkInTarget.id,
            patientId: checkInTarget.patientId,
            amount: amountCents,
            status: "paid",
            paymentMethod: checkInPaymentMethod,
          }),
          credentials: "include",
        });
        if (!billRes.ok) {
          // 409 means a concurrent check-in already created the bill — that's fine, continue.
          if (billRes.status !== 409) {
            const err = await billRes.json().catch(() => ({}));
            throw new Error(err?.message || "Failed to record payment");
          }
        }
      }
      // Keep isCheckingIn=true until the mutation resolves so the button stays
      // disabled for the full duration. Moving setIsCheckingIn(false) to the
      // mutation callbacks prevents the "finally" block from re-enabling the
      // button before the payment is actually confirmed.
      updateAppointment.mutate(
        { id: checkInTarget.id, updates: { status: "checked_in" } },
        {
          onSuccess: () => {
            setIsCheckingIn(false);
            const amountStr = (amountCents / 100).toFixed(0);
            setReceiptData({
              patient: checkInTarget.patient.name,
              doctor: doctorDisplayName(checkInTarget.doctor),
              amount: amountStr,
              date: format(new Date(), "PPpp"),
              paymentMethod: PAYMENT_METHODS.find(m => m.value === checkInPaymentMethod)?.label || "Cash",
            });
            toast({ title: "Payment Collected", description: `₹${amountStr} collected via ${checkInPaymentMethod}.` });
            setCheckInTarget(null);
            queryClient.invalidateQueries({ queryKey: [api.appointments.list.path] });
          },
          onError: () => {
            setIsCheckingIn(false);
            toast({ title: "Error", description: "Failed to check in", variant: "destructive" });
          },
        }
      );
    } catch {
      setIsCheckingIn(false);
      toast({ title: "Error", description: "Failed to create bill", variant: "destructive" });
    }
  };

  const handleStatusChange = (id: number, status: string, notes?: string) => {
    const updates: any = { status };
    if (notes) updates.notes = notes;
    updateAppointment.mutate(
      { id, updates },
      {
        onSuccess: () => {
          toast({
            title: "Status Updated",
            description: `Patient marked as ${status.replace("_", " ")}`,
          });
        },
        onError: () => {
          toast({
            title: "Error",
            description: "Failed to update patient status. Please try again.",
            variant: "destructive",
          });
        },
      }
    );
  };

  const confirmNoShow = () => {
    if (!noShowTarget) return;
    handleStatusChange(noShowTarget.id, "no_show");
    setNoShowTarget(null);
  };

  if (isDoctorsLoading || (isLoading && !appointments)) return <Loading />;

  if (!doctors?.length) {
    return (
      <>
        <div className="flex flex-col gap-6">
          <PageHeader title="Queue Management" description="Live queue for the current week" />
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-100">
            <Users className="w-16 h-16 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-500">No doctors available. Please add doctors first.</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Queue Management"
          description={`Live queue — ${selectedDate === format(new Date(), "yyyy-MM-dd") ? "today" : format(parseISO(selectedDate), "EEEE, MMM d")}`}
        />

        <div className="flex flex-col sm:flex-row gap-3">
          <Select
            value={selectedDoctor}
            onValueChange={(v) => { setSelectedDoctor(v); }}
          >
            <SelectTrigger className="bg-white border-slate-200 rounded-xl w-full sm:w-56 h-11">
              <SelectValue placeholder="Select doctor" />
            </SelectTrigger>
            <SelectContent>
              {doctors.map((d) => (
                <SelectItem key={d.id} value={String(d.id)}>
                  Dr. {doctorDisplayName(d)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => { setSelectedDate(e.target.value); }}
            className="bg-white border-slate-200 rounded-xl w-full sm:w-44 h-11 px-3 text-sm cursor-pointer"
          />

          {/* Public display link */}
          {selectedDoctor && (
            <a
              href={`/queue/${selectedDoctor}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 h-11 rounded-xl border border-slate-200 bg-white text-sm text-slate-600 hover:text-teal-700 hover:border-blue-200 transition-colors whitespace-nowrap"
              title="Open public queue display"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="hidden sm:inline">Display Board</span>
            </a>
          )}
        </div>

        {/* Queue summary bar */}
        {queueItems.length > 0 && (
          <div className="flex gap-3 flex-wrap">
            {[
              { label: "Waiting", count: queueItems.filter(a => a.status === "booked").length, color: "bg-slate-100 text-slate-600" },
              { label: "Paid", count: queueItems.filter(a => a.status === "checked_in").length, color: "bg-green-100 text-green-700" },
              { label: "With Doctor", count: queueItems.filter(a => a.status === "in_progress").length, color: "bg-teal-100 text-teal-700" },
            ].map(({ label, count, color }) => (
              <span key={label} className={`px-3 py-1.5 rounded-full text-xs font-semibold ${color}`}>
                {count} {label}
              </span>
            ))}
          </div>
        )}

        {queueItems.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-8">
            <div className="text-center py-16">
              <Users className="w-16 h-16 text-slate-200 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-400">No patients in queue</h3>
              <p className="text-sm text-slate-300 mt-1">
                Patients will appear here when appointments are booked for this day
              </p>
            </div>
          </div>
        ) : (
          <Reorder.Group axis="y" values={queueItems} onReorder={handleReorder} className="space-y-3">
            <AnimatePresence>
              {queueItems.map((apt, idx) => (
                <Reorder.Item
                  key={apt.id}
                  value={apt}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  whileDrag={{ scale: 1.02, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 50 }}
                  layout="position"
                  className={cn(
                    "bg-white rounded-2xl shadow-sm border p-4 cursor-grab active:cursor-grabbing",
                    apt.status === "in_progress" && "border-l-4 border-l-blue-500 bg-teal-50/30",
                    apt.status === "checked_in" && "border-l-4 border-l-green-500",
                    apt.status === "booked" && "border-l-4 border-l-slate-200"
                  )}
                >
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="flex items-center gap-2 text-slate-300 cursor-grab shrink-0">
                      <GripVertical className="w-5 h-5" />
                    </div>
                    {/* Position badge uses live array index — stays correct during/after drag */}
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0",
                      apt.status === "in_progress" ? "bg-teal-100 text-teal-700" : "bg-slate-100 text-slate-700"
                    )}>
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-900 truncate">{apt.patient?.name ?? "Unknown"}</p>
                        {apt.queueToken && (
                          <SendQueueLinkDialog appointment={apt} livePosition={idx + 1} />
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-slate-500 truncate">{apt.patient?.phone ?? ""}</p>
                        {apt.patient?.phone && (
                          <div className="flex items-center gap-1 shrink-0">
                            <a
                              href={(() => { const d = apt.patient.phone.replace(/[^0-9]/g, ""); return `https://wa.me/${d.length === 10 ? "91" + d : d}`; })()}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="w-6 h-6 rounded-full bg-green-100 text-green-600 hover:bg-green-200 flex items-center justify-center transition-colors"
                              title="WhatsApp"
                            >
                              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                            </a>
                            <a
                              href={`tel:${apt.patient.phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="w-6 h-6 rounded-full bg-teal-100 text-teal-700 hover:bg-blue-200 flex items-center justify-center transition-colors"
                              title="Call"
                            >
                              <Phone className="w-3 h-3" />
                            </a>
                          </div>
                        )}
                      </div>
                      {apt.reason && (
                        <p className="text-xs text-slate-400 mt-0.5 italic">{apt.reason}</p>
                      )}
                    </div>
                    <div className="shrink-0 hidden sm:block">
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-xs font-semibold",
                        apt.status === "booked" && "bg-slate-100 text-slate-600",
                        apt.status === "checked_in" && "bg-green-100 text-green-700",
                        apt.status === "in_progress" && "bg-teal-100 text-teal-700"
                      )}>
                        {apt.status === "booked" && "Waiting"}
                        {apt.status === "checked_in" && "Paid"}
                        {apt.status === "in_progress" && "With Doctor"}
                      </span>
                    </div>
                    <div className="hidden sm:flex items-center gap-2 shrink-0">
                      {(apt.status === "booked" || (apt.status === "checked_in" && !apt.bill)) && can("queue:check-in") && (
                        <Button
                          size="sm"
                          className="rounded-xl h-9 bg-teal-600 hover:bg-teal-700 text-white"
                          onClick={() => setCheckInTarget(apt)}
                        >
                          <Banknote className="w-4 h-4 mr-1.5" /> Collect
                        </Button>
                      )}
                      {apt.status === "checked_in" && can("queue:status-change") && (
                        <Button
                          size="sm"
                          className="rounded-xl h-9 bg-blue-600 hover:bg-blue-700 text-white"
                          onClick={() => handleStatusChange(apt.id, "in_progress")}
                          disabled={updateAppointment.isPending}
                        >
                          Start
                        </Button>
                      )}
                      {(apt.status === "booked" || apt.status === "checked_in") && can("queue:status-change") && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl h-9 text-red-500 border-red-100 hover:bg-red-50"
                          onClick={() => setNoShowTarget(apt)}
                          disabled={updateAppointment.isPending}
                        >
                          No Show
                        </Button>
                      )}
                      {apt.status === "in_progress" && can("queue:prescription") && (
                        <PrescriptionDialog appointment={apt} />
                      )}
                      {apt.status === "in_progress" && can("queue:status-change") && (
                        <ConsultationNotesDialog
                          appointment={apt}
                          onComplete={(notes) => handleStatusChange(apt.id, "completed", notes)}
                        />
                      )}
                    </div>
                  </div>
                  {/* Mobile actions */}
                  <div className="flex items-center gap-2 mt-3 sm:hidden flex-wrap">
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-[10px] font-semibold",
                      apt.status === "booked" && "bg-slate-100 text-slate-600",
                      apt.status === "checked_in" && "bg-green-100 text-green-700",
                      apt.status === "in_progress" && "bg-teal-100 text-teal-700"
                    )}>
                      {apt.status === "booked" && "Waiting"}
                      {apt.status === "checked_in" && "Paid"}
                      {apt.status === "in_progress" && "With Doctor"}
                    </span>
                    <div className="flex-1" />
                    {(apt.status === "booked" || (apt.status === "checked_in" && !apt.bill)) && can("queue:check-in") && (
                      <Button size="sm" className="rounded-xl h-8 text-xs bg-teal-600 text-white" onClick={() => setCheckInTarget(apt)}>
                        Collect
                      </Button>
                    )}
                    {apt.status === "checked_in" && can("queue:status-change") && (
                      <Button size="sm" className="rounded-xl h-8 text-xs bg-blue-600 text-white" onClick={() => handleStatusChange(apt.id, "in_progress")} disabled={updateAppointment.isPending}>
                        Start
                      </Button>
                    )}
                    {(apt.status === "booked" || apt.status === "checked_in") && can("queue:status-change") && (
                      <Button size="sm" variant="outline" className="rounded-xl h-8 text-xs text-red-500 border-red-100" onClick={() => setNoShowTarget(apt)} disabled={updateAppointment.isPending}>
                        No Show
                      </Button>
                    )}
                    {apt.status === "in_progress" && can("queue:prescription") && (
                      <PrescriptionDialog appointment={apt} />
                    )}
                    {apt.status === "in_progress" && can("queue:status-change") && (
                      <ConsultationNotesDialog
                        appointment={apt}
                        onComplete={(notes) => handleStatusChange(apt.id, "completed", notes)}
                      />
                    )}
                  </div>
                </Reorder.Item>
              ))}
            </AnimatePresence>
          </Reorder.Group>
        )}

        {/* No Show Confirmation */}
        <AlertDialog open={noShowTarget !== null} onOpenChange={(open) => !open && setNoShowTarget(null)}>
          <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                Mark as No Show?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This will mark <strong>{noShowTarget?.patient?.name}</strong> as a no-show. This action cannot be easily undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmNoShow} className="rounded-xl bg-red-600 hover:bg-red-700" disabled={updateAppointment.isPending}>
                Yes, No Show
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Check-in / Payment Dialog */}
        <Dialog open={checkInTarget !== null} onOpenChange={(open) => !open && setCheckInTarget(null)}>
          <DialogContent className="sm:max-w-[440px] rounded-2xl">
            <DialogHeader>
              <DialogTitle>Collect Payment</DialogTitle>
            </DialogHeader>
            {checkInTarget && (
              <div className="space-y-4 py-2">
                <div className="bg-teal-50 p-4 rounded-xl space-y-1">
                  <p className="font-semibold text-blue-900">{checkInTarget.patient.name}</p>
                  <p className="text-sm text-teal-700">Dr. {doctorDisplayName(checkInTarget.doctor)}</p>
                  <p className="text-xs text-teal-700">
                    {format(
                      checkInTarget.date instanceof Date ? checkInTarget.date : parseISO(checkInTarget.date),
                      "MMM d, yyyy"
                    )}
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Consultation Fee (₹)</label>
                  <Input
                    type="number"
                    value={checkInFee}
                    onChange={(e) => setCheckInFee(e.target.value)}
                    className="rounded-xl h-12 text-lg font-bold"
                    min="0"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Payment Method</label>
                  <div className="grid grid-cols-4 gap-2">
                    {PAYMENT_METHODS.map((m) => (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => setCheckInPaymentMethod(m.value)}
                        className={cn(
                          "py-2.5 rounded-xl text-xs font-semibold border transition-colors",
                          checkInPaymentMethod === m.value
                            ? "bg-teal-600 text-white border-teal-600"
                            : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"
                        )}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
                <Button
                  onClick={handleCheckIn}
                  disabled={isCheckingIn}
                  className="w-full rounded-xl h-12 bg-green-600 hover:bg-green-700 shadow-lg shadow-green-600/20 text-base font-semibold"
                >
                  {isCheckingIn ? "Processing..." : `Collect ₹${checkInFee || "0"}`}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Receipt Dialog */}
        <Dialog open={receiptData !== null} onOpenChange={(open) => !open && setReceiptData(null)}>
          <DialogContent className="sm:max-w-[400px] rounded-2xl">
            <DialogHeader>
              <DialogTitle>Bill & Prescription</DialogTitle>
            </DialogHeader>
            {receiptData && (
              <div className="space-y-4 py-2">
                <div className="border border-slate-200 rounded-xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-teal-700 font-black text-lg tracking-tight">BariQ</h3>
                    <span className="text-xs text-slate-400 font-medium">BILL</span>
                  </div>
                  <hr className="border-slate-100" />
                  <div className="space-y-2 text-sm">
                    <p><span className="font-semibold text-slate-700">Patient:</span> {receiptData.patient}</p>
                    <p><span className="font-semibold text-slate-700">Doctor:</span> Dr. {receiptData.doctor}</p>
                    <p><span className="font-semibold text-slate-700">Date:</span> {receiptData.date}</p>
                    <p><span className="font-semibold text-slate-700">Amount:</span> ₹{receiptData.amount}</p>
                    <p><span className="font-semibold text-slate-700">Method:</span> {receiptData.paymentMethod}</p>
                  </div>
                  <hr className="border-slate-100" />
                  <p className="text-center text-xs text-slate-400">Prescription space will be printed below the bill.</p>
                </div>
                <div className="flex gap-3">
                  <Button
                    className="flex-1 rounded-xl h-11 bg-teal-600 hover:bg-teal-700"
                    onClick={() => {
                      const html = buildCombinedHtml(receiptData!, null, settings?.clinicProfile || {});
                      openPrint(html, `Bill & Prescription – ${receiptData!.patient}`);
                    }}
                  >
                    Print Bill & Prescription
                  </Button>
                  <Button variant="outline" className="rounded-xl h-11" onClick={() => setReceiptData(null)}>
                    Close
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
