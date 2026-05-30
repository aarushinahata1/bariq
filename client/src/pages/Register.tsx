import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Loader2, CheckCircle, User, Phone, Stethoscope, MessageSquare, ChevronRight, AlertCircle, ExternalLink, Clock, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, addDays } from "date-fns";

function BariQLogo() {
  return (
    <div className="flex items-center gap-2 justify-center">
      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center font-black text-white text-sm shadow-lg">
        B
      </div>
      <span className="font-black text-teal-700 text-xl tracking-tight">BariQ</span>
    </div>
  );
}

type DoctorSlot = { start: string; end: string };

type KioskInfo = {
  clinic: { name: string; tagline: string | null; address: string | null };
  doctors: { id: string; name: string; specialization: string; slots: DoctorSlot[] }[];
};

function formatSlot(slot: DoctorSlot): string {
  const fmt = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    const period = h < 12 ? "AM" : "PM";
    const hh = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${hh}:${String(m).padStart(2, "0")} ${period}`;
  };
  return `${fmt(slot.start)} – ${fmt(slot.end)}`;
}

function todayStr() {
  return format(new Date(), "yyyy-MM-dd");
}

type RegistrationResult = {
  alreadyRegistered: boolean;
  patientName: string;
  doctorName: string;
  queuePosition: number | null;
  queueToken: string | null;
  queueUrl: string;
};

// Build quick-pick date options: today + next 6 days
function buildDateOptions() {
  const options: { value: string; label: string }[] = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = addDays(today, i);
    options.push({
      value: format(d, "yyyy-MM-dd"),
      label: i === 0 ? "Today" : i === 1 ? "Tomorrow" : format(d, "EEE, MMM d"),
    });
  }
  return options;
}

export default function Register() {
  const { token } = useParams<{ token: string }>();

  const [step, setStep] = useState<"form" | "success">("form");
  const [selectedDate, setSelectedDate] = useState<string>(todayStr());
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<RegistrationResult | null>(null);

  const dateOptions = buildDateOptions();

  const { data: info, isLoading, error } = useQuery<KioskInfo>({
    queryKey: ["kiosk", token, selectedDate],
    queryFn: async () => {
      const res = await fetch(`/api/kiosk/${token}?date=${selectedDate}`);
      if (!res.ok) throw new Error("Invalid or expired registration link");
      return res.json();
    },
    enabled: !!token,
    retry: false,
  });

  const doctors = info?.doctors ?? [];

  // Reset doctor/slot when date changes (availability differs by day)
  useEffect(() => {
    setSelectedDoctorId("");
    setSelectedSlot("");
  }, [selectedDate]);

  // Auto-select when only one doctor
  useEffect(() => {
    if (info?.doctors?.length === 1) {
      setSelectedDoctorId(prev => prev || info!.doctors[0].id);
    }
  }, [info]);

  // Reset/auto-select slot when doctor changes
  useEffect(() => {
    if (!selectedDoctorId) { setSelectedSlot(""); return; }
    const doc = doctors.find(d => d.id === selectedDoctorId);
    if (doc?.slots?.length === 1) {
      setSelectedSlot(doc.slots[0].start);
    } else {
      setSelectedSlot("");
    }
  }, [selectedDoctorId]); // eslint-disable-line react-hooks/exhaustive-deps

  const registerMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/kiosk/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          doctorId: selectedDoctorId,
          reason: reason.trim() || null,
          slotStart: selectedSlot || undefined,
          date: selectedDate,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Registration failed");
      }
      return res.json() as Promise<RegistrationResult>;
    },
    onSuccess: (data) => {
      setResult(data);
      setStep("success");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) return;
    if (!selectedDoctorId) return;
    registerMutation.mutate();
  };

  const selectedDoctor = doctors.find(d => d.id === selectedDoctorId);
  const selectedDoctorSlots = selectedDoctor?.slots ?? [];

  const waMessage = result
    ? encodeURIComponent(`Hi! I'm ${result.patientName}. Track my queue position:\n${result.queueUrl}`)
    : "";
  const waUrl = result?.queueUrl ? `https://wa.me/?text=${waMessage}` : "";

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-teal-500 animate-spin mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  // ── Error / invalid link ─────────────────────────────────────────────────────
  if (error || !info) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <BariQLogo />
          <div className="mt-8 bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
            <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-7 h-7 text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Link Not Found</h2>
            <p className="text-slate-500 text-sm">This registration link is invalid or has expired. Please ask the reception for assistance.</p>
          </div>
          <p className="text-slate-400 text-xs mt-6">Powered by <span className="font-semibold">BariQ</span></p>
        </div>
      </div>
    );
  }

  // ── Success screen ───────────────────────────────────────────────────────────
  if (step === "success" && result) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-white flex flex-col">
        <header className="pt-10 pb-4 text-center">
          <BariQLogo />
        </header>

        <main className="flex-1 flex flex-col items-center justify-center px-5 py-6">
          <div className="w-full max-w-sm space-y-5">

            {/* Clinic name */}
            <p className="text-center text-sm font-semibold text-slate-500">{info.clinic.name}</p>

            {/* Success / Already registered */}
            {result.alreadyRegistered ? (
              <div className="bg-amber-50 border border-amber-200 rounded-3xl p-7 text-center">
                <div className="w-14 h-14 bg-amber-100 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                  <AlertCircle className="w-7 h-7 text-amber-500" />
                </div>
                <h1 className="text-xl font-bold text-amber-900 mb-1">Already Registered</h1>
                <p className="text-amber-700 text-sm">You're already in the queue for Dr. {result.doctorName} on {dateOptions.find(d => d.value === selectedDate)?.label ?? selectedDate}.</p>
              </div>
            ) : (
              <div className="bg-teal-600 rounded-3xl p-8 text-center shadow-2xl shadow-teal-200 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
                <div className="w-14 h-14 bg-white/20 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-white" />
                </div>
                <p className="text-teal-100/80 text-[10px] uppercase tracking-[0.2em] font-bold mb-2">You're Registered!</p>
                <div className="text-7xl font-black text-white leading-none tracking-tighter mb-2">
                  #{result.queuePosition}
                </div>
                <p className="text-teal-100 text-sm font-semibold">Your token number</p>
              </div>
            )}

            {/* Doctor + patient + date info */}
            <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
              <div className="flex items-center gap-3 px-4 py-3.5">
                <User className="w-4 h-4 text-slate-400 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Patient</p>
                  <p className="text-sm font-semibold text-slate-900">{result.patientName}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-4 py-3.5">
                <Stethoscope className="w-4 h-4 text-slate-400 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Doctor</p>
                  <p className="text-sm font-semibold text-slate-900">Dr. {result.doctorName}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-4 py-3.5">
                <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Date</p>
                  <p className="text-sm font-semibold text-slate-900">{dateOptions.find(d => d.value === selectedDate)?.label ?? selectedDate}</p>
                </div>
              </div>
            </div>

            {/* Track position button (only meaningful for today's bookings) */}
            {result.queueToken && selectedDate === todayStr() && (
              <a
                href={result.queueUrl}
                className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-teal-600 text-white font-bold text-base shadow-lg shadow-teal-200 hover:bg-teal-700 transition-colors"
              >
                Track Your Position <ChevronRight className="w-5 h-5" />
              </a>
            )}

            {/* WhatsApp share */}
            {waUrl && (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2.5 w-full py-3 rounded-2xl border border-green-200 bg-green-50 text-green-700 font-semibold text-sm hover:bg-green-100 transition-colors"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-green-600">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                Share via WhatsApp
                <ExternalLink className="w-3.5 h-3.5 opacity-60" />
              </a>
            )}

            {/* Register another */}
            <button
              onClick={() => {
                setStep("form");
                setName(""); setPhone(""); setReason(""); setResult(null);
                setSelectedDate(todayStr());
                setSelectedDoctorId(""); setSelectedSlot("");
              }}
              className="w-full py-3 text-sm text-slate-400 hover:text-slate-600 transition-colors"
            >
              Register another patient
            </button>
          </div>
        </main>

        <footer className="pb-8 text-center">
          <p className="text-slate-400 text-xs">Powered by <span className="font-semibold text-slate-500">BariQ</span> — Your Turn, Simplified</p>
        </footer>
      </div>
    );
  }

  // ── Registration form ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-slate-50 flex flex-col">
      <header className="pt-10 pb-4 text-center">
        <BariQLogo />
      </header>

      <main className="flex-1 flex flex-col items-center px-5 py-4">
        <div className="w-full max-w-sm space-y-5">

          {/* Clinic header */}
          <div className="text-center">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">{info.clinic.name}</h1>
            {info.clinic.tagline && <p className="text-sm text-teal-600 font-medium mt-1">{info.clinic.tagline}</p>}
            {info.clinic.address && <p className="text-xs text-slate-400 mt-1">{info.clinic.address}</p>}
            <p className="text-slate-500 text-sm mt-3">Fill in your details to join the queue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* ── Date selection ─────────────────────────────────────────── */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> Select Date *
              </label>
              <div className="grid grid-cols-3 gap-2">
                {dateOptions.slice(0, 6).map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSelectedDate(opt.value)}
                    className={cn(
                      "py-2.5 px-2 rounded-2xl border-2 text-center transition-all text-xs font-semibold",
                      selectedDate === opt.value
                        ? "border-teal-500 bg-teal-50 text-teal-800"
                        : "border-slate-200 bg-white text-slate-600 hover:border-teal-200"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Doctor selection ───────────────────────────────────────── */}
            {doctors.length > 1 && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Select Doctor *</label>
                <div className="space-y-2">
                  {doctors.map(doc => {
                    const hasSlots = doc.slots.length > 0;
                    return (
                      <button
                        key={doc.id}
                        type="button"
                        onClick={() => hasSlots && setSelectedDoctorId(doc.id)}
                        disabled={!hasSlots}
                        className={cn(
                          "w-full flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all",
                          !hasSlots && "opacity-40 cursor-not-allowed border-slate-100 bg-slate-50",
                          hasSlots && selectedDoctorId === doc.id && "border-teal-500 bg-teal-50",
                          hasSlots && selectedDoctorId !== doc.id && "border-slate-200 bg-white hover:border-teal-200"
                        )}
                      >
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-black text-sm",
                          selectedDoctorId === doc.id ? "bg-teal-500 text-white" : "bg-slate-100 text-slate-500"
                        )}>
                          {doc.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={cn("font-bold text-sm", selectedDoctorId === doc.id ? "text-teal-800" : "text-slate-800")}>
                            Dr. {doc.name}
                          </p>
                          <p className="text-xs text-slate-500 truncate">{doc.specialization}</p>
                          {!hasSlots && <p className="text-[10px] text-slate-400 mt-0.5">Not available on this day</p>}
                        </div>
                        {hasSlots && (
                          <div className={cn(
                            "w-5 h-5 rounded-full border-2 shrink-0 ml-auto flex items-center justify-center",
                            selectedDoctorId === doc.id ? "border-teal-500 bg-teal-500" : "border-slate-300"
                          )}>
                            {selectedDoctorId === doc.id && <div className="w-2 h-2 rounded-full bg-white" />}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Single doctor — just show who they'll see */}
            {doctors.length === 1 && (
              <div className={cn(
                "flex items-center gap-3 p-4 rounded-2xl border",
                doctors[0].slots.length > 0
                  ? "bg-teal-50 border-teal-100"
                  : "bg-slate-50 border-slate-200 opacity-60"
              )}>
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                  doctors[0].slots.length > 0 ? "bg-teal-500" : "bg-slate-300"
                )}>
                  <Stethoscope className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className={cn("text-xs font-semibold uppercase tracking-wider", doctors[0].slots.length > 0 ? "text-teal-600" : "text-slate-400")}>Consulting</p>
                  <p className={cn("font-bold", doctors[0].slots.length > 0 ? "text-teal-900" : "text-slate-500")}>Dr. {doctors[0].name}</p>
                  <p className={cn("text-xs", doctors[0].slots.length > 0 ? "text-teal-600" : "text-slate-400")}>
                    {doctors[0].slots.length > 0 ? doctors[0].specialization : "Not available on this day"}
                  </p>
                </div>
              </div>
            )}

            {/* ── Time slot selection ────────────────────────────────────── */}
            {selectedDoctorId && (() => {
              if (selectedDoctorSlots.length === 0) {
                return (
                  <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-100">
                    <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                    <p className="text-sm text-amber-700">No available slots for this day. Please select another date.</p>
                  </div>
                );
              }
              if (selectedDoctorSlots.length === 1) {
                return (
                  <div className="flex items-center gap-3 p-4 rounded-2xl bg-teal-50 border border-teal-100">
                    <div className="w-10 h-10 rounded-xl bg-teal-500 flex items-center justify-center shrink-0">
                      <Clock className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-xs text-teal-600 font-semibold uppercase tracking-wider">Time Slot</p>
                      <p className="font-bold text-teal-900">{formatSlot(selectedDoctorSlots[0])}</p>
                    </div>
                  </div>
                );
              }
              return (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Select Time Slot *</label>
                  <div className="space-y-2">
                    {selectedDoctorSlots.map(slot => (
                      <button
                        key={slot.start}
                        type="button"
                        onClick={() => setSelectedSlot(slot.start)}
                        className={cn(
                          "w-full flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all",
                          selectedSlot === slot.start
                            ? "border-teal-500 bg-teal-50"
                            : "border-slate-200 bg-white hover:border-teal-200"
                        )}
                      >
                        <Clock className={cn("w-5 h-5 shrink-0", selectedSlot === slot.start ? "text-teal-500" : "text-slate-400")} />
                        <p className={cn("font-bold text-sm", selectedSlot === slot.start ? "text-teal-800" : "text-slate-800")}>
                          {formatSlot(slot)}
                        </p>
                        <div className={cn(
                          "w-5 h-5 rounded-full border-2 shrink-0 ml-auto flex items-center justify-center",
                          selectedSlot === slot.start ? "border-teal-500 bg-teal-500" : "border-slate-300"
                        )}>
                          {selectedSlot === slot.start && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Full Name *</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3.5 rounded-2xl border-2 border-slate-200 bg-white text-slate-900 text-sm font-medium placeholder:text-slate-300 focus:outline-none focus:border-teal-400 transition-colors"
                />
              </div>
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Mobile Number *</label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="tel"
                  required
                  placeholder="10-digit mobile number"
                  value={phone}
                  onChange={e => setPhone(e.target.value.replace(/[^\d\s\-+]/g, ""))}
                  className="w-full pl-10 pr-4 py-3.5 rounded-2xl border-2 border-slate-200 bg-white text-slate-900 text-sm font-medium placeholder:text-slate-300 focus:outline-none focus:border-teal-400 transition-colors"
                  maxLength={13}
                />
              </div>
              {phone && phone.replace(/\D/g, "").length < 10 && (
                <p className="text-xs text-red-500 pl-1">Please enter a valid 10-digit number</p>
              )}
            </div>

            {/* Reason (optional) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Reason for Visit <span className="text-slate-300 font-normal normal-case">(optional)</span>
              </label>
              <div className="relative">
                <MessageSquare className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                <textarea
                  placeholder="e.g. Fever, Follow-up, General checkup…"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  rows={2}
                  className="w-full pl-10 pr-4 py-3.5 rounded-2xl border-2 border-slate-200 bg-white text-slate-900 text-sm font-medium placeholder:text-slate-300 focus:outline-none focus:border-teal-400 transition-colors resize-none"
                />
              </div>
            </div>

            {/* Error */}
            {registerMutation.isError && (
              <div className="flex items-center gap-2 p-3.5 rounded-xl bg-red-50 border border-red-200">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <p className="text-sm text-red-600">{(registerMutation.error as Error).message}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={
                registerMutation.isPending ||
                !name.trim() ||
                phone.replace(/\D/g, "").length < 10 ||
                !selectedDoctorId ||
                selectedDoctorSlots.length === 0 ||
                (selectedDoctorSlots.length > 1 && !selectedSlot)
              }
              className={cn(
                "w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-base transition-all shadow-lg",
                "bg-teal-600 text-white shadow-teal-200 hover:bg-teal-700",
                "disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
              )}
            >
              {registerMutation.isPending ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Registering…</>
              ) : (
                <>Join Queue <ChevronRight className="w-5 h-5" /></>
              )}
            </button>

            <p className="text-center text-xs text-slate-400">
              By registering, you agree to share your name and phone for queue management.
            </p>
          </form>
        </div>
      </main>

      <footer className="pb-8 text-center">
        <p className="text-slate-400 text-xs">Powered by <span className="font-semibold text-slate-500">BariQ</span> — Your Turn, Simplified</p>
      </footer>
    </div>
  );
}
