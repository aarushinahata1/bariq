import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Building2, Users, Clock, CheckCircle, XCircle, IndianRupee, LogOut,
  Stethoscope, AlertTriangle, TrendingUp, CreditCard, CalendarCheck,
  ChevronDown, ChevronUp, Trash2, RefreshCw, Handshake, Plus, Copy, Ban, PlayCircle, Hourglass,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(d: string | null | undefined) {
  if (!d) return "-";
  return format(new Date(d), "dd MMM yyyy");
}

function fmtAmount(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

function planBadge(status: string, isExpired?: boolean) {
  if (isExpired) return "bg-red-100 text-red-700";
  const map: Record<string, string> = {
    trial: "bg-amber-100 text-amber-700",
    active: "bg-emerald-100 text-emerald-700",
    expired: "bg-red-100 text-red-700",
    cancelled: "bg-gray-100 text-gray-500",
  };
  return map[status] ?? "bg-gray-100 text-gray-500";
}

function paymentBadge(status: string) {
  const map: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700",
    approved: "bg-emerald-100 text-emerald-700",
    rejected: "bg-red-100 text-red-700",
  };
  return map[status] ?? "bg-gray-100 text-gray-500";
}

const PLANS = [
  { key: "monthly",   label: "Monthly",   note: "1 month",  defaultAmount: "4999" },
  { key: "quarterly", label: "Quarterly", note: "3 months", defaultAmount: "12999" },
  { key: "annual",    label: "Annual",    note: "1 year",   defaultAmount: "49999" },
];

// ── Grant Subscription Modal ───────────────────────────────────────────────────

