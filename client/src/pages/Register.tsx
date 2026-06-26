import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Loader2, CheckCircle, User, Phone, Stethoscope, MessageSquare, ChevronRight, AlertCircle, ExternalLink, Calendar, Hash } from "lucide-react";
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

type KioskInfo = {
  clinic: { name: string; tagline: string | null; address: string | null };
  doctors: { id: string; name: string; specialization: string; availableToday: boolean }[];
};

function todayStr() {
  return format(new Date(), "yyyy-MM-dd");
}

type RegistrationResult = {
  alreadyRegistered: boolean;
  patientName: string;
  doctorName: string;
  queueNumber: number | null;
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
  const queryClient = useQueryClient();

  const [step, setStep] = useState<"form" | "success">("form");
  const [selectedDate, setSelectedDate] = useState<string>(todayStr());
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<RegistrationResult | null>(null);

  // Phone-first patient lookup
  const [selectedExistingId, setSelectedExistingId] = useState<number | null>(null);
  const [addingNew, setAddingNew] = useState(false);

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

  const phoneDigits = phone.replace(/\D/g, "").slice(-10);
  const phoneReady = phoneDigits.length >= 10;

  const { data: lookupData } = useQuery<{ patients: { id: number; name: string }[] }>({
    queryKey: ["kiosk-lookup", token, phoneDigits],
    queryFn: async () => {
      const res = await fetch(`/api/kiosk/${token}/lookup?phone=${phoneDigits}`);
      if (!res.ok) return { patients: [] };
      return res.json();
    },
    enabled: !!token && phoneReady,
    staleTime: 30000,
  });

  const lookedUpPatients = lookupData?.patients ?? [];

  const { data: queuePreview } = useQuery<{ nextQueueNumber: number; activeAhead: number }>({
    queryKey: ["kiosk-preview", token, selectedDoctorId, selectedDate],
    queryFn: async () => {
      const res = await fetch(`/api/kiosk/${token}/queue-preview?doctorId=${selectedDoctorId}&date=${selectedDate}`);
      if (!res.ok) throw new Error("preview failed");
      return res.json();
    },
    enabled: !!token && !!selectedDoctorId,
    staleTime: 0,
    gcTime: 0,
    refetchInterval: 10000,
  });

  // Live queue data for success screen (today's bookings only)
  const isSuccessToday = step === "success" && !!result?.queueToken && selectedDate === todayStr();
  const { data: liveQueue } = useQuery({
    queryKey: ["queue", result?.queueToken],
    queryFn: async () => {
      const res = await fetch(`/api/queue/${result!.queueToken}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: isSuccessToday,
    refetchInterval: 10000,
    staleTime: 0,
  });

  // SSE: push live queue updates to the success screen
  useEffect(() => {
    if (!isSuccessToday || !selectedDoctorId) return;
    const es = new EventSource(`/api/sse/doctor/${selectedDoctorId}`);
    es.onmessage = (e) => {
      if (e.data === "connected") return;
      queryClient.invalidateQueries({ queryKey: ["queue", result?.queueToken] });
    };
    return () => es.close();
  }, [isSuccessToday, selectedDoctorId, result?.queueToken, queryClient]);

  const doctors = info?.doctors ?? [];

  // Reset doctor when date changes
  useEffect(() => {
    setSelectedDoctorId("");
  }, [selectedDate]);

  // Auto-select when only one doctor
  useEffect(() => {
    if (info?.doctors?.length === 1) {
      setSelectedDoctorId(prev => prev || info!.doctors[0].id);
    }
  }, [info]);

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
          date: selectedDate,
          ...(selectedExistingId ? { patientId: selectedExistingId } : {}),
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
    if (!phoneReady) return;
    if (!selectedDoctorId) return;
    if (!name.trim()) return;
    registerMutation.mutate();
  };

  const selectedDoctor = doctors.find(d => d.id === selectedDoctorId);

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
                <div className="text-7xl font-black text-white leading-none tracking-tighter mb-1">
                  #{result.queueNumber ?? result.queuePosition}
                </div>
                <p className="text-teal-100/70 text-sm font-semibold">Your token number</p>

                {/* Live queue position (today only) */}
                {selectedDate === todayStr() && (
                  <div className="mt-4 pt-4 border-t border-white/20">
                    {liveQueue ? (
                      liveQueue.status === "completed" ? (
                        <p className="text-green-200 font-bold text-sm">Consultation complete!</p>
                      ) : liveQueue.status === "in_progress" ? (
                        <p className="text-teal-100 font-bold text-sm animate-pulse">With doctor now</p>
                      ) : liveQueue.position === 1 ? (
                        <p className="text-amber-200 font-bold text-sm">You're up next!</p>
                      ) : (
                        <p className="text-teal-100/80 text-sm">
                          <span className="font-bold text-white text-lg">{liveQueue.aheadCount}</span>{" "}
                          {liveQueue.aheadCount === 1 ? "person" : "people"} ahead of you
                        </p>
                      )
                    ) : (
                      <div className="flex items-center justify-center gap-1.5">
                        <div className="w-1.5 h-1.5 bg-teal-300/50 rounded-full animate-pulse" />
                        <p className="text-teal-100/60 text-xs">Loading live position…</p>
                      </div>
                    )}
                    <div className="flex items-center justify-center gap-1.5 mt-2">
                      <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                      <p className="text-teal-100/50 text-xs">Live updates</p>
                    </div>
                  </div>
                )}
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
                setSelectedDoctorId("");
                setSelectedExistingId(null); setAddingNew(false);
              }}
              className="w-full py-3 text-sm text-slate-400 hover:text-slate-600 transition-colors"
            >
              Register another patient
            </button>
          </div>
        </main>

        <footer className="pb-8 text-center">
          <p className="text-slate-400 text-xs">Powered by <span className="font-semibold text-slate-500">BariQ</span> · Your Turn, Simplified</p>
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
                  {doctors.map(doc => (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => setSelectedDoctorId(doc.id)}
                      className={cn(
                        "w-full flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all",
                        selectedDoctorId === doc.id ? "border-teal-500 bg-teal-50" : "border-slate-200 bg-white hover:border-teal-200"
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
                      </div>
                      <div className={cn(
                        "w-5 h-5 rounded-full border-2 shrink-0 ml-auto flex items-center justify-center",
                        selectedDoctorId === doc.id ? "border-teal-500 bg-teal-500" : "border-slate-300"
                      )}>
                        {selectedDoctorId === doc.id && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Single doctor — just show who they'll see */}
            {doctors.length === 1 && (
              <div className="flex items-center gap-3 p-4 rounded-2xl border bg-teal-50 border-teal-100">
                <div className="w-10 h-10 rounded-xl bg-teal-500 flex items-center justify-center shrink-0">
                  <Stethoscope className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-teal-600">Consulting</p>
                  <p className="font-bold text-teal-900">Dr. {doctors[0].name}</p>
                  <p className="text-xs text-teal-600">{doctors[0].specialization}</p>
                </div>
              </div>
            )}

            {/* Phone (first) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Mobile Number *</label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="tel"
                  required
                  placeholder="10-digit mobile number"
                  value={phone}
                  onChange={e => {
                    setPhone(e.target.value.replace(/[^\d\s\-+]/g, ""));
                    setSelectedExistingId(null);
                    setAddingNew(false);
                    setName("");
                  }}
                  className="w-full pl-10 pr-4 py-3.5 rounded-2xl border-2 border-slate-200 bg-white text-slate-900 text-sm font-medium placeholder:text-slate-300 focus:outline-none focus:border-teal-400 transition-colors"
                  maxLength={13}
                />
              </div>
              {phone && !phoneReady && (
                <p className="text-xs text-red-500 pl-1">Please enter a valid 10-digit number</p>
              )}
            </div>

            {/* Patient name resolution (shown once phone is ready) */}
            {phoneReady && lookedUpPatients.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  {lookedUpPatients.length === 1 ? "Is this you?" : "Who is registering?"}
                </p>
                <div className="flex flex-wrap gap-2">
                  {lookedUpPatients.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { setSelectedExistingId(p.id); setAddingNew(false); setName(p.name); }}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2.5 rounded-2xl border-2 text-sm font-semibold transition-all",
                        selectedExistingId === p.id
                          ? "border-teal-500 bg-teal-50 text-teal-800"
                          : "border-slate-200 bg-white text-slate-700 hover:border-teal-300"
                      )}
                    >
                      <span className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center text-xs font-black",
                        selectedExistingId === p.id ? "bg-teal-500 text-white" : "bg-slate-100 text-slate-500"
                      )}>
                        {p.name.charAt(0)}
                      </span>
                      {p.name}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => { setAddingNew(true); setSelectedExistingId(null); setName(""); }}
                    className={cn(
                      "flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border-2 text-sm font-semibold transition-all",
                      addingNew
                        ? "border-slate-600 bg-slate-700 text-white"
                        : "border-dashed border-slate-300 bg-white text-slate-500 hover:border-slate-400"
                    )}
                  >
                    <User className="w-3.5 h-3.5" /> Someone else
                  </button>
                </div>
              </div>
            )}

            {/* Name field — shown when no existing match, or user picks "someone else" */}
            {phoneReady && (lookedUpPatients.length === 0 || addingNew) && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Full Name *</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="e.g. Rahul Sharma"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full pl-10 pr-4 py-3.5 rounded-2xl border-2 border-slate-200 bg-white text-slate-900 text-sm font-medium placeholder:text-slate-300 focus:outline-none focus:border-teal-400 transition-colors"
                  />
                </div>
                {lookedUpPatients.length === 0 && (
                  <p className="text-xs text-slate-400 pl-1">New patient — we'll register you</p>
                )}
              </div>
            )}

            {/* If existing patient selected, show their name as read-only confirmation */}
            {phoneReady && selectedExistingId && !addingNew && (
              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-teal-50 border border-teal-100">
                <div className="w-9 h-9 rounded-xl bg-teal-500 text-white flex items-center justify-center font-black text-sm shrink-0">
                  {name.charAt(0)}
                </div>
                <div>
                  <p className="text-xs text-teal-600 font-semibold uppercase tracking-wider">Registering as</p>
                  <p className="font-bold text-teal-900">{name}</p>
                </div>
              </div>
            )}

            {!phoneReady && (
              <p className="text-xs text-slate-400 text-center py-2">Enter your mobile number to continue</p>
            )}

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

            {/* Queue number preview */}
            {selectedDoctorId && queuePreview && (
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-teal-600 text-white shadow-lg shadow-teal-200">
                <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
                  <span className="text-2xl font-black">#{queuePreview.nextQueueNumber}</span>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-teal-200">Your Token Number</p>
                  <p className="font-bold text-base">You will get token #{queuePreview.nextQueueNumber}</p>
                  <p className="text-xs text-teal-200 mt-0.5">
                    {queuePreview.activeAhead === 0
                      ? "You'll be first in queue!"
                      : `${queuePreview.activeAhead} patient${queuePreview.activeAhead === 1 ? "" : "s"} ahead of you`}
                  </p>
                </div>
              </div>
            )}

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
                !phoneReady ||
                !name.trim() ||
                !selectedDoctorId
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
        <p className="text-slate-400 text-xs">Powered by <span className="font-semibold text-slate-500">BariQ</span> · Your Turn, Simplified</p>
      </footer>
    </div>
  );
}
