import { PageHeader } from "@/components/ui/PageHeader";
import { MedicineNameAutocomplete } from "@/components/MedicineNameAutocomplete";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDoctors } from "@/hooks/use-doctors";
import { useUpdateAppointment } from "@/hooks/use-appointments";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useRef, type ReactNode } from "react";
import { format, differenceInYears, differenceInMinutes } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Stethoscope,
  Phone,
  Mail,
  AlertTriangle,
  Heart,
  Thermometer,
  Activity,
  Weight,
  Clock,
  Hash,
  FileText,
  Plus,
  Trash2,
  Printer,
  CheckCircle,
  Users,
  ChevronDown,
  ChevronUp,
  History,
  Pill,
  Droplets,
  Ruler,
  RefreshCw,
  MonitorSmartphone,
  FlaskConical,
  Copy,
  CalendarDays,
  ChevronRight,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type Med = {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  timing: string;
  instructions: string;
};

type PastEncounter = {
  appointmentId: number;
  date: string;
  status: string;
  reason: string | null;
  vitals: { bp?: string; pulse?: number; temperature?: number; weight?: number; spO2?: number; height?: number } | null;
  prescriptionId: number | null;
  chiefComplaints: string | null;
  diagnosis: string | null;
  medications: Med[] | null;
  rxNotes: string | null;
  prescriptionCreatedAt: string | null;
};

type ConsoleData = {
  doctor: { id: string; name: string; specialization?: string; avgConsultationTime?: number };
  currentAppointment: {
    id: number;
    queueNumber: number | null;
    queueToken: string | null;
    reason: string | null;
    notes: string | null;
    consultationStartTime: string | null;
    checkInTime: string | null;
    vitals: { bp?: string; pulse?: number; temperature?: number; weight?: number; spO2?: number; height?: number } | null;
    status: string;
    patient: {
      id: number;
      name: string;
      phone: string;
      email?: string | null;
      dateOfBirth?: string | null;
      gender?: string | null;
      bloodGroup?: string | null;
      allergies?: string | null;
      address?: string | null;
    } | null;
    prescription: {
      id: number;
      chiefComplaints?: string | null;
      diagnosis?: string | null;
      medications: Med[];
      notes?: string | null;
    } | null;
    pastEncounters: PastEncounter[];
    pastVisitsCount: number;
  } | null;
  queue: {
    id: number;
    queueNumber: number | null;
    queuePosition: number | null;
    status: string;
    patientName: string;
    checkInTime: string | null;
    consultationStartTime: string | null;
  }[];
  waitingCount: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();
}

function calcAge(dob: string | null | undefined): string {
  if (!dob) return "—";
  const age = differenceInYears(new Date(), new Date(dob));
  return `${age} yrs`;
}

