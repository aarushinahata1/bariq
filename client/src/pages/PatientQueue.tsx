import { useParams } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Loader2, CheckCircle, Stethoscope, Bell, Clock, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

function getInitials(name: string): string {
  return name.trim().split(/\s+/).map(n => n[0] || "").join("").toUpperCase().slice(0, 2) || "?";
}

function BariQLogo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center font-black text-white text-sm shadow-lg shadow-teal-900/50">
        B
      </div>
      <span className="font-black text-white text-xl tracking-tight">BariQ</span>
    </div>
  );
}

const BG = "min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 flex flex-col";

function StatusCard({ data }: { data: any }) {
  const isExpired = data.expired === true;
  const isCancelled = data.status === "cancelled" || data.status === "no_show";
  const isNotToday = data.notInTodayQueue === true;
  const isCompleted = data.status === "completed";
  const isWithDoctor = data.status === "in_progress";
  const isNext = data.position === 1 && !isWithDoctor && !isCompleted;
  const aheadCount: number = data.aheadCount ?? Math.max(0, data.position - 1);
  const patientName: string = data.patientName || "Patient";
  const doctorName: string = data.doctorName || "Doctor";

  if (isExpired || isCancelled || isNotToday) {
    return (
      <div className={cn(BG, "items-center justify-center px-6")}>
        <div className="w-full max-w-sm text-center">
          <BariQLogo />
          <div className="mt-10 bg-white/5 backdrop-blur-sm rounded-3xl p-10 border border-white/10">
            <div className={cn(
              "w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center",
              isCancelled ? "bg-red-500/20" : "bg-slate-700/30"
            )}>
              {isCancelled
                ? <XCircle className="w-8 h-8 text-red-400" />
                : <Clock className="w-8 h-8 text-slate-400" />}
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">
              {isCancelled ? "Appointment Cancelled" : isNotToday ? "Not in Today's Queue" : "Queue Session Ended"}
            </h1>
            <p className="text-white/60 text-sm mb-1">{patientName}</p>
            <p className="text-teal-400/60 text-sm mb-4">Dr. {doctorName}</p>
            <p className="text-white/40 text-sm leading-relaxed">
              {isCancelled
                ? "This appointment was cancelled or marked as no-show."
                : isNotToday
                ? "This appointment isn't part of today's queue — it may have been rescheduled. Please check with the clinic for your updated time."
                : "This queue link has expired. Please visit the clinic for assistance."}
            </p>
          </div>
          <p className="text-white/20 text-xs mt-8">
            Powered by <span className="text-white/30 font-semibold">BariQ</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={BG}>
      <header className="flex items-center justify-center pt-10 pb-2">
        <BariQLogo />
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-5 py-8">
        <div className="w-full max-w-sm space-y-5">

          {/* Patient avatar + info */}
          <div className="text-center">
            <div className="w-20 h-20 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-gradient-to-br from-teal-600/30 to-teal-900/50 border border-teal-500/20 shadow-xl shadow-teal-900/30">
              <span className="text-teal-200 font-black text-2xl tracking-tighter">
                {getInitials(patientName)}
              </span>
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">{patientName}</h2>
            <p className="text-teal-400 text-sm font-semibold mt-1">Dr. {doctorName}</p>
          </div>

          {/* Main status card */}
          {isCompleted ? (
            <div className="bg-green-500/10 border border-green-500/25 rounded-3xl p-8 text-center">
              <div className="w-14 h-14 bg-green-500/20 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                <CheckCircle className="w-7 h-7 text-green-400" />
              </div>
              <p className="text-green-300 font-bold text-xl">Consultation Complete</p>
              <p className="text-green-400/60 text-sm mt-1">Thank you for your visit!</p>
            </div>
          ) : isWithDoctor ? (
            <div className="bg-teal-500/10 border border-teal-400/25 rounded-3xl p-8 text-center">
              <div className="w-14 h-14 bg-teal-500/20 rounded-2xl mx-auto mb-4 flex items-center justify-center animate-pulse">
                <Stethoscope className="w-7 h-7 text-teal-300" />
              </div>
              <p className="text-teal-200 font-bold text-xl">With Doctor Now</p>
              <p className="text-teal-400/60 text-sm mt-1">Please proceed to the consultation room</p>
            </div>
          ) : isNext ? (
            <div className="bg-amber-500/10 border border-amber-400/25 rounded-3xl p-8 text-center">
              <div className="w-14 h-14 bg-amber-500/20 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                <Bell className="w-7 h-7 text-amber-300" />
              </div>
              <p className="text-amber-200 font-bold text-xl">You're Next!</p>
              <p className="text-amber-400/60 text-sm mt-1">Please be ready at the waiting area</p>
            </div>
          ) : (
            <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8 text-center overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-teal-500/10 to-transparent pointer-events-none rounded-3xl" />
              <p className="text-white/40 text-[10px] uppercase tracking-[0.25em] font-bold mb-3">
                Your Token Number
              </p>
              <div className="text-[88px] font-black text-white leading-none mb-2 tracking-tighter">
                #{data.queueNumber ?? data.queuePosition}
              </div>
              <p className="text-teal-300 text-sm font-medium">
                {aheadCount === 0
                  ? "You're up next!"
                  : aheadCount === 1
                  ? "1 person ahead of you"
                  : `${aheadCount} people ahead of you`}
              </p>
            </div>
          )}

          {/* Status badge */}
          <div className={cn(
            "flex items-center justify-center gap-2.5 py-3 px-5 rounded-2xl text-sm font-semibold border",
            isCompleted ? "bg-green-500/10 text-green-300 border-green-500/20" :
            isWithDoctor ? "bg-teal-500/10 text-teal-300 border-teal-500/20" :
            isNext ? "bg-amber-500/10 text-amber-300 border-amber-500/20" :
            "bg-white/5 text-white/50 border-white/10"
          )}>
            <div className={cn(
              "w-2 h-2 rounded-full shrink-0",
              isCompleted ? "bg-green-400" :
              isWithDoctor ? "bg-teal-400 animate-pulse" :
              isNext ? "bg-amber-400 animate-pulse" :
              "bg-slate-500"
            )} />
            {isCompleted ? "Consulted" :
             isWithDoctor ? "In Consultation" :
             isNext ? "Get Ready" :
             `Token #${data.queueNumber ?? data.queuePosition}`}
          </div>

          {/* Live indicator */}
          <div className="flex items-center justify-center gap-2 text-xs text-white/25">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            Live updates
          </div>
        </div>
      </main>

      <footer className="pb-8 text-center">
        <p className="text-white/20 text-xs">
          Powered by <span className="text-white/35 font-semibold">BariQ</span>
        </p>
      </footer>
    </div>
  );
}

export default function PatientQueue() {
  const { token } = useParams();
  const queryClient = useQueryClient();

  // Own identity — resolved once from the private token, never polled.
  const { data: identity, isLoading, error } = useQuery({
    queryKey: ["queue-identity", token],
    queryFn: async () => {
      const res = await fetch(`/api/queue/${token}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error("Queue not found");
        throw new Error("Failed to load queue status");
      }
      return res.json();
    },
    staleTime: Infinity,
  });

  const doctorId = identity?.doctorId;
  const expired = identity?.expired === true;

  // Shared board — the same query every patient (and the waiting-room TV) reads for
  // this doctor. Server-cached and pushed via SSE below, so N patients no longer
  // each trigger their own per-token DB scan every few seconds.
  const { data: board, isLoading: isBoardLoading } = useQuery<{ queue: any[] }>({
    queryKey: ["public-queue", doctorId],
    queryFn: async () => {
      const res = await fetch(`/api/public-queue/${doctorId}`);
      if (!res.ok) throw new Error("Failed to load queue board");
      return res.json();
    },
    enabled: !!doctorId && !expired,
    refetchInterval: 60000, // safety net only — SSE below drives real-time updates
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  // SSE: get pushed updates immediately when the doctor's queue changes.
  // Auto-reconnects on error with a 5-second delay so live updates survive transient drops.
  useEffect(() => {
    if (!doctorId) return;
    let es: EventSource;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      es = new EventSource(`/api/sse/doctor/${doctorId}`);
      es.onmessage = (e) => {
        if (e.data === "connected") return;
        queryClient.invalidateQueries({ queryKey: ["public-queue", doctorId] });
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
  }, [doctorId, queryClient]);

  if (isLoading || (!!doctorId && !expired && isBoardLoading)) {
    return (
      <div className={cn(BG, "items-center justify-center")}>
        <div className="text-center">
          <Loader2 className="animate-spin text-teal-400 w-10 h-10 mx-auto mb-3" />
          <p className="text-white/40 text-sm">Loading your queue status...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn(BG, "items-center justify-center px-6")}>
        <div className="bg-white/5 backdrop-blur-sm rounded-3xl p-10 text-center max-w-sm border border-white/10">
          <div className="w-14 h-14 bg-red-500/20 rounded-2xl mx-auto mb-4 flex items-center justify-center">
            <XCircle className="w-7 h-7 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Queue Not Found</h1>
          <p className="text-white/40 text-sm">
            {error instanceof Error ? error.message : "Check your link and try again"}
          </p>
        </div>
      </div>
    );
  }

  // Find our own row in the shared board — it carries the freshest status/position
  // (e.g. after a doctor reorders the queue), falling back to the one-time identity
  // fetch when the board hasn't loaded yet.
  const ownRow = board?.queue.find((a: any) => a.id === identity.id);
  const status = ownRow?.status ?? identity.status;
  const queuePosition = ownRow?.queuePosition ?? identity.queuePosition;
  const queueNumber = ownRow?.queueNumber ?? identity.queueNumber;
  const isDone = status === "completed" || status === "cancelled" || status === "no_show";

  // Board loaded but doesn't contain this appointment (rescheduled to a different day,
  // or deleted) and it isn't already in a terminal state — there's no live position to
  // show, so surface that plainly instead of a stale/misleading fallback number.
  const notInTodayQueue = !!board && !ownRow && !isDone;

  // Only count patients still actively waiting (booked or paid/checked_in). Excluding
  // in_progress means: once the doctor starts seeing the patient ahead of you, your
  // position immediately reflects that you are next.
  const aheadCount = board && !notInTodayQueue
    ? board.queue.filter((a: any) =>
        a.queuePosition !== null &&
        a.queuePosition < (queuePosition ?? 0) &&
        (a.status === "booked" || a.status === "checked_in")
      ).length
    : 0;

  const data = {
    expired,
    notInTodayQueue,
    patientName: identity.patientName,
    doctorName: identity.doctorName,
    status,
    queueNumber,
    queuePosition,
    aheadCount: isDone ? 0 : aheadCount,
    position: isDone ? 0 : aheadCount + 1,
  };

  return <StatusCard data={data} />;
}
