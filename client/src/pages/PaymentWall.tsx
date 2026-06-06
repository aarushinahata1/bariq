import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Clock, CheckCircle, XCircle, Stethoscope, Copy, AlertTriangle, RefreshCw, LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

const UPI_ID = "akshatnahata05@okibl";

const PLANS = [
  {
    key: "monthly",
    label: "Monthly",
    price: 4999,
    display: "₹4,999",
    per: "/month",
    note: "Cancel anytime",
    highlight: false,
  },
  {
    key: "quarterly",
    label: "Quarterly",
    price: 12999,
    display: "₹12,999",
    per: "/quarter",
    note: "Save ₹1,998 vs monthly",
    highlight: true,
  },
  {
    key: "annual",
    label: "Annual",
    price: 49999,
    display: "₹49,999",
    per: "/year",
    note: "Save ₹9,989 vs monthly",
    highlight: false,
  },
] as const;

type PlanKey = "monthly" | "quarterly" | "annual";

export default function PaymentWall() {
  const { clinic } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    qc.clear();
    localStorage.removeItem("medqueue-role");
    window.location.href = "/login";
  }
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>("quarterly");
  const [utr, setUtr] = useState("");
  const [copied, setCopied] = useState(false);

  // After auto-expire, planStatus is "expired" for both trial and subscription.
  // Use subscriptionEndsAt as the discriminator: if it exists, they were a paying subscriber.
  const wasSubscription = !!clinic?.subscriptionEndsAt;
  const trialExpired = !wasSubscription;

  const { data: payments = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/payments"],
    queryFn: () => apiRequest("GET", "/api/payments").then(r => r.json()),
  });

  const submit = useMutation({
    mutationFn: (body: { amount: number; utr: string; planType: string }) =>
      apiRequest("POST", "/api/payments", body).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/payments"] });
      toast({ title: "Payment request submitted", description: "Our team will verify and activate your account shortly." });
      setUtr("");
    },
    onError: (err: any) => {
      const raw = err?.message || "Submission failed";
      let msg = raw;
      try { msg = JSON.parse(raw.replace(/^\d+: /, "")).message || raw; } catch {}
      toast({ title: "Failed to submit", description: msg, variant: "destructive" });
    },
  });

  function handleCopy() {
    navigator.clipboard.writeText(UPI_ID);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = utr.trim();
    if (!trimmed) {
      toast({ title: "Enter UTR", description: "Paste the UTR/reference number from your payment app.", variant: "destructive" });
      return;
    }
    const plan = PLANS.find(p => p.key === selectedPlan)!;
    submit.mutate({ amount: plan.price, utr: trimmed, planType: plan.key });
  }

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const pending = payments.find(p => p.status === "pending");
  const lastRejected = !pending && payments.find(p => p.status === "rejected");

  return (
    <div className="min-h-screen bg-[#f0f0ea] flex flex-col">
      {/* Header */}
      <header className="bg-teal-800 text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
            <Stethoscope className="w-4 h-4" />
          </div>
          <span className="font-bold text-lg">BariQ</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-teal-200 hover:text-white text-sm font-medium transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </header>

      <div className="flex-1 flex items-start justify-center px-4 py-12">
        <div className="w-full max-w-2xl space-y-6">

          {/* Status banner */}
          <div className={cn(
            "rounded-2xl p-5 flex items-start gap-4 border",
            trialExpired
              ? "bg-amber-50 border-amber-200"
              : "bg-red-50 border-red-200"
          )}>
            <AlertTriangle className={cn("w-5 h-5 mt-0.5 flex-shrink-0", trialExpired ? "text-amber-500" : "text-red-500")} />
            <div>
              <p className={cn("font-semibold text-sm", trialExpired ? "text-amber-800" : "text-red-800")}>
                {trialExpired ? "Your 7-day free trial has ended" : "Your subscription has expired"}
              </p>
              <p className={cn("text-sm mt-1", trialExpired ? "text-amber-700" : "text-red-700")}>
                {trialExpired
                  ? `${clinic?.trialEndsAt ? `Trial ended on ${new Date(clinic.trialEndsAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}. ` : ""}Subscribe to continue using BariQ.`
                  : `Subscription expired on ${new Date(clinic!.subscriptionEndsAt!).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}. Please renew to continue using BariQ.`}
              </p>
            </div>
          </div>

          {/* Pending state */}
          {pending && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8 text-amber-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Payment Under Review</h2>
              <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto">
                Your payment request (UTR: <span className="font-mono font-semibold text-gray-700">{pending.utr}</span>) has been submitted and is being reviewed by our team. Access will be restored once approved.
              </p>
              <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600 mb-6">
                <p className="font-medium mb-1">Plan requested: <span className="text-teal-700 capitalize">{pending.planType || "monthly"}</span></p>
                <p>Amount: <span className="font-semibold">₹{(pending.amount / 100).toLocaleString("en-IN")}</span></p>
                <p className="mt-1 text-gray-400">Submitted on {new Date(pending.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
              </div>
              <p className="text-xs text-gray-400">
                Questions? WhatsApp us at{" "}
                <a href="https://wa.me/91942457591" target="_blank" rel="noopener noreferrer" className="text-teal-700 hover:underline font-medium">
                  +91 94245 7591
                </a>
              </p>
            </div>
          )}

          {/* Payment form */}
          {!pending && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-900">Activate Your Account</h2>
                <p className="text-gray-500 text-sm mt-1">Choose a plan, pay via UPI, then enter your UTR to request access.</p>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                {/* Rejection notice */}
                {lastRejected && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
                    <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                      <p className="font-semibold text-red-700">Previous request rejected</p>
                      {lastRejected.notes && <p className="text-red-600 mt-0.5">{lastRejected.notes}</p>}
                      <p className="text-red-500 mt-0.5">Please ensure your UTR is correct and resubmit.</p>
                    </div>
                  </div>
                )}

                {/* Plan selector */}
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-3">Select Plan</p>
                  <div className="grid grid-cols-3 gap-3">
                    {PLANS.map(plan => (
                      <button
                        key={plan.key}
                        type="button"
                        onClick={() => setSelectedPlan(plan.key)}
                        className={cn(
                          "relative rounded-xl border-2 p-4 text-left transition-all",
                          selectedPlan === plan.key
                            ? "border-teal-700 bg-teal-50"
                            : "border-gray-200 hover:border-gray-300"
                        )}
                      >
                        {plan.highlight && (
                          <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-teal-700 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                            Popular
                          </span>
                        )}
                        <p className="font-bold text-gray-900 text-sm">{plan.label}</p>
                        <p className="text-xl font-extrabold text-gray-900 mt-1">{plan.display}</p>
                        <p className="text-xs text-gray-400">{plan.per}</p>
                        <p className="text-[10px] text-teal-600 font-medium mt-1">{plan.note}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* UPI payment */}
                <div className="bg-teal-50 border border-teal-100 rounded-xl p-5">
                  <p className="text-sm font-semibold text-gray-700 mb-3">
                    Step 1 — Pay{" "}
                    <span className="text-teal-700">{PLANS.find(p => p.key === selectedPlan)?.display}</span>{" "}
                    to this UPI ID
                  </p>
                  <div className="flex items-center gap-3 bg-white rounded-lg border border-teal-200 px-4 py-3">
                    <span className="font-mono font-semibold text-gray-900 flex-1 text-sm">{UPI_ID}</span>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="flex items-center gap-1.5 text-xs text-teal-700 font-medium hover:text-teal-800 transition-colors"
                    >
                      {copied ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Open any UPI app (GPay, PhonePe, Paytm) → Pay to UPI ID above → Note the UTR/transaction ID
                  </p>
                </div>

                {/* UTR input */}
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-2">
                    Step 2 — Enter UTR / Reference Number
                  </p>
                  <Input
                    value={utr}
                    onChange={e => setUtr(e.target.value)}
                    placeholder="e.g. 423198765432 (12-digit UTR from your payment app)"
                    className="font-mono h-11"
                  />
                  <p className="text-xs text-gray-400 mt-1.5">
                    Find this in your UPI app under transaction details — usually labeled UTR, Ref No, or Transaction ID.
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={submit.isPending}
                  className="w-full h-12 bg-teal-700 hover:bg-teal-800 text-white font-semibold rounded-xl text-base"
                >
                  {submit.isPending ? (
                    <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Submitting…</>
                  ) : (
                    "Submit Payment Request"
                  )}
                </Button>

                <p className="text-center text-xs text-gray-400">
                  Access is granted within a few hours of payment verification.{" "}
                  <a href="https://wa.me/91942457591" target="_blank" rel="noopener noreferrer" className="text-teal-700 hover:underline">
                    WhatsApp support
                  </a>
                </p>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