function GrantSubModal({
  clinic,
  onClose,
  onSubmit,
  isPending,
}: {
  clinic: any;
  onClose: () => void;
  onSubmit: (plan: string, amount: number, utr: string, notes: string) => void;
  isPending: boolean;
}) {
  const [plan, setPlan] = useState("monthly");
  const [amount, setAmount] = useState("4999");
  const [utr, setUtr] = useState("");
  const [notes, setNotes] = useState("");

  const selectPlan = (key: string) => {
    setPlan(key);
    setAmount(PLANS.find(p => p.key === key)?.defaultAmount ?? "4999");
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Grant Subscription</DialogTitle>
          <DialogDescription className="text-sm text-gray-500">
            {clinic.name} · {clinic.email}
            {clinic.planStatus === "trial" && clinic.daysLeft != null && (
              <span className="ml-2 text-amber-600 font-medium">
                ({clinic.daysLeft > 0 ? `${clinic.daysLeft}d trial left` : "trial expired"})
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Plan picker */}
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-2">Subscription Plan</label>
            <div className="space-y-2">
              {PLANS.map(p => (
                <button
                  key={p.key}
                  onClick={() => selectPlan(p.key)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-colors text-left ${
                    plan === p.key
                      ? "border-teal-600 bg-teal-50"
                      : "border-gray-200 hover:border-gray-300 bg-white"
                  }`}
                >
                  <div>
                    <p className="font-semibold text-sm text-gray-900">{p.label}</p>
                    <p className="text-xs text-gray-500">{p.note} · ₹{p.defaultAmount}</p>
                  </div>
                  {plan === p.key && <CheckCircle className="w-4 h-4 text-teal-600 shrink-0" />}
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1.5">Amount Received (₹)</label>
            <Input
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="rounded-xl"
              placeholder="4999"
              type="number"
              min="0"
            />
          </div>

          {/* UTR */}
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1.5">
              UTR / Reference <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <Input
              value={utr}
              onChange={e => setUtr(e.target.value)}
              className="rounded-xl"
              placeholder="UTR, transaction ID, or cheque no."
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1.5">
              Notes <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <Input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="rounded-xl"
              placeholder="Any additional notes..."
            />
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl" disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => onSubmit(plan, parseFloat(amount || "0") * 100, utr, notes)}
            disabled={isPending || !amount}
            className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isPending ? "Activating..." : "Activate Subscription"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Create Partner Modal ───────────────────────────────────────────────────────

function CreatePartnerModal({
  onClose,
  onSubmit,
  isPending,
}: {
  onClose: () => void;
  onSubmit: (data: { name: string; email: string; password: string; phone: string; commissionPercent: number }) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [commissionPercent, setCommissionPercent] = useState("10");

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Partner</DialogTitle>
          <DialogDescription className="text-sm text-gray-500">
            A referral code is generated automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1.5">Name</label>
            <Input value={name} onChange={e => setName(e.target.value)} className="rounded-xl" placeholder="Partner name" />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1.5">Email</label>
            <Input value={email} onChange={e => setEmail(e.target.value)} className="rounded-xl" type="email" placeholder="partner@example.com" />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1.5">Password</label>
            <Input value={password} onChange={e => setPassword(e.target.value)} className="rounded-xl" type="password" placeholder="Min 8 characters" />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1.5">Phone <span className="text-gray-400 font-normal">(optional)</span></label>
            <Input value={phone} onChange={e => setPhone(e.target.value)} className="rounded-xl" placeholder="9876543210" />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1.5">Commission %</label>
            <Input value={commissionPercent} onChange={e => setCommissionPercent(e.target.value)} className="rounded-xl" type="number" min="0" max="100" />
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl" disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => onSubmit({ name, email, password, phone, commissionPercent: parseInt(commissionPercent || "10", 10) })}
            disabled={isPending || !name || !email || password.length < 8}
            className="flex-1 rounded-xl bg-teal-700 hover:bg-teal-800 text-white"
          >
            {isPending ? "Creating..." : "Create Partner"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function SuperAdmin() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: stats } = useQuery<any>({ queryKey: ["/api/admin/stats"] });
  const { data: clinics = [], isLoading: loadingClinics } = useQuery<any[]>({ queryKey: ["/api/admin/clinics"] });
  const { data: payments = [] } = useQuery<any[]>({ queryKey: ["/api/admin/payments"] });
  const { data: partners = [], isLoading: loadingPartners } = useQuery<any[]>({ queryKey: ["/api/admin/partners"] });

  // Modal state
  const [grantingClinic, setGrantingClinic] = useState<any>(null);
  const [expandedClinicId, setExpandedClinicId] = useState<number | null>(null);
  const [expandedPartnerId, setExpandedPartnerId] = useState<number | null>(null);
  const [creatingPartner, setCreatingPartner] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const logout = useMutation({
    mutationFn: () => apiRequest("POST", "/api/auth/logout").then(r => r.json()),
    onSuccess: () => { qc.clear(); window.location.href = "/login"; },
  });

  // Grant subscription — creates payment record + activates clinic
  const grantSub = useMutation({
    mutationFn: ({ clinicId, planType, amount, utr, notes }: any) =>
      apiRequest("POST", "/api/admin/payments", { clinicId, planType, amount, utr, notes }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/clinics"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/payments"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setGrantingClinic(null);
      toast({ title: "Subscription activated!", description: "Clinic is now on an active plan." });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // Other clinic actions (extend-trial, expire)
  const clinicAction = useMutation({
    mutationFn: ({ id, action, days }: { id: number; action: string; days?: number }) =>
      apiRequest("PATCH", `/api/admin/clinics/${id}`, { action, days }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/clinics"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Clinic updated" });
    },
    onError: () => toast({ title: "Action failed", variant: "destructive" }),
  });

  const deleteClinic = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/clinics/${id}`).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/clinics"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Clinic deleted" });
    },
    onError: () => toast({ title: "Delete failed", variant: "destructive" }),
  });

  const paymentAction = useMutation({
    mutationFn: ({ id, status, notes }: { id: number; status: string; notes?: string }) =>
      apiRequest("PATCH", `/api/admin/payments/${id}`, { status, notes }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/payments"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/clinics"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Payment updated" });
    },
    onError: () => toast({ title: "Payment action failed", variant: "destructive" }),
  });

  // Partner management
  const createPartner = useMutation({
    mutationFn: (body: any) => apiRequest("POST", "/api/admin/partners", body).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/partners"] });
      setCreatingPartner(false);
      toast({ title: "Partner created", description: "Referral code generated." });
    },
    onError: (err: any) => {
      const raw = err?.message || "Failed to create partner";
      let msg = raw;
      try { msg = JSON.parse(raw.replace(/^\d+: /, "")).message || raw; } catch {}
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const partnerAction = useMutation({
    mutationFn: ({ id, body }: { id: number; body: any }) =>
      apiRequest("PATCH", `/api/admin/partners/${id}`, body).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/partners"] });
      toast({ title: "Partner updated" });
    },
    onError: () => toast({ title: "Action failed", variant: "destructive" }),
  });

  const deletePartner = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/partners/${id}`).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/partners"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/clinics"] });
      toast({ title: "Partner deleted" });
    },
    onError: () => toast({ title: "Delete failed", variant: "destructive" }),
  });

  function copyReferralCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  }

  function copyReferralLink(code: string) {
    const link = `${window.location.origin}/signup?ref=${code}`;
    navigator.clipboard.writeText(link);
    setCopiedCode(`link:${code}`);
    setTimeout(() => setCopiedCode(null), 2000);
  }

  const pendingPartners = (partners as any[]).filter((p: any) => p.status === "pending");

  const expiringSoon = (clinics as any[]).filter((c: any) => {
    if (c.planStatus !== "trial" || !c.trialEndsAt) return false;
    const d = Math.ceil((new Date(c.trialEndsAt).getTime() - Date.now()) / 86400000);
    return d <= 3 && d >= 0;
  });

  const statCards = [
    { label: "Total Clinics", value: stats?.total ?? 0, icon: Building2, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Trial", value: stats?.trial ?? 0, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Active", value: stats?.active ?? 0, icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Expired", value: stats?.expired ?? 0, icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
    { label: "Pending Payments", value: stats?.pending ?? 0, icon: CreditCard, color: "text-purple-600", bg: "bg-purple-50" },
    {
      label: "Total Revenue",
      value: stats?.totalRevenue ? `₹${Number(stats.totalRevenue).toLocaleString("en-IN")}` : "₹0",
      icon: IndianRupee, color: "text-teal-600", bg: "bg-teal-50",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-teal-800 text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center">
            <Stethoscope className="w-5 h-5" />
          </div>
          <div>
            <p className="font-bold text-lg leading-none">BariQ Admin</p>
            <p className="text-teal-200 text-xs">TirthonTech Control Panel</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="text-white hover:bg-white/10" onClick={() => logout.mutate()}>
          <LogOut className="w-4 h-4 mr-2" /> Logout
        </Button>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {statCards.map(s => (
            <div key={s.label} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className={`w-9 h-9 ${s.bg} rounded-xl flex items-center justify-center mb-3`}>
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-gray-500 text-xs mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Expiring Soon Alert */}
        {expiringSoon.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <h2 className="font-semibold text-amber-800">Trials Expiring Soon</h2>
            </div>
            <div className="space-y-3">
              {expiringSoon.map((c: any) => {
                const d = Math.ceil((new Date(c.trialEndsAt).getTime() - Date.now()) / 86400000);
                return (
                  <div key={c.id} className="flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-amber-100">
                    <div>
                      <p className="font-semibold text-sm text-gray-900">{c.name}</p>
                      <p className="text-xs text-amber-600">{d} day{d !== 1 ? "s" : ""} left · {c.email}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="h-8 text-xs rounded-lg border-amber-200 text-amber-700 hover:bg-amber-50"
                        onClick={() => clinicAction.mutate({ id: c.id, action: "extend-trial", days: 7 })}>
                        +7 Days
                      </Button>
                      <Button size="sm" className="h-8 text-xs rounded-lg bg-teal-700 hover:bg-teal-800 text-white"
                        onClick={() => setGrantingClinic(c)}>
                        <CalendarCheck className="w-3.5 h-3.5 mr-1" /> Grant Sub
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Revenue Chart + Pending Payments */}
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-2 mb-5">
              <TrendingUp className="w-4 h-4 text-teal-600" />
              <h2 className="font-semibold text-gray-900">Monthly Revenue</h2>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats?.monthlyData ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `₹${v}`} />
                <Tooltip formatter={(v: any) => [`₹${v}`, "Revenue"]} />
                <Bar dataKey="revenue" fill="#0f766e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Recent Payments</h2>
            <div className="space-y-2 max-h-[260px] overflow-auto">
              {payments.length === 0 && (
                <p className="text-center text-gray-400 py-8 text-sm">No payments yet</p>
              )}
              {payments.map((p: any) => (
                <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 truncate">{p.clinicName}</p>
                    <p className="text-xs text-gray-500">
                      {fmtAmount(p.amount)} · <span className="capitalize">{p.planType || "-"}</span>
                      {p.utr && <span className="font-mono ml-1 text-gray-400">· {p.utr}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${paymentBadge(p.status)}`}>
                      {p.status}
                    </span>
                    {p.status === "pending" && (
                      <>
                        <Button size="sm" className="h-7 px-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded"
                          onClick={() => paymentAction.mutate({ id: p.id, status: "approved" })}>
                          Approve
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 px-2 text-red-600 border-red-200 hover:bg-red-50 text-xs rounded"
                          onClick={() => paymentAction.mutate({ id: p.id, status: "rejected" })}>
                          Reject
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* All Clinics */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-5">
            <Users className="w-4 h-4 text-teal-600" />
            <h2 className="font-semibold text-gray-900">All Clinics</h2>
            <span className="ml-auto text-sm text-gray-400">{clinics.length} clinics</span>
          </div>

          {loadingClinics ? (
            <p className="text-center text-gray-400 py-12 text-sm">Loading...</p>
          ) : clinics.length === 0 ? (
            <p className="text-center text-gray-400 py-12 text-sm">No clinics yet</p>
          ) : (
            <div className="space-y-2">
              {clinics.map((c: any) => {
                const isExpanded = expandedClinicId === c.id;
                const statusLabel = c.isExpired ? "expired" : c.planStatus;

                return (
                  <div key={c.id} className="border border-gray-100 rounded-2xl overflow-hidden">
                    {/* Main row */}
                    <div
                      className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => setExpandedClinicId(isExpanded ? null : c.id)}
                    >
                      {/* Clinic info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm text-gray-900">{c.name}</p>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${planBadge(c.planStatus, c.isExpired)}`}>
                            {statusLabel}
                          </span>
                          {c.daysLeft != null && !c.isExpired && (
                            <span className="text-[10px] text-gray-400 font-medium">
                              {c.daysLeft > 0 ? `${c.daysLeft}d left` : "expires today"}
                            </span>
                          )}
                          {c.partnerName && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700">
                              <Handshake className="w-2.5 h-2.5" /> {c.partnerName}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{c.email}{c.phone ? ` · ${c.phone}` : ""}</p>
                      </div>

                      {/* Counts */}
                      <div className="hidden sm:flex items-center gap-4 text-xs text-gray-500 shrink-0">
                        <span>{c.patientCount ?? 0} patients</span>
                        <span>{c.apptCount ?? 0} visits</span>
                        {c.totalPaid > 0 && <span className="text-emerald-600 font-medium">₹{c.totalPaid.toLocaleString("en-IN")} paid</span>}
                      </div>

                      {/* Quick action + expand toggle */}
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          className="h-8 px-3 text-xs rounded-xl bg-teal-700 hover:bg-teal-800 text-white"
                          onClick={e => { e.stopPropagation(); setGrantingClinic(c); }}
                        >
                          <CalendarCheck className="w-3.5 h-3.5 mr-1" />
                          Grant Sub
                        </Button>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                    </div>

                    {/* Expanded detail row */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 border-t border-gray-100 bg-gray-50/50">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 text-xs text-gray-600">
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">Joined</p>
                            <p className="font-medium">{fmtDate(c.createdAt)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">Trial Ends</p>
                            <p className="font-medium">{fmtDate(c.trialEndsAt)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">Sub Ends</p>
                            <p className="font-medium">{fmtDate(c.subscriptionEndsAt)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">Total Paid</p>
                            <p className="font-medium text-emerald-600">₹{c.totalPaid?.toLocaleString("en-IN") ?? 0}</p>
                          </div>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-3 text-xs rounded-lg text-amber-600 border-amber-200 hover:bg-amber-50"
                            onClick={() => clinicAction.mutate({ id: c.id, action: "extend-trial", days: 7 })}
                            disabled={clinicAction.isPending}
                          >
                            <RefreshCw className="w-3 h-3 mr-1" /> Extend Trial 7d
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-3 text-xs rounded-lg text-gray-500 border-gray-200 hover:bg-gray-50"
                            onClick={() => clinicAction.mutate({ id: c.id, action: "expire" })}
                            disabled={clinicAction.isPending}
                          >
                            Expire Now
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-3 text-xs rounded-lg text-red-600 border-red-200 hover:bg-red-50 ml-auto"
                            onClick={() => {
                              if (window.confirm(`Permanently delete ${c.name} and ALL their data? This cannot be undone.`)) {
                                deleteClinic.mutate(c.id);
                              }
                            }}
                            disabled={deleteClinic.isPending}
                          >
                            <Trash2 className="w-3 h-3 mr-1" /> Delete Clinic
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pending Partner Approvals */}
        {pendingPartners.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Hourglass className="w-4 h-4 text-amber-600" />
              <h2 className="font-semibold text-amber-800">Pending Partner Approvals</h2>
            </div>
            <div className="space-y-3">
              {pendingPartners.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-amber-100">
                  <div>
                    <p className="font-semibold text-sm text-gray-900">{p.name}</p>
                    <p className="text-xs text-amber-600">{p.email}{p.phone ? ` · ${p.phone}` : ""}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="h-8 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => partnerAction.mutate({ id: p.id, body: { status: "active" } })}
                      disabled={partnerAction.isPending}>
                      <CheckCircle className="w-3.5 h-3.5 mr-1" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs rounded-lg border-red-200 text-red-600 hover:bg-red-50"
                      onClick={() => partnerAction.mutate({ id: p.id, body: { status: "inactive" } })}
                      disabled={partnerAction.isPending}>
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Partners */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-5">
            <Handshake className="w-4 h-4 text-teal-600" />
            <h2 className="font-semibold text-gray-900">Partners</h2>
            <span className="text-sm text-gray-400">{partners.length} partners</span>
            <Button
              size="sm"
              className="ml-auto h-8 px-3 text-xs rounded-xl bg-teal-700 hover:bg-teal-800 text-white"
              onClick={() => setCreatingPartner(true)}
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Create Partner
            </Button>
          </div>

          {loadingPartners ? (
            <p className="text-center text-gray-400 py-12 text-sm">Loading...</p>
          ) : partners.length === 0 ? (
            <p className="text-center text-gray-400 py-12 text-sm">No partners yet</p>
          ) : (
            <div className="space-y-2">
              {partners.map((p: any) => {
                const isExpanded = expandedPartnerId === p.id;
                return (
                  <div key={p.id} className="border border-gray-100 rounded-2xl overflow-hidden">
                    <div
                      className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => setExpandedPartnerId(isExpanded ? null : p.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm text-gray-900">{p.name}</p>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            p.status === "active" ? "bg-emerald-100 text-emerald-700"
                              : p.status === "pending" ? "bg-amber-100 text-amber-700"
                              : "bg-gray-100 text-gray-500"
                          }`}>
                            {p.status}
                          </span>
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-teal-50 text-teal-700 cursor-pointer"
                            onClick={e => { e.stopPropagation(); copyReferralCode(p.referralCode); }}
                          >
                            {copiedCode === p.referralCode ? <CheckCircle className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
                            {p.referralCode}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{p.email}{p.phone ? ` · ${p.phone}` : ""}</p>
                      </div>

                      <div className="hidden sm:flex items-center gap-4 text-xs text-gray-500 shrink-0">
                        <span>{p.clientCount ?? 0} registered</span>
                        <span>{p.paidClients ?? 0} paid</span>
                        {p.totalRevenue > 0 && <span className="text-emerald-600 font-medium">₹{p.totalRevenue.toLocaleString("en-IN")} revenue</span>}
                      </div>

                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                      )}
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 border-t border-gray-100 bg-gray-50/50">
                        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 mb-4 text-xs text-gray-600">
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">Joined</p>
                            <p className="font-medium">{fmtDate(p.createdAt)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">Registered</p>
                            <p className="font-medium">{p.clientCount ?? 0}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">Paid</p>
                            <p className="font-medium text-emerald-600">
                              {p.paidClients ?? 0}{p.clientCount ? ` (${Math.round(((p.paidClients ?? 0) / p.clientCount) * 100)}%)` : ""}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">Active</p>
                            <p className="font-medium text-emerald-600">{p.activeClients ?? 0}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">Revenue</p>
                            <p className="font-medium">₹{(p.totalRevenue ?? 0).toLocaleString("en-IN")}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-0.5">Commission Owed ({p.commissionPercent}%)</p>
                            <p className="font-medium text-emerald-600">₹{(p.commissionOwed ?? 0).toLocaleString("en-IN")}</p>
                          </div>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          {p.status === "pending" ? (
                            <>
                              <Button
                                size="sm"
                                className="h-7 px-3 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={() => partnerAction.mutate({ id: p.id, body: { status: "active" } })}
                                disabled={partnerAction.isPending}
                              >
                                <CheckCircle className="w-3 h-3 mr-1" /> Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-3 text-xs rounded-lg text-red-600 border-red-200 hover:bg-red-50"
                                onClick={() => partnerAction.mutate({ id: p.id, body: { status: "inactive" } })}
                                disabled={partnerAction.isPending}
                              >
                                Reject
                              </Button>
                            </>
                          ) : p.status === "active" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-3 text-xs rounded-lg text-gray-500 border-gray-200 hover:bg-gray-50"
                              onClick={() => partnerAction.mutate({ id: p.id, body: { status: "inactive" } })}
                              disabled={partnerAction.isPending}
                            >
                              <Ban className="w-3 h-3 mr-1" /> Deactivate
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-3 text-xs rounded-lg text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                              onClick={() => partnerAction.mutate({ id: p.id, body: { status: "active" } })}
                              disabled={partnerAction.isPending}
                            >
                              <PlayCircle className="w-3 h-3 mr-1" /> Activate
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-3 text-xs rounded-lg text-teal-600 border-teal-200 hover:bg-teal-50"
                            onClick={() => copyReferralLink(p.referralCode)}
                          >
                            {copiedCode === `link:${p.referralCode}` ? <CheckCircle className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                            Copy Referral Link
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-3 text-xs rounded-lg text-amber-600 border-amber-200 hover:bg-amber-50"
                            onClick={() => partnerAction.mutate({ id: p.id, body: { action: "regenerate-code" } })}
                            disabled={partnerAction.isPending}
                          >
                            <RefreshCw className="w-3 h-3 mr-1" /> Regenerate Code
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-3 text-xs rounded-lg text-red-600 border-red-200 hover:bg-red-50 ml-auto"
                            onClick={() => {
                              if (window.confirm(`Delete partner ${p.name}? Their referred clinics will be unlinked but kept.`)) {
                                deletePartner.mutate(p.id);
                              }
                            }}
                            disabled={deletePartner.isPending}
                          >
                            <Trash2 className="w-3 h-3 mr-1" /> Delete Partner
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Create Partner Modal */}
      {creatingPartner && (
        <CreatePartnerModal
          onClose={() => setCreatingPartner(false)}
          isPending={createPartner.isPending}
          onSubmit={(data) => createPartner.mutate(data)}
        />
      )}

      {/* Grant Subscription Modal */}
      {grantingClinic && (
        <GrantSubModal
          clinic={grantingClinic}
          onClose={() => setGrantingClinic(null)}
          isPending={grantSub.isPending}
          onSubmit={(plan, amount, utr, notes) =>
            grantSub.mutate({
              clinicId: grantingClinic.id,
              planType: plan,
              amount,
              utr,
              notes,
            })
          }
        />
      )}
    </div>
  );
}
