import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

function StatusCard({ data }: { data: any }) {
  const isCompleted = data.status === "completed";
  const isWithDoctor = data.status === "in_progress" || data.position === 0;
  const isNext = data.position === 1 && !isWithDoctor;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex flex-col">
      {/* BariQ header */}
      <div className="flex items-center justify-center pt-10 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-500 flex items-center justify-center font-black text-white text-base">B</div>
          <span className="font-black text-white text-xl tracking-tight">BariQ</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <div className="w-full max-w-sm">
          {/* Patient info */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-white/10 rounded-2xl mx-auto mb-4 flex items-center justify-center">
              <span className="text-3xl">👤</span>
            </div>
            <h2 className="text-2xl font-black text-white">{data.patientName}</h2>
            <p className="text-blue-300 text-sm font-medium mt-1">Dr. {data.doctorName}</p>
          </div>

          {/* Position card */}
          {isCompleted ? (
            <div className="bg-green-500/20 border-2 border-green-400/40 rounded-3xl p-8 text-center mb-6">
              <div className="text-5xl mb-3">✅</div>
              <p className="text-green-300 font-bold text-xl">Consultation Complete</p>
              <p className="text-green-400/70 text-sm mt-1">Thank you for your visit!</p>
            </div>
          ) : isWithDoctor ? (
            <div className="bg-blue-500/20 border-2 border-blue-400/40 rounded-3xl p-8 text-center mb-6 animate-pulse">
              <div className="text-5xl mb-3">👨‍⚕️</div>
              <p className="text-blue-200 font-bold text-xl">With Doctor Now</p>
              <p className="text-blue-300/70 text-sm mt-1">Please proceed to consultation room</p>
            </div>
          ) : isNext ? (
            <div className="bg-yellow-500/20 border-2 border-yellow-400/40 rounded-3xl p-8 text-center mb-6">
              <div className="text-5xl mb-3">🔔</div>
              <p className="text-yellow-200 font-bold text-xl">You're Next!</p>
              <p className="text-yellow-300/70 text-sm mt-1">Please be ready at the waiting area</p>
            </div>
          ) : (
            <div className="bg-white/10 rounded-3xl p-8 text-center mb-6 backdrop-blur-sm border border-white/10">
              <p className="text-white/50 text-xs uppercase tracking-[0.2em] font-bold mb-3">Your Position</p>
              <div className="text-8xl font-black text-white leading-none mb-2">{data.position}</div>
              <p className="text-blue-300 text-sm font-medium">ahead in queue</p>
            </div>
          )}

          {/* Status badge */}
          <div className={cn(
            "flex items-center justify-center gap-2 py-3 px-5 rounded-2xl text-sm font-semibold mb-8",
            isCompleted ? "bg-green-500/20 text-green-300" :
            isWithDoctor ? "bg-blue-500/20 text-blue-300" :
            isNext ? "bg-yellow-500/20 text-yellow-300" :
            "bg-white/10 text-white/70"
          )}>
            <div className={cn(
              "w-2 h-2 rounded-full",
              isCompleted ? "bg-green-400" :
              isWithDoctor ? "bg-blue-400 animate-pulse" :
              isNext ? "bg-yellow-400 animate-pulse" :
              "bg-slate-400"
            )} />
            {isCompleted ? "Consulted" :
             isWithDoctor ? "In Consultation" :
             isNext ? "Get Ready" :
             `Queue #${data.queuePosition}`}
          </div>

          {/* Auto-refresh note */}
          <div className="text-center">
            <div className="inline-flex items-center gap-2 text-xs text-white/30">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              Updates every 5 seconds
            </div>
          </div>
        </div>
      </div>

      <div className="pb-8 text-center">
        <p className="text-white/20 text-xs">
          Powered by <span className="text-white/40 font-semibold">BariQ</span>
        </p>
      </div>
    </div>
  );
}

export default function PatientQueue() {
  const { token } = useParams();

  const { data, isLoading, error } = useQuery({
    queryKey: ["queue", token],
    queryFn: async () => {
      const res = await fetch(`/api/queue/${token}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error("Queue not found");
        throw new Error("Failed to load queue status");
      }
      return res.json();
    },
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin text-blue-400 w-10 h-10 mx-auto mb-3" />
          <p className="text-white/40 text-sm">Loading your queue status...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center px-6">
        <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-10 text-center max-w-sm border border-white/10">
          <div className="text-5xl mb-4">🔍</div>
          <h1 className="text-2xl font-bold text-white mb-2">Queue Not Found</h1>
          <p className="text-white/50 text-sm">
            {error instanceof Error ? error.message : "Check your link and try again"}
          </p>
        </div>
      </div>
    );
  }

  return <StatusCard data={data} />;
}