function esc(s: unknown) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildPrescriptionHtml(
  patient: { name: string; phone?: string; age?: string },
  doctor: string,
  date: string,
  rx: { chiefComplaints?: string; diagnosis?: string; medications: Med[]; notes?: string },
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
      <tbody>${medRows || "<tr><td colspan='7' style='color:#94a3b8;text-align:center;padding:16px'>No medications prescribed</td></tr>"}</tbody>
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

// ── Elapsed timer ─────────────────────────────────────────────────────────────

function useElapsedTime(startTime: string | null) {
  const [elapsed, setElapsed] = useState("");
  useEffect(() => {
    if (!startTime) { setElapsed(""); return; }
    const tick = () => {
      const mins = differenceInMinutes(new Date(), new Date(startTime));
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      setElapsed(h > 0 ? `${h}h ${m}m` : `${m}m`);
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [startTime]);
  return elapsed;
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    booked:      { label: "Booked",      cls: "bg-blue-100 text-blue-700" },
    checked_in:  { label: "Checked In",  cls: "bg-amber-100 text-amber-700" },
    in_progress: { label: "With Doctor", cls: "bg-emerald-100 text-emerald-700" },
    completed:   { label: "Done",        cls: "bg-gray-100 text-gray-500" },
    cancelled:   { label: "Cancelled",   cls: "bg-red-100 text-red-500" },
    no_show:     { label: "No Show",     cls: "bg-red-100 text-red-400" },
  };
  const s = map[status] || { label: status, cls: "bg-gray-100 text-gray-500" };
  return <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-semibold", s.cls)}>{s.label}</span>;
}

// ── Empty state ───────────────────────────────────────────────────────────────

function NoPatient({ doctorName, waitingCount }: { doctorName: string; waitingCount: number }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-20 h-20 rounded-full bg-teal-50 flex items-center justify-center mb-5">
        <MonitorSmartphone className="w-9 h-9 text-teal-300" />
      </div>
      <h3 className="text-lg font-semibold text-gray-700">No patient in consultation</h3>
      <p className="text-sm text-gray-400 mt-1 max-w-xs">
        Dr. {doctorName}'s console is ready.{" "}
        {waitingCount > 0
          ? `${waitingCount} patient${waitingCount > 1 ? "s" : ""} waiting. Ask receptionist to send the next one.`
          : "No patients waiting right now."}
      </p>
      <div className="mt-6 flex items-center gap-2 text-xs text-teal-500 bg-teal-50 border border-teal-100 rounded-xl px-4 py-2.5">
        <Activity className="w-3.5 h-3.5" />
        Live updates active · page refreshes automatically
      </div>
    </div>
  );
}

// ── Past Encounter Card (expandable) ─────────────────────────────────────────

function EncounterCard({
  enc,
  patientName,
  patientPhone,
  patientDob,
  doctorName,
  clinicProfile,
  onRepeatRx,
}: {
  enc: PastEncounter;
  patientName: string;
  patientPhone: string;
  patientDob?: string | null;
  doctorName: string;
  clinicProfile: Record<string, any>;
  onRepeatRx: (meds: Med[], complaints: string, diagnosis: string, notes: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const hasMeds = (enc.medications?.length ?? 0) > 0;
  const hasVitals = enc.vitals && Object.values(enc.vitals).some(v => v !== undefined && v !== null);

  const printOldRx = () => {
    if (!enc.medications?.length) return;
    const html = buildPrescriptionHtml(
      { name: patientName, phone: patientPhone, age: calcAge(patientDob) },
      doctorName,
      format(new Date(enc.date), "dd MMM yyyy"),
      {
        chiefComplaints: enc.chiefComplaints || undefined,
        diagnosis: enc.diagnosis || undefined,
        medications: enc.medications,
        notes: enc.rxNotes || undefined,
      },
      clinicProfile
    );
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
  };

  return (
    <div className={cn(
      "border rounded-xl overflow-hidden transition-all",
      open ? "border-teal-200 bg-teal-50/30" : "border-gray-100 bg-white hover:border-gray-200"
    )}>
      {/* Header row — always visible, click to expand */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
          <CalendarDays className="w-3.5 h-3.5 text-gray-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800">
            {format(new Date(enc.date), "dd MMM yyyy")}
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5 truncate">
            {enc.diagnosis
              ? enc.diagnosis
              : enc.chiefComplaints
              ? enc.chiefComplaints
              : enc.reason
              ? `Reason: ${enc.reason}`
              : "No diagnosis recorded"}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hasMeds && (
            <span className="text-[10px] bg-teal-50 border border-teal-100 text-teal-600 font-medium px-2 py-0.5 rounded-full">
              {enc.medications!.length} med{enc.medications!.length !== 1 ? "s" : ""}
            </span>
          )}
          {hasVitals && (
            <span className="text-[10px] bg-blue-50 border border-blue-100 text-blue-600 font-medium px-2 py-0.5 rounded-full">
              Vitals
            </span>
          )}
          <ChevronRight className={cn("w-4 h-4 text-gray-300 transition-transform", open && "rotate-90")} />
        </div>
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">

          {/* Vitals from this visit */}
          {hasVitals && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Vitals at this visit</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {enc.vitals!.bp && <MiniVital label="BP" value={enc.vitals!.bp} unit="mmHg" />}
                {enc.vitals!.pulse && <MiniVital label="Pulse" value={String(enc.vitals!.pulse)} unit="bpm" />}
                {enc.vitals!.temperature && <MiniVital label="Temp" value={String(enc.vitals!.temperature)} unit="°F" />}
                {enc.vitals!.spO2 && <MiniVital label="SpO₂" value={String(enc.vitals!.spO2)} unit="%" />}
                {enc.vitals!.weight && <MiniVital label="Weight" value={String(enc.vitals!.weight)} unit="kg" />}
                {enc.vitals!.height && <MiniVital label="Height" value={String(enc.vitals!.height)} unit="cm" />}
              </div>
            </div>
          )}

          {/* Chief complaints */}
          {enc.chiefComplaints && (
            <div>
              <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1">Chief Complaints</p>
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">{enc.chiefComplaints}</p>
            </div>
          )}

          {/* Diagnosis */}
          {enc.diagnosis && (
            <div>
              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1">Diagnosis</p>
              <p className="text-sm font-semibold text-blue-800 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">{enc.diagnosis}</p>
            </div>
          )}

          {/* Medications table */}
          {hasMeds && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Medications prescribed</p>
              <div className="border border-gray-100 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-3 py-2 font-semibold text-gray-500">#</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-500">Medicine</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-500">Dosage</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-500">Frequency</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-500">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {enc.medications!.map((m, i) => (
                      <tr key={i} className="hover:bg-gray-50/50">
                        <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                        <td className="px-3 py-2 font-medium text-gray-800">{m.name}</td>
                        <td className="px-3 py-2 text-gray-600">{m.dosage}</td>
                        <td className="px-3 py-2 text-gray-600">{m.frequency}{m.timing ? ` · ${m.timing}` : ""}</td>
                        <td className="px-3 py-2 text-gray-600">{m.duration}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {enc.rxNotes && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-2">
                  <span className="font-semibold">Notes:</span> {enc.rxNotes}
                </p>
              )}
            </div>
          )}

          {!hasMeds && !enc.chiefComplaints && !enc.diagnosis && (
            <p className="text-sm text-gray-400 italic">No prescription recorded for this visit</p>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            {hasMeds && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onRepeatRx(
                  enc.medications!,
                  enc.chiefComplaints || "",
                  enc.diagnosis || "",
                  enc.rxNotes || ""
                )}
                className="gap-1.5 h-7 text-xs border-teal-200 text-teal-700 hover:bg-teal-50"
              >
                <Copy className="w-3 h-3" /> Repeat this Rx
              </Button>
            )}
            {hasMeds && (
              <Button
                size="sm"
                variant="ghost"
                onClick={printOldRx}
                className="gap-1.5 h-7 text-xs text-gray-500 hover:text-gray-700"
              >
                <Printer className="w-3 h-3" /> Print
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MiniVital({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="bg-white border border-gray-100 rounded-lg px-2.5 py-1.5">
      <p className="text-[9px] text-gray-400 font-medium uppercase">{label}</p>
      <p className="text-xs font-bold text-gray-700">{value} <span className="text-[10px] font-normal text-gray-400">{unit}</span></p>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

const DOCTOR_KEY = "medqueue-doctor-console-doctorId";
const BLANK_MED: Med = { name: "", dosage: "", frequency: "", duration: "", timing: "After food", instructions: "" };

export default function DoctorConsole() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Doctor selection (persisted)
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>(() =>
    localStorage.getItem(DOCTOR_KEY) || ""
  );

  const { data: doctorsList = [] } = useDoctors();

  const persistDoctor = (id: string) => {
    setSelectedDoctorId(id);
    localStorage.setItem(DOCTOR_KEY, id);
  };

  // Console data
  const { data: consoleData, isLoading, isFetching } = useQuery<ConsoleData>({
    queryKey: ["/api/doctor-console", selectedDoctorId],
    queryFn: async () => {
      const res = await fetch(`/api/doctor-console/${selectedDoctorId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load console");
      return res.json();
    },
    enabled: !!selectedDoctorId,
    refetchInterval: 15000,
  });

  // Clinic profile (for print)
  const { data: clinicProfile } = useQuery({
    queryKey: ["/api/settings/clinicProfile"],
    queryFn: () => fetch("/api/settings/clinicProfile", { credentials: "include" }).then(r => r.ok ? r.json() : {}),
  });

  // SSE for real-time updates — auto-reconnects on drop (Render 30s proxy timeout, etc.)
  useEffect(() => {
    if (!selectedDoctorId) return;
    let es: EventSource;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      es = new EventSource(`/api/sse/doctor/${selectedDoctorId}`);
      es.onmessage = (e) => {
        if (e.data === "connected") return;
        queryClient.invalidateQueries({ queryKey: ["/api/doctor-console", selectedDoctorId] });
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
  }, [selectedDoctorId, queryClient]);

  // Prescription state
  const appt = consoleData?.currentAppointment;
  const [chiefComplaints, setChiefComplaints] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [meds, setMeds] = useState<Med[]>([{ ...BLANK_MED }]);
  const [rxNotes, setRxNotes] = useState("");
  const [rxSaving, setRxSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const prevApptId = useRef<number | null>(null);

  // Reset prescription form when patient changes
  useEffect(() => {
    if (!appt) return;
    if (appt.id === prevApptId.current) return;
    prevApptId.current = appt.id;
    const rx = appt.prescription;
    setChiefComplaints(rx?.chiefComplaints || "");
    setDiagnosis(rx?.diagnosis || "");
    setMeds(rx?.medications?.length ? rx.medications : [{ ...BLANK_MED }]);
    setRxNotes(rx?.notes || "");
    setShowHistory(false);
  }, [appt?.id]);

  const elapsed = useElapsedTime(appt?.consultationStartTime || null);

  // Mutations
  const updateAppointment = useUpdateAppointment();

  const savePrescription = useMutation({
    mutationFn: async () => {
      if (!appt) return;
      const body = {
        appointmentId: appt.id,
        patientId: appt.patient?.id,
        doctorId: selectedDoctorId,
        chiefComplaints: chiefComplaints.trim() || null,
        diagnosis: diagnosis.trim() || null,
        medications: meds.filter(m => m.name.trim()),
        notes: rxNotes.trim() || null,
      };
      if (appt.prescription?.id) {
        const r = await fetch(`/api/prescriptions/${appt.prescription.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        });
        if (!r.ok) throw new Error("Failed to update prescription");
        return r.json();
      } else {
        const r = await fetch("/api/prescriptions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        });
        if (!r.ok) throw new Error("Failed to create prescription");
        return r.json();
      }
    },
    onSuccess: () => {
      toast({ title: "Prescription saved" });
      queryClient.invalidateQueries({ queryKey: ["/api/doctor-console", selectedDoctorId] });
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const handleComplete = async () => {
    if (!appt) return;
    if (chiefComplaints || diagnosis || meds.some(m => m.name) || rxNotes) {
      setRxSaving(true);
      try { await savePrescription.mutateAsync(); } catch {}
      setRxSaving(false);
    }
    try {
      await updateAppointment.mutateAsync({ id: appt.id, updates: { status: "completed" } });
      toast({ title: "Consultation completed", description: "Patient marked as done." });
      queryClient.invalidateQueries({ queryKey: ["/api/doctor-console", selectedDoctorId] });
    } catch {
      toast({ title: "Error", description: "Failed to complete consultation. Please try again.", variant: "destructive" });
    }
  };

  const printPrescription = () => {
    if (!appt?.patient) return;
    const profile = (clinicProfile as any) || {};
    const doctorName = consoleData?.doctor?.name || "Doctor";
    const html = buildPrescriptionHtml(
      { name: appt.patient.name, phone: appt.patient.phone, age: calcAge(appt.patient.dateOfBirth) },
      doctorName,
      format(new Date(), "dd MMM yyyy"),
      { chiefComplaints, diagnosis, medications: meds.filter(m => m.name.trim()), notes: rxNotes },
      profile
    );
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
  };

  // "Repeat Rx" — copy past prescription into current form
  const handleRepeatRx = (
    pastMeds: Med[],
    pastComplaints: string,
    pastDiagnosis: string,
    pastNotes: string
  ) => {
    if (pastComplaints && !chiefComplaints) setChiefComplaints(pastComplaints);
    if (pastDiagnosis && !diagnosis) setDiagnosis(pastDiagnosis);
    setMeds(pastMeds.length ? pastMeds.map(m => ({ ...m })) : [{ ...BLANK_MED }]);
    if (pastNotes && !rxNotes) setRxNotes(pastNotes);
    setShowHistory(false);
    toast({ title: "Prescription repeated", description: "Medications copied from previous visit." });
  };

  // Med helpers
  const addMed = () => setMeds(p => [...p, { ...BLANK_MED }]);
  const removeMed = (i: number) => setMeds(p => p.length === 1 ? [{ ...BLANK_MED }] : p.filter((_, idx) => idx !== i));
  const updateMed = (i: number, field: keyof Med, val: string) =>
    setMeds(p => p.map((m, idx) => idx === i ? { ...m, [field]: val } : m));

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <PageHeader
        title="Doctor Console"
        description="Live view of current patient — updates automatically when receptionist sends the next patient"
      />

      {/* Doctor selector */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-gray-500 font-medium shrink-0">
          <Stethoscope className="w-4 h-4 text-teal-600" />
          Active Doctor:
        </div>
        <Select value={selectedDoctorId} onValueChange={persistDoctor}>
          <SelectTrigger className="w-72 h-9 border-gray-200">
            <SelectValue placeholder="Select doctor to monitor..." />
          </SelectTrigger>
          <SelectContent>
            {(doctorsList as any[]).map((d: any) => (
              <SelectItem key={d.id} value={d.id}>
                Dr. {d.name || `${d.firstName || ""} ${d.lastName || ""}`.trim()}
                {d.doctorProfile?.specialization && (
                  <span className="text-gray-400 ml-1.5">· {d.doctorProfile.specialization}</span>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedDoctorId && (
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/doctor-console", selectedDoctorId] })}
            disabled={isFetching}
            className="ml-auto flex items-center gap-1.5 text-xs text-teal-600 hover:text-teal-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin")} />
            Refresh
          </button>
        )}
        {selectedDoctorId && (
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-medium bg-emerald-50 border border-emerald-100 rounded-full px-3 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live
          </div>
        )}
      </div>

      {!selectedDoctorId ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-16 text-center shadow-sm">
          <Stethoscope className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Select a doctor above to open their console</p>
        </div>
      ) : isLoading ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-16 text-center shadow-sm">
          <div className="w-7 h-7 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Loading console...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

          {/* ── LEFT: Patient details + prescription + history ── */}
          <div className="xl:col-span-2 space-y-4">

            {!appt ? (
              <div className="bg-white border border-gray-100 rounded-2xl shadow-sm">
                <NoPatient
                  doctorName={consoleData?.doctor?.name || ""}
                  waitingCount={consoleData?.waitingCount || 0}
                />
              </div>
            ) : (
              <>
                {/* ── Patient card ── */}
                <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                  <div className="bg-gradient-to-r from-teal-600 to-teal-500 px-5 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-white">
                      <Activity className="w-4 h-4" />
                      <span className="text-sm font-semibold">Current Patient</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {appt.queueNumber && (
                        <span className="bg-white/20 text-white text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                          <Hash className="w-3 h-3" /> {appt.queueNumber}
                        </span>
                      )}
                      {elapsed && (
                        <span className="bg-white/20 text-white text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {elapsed}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-5">
                    {appt.patient ? (
                      <div className="space-y-4">
                        {/* Identity row */}
                        <div className="flex items-start gap-4">
                          <div className="w-14 h-14 rounded-2xl bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-lg shrink-0 select-none">
                            {initials(appt.patient.name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h2 className="text-xl font-bold text-gray-900 leading-tight">{appt.patient.name}</h2>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                              {appt.patient.dateOfBirth && (
                                <span className="text-sm text-gray-500">{calcAge(appt.patient.dateOfBirth)}</span>
                              )}
                              {appt.patient.gender && (
                                <span className="text-sm text-gray-500 capitalize">{appt.patient.gender}</span>
                              )}
                              {appt.patient.bloodGroup && (
                                <span className="flex items-center gap-1 text-sm font-semibold text-red-600">
                                  <Droplets className="w-3.5 h-3.5" /> {appt.patient.bloodGroup}
                                </span>
                              )}
                              {appt.pastVisitsCount > 0 && (
                                <button
                                  onClick={() => setShowHistory(h => !h)}
                                  className="text-xs bg-blue-50 text-blue-600 font-medium px-2 py-0.5 rounded-full hover:bg-blue-100 transition-colors"
                                >
                                  {appt.pastVisitsCount} past visit{appt.pastVisitsCount !== 1 ? "s" : ""}
                                </button>
                              )}
                            </div>
                          </div>
                          <Button
                            onClick={handleComplete}
                            disabled={updateAppointment.isPending || rxSaving}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white shrink-0 gap-1.5"
                            size="sm"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Complete
                          </Button>
                        </div>

                        {/* Allergy alert */}
                        {appt.patient.allergies && (
                          <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl p-3">
                            <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                            <div>
                              <p className="text-xs font-bold text-red-600 uppercase tracking-wide mb-0.5">Allergies</p>
                              <p className="text-sm text-red-700">{appt.patient.allergies}</p>
                            </div>
                          </div>
                        )}

                        {/* Contact + reason */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-xl px-3 py-2">
                            <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            {appt.patient.phone || "-"}
                          </div>
                          {appt.patient.email && (
                            <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-xl px-3 py-2">
                              <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                              <span className="truncate">{appt.patient.email}</span>
                            </div>
                          )}
                          {appt.reason && (
                            <div className="sm:col-span-2 flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                              <FileText className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                              <span><span className="font-semibold">Reason:</span> {appt.reason}</span>
                            </div>
                          )}
                        </div>

                        {/* Vitals */}
                        {appt.vitals && Object.values(appt.vitals).some(v => v !== undefined && v !== null) && (
                          <div>
                            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Vitals</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {appt.vitals.bp && <VitalCard icon={<Heart className="w-3.5 h-3.5 text-red-400" />} label="BP" value={appt.vitals.bp} unit="mmHg" />}
                              {appt.vitals.pulse && <VitalCard icon={<Activity className="w-3.5 h-3.5 text-pink-400" />} label="Pulse" value={String(appt.vitals.pulse)} unit="bpm" />}
                              {appt.vitals.temperature && <VitalCard icon={<Thermometer className="w-3.5 h-3.5 text-orange-400" />} label="Temp" value={String(appt.vitals.temperature)} unit="°F" />}
                              {appt.vitals.spO2 && <VitalCard icon={<FlaskConical className="w-3.5 h-3.5 text-blue-400" />} label="SpO₂" value={String(appt.vitals.spO2)} unit="%" />}
                              {appt.vitals.weight && <VitalCard icon={<Weight className="w-3.5 h-3.5 text-purple-400" />} label="Weight" value={String(appt.vitals.weight)} unit="kg" />}
                              {appt.vitals.height && <VitalCard icon={<Ruler className="w-3.5 h-3.5 text-teal-400" />} label="Height" value={String(appt.vitals.height)} unit="cm" />}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-gray-400 text-sm">Patient details unavailable</p>
                    )}
                  </div>
                </div>

                {/* ── Prescription panel ── */}
                <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                      <Pill className="w-4 h-4 text-teal-600" />
                      Prescription
                      {appt.prescription && (
                        <span className="text-[11px] bg-teal-50 text-teal-600 font-medium px-2 py-0.5 rounded-full border border-teal-100">Saved</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={printPrescription} className="gap-1.5 h-8 text-xs">
                        <Printer className="w-3.5 h-3.5" /> Print
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => savePrescription.mutate()}
                        disabled={savePrescription.isPending}
                        className="bg-teal-600 hover:bg-teal-700 gap-1.5 h-8 text-xs"
                      >
                        {savePrescription.isPending ? "Saving…" : "Save Rx"}
                      </Button>
                    </div>
                  </div>

                  <div className="p-5 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Chief Complaints</label>
                        <Textarea value={chiefComplaints} onChange={e => setChiefComplaints(e.target.value)} placeholder="e.g. Fever, cough, headache..." rows={3} className="resize-none text-sm" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Diagnosis</label>
                        <Textarea value={diagnosis} onChange={e => setDiagnosis(e.target.value)} placeholder="e.g. Viral fever with URTI..." rows={3} className="resize-none text-sm" />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Medications</label>
                        <button onClick={addMed} className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 font-medium transition-colors">
                          <Plus className="w-3.5 h-3.5" /> Add Medicine
                        </button>
                      </div>
                      <div className="space-y-2">
                        {meds.map((med, i) => (
                          <MedRow key={i} med={med} index={i} onChange={updateMed} onRemove={removeMed} />
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Advice / Notes</label>
                      <Textarea value={rxNotes} onChange={e => setRxNotes(e.target.value)} placeholder="Rest, diet advice, follow-up date..." rows={2} className="resize-none text-sm" />
                    </div>
                  </div>
                </div>

                {/* ── Patient history (expandable encounters) ── */}
                {appt.pastEncounters.length > 0 && (
                  <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                    <button
                      onClick={() => setShowHistory(h => !h)}
                      className="w-full px-5 py-3.5 flex items-center justify-between text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <History className="w-4 h-4 text-gray-400" />
                        Patient History
                        <span className="text-[11px] bg-blue-50 text-blue-600 font-medium px-2 py-0.5 rounded-full border border-blue-100">
                          {appt.pastEncounters.length} visit{appt.pastEncounters.length !== 1 ? "s" : ""}
                        </span>
                        <span className="text-[11px] text-gray-400 font-normal">· click any visit to expand</span>
                      </span>
                      {showHistory ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </button>

                    {showHistory && (
                      <div className="px-5 pb-5 space-y-2 border-t border-gray-100 pt-4">
                        {appt.pastEncounters.map(enc => (
                          <EncounterCard
                            key={enc.appointmentId}
                            enc={enc}
                            patientName={appt.patient?.name || ""}
                            patientPhone={appt.patient?.phone || ""}
                            patientDob={appt.patient?.dateOfBirth}
                            doctorName={consoleData?.doctor?.name || "Doctor"}
                            clinicProfile={(clinicProfile as any) || {}}
                            onRepeatRx={handleRepeatRx}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── RIGHT: Queue overview + stats + doctor info ── */}
          <div className="space-y-4">
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3.5 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <Users className="w-4 h-4 text-teal-600" />
                  Today's Queue
                </div>
                <span className="text-xs bg-amber-50 text-amber-700 font-semibold border border-amber-100 px-2.5 py-1 rounded-full">
                  {consoleData?.waitingCount || 0} waiting
                </span>
              </div>

              <div className="divide-y divide-gray-50">
                {(consoleData?.queue || []).length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">No patients today</p>
                ) : (
                  (consoleData?.queue || []).map((q, i) => (
                    <div key={q.id} className={cn("px-4 py-3 flex items-center gap-3", q.status === "in_progress" && "bg-emerald-50")}>
                      <div className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                        q.status === "in_progress" ? "bg-emerald-500 text-white" :
                        q.status === "completed" ? "bg-gray-200 text-gray-500" :
                        q.status === "checked_in" ? "bg-amber-100 text-amber-700" :
                        "bg-blue-50 text-blue-600"
                      )}>
                        {q.queueNumber || i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-sm font-medium truncate",
                          q.status === "in_progress" ? "text-emerald-800" :
                          q.status === "completed" ? "text-gray-400" : "text-gray-700"
                        )}>
                          {q.patientName}
                        </p>
                        {q.checkInTime && q.status === "checked_in" && (
                          <p className="text-[11px] text-gray-400">Checked in {format(new Date(q.checkInTime), "h:mm a")}</p>
                        )}
                        {q.consultationStartTime && q.status === "in_progress" && (
                          <p className="text-[11px] text-emerald-600">Started {format(new Date(q.consultationStartTime), "h:mm a")}</p>
                        )}
                      </div>
                      <StatusBadge status={q.status} />
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Quick stats */}
            {consoleData && (
              <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 space-y-3">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Today at a glance</p>
                <StatRow label="Waiting" value={String(consoleData.queue.filter(q => q.status === "booked" || q.status === "checked_in").length)} color="text-amber-600" />
                <StatRow label="In consultation" value={String(consoleData.queue.filter(q => q.status === "in_progress").length)} color="text-emerald-600" />
                <StatRow label="Completed" value={String(consoleData.queue.filter(q => q.status === "completed").length)} color="text-gray-500" />
                <StatRow label="Total today" value={String(consoleData.queue.length)} color="text-teal-600" />
              </div>
            )}

            {/* Doctor info */}
            {consoleData?.doctor && (
              <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Doctor Info</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-sm shrink-0">
                    {initials(consoleData.doctor.name || "Dr")}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Dr. {consoleData.doctor.name}</p>
                    {consoleData.doctor.specialization && <p className="text-xs text-gray-400">{consoleData.doctor.specialization}</p>}
                    {consoleData.doctor.avgConsultationTime && <p className="text-xs text-gray-400">~{consoleData.doctor.avgConsultationTime} min/patient</p>}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function VitalCard({ icon, label, value, unit }: { icon: ReactNode; label: string; value: string; unit: string }) {
  return (
    <div className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 flex items-center gap-2.5">
      {icon}
      <div>
        <p className="text-[10px] text-gray-400 font-medium">{label}</p>
        <p className="text-sm font-bold text-gray-800">{value} <span className="text-[11px] font-normal text-gray-400">{unit}</span></p>
      </div>
    </div>
  );
}

function StatRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={cn("text-sm font-bold", color)}>{value}</span>
    </div>
  );
}

const FREQUENCY_OPTIONS = ["Once daily", "Twice daily", "Thrice daily", "Every 4h", "Every 6h", "Every 8h", "SOS"];
const TIMING_OPTIONS = ["Before food", "After food", "With food", "Empty stomach", "At bedtime", "Morning", "Night"];
const DURATION_OPTIONS = ["1 day", "3 days", "5 days", "7 days", "10 days", "14 days", "1 month", "2 months", "3 months", "Ongoing"];

function MedRow({ med, index, onChange, onRemove }: {
  med: Med; index: number;
  onChange: (i: number, field: keyof Med, val: string) => void;
  onRemove: (i: number) => void;
}) {
  return (
    <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 space-y-2">
      <div className="flex gap-2 items-start">
        <div className="flex-1">
          <MedicineNameAutocomplete value={med.name} onChange={v => onChange(index, "name", v)} placeholder="Medicine name..." className="h-8 text-sm" />
        </div>
        <Input value={med.dosage} onChange={e => onChange(index, "dosage", e.target.value)} placeholder="Dosage" className="w-24 h-8 text-sm" />
        <button onClick={() => onRemove(index)} className="mt-1 text-gray-300 hover:text-red-400 transition-colors shrink-0">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <CompactSelect value={med.frequency} onChange={v => onChange(index, "frequency", v)} options={FREQUENCY_OPTIONS} placeholder="Frequency" />
        <CompactSelect value={med.timing} onChange={v => onChange(index, "timing", v)} options={TIMING_OPTIONS} placeholder="Timing" />
        <CompactSelect value={med.duration} onChange={v => onChange(index, "duration", v)} options={DURATION_OPTIONS} placeholder="Duration" />
      </div>
      <Input value={med.instructions} onChange={e => onChange(index, "instructions", e.target.value)} placeholder="Special instructions (optional)" className="h-7 text-xs" />
    </div>
  );
}

function CompactSelect({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void; options: string[]; placeholder: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-7 text-xs px-2">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map(o => <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
