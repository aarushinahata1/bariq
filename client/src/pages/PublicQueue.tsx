import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, Clock, Users, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";

export default function PublicQueue() {
  const [, params] = useRoute("/queue/:doctorId");
  const doctorId = params?.doctorId;

  const { data, isLoading } = useQuery<{ doctor: any; queue: any[] }>({
    queryKey: ["public-queue", doctorId],
    queryFn: async () => {
      const res = await fetch(`/api/public-queue/${doctorId}`);
      if (!res.ok) throw new Error("Doctor not found");
      return res.json();
    },
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
    staleTime: 0,
    enabled: !!doctorId,
  });

  const doctor = data?.doctor;
  const queue = data?.queue || [];

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-900">
        <Loader2 className="animate-spin text-blue-400 w-10 h-10" />
      </div>
    );
  }

  if (!doctor) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-900">
        <div className="text-white text-center">
          <p className="text-2xl font-bold mb-2">Doctor not found</p>
          <p className="text-slate-400">Check the URL and try again</p>
        </div>
      </div>
    );
  }

  const currentPatient = queue.find((a: any) => a.status === "in_progress");
  const waitingList = queue.filter((a: any) => a.status === "checked_in");
  const avgConsultTime = doctor.doctorProfile?.avgConsultationTime || 15;
  const totalWaitMins = waitingList.length * avgConsultTime;

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center font-black text-white text-lg tracking-tight">B</div>
          <div>
            <p className="font-black text-white text-lg leading-none tracking-tight">BariQ</p>
            <p className="text-slate-500 text-[10px] uppercase tracking-widest font-medium">Queue Display</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Wifi className="w-4 h-4 text-green-500" />
          <span className="hidden sm:inline">Live</span>
          <span className="text-slate-600">•</span>
          <span>{format(new Date(), "hh:mm a")}</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10">
        {/* Doctor info */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-slate-800 text-5xl mb-5 shadow-2xl">👨‍⚕️</div>
          <h1 className="text-4xl font-black tracking-tight mb-1">Dr. {doctor.name}</h1>
          <p className="text-blue-400 font-semibold text-lg">
            {doctor.doctorProfile?.specialization || "General Physician"}
          </p>
        </div>

        <div className="w-full max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          {/* Now Serving */}
          <div className="bg-blue-600 rounded-3xl overflow-hidden shadow-2xl shadow-blue-900/50">
            <div className="px-8 pt-8 pb-4">
              <p className="text-blue-200 text-xs uppercase tracking-[0.2em] font-bold mb-3">NOW SERVING</p>
              {currentPatient ? (
                <div className="text-8xl font-black tracking-tighter leading-none">
                  {currentPatient.queuePosition ?? "#"}
                </div>
              ) : (
                <div className="py-6">
                  <p className="text-3xl font-bold text-blue-100 opacity-60">—</p>
                  <p className="text-blue-200 text-sm mt-2">No active consultation</p>
                </div>
              )}
            </div>
            <div className="px-8 pb-8 pt-2">
              {currentPatient ? (
                <p className="text-blue-100 font-semibold text-lg">
                  Token #{currentPatient.queuePosition} · Please proceed
                </p>
              ) : (
                <p className="text-blue-300 text-sm">Waiting for next patient</p>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="space-y-4">
            <div className="bg-slate-800 rounded-2xl p-6 flex items-center gap-5">
              <div className="w-14 h-14 rounded-2xl bg-slate-700 flex items-center justify-center shrink-0">
                <Users className="w-7 h-7 text-slate-300" />
              </div>
              <div>
                <p className="text-3xl font-black">{waitingList.length}</p>
                <p className="text-slate-400 text-sm font-medium">Patients in queue</p>
              </div>
            </div>
            <div className="bg-slate-800 rounded-2xl p-6 flex items-center gap-5">
              <div className="w-14 h-14 rounded-2xl bg-slate-700 flex items-center justify-center shrink-0">
                <Clock className="w-7 h-7 text-slate-300" />
              </div>
              <div>
                <p className="text-3xl font-black">{totalWaitMins} <span className="text-xl font-semibold text-slate-400">min</span></p>
                <p className="text-slate-400 text-sm font-medium">Estimated total wait</p>
              </div>
            </div>
          </div>
        </div>

        {/* Queue list */}
        {waitingList.length > 0 && (
          <div className="w-full max-w-3xl">
            <p className="text-slate-400 text-xs uppercase tracking-widest font-bold mb-4 px-1">Up Next</p>
            <div className="space-y-3">
              {waitingList.slice(0, 5).map((apt: any, idx: number) => (
                <div
                  key={apt.id}
                  className={cn(
                    "flex items-center justify-between p-5 rounded-2xl border transition-colors",
                    idx === 0
                      ? "bg-green-900/30 border-green-700/50"
                      : "bg-slate-800 border-slate-700/50"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg",
                      idx === 0 ? "bg-green-600 text-white" : "bg-slate-700 text-slate-300"
                    )}>
                      {apt.queuePosition ?? idx + 1}
                    </div>
                    <div>
                      <p className={cn("font-bold text-lg", idx === 0 ? "text-green-300" : "text-slate-200")}>
                        Token #{apt.queuePosition ?? idx + 1}
                      </p>
                      <p className="text-slate-500 text-sm">
                        Est. wait: ~{(idx + 1) * avgConsultTime} min
                      </p>
                    </div>
                  </div>
                  <span className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-bold uppercase",
                    idx === 0 ? "bg-green-600/30 text-green-400" : "bg-slate-700 text-slate-400"
                  )}>
                    {idx === 0 ? "You're next!" : "Waiting"}
                  </span>
                </div>
              ))}
              {waitingList.length > 5 && (
                <p className="text-center text-slate-500 text-sm pt-2">+{waitingList.length - 5} more in queue</p>
              )}
            </div>
          </div>
        )}

        {waitingList.length === 0 && !currentPatient && (
          <div className="text-center mt-4">
            <p className="text-slate-400 text-xl font-semibold">No patients in queue right now</p>
            <p className="text-slate-600 text-sm mt-1">Waiting for check-ins</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-8 py-4 border-t border-slate-800 text-center">
        <p className="text-slate-600 text-xs">
          Powered by <span className="text-slate-400 font-semibold">BariQ</span> — Your Turn, Simplified
        </p>
      </div>
    </div>
  );
}
