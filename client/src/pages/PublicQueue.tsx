import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useState, useEffect, useRef } from "react";
import { Loader2, Clock, Users, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";

function getInitials(name: string): string {
  return name.trim().split(/\s+/).map(n => n[0] || "").join("").toUpperCase().slice(0, 2) || "?";
}

export default function PublicQueue() {
  const [, params] = useRoute("/queue/:doctorId");
  const doctorId = params?.doctorId;

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const { data, isLoading, refetch } = useQuery<{ doctor: any; queue: any[] }>({
    queryKey: ["public-queue", doctorId],
    queryFn: async () => {
      const res = await fetch(`/api/public-queue/${doctorId}`);
      if (!res.ok) throw new Error("Doctor not found");
      return res.json();
    },
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
    staleTime: 0,
    enabled: !!doctorId,
  });

  // SSE: get pushed updates immediately when queue changes
  const esRef = useRef<EventSource | null>(null);
  useEffect(() => {
    if (!doctorId) return;
    const es = new EventSource(`/api/sse/doctor/${doctorId}`);
    esRef.current = es;
    es.onmessage = () => refetch();
    return () => { es.close(); esRef.current = null; };
  }, [doctorId, refetch]);

  const doctor = data?.doctor;
  const queue = data?.queue || [];

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-950">
        <Loader2 className="animate-spin text-teal-400 w-10 h-10" />
      </div>
    );
  }

  if (!doctor) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-950 px-6">
        <div className="text-center">
          <p className="text-2xl font-bold text-white mb-2">Doctor not found</p>
          <p className="text-slate-500 text-sm">Check the URL and try again</p>
        </div>
      </div>
    );
  }

  const doctorName =
    doctor.name ||
    [doctor.firstName, doctor.lastName].filter(Boolean).join(" ") ||
    "Doctor";
  const specialization = doctor.doctorProfile?.specialization || "General Physician";
  const currentPatient = queue.find((a: any) => a.status === "in_progress");
  const waitingList = queue
    .filter((a: any) => a.status === "checked_in" || a.status === "booked")
    .sort((a: any, b: any) => (a.queuePosition ?? Infinity) - (b.queuePosition ?? Infinity));

  const avgConsultTime = doctor.doctorProfile?.avgConsultationTime || 15;
  const totalWaitMins = waitingList.length * avgConsultTime;

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 sm:px-10 py-4 border-b border-slate-800/60">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center font-black text-white text-lg shadow-lg shadow-teal-900/50">
            B
          </div>
          <div>
            <p className="font-black text-white text-lg leading-none tracking-tight">BariQ</p>
            <p className="text-slate-600 text-[10px] uppercase tracking-widest font-medium">Queue Display</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Wifi className="w-4 h-4 text-green-400" />
          <span className="text-green-400 text-sm font-semibold hidden sm:inline">Live</span>
          <span className="text-slate-700 text-sm">•</span>
          <span className="text-slate-400 text-sm tabular-nums font-medium">
            {format(now, "hh:mm:ss a")}
          </span>
        </div>
      </header>

      {/* Main */}
      <div className="flex-1 flex flex-col items-center px-5 sm:px-8 py-10 w-full max-w-4xl mx-auto">

        {/* Doctor info */}
        <div className="text-center mb-10">
          <div className="w-24 h-24 rounded-3xl mx-auto mb-5 flex items-center justify-center bg-gradient-to-br from-teal-700/30 to-slate-800 border border-teal-500/20 shadow-2xl shadow-teal-900/30">
            <span className="text-teal-200 font-black text-4xl tracking-tighter">
              {getInitials(doctorName)}
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white mb-1">
            Dr. {doctorName}
          </h1>
          <p className="text-teal-400 font-semibold text-base sm:text-lg">{specialization}</p>
        </div>

        {/* Now Serving + Stats */}
        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
          {/* Now Serving */}
          <div className="bg-gradient-to-br from-teal-600 via-teal-700 to-teal-800 rounded-3xl shadow-2xl shadow-teal-900/60 flex flex-col justify-between min-h-[180px] overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none rounded-3xl" />
            <div className="px-8 pt-8">
              <p className="text-teal-200/60 text-[10px] uppercase tracking-[0.25em] font-bold mb-4">
                Now Serving
              </p>
              {currentPatient ? (
                <div className="text-7xl font-black tracking-tighter text-white leading-none">
                  #{currentPatient.queuePosition}
                </div>
              ) : (
                <div>
                  <div className="w-10 h-1 bg-teal-300/30 rounded mb-3" />
                  <p className="text-teal-100/60 text-xl font-bold">No active consultation</p>
                </div>
              )}
            </div>
            <div className="px-8 pb-8 pt-3">
              <p className="text-teal-100/80 text-sm font-medium">
                {currentPatient
                  ? `Token #${currentPatient.queuePosition} · Please proceed`
                  : "Waiting for next patient"}
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800/60 rounded-2xl p-5 sm:p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700/50 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 text-teal-400" />
              </div>
              <div>
                <p className="text-3xl font-black text-white">{waitingList.length}</p>
                <p className="text-slate-500 text-sm font-medium">Patients in queue</p>
              </div>
            </div>
            <div className="bg-slate-900 border border-slate-800/60 rounded-2xl p-5 sm:p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700/50 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 text-teal-400" />
              </div>
              <div>
                <p className="text-3xl font-black text-white">
                  {totalWaitMins}{" "}
                  <span className="text-xl font-semibold text-slate-500">min</span>
                </p>
                <p className="text-slate-500 text-sm font-medium">Estimated total wait</p>
              </div>
            </div>
          </div>
        </div>

        {/* Queue list */}
        {waitingList.length > 0 && (
          <div className="w-full">
            <p className="text-slate-600 text-[10px] uppercase tracking-[0.2em] font-bold mb-4 px-1">
              Up Next
            </p>
            <div className="space-y-3">
              {waitingList.slice(0, 5).map((apt: any, idx: number) => {
                const isCheckedIn = apt.status === "checked_in";
                const isFirst = idx === 0;
                return (
                  <div
                    key={apt.id}
                    className={cn(
                      "flex items-center justify-between px-5 py-4 rounded-2xl border transition-colors",
                      isFirst && isCheckedIn
                        ? "bg-green-900/20 border-green-700/30"
                        : isFirst
                        ? "bg-amber-900/15 border-amber-700/30"
                        : "bg-slate-900 border-slate-800/60"
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-11 h-11 rounded-xl flex items-center justify-center font-black text-base shrink-0",
                        isFirst && isCheckedIn ? "bg-green-600 text-white" :
                        isFirst ? "bg-amber-600 text-white" :
                        "bg-slate-800 text-slate-400"
                      )}>
                        {apt.queuePosition ?? idx + 1}
                      </div>
                      <div>
                        <p className={cn(
                          "font-bold text-base",
                          isFirst && isCheckedIn ? "text-green-300" :
                          isFirst ? "text-amber-300" :
                          "text-slate-200"
                        )}>
                          Token #{apt.queuePosition ?? idx + 1}
                        </p>
                        <p className="text-slate-600 text-sm">
                          Est. wait: ~{(idx + 1) * avgConsultTime} min
                        </p>
                      </div>
                    </div>
                    <span className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide",
                      isFirst && isCheckedIn ? "bg-green-500/20 text-green-400" :
                      isFirst ? "bg-amber-500/20 text-amber-400" :
                      isCheckedIn ? "bg-teal-500/20 text-teal-400" :
                      "bg-slate-800 text-slate-500"
                    )}>
                      {isFirst && isCheckedIn ? "Up next" :
                       isFirst ? "Soon" :
                       isCheckedIn ? "Paid" :
                       "Waiting"}
                    </span>
                  </div>
                );
              })}
              {waitingList.length > 5 && (
                <p className="text-center text-slate-600 text-sm pt-2">
                  +{waitingList.length - 5} more in queue
                </p>
              )}
            </div>
          </div>
        )}

        {waitingList.length === 0 && !currentPatient && (
          <div className="text-center mt-8">
            <div className="w-16 h-16 bg-slate-900 border border-slate-800 rounded-2xl mx-auto mb-4 flex items-center justify-center">
              <Users className="w-8 h-8 text-slate-700" />
            </div>
            <p className="text-slate-400 text-xl font-semibold">No patients in queue</p>
            <p className="text-slate-600 text-sm mt-1">Waiting for check-ins</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="px-8 py-4 border-t border-slate-800/60 text-center">
        <p className="text-slate-700 text-xs">
          Powered by <span className="text-slate-500 font-semibold">BariQ</span> · Your Turn, Simplified
        </p>
      </footer>
    </div>
  );
}
