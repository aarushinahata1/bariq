import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAppointments, useUpdateAppointment } from "@/hooks/use-appointments";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useDoctors } from "@/hooks/use-doctors";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { format, parseISO, startOfWeek, addDays, startOfDay } from "date-fns";
import { Button } from "@/components/ui/button";
import { GripVertical, Users, Banknote, Pill, Plus, Trash2, Phone, Copy, Check, ExternalLink, AlertTriangle, Share2 } from "lucide-react";
import {
  Dialog,
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

function buildReceiptHtml(
  data: { patient: string; doctor: string; amount: string; date: string; paymentMethod: string },
  profile: Record<string, any>
): string {
  const clinicName = esc(profile?.clinicName || "BariQ Clinic");
  const tagline = profile?.tagline ? `<p class="sub">${esc(profile.tagline)}</p>` : "";
  const address = profile?.address ? `<p class="sub">${esc(profile.address)}</p>` : "";
  const contactLine = [profile?.phone, profile?.email].filter(Boolean).map(esc).join(" · ");
  const contact = contactLine ? `<p class="sub">${contactLine}</p>` : "";

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Receipt – ${esc(data.patient)}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',system-ui,Arial,sans-serif;background:#fff;color:#1e293b;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{max-width:460px;margin:0 auto;padding:36px 32px}
.header{text-align:center;padding-bottom:18px;border-bottom:2.5px solid #0d9488;margin-bottom:22px}
.clinic-name{font-size:21px;font-weight:900;color:#0f766e;letter-spacing:-.3px}
.sub{font-size:11px;color:#64748b;margin-top:4px;line-height:1.55}
.badge{display:inline-block;background:#dcfce7;color:#16a34a;font-size:9.5px;font-weight:700;padding:2px 8px;border-radius:20px;text-transform:uppercase;letter-spacing:.05em;margin-top:4px}
.title-row{text-align:center;margin-bottom:20px}
.title-row h2{font-size:11px;color:#94a3b8;letter-spacing:.15em;font-weight:700;text-transform:uppercase}
.title-row p{font-size:11px;color:#cbd5e1;margin-top:3px}
.section{margin-bottom:16px}
.section-label{font-size:9.5px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.12em;margin-bottom:7px}
.row{display:flex;justify-content:space-between;align-items:baseline;font-size:13px;padding:7px 0;border-bottom:1px solid #f1f5f9}
.row:last-child{border-bottom:none}
.lbl{color:#64748b}.val{font-weight:600;color:#0f172a}
.amount-box{display:flex;justify-content:space-between;align-items:center;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px 18px;margin:18px 0}
.amount-label{font-size:12px;font-weight:600;color:#15803d}
.amount-method{font-size:11px;color:#86efac;margin-top:2px}
.amount-value{font-size:26px;font-weight:900;color:#15803d;text-align:right}
.footer{margin-top:26px;padding-top:16px;border-top:1px dashed #e2e8f0;text-align:center}
.footer p{font-size:11px;color:#94a3b8;line-height:1.6}
.powered{font-size:10px;color:#cbd5e1;margin-top:6px}
@media print{.page{padding:20px}}
</style></head><body>
<div class="page">
  <div class="header">
    <p class="clinic-name">${clinicName}</p>
    ${tagline}${address}${contact}
  </div>
  <div class="title-row">
    <h2>Payment Receipt</h2>
    <p>${esc(data.date)}</p>
  </div>
  <div class="section">
    <p class="section-label">Patient</p>
    <div class="row"><span class="lbl">Name</span><span class="val">${esc(data.patient)}</span></div>
  </div>
  <div class="section">
    <p class="section-label">Consultation</p>
    <div class="row"><span class="lbl">Doctor</span><span class="val">Dr. ${esc(data.doctor)}</span></div>
    <div class="row"><span class="lbl">Date &amp; Time</span><span class="val">${esc(data.date)}</span></div>
  </div>
  <div class="amount-box">
    <div>
      <p class="amount-label">Amount Paid</p>
      <p class="amount-method">${esc(data.paymentMethod)}</p>
    </div>
    <div style="text-align:right">
      <p class="amount-value">&#8377;${esc(data.amount)}</p>
      <span class="badge">&#10003; Paid</span>
    </div>
  </div>
  <div class="footer">
    <p>Thank you for visiting ${clinicName}!</p>
    <p class="powered">Generated by BariQ &middot; Your Turn, Simplified</p>
  </div>
</div>
<script>window.onload=function(){window.print()}</script>
</body></html>`;
}

function buildPrescriptionHtml(
  data: {
    patient: string;
    doctor: string;
    medications: Array<{ name: string; dosage: string; duration: string; instructions: string }>;
    notes: string;
    date: string;
  },
  profile: Record<string, any>
): string {
  const clinicName = esc(profile?.clinicName || "BariQ Clinic");
  const address = profile?.address ? `<p class="detail">${esc(profile.address)}</p>` : "";
  const contactLine = [profile?.phone, profile?.email].filter(Boolean).map(esc).join(" · ");
  const contact = contactLine ? `<p class="detail">${contactLine}</p>` : "";
  const doctorDisplay = esc(profile?.doctorName || data.doctor);
  const quals = profile?.qualifications ? `<p class="quals">${esc(profile.qualifications)}</p>` : "";
  const regNo = profile?.registrationNo ? `<p class="reg">Reg. No. ${esc(profile.registrationNo)}</p>` : "";

  const medsRows = data.medications.map((m, i) => `
    <tr>
      <td style="color:#94a3b8;padding-right:6px;vertical-align:top">${i + 1}.</td>
      <td style="vertical-align:top"><strong>${esc(m.name)}</strong></td>
      <td style="color:#475569;vertical-align:top">${esc(m.dosage)}</td>
      <td style="color:#475569;vertical-align:top">${esc(m.duration)}</td>
      <td style="color:#64748b;vertical-align:top">${esc(m.instructions)}</td>
    </tr>`).join("");

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Prescription – ${esc(data.patient)}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',system-ui,Arial,sans-serif;background:#fff;color:#1e293b;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{max-width:700px;margin:0 auto;padding:36px 40px}
.header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:16px;border-bottom:3px solid #0d9488;margin-bottom:22px}
.clinic-name{font-size:20px;font-weight:900;color:#0f766e}
.detail{font-size:11px;color:#64748b;margin-top:4px;line-height:1.6}
.doctor-col{text-align:right}
.doctor-name{font-size:16px;font-weight:800;color:#0f172a}
.quals{font-size:11.5px;color:#475569;margin-top:3px}
.reg{font-size:10.5px;color:#94a3b8;margin-top:2px}
.patient-bar{display:flex;gap:32px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 18px;margin-bottom:22px}
.pf-label{font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.12em}
.pf-value{font-size:13.5px;font-weight:700;color:#0f172a;margin-top:3px}
.rp{font-size:30px;font-style:italic;font-weight:900;color:#0d9488;margin-bottom:14px;line-height:1}
table{width:100%;border-collapse:collapse;margin-bottom:22px}
thead th{font-size:9.5px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.1em;padding:8px 10px;background:#f1f5f9;text-align:left}
tbody td{font-size:13px;padding:10px 10px;border-bottom:1px solid #f1f5f9}
tbody tr:last-child td{border-bottom:none}
.notes{background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;margin-bottom:28px}
.nl{font-size:9.5px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px}
.nt{font-size:13px;color:#78350f;line-height:1.65}
.sig{display:flex;justify-content:flex-end;margin-top:36px}
.sig-box{text-align:center;min-width:180px}
.sig-line{border-top:1px solid #94a3b8;margin-bottom:7px}
.sig-name{font-size:12px;font-weight:600;color:#475569}
.sig-sub{font-size:10.5px;color:#94a3b8;margin-top:2px}
.footer{margin-top:24px;padding-top:14px;border-top:1px dashed #e2e8f0;text-align:center}
.footer p{font-size:10px;color:#94a3b8;line-height:1.7}
@media print{.page{padding:20px 24px}}
</style></head><body>
<div class="page">
  <div class="header">
    <div>
      <p class="clinic-name">${clinicName}</p>
      ${address}${contact}
    </div>
    <div class="doctor-col">
      <p class="doctor-name">Dr. ${doctorDisplay}</p>
      ${quals}${regNo}
    </div>
  </div>
  <div class="patient-bar">
    <div><p class="pf-label">Patient</p><p class="pf-value">${esc(data.patient)}</p></div>
    <div><p class="pf-label">Date</p><p class="pf-value">${esc(data.date)}</p></div>
    <div><p class="pf-label">Consulting Doctor</p><p class="pf-value">Dr. ${doctorDisplay}</p></div>
  </div>
  <p class="rp">&#8478;</p>
  <table>
    <thead><tr><th style="width:24px"></th><th>Medicine</th><th>Dosage</th><th>Duration</th><th>Instructions</th></tr></thead>
    <tbody>${medsRows}</tbody>
  </table>
  ${data.notes ? `<div class="notes"><p class="nl">Notes &amp; Instructions</p><p class="nt">${esc(data.notes)}</p></div>` : ""}
  <div class="sig">
    <div class="sig-box">
      <div class="sig-line"></div>
      <p class="sig-name">Dr. ${doctorDisplay}</p>
      ${profile?.qualifications ? `<p class="sig-sub">${esc(profile.qualifications)}</p>` : ""}
    </div>
  </div>
  <div class="footer">
    <p>This is a computer-generated prescription. Valid only with the doctor's signature/stamp.</p>
    <p>${clinicName} &middot; Generated by BariQ</p>
  </div>
</div>
<script>window.onload=function(){window.print()}</script>
</body></html>`;
}

const DAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

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

// Controlled dialog — closes automatically after prescription is saved
function PrescriptionDialog({ appointment }: { appointment: any }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: settings } = useQuery<Record<string, any>>({ queryKey: ["/api/settings"] });
  const [open, setOpen] = useState(false);
  const [meds, setMeds] = useState<any[]>([]);
  const [prescriptionNotes, setPrescriptionNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const addMed = () =>
    setMeds([...meds, { name: "", dosage: "", duration: "", instructions: "" }]);
  const removeMed = (idx: number) => setMeds(meds.filter((_, i) => i !== idx));
  const updateMed = (idx: number, field: string, val: string) => {
    const newMeds = [...meds];
    newMeds[idx] = { ...newMeds[idx], [field]: val };
    setMeds(newMeds);
  };

  const handleSave = async () => {
    if (meds.length === 0) {
      toast({ title: "Add at least one medication", variant: "destructive" });
      return;
    }
    const incomplete = meds.some(m => !m.name.trim());
    if (incomplete) {
      toast({ title: "All medications must have a name", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch("/api/prescriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId: appointment.id,
          patientId: appointment.patientId,
          doctorId: appointment.doctorId,
          medications: meds,
          notes: prescriptionNotes.trim() || null,
        }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to save");
      queryClient.invalidateQueries({ queryKey: ["/api/prescriptions"] });
      toast({ title: "Prescription Saved", description: "Printing prescription…" });
      const html = buildPrescriptionHtml({
        patient: appointment.patient.name,
        doctor: doctorDisplayName(appointment.doctor),
        medications: meds,
        notes: prescriptionNotes.trim(),
        date: format(new Date(), "PPpp"),
      }, settings?.clinicProfile || {});
      openPrint(html, `Prescription – ${appointment.patient.name}`);
      setMeds([]);
      setPrescriptionNotes("");
      setOpen(false);
    } catch {
      toast({
        title: "Error",
        description: "Failed to save prescription",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="rounded-xl h-9 px-3 text-purple-600 border-purple-100 hover:bg-purple-50"
        >
          <Pill className="w-4 h-4 mr-1.5" /> Rx
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Digital Prescription — {appointment.patient.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-slate-900">Medications</h4>
            <Button size="sm" onClick={addMed} className="bg-purple-600 rounded-lg">
              <Plus className="w-4 h-4 mr-1.5" /> Add
            </Button>
          </div>
          <div className="space-y-4">
            {meds.map((med, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 space-y-3 relative group"
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-2 h-8 w-8 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => removeMed(idx)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">
                      Medicine Name *
                    </label>
                    <Input
                      placeholder="e.g. Paracetamol"
                      value={med.name}
                      onChange={(e) => updateMed(idx, "name", e.target.value)}
                      className="rounded-lg h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">
                      Dosage
                    </label>
                    <Input
                      placeholder="e.g. 500mg, 1-0-1"
                      value={med.dosage}
                      onChange={(e) => updateMed(idx, "dosage", e.target.value)}
                      className="rounded-lg h-9 text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">
                      Duration
                    </label>
                    <Input
                      placeholder="e.g. 5 days"
                      value={med.duration}
                      onChange={(e) => updateMed(idx, "duration", e.target.value)}
                      className="rounded-lg h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">
                      Instructions
                    </label>
                    <Input
                      placeholder="e.g. After food"
                      value={med.instructions}
                      onChange={(e) =>
                        updateMed(idx, "instructions", e.target.value)
                      }
                      className="rounded-lg h-9 text-sm"
                    />
                  </div>
                </div>
              </div>
            ))}
            {meds.length === 0 && (
              <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-2xl">
                <Pill className="w-12 h-12 text-slate-200 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">No medications added yet.</p>
                <Button size="sm" onClick={addMed} className="mt-3 bg-purple-600 rounded-lg">
                  <Plus className="w-4 h-4 mr-1.5" /> Add Medication
                </Button>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Additional Notes</label>
            <Textarea
              placeholder="Dietary advice, follow-up instructions, precautions..."
              value={prescriptionNotes}
              onChange={(e) => setPrescriptionNotes(e.target.value)}
              className="rounded-xl resize-none h-24 text-sm"
            />
          </div>
          <Button
            className="w-full rounded-xl h-11 bg-purple-600 shadow-lg shadow-purple-600/20"
            onClick={handleSave}
            disabled={isSaving || meds.length === 0}
          >
            {isSaving ? "Saving..." : "Save & Finalize Prescription"}
          </Button>
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
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [checkInTarget, setCheckInTarget] = useState<any>(null);
  const [checkInFee, setCheckInFee] = useState<string>("");
  const [checkInPaymentMethod, setCheckInPaymentMethod] = useState<string>("cash");
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [queueItems, setQueueItems] = useState<any[]>([]);
  const [receiptData, setReceiptData] = useState<{ patient: string; doctor: string; amount: string; date: string; paymentMethod: string } | null>(null);
  const [noShowTarget, setNoShowTarget] = useState<any>(null);

  const { data: doctors, isLoading: isDoctorsLoading } = useDoctors();
  const updateAppointment = useUpdateAppointment();

  const weekDates = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const monday = startOfWeek(now, { weekStartsOn: 1 });
    const dates: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(monday, i);
      if (d >= todayStart) dates.push(d);
    }
    return dates;
  }, []);

  const selectedDoctorProfile = useMemo(() => {
    if (!selectedDoctor || !doctors) return null;
    const doc = doctors.find((d) => String(d.id) === selectedDoctor);
    return doc?.doctorProfile ?? null;
  }, [selectedDoctor, doctors]);

  const doctorSlots = useMemo(() => {
    const profile = selectedDoctorProfile;
    if (!profile?.availability) return [];

    const slots: { id: string; label: string; date: string; start: string; end: string }[] = [];
    const now = new Date();
    const todayStr = format(now, "yyyy-MM-dd");
    const nowMins = now.getHours() * 60 + now.getMinutes();

    for (const date of weekDates) {
      const dayName = DAY_NAMES[date.getDay()];
      const dayConfig = (profile.availability as Record<string, any>)[dayName];
      const dateStr = format(date, "yyyy-MM-dd");
      const dateLabel = format(date, "EEE, MMM d");
      const isToday = dateStr === todayStr;

      if (!dayConfig?.enabled || !dayConfig.slots?.length) continue;

      for (const s of dayConfig.slots as { start: string; end: string }[]) {
        if (isToday) {
          const [endH, endM] = s.end.split(":").map(Number);
          if (endH * 60 + endM <= nowMins) continue;
        }
        slots.push({
          id: `${dateStr}|${s.start}-${s.end}`,
          label: `${isToday ? "Today" : dateLabel} — ${s.start} - ${s.end}`,
          date: dateStr,
          start: s.start,
          end: s.end,
        });
      }
    }

    return slots;
  }, [selectedDoctorProfile, weekDates]);

  const activeDate = useMemo(() => {
    if (!selectedSlot) return format(new Date(), "yyyy-MM-dd");
    const [dateStr] = selectedSlot.split("|");
    return dateStr || format(new Date(), "yyyy-MM-dd");
  }, [selectedSlot]);

  const { data: appointments, isLoading } = useAppointments({
    date: activeDate,
    doctorId: selectedDoctor || undefined,
  });

  const filteredAndSorted = useMemo(() => {
    if (!appointments) return [];
    const statuses = ["booked", "checked_in", "in_progress"];
    let items = appointments.filter(
      (apt) =>
        statuses.includes(apt.status) &&
        String(apt.doctorId) === selectedDoctor
    );

    if (selectedSlot && doctorSlots.length > 0) {
      const slot = doctorSlots.find((s) => s.id === selectedSlot);
      if (slot) {
        const [startH, startM] = slot.start.split(":").map(Number);
        const [endH, endM] = slot.end.split(":").map(Number);
        const slotStartMins = startH * 60 + startM;
        const slotEndMins = endH * 60 + endM;

        items = items.filter((apt) => {
          const d = apt.date instanceof Date ? apt.date : parseISO(apt.date);
          const aptMins = d.getHours() * 60 + d.getMinutes();
          return aptMins >= slotStartMins && aptMins < slotEndMins;
        });
      }
    }

    return [...items].sort((a, b) => {
      const posA = a.queuePosition ?? Infinity;
      const posB = b.queuePosition ?? Infinity;
      return posA - posB;
    });
  }, [appointments, selectedDoctor, selectedSlot, doctorSlots]);

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

  useEffect(() => {
    if (doctorSlots.length && !selectedSlot) {
      setSelectedSlot(doctorSlots[0].id);
    } else if (doctorSlots.length && selectedSlot && !doctorSlots.find((s) => s.id === selectedSlot)) {
      setSelectedSlot(doctorSlots[0].id);
    } else if (!doctorSlots.length) {
      setSelectedSlot("");
    }
  }, [doctorSlots, selectedSlot]);

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
          const err = await billRes.json().catch(() => ({}));
          throw new Error(err?.message || "Failed to record payment");
        }
      }
      updateAppointment.mutate(
        { id: checkInTarget.id, updates: { status: "checked_in" } },
        {
          onSuccess: () => {
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
            toast({ title: "Error", description: "Failed to check in", variant: "destructive" });
          },
        }
      );
    } catch {
      toast({ title: "Error", description: "Failed to create bill", variant: "destructive" });
    } finally {
      setIsCheckingIn(false);
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
      }
    );
  };

  const confirmNoShow = () => {
    if (!noShowTarget) return;
    handleStatusChange(noShowTarget.id, "no_show");
    setNoShowTarget(null);
  };

  if (isDoctorsLoading || (isLoading && !appointments)) return <Layout><Loading /></Layout>;

  if (!doctors?.length) {
    return (
      <Layout>
        <div className="flex flex-col gap-6">
          <PageHeader title="Queue Management" description="Live queue for the current week" />
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-100">
            <Users className="w-16 h-16 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-500">No doctors available. Please add doctors first.</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Queue Management"
          description={`Live queue — ${activeDate === format(new Date(), "yyyy-MM-dd") ? "today" : format(parseISO(activeDate), "EEEE, MMM d")}`}
        />

        <div className="flex flex-col sm:flex-row gap-3">
          <Select
            value={selectedDoctor}
            onValueChange={(v) => { setSelectedDoctor(v); setSelectedSlot(""); }}
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
          <Select value={selectedSlot} onValueChange={setSelectedSlot} disabled={!doctorSlots.length}>
            <SelectTrigger className="bg-white border-slate-200 rounded-xl w-full sm:w-72 h-11">
              <SelectValue placeholder={doctorSlots.length ? "Select date & slot" : "No slots available"} />
            </SelectTrigger>
            <SelectContent>
              {doctorSlots.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

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
                Patients will appear here when appointments are booked for this slot
              </p>
            </div>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            <Reorder.Group axis="y" values={queueItems} onReorder={handleReorder} className="space-y-3">
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
                      <p className="text-xs text-slate-400 mt-0.5">
                        {format(apt.date instanceof Date ? apt.date : parseISO(apt.date), "h:mm a")}
                        {apt.reason && <span className="italic"> · {apt.reason}</span>}
                      </p>
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
                      <Button size="sm" className="rounded-xl h-8 text-xs bg-blue-600 text-white" onClick={() => handleStatusChange(apt.id, "in_progress")}>
                        Start
                      </Button>
                    )}
                    {(apt.status === "booked" || apt.status === "checked_in") && can("queue:status-change") && (
                      <Button size="sm" variant="outline" className="rounded-xl h-8 text-xs text-red-500 border-red-100" onClick={() => setNoShowTarget(apt)}>
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
            </Reorder.Group>
          </AnimatePresence>
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
              <AlertDialogAction onClick={confirmNoShow} className="rounded-xl bg-red-600 hover:bg-red-700">
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
                      "h:mm a, MMM d"
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
              <DialogTitle>Payment Receipt</DialogTitle>
            </DialogHeader>
            {receiptData && (
              <div className="space-y-4 py-2">
                <div className="border border-slate-200 rounded-xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-teal-700 font-black text-lg tracking-tight">BariQ</h3>
                    <span className="text-xs text-slate-400 font-medium">RECEIPT</span>
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
                  <p className="text-center text-xs text-slate-400">Thank you for visiting!</p>
                </div>
                <div className="flex gap-3">
                  <Button
                    className="flex-1 rounded-xl h-11 bg-teal-600 hover:bg-teal-700"
                    onClick={() => {
                      const html = buildReceiptHtml(receiptData!, settings?.clinicProfile || {});
                      openPrint(html, `Receipt – ${receiptData!.patient}`);
                    }}
                  >
                    Print Receipt
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
    </Layout>
  );
}
