import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Stethoscope, LogOut, Copy, CheckCircle, Users, Clock, XCircle, Handshake, IndianRupee, Hourglass, Ban,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";

function fmtDate(d: string | null | undefined) {
  if (!d) return "-";
  return format(new Date(d), "dd MMM yyyy");
}

function fmtRupees(n: number | undefined) {
  return `₹${Math.round(n ?? 0).toLocaleString("en-IN")}`;
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

function PartnerHeader({ name, onLogout }: { name?: string; onLogout: () => void }) {
  return (
    <header className="bg-teal-800 text-white px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center">
          <Stethoscope className="w-5 h-5" />
        </div>
        <div>
          <p className="font-bold text-lg leading-none">BariQ Partner</p>
          <p className="text-teal-200 text-xs">{name}</p>
        </div>
      </div>
      <Button variant="ghost" size="sm" className="text-white hover:bg-white/10" onClick={onLogout}>
        <LogOut className="w-4 h-4 mr-2" /> Logout
      </Button>
    </header>
  );
}

export default function PartnerDashboard() {
  const { partner } = useAuth();
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const isActive = partner?.status === "active";
  const referralLink = partner?.referralCode ? `${window.location.origin}/signup?ref=${partner.referralCode}` : "";

  const { data: stats } = useQuery<any>({ queryKey: ["/api/partner/stats"], enabled: isActive });
  const { data: clients = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/partner/clients"], enabled: isActive });

  const logout = useMutation({
    mutationFn: () => apiRequest("POST", "/api/auth/logout").then(r => r.json()),
    onSuccess: () => { qc.clear(); window.location.href = "/login"; },
  });

  function handleCopy() {
    if (!partner?.referralCode) return;
    navigator.clipboard.writeText(partner.referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleCopyLink() {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  // ── Awaiting approval ──────────────────────────────────────────────────────
  if (partner?.status === "pending") {
    return (
      <div className="min-h-screen bg-gray-50">
        <PartnerHeader name={partner?.name} onLogout={() => logout.mutate()} />
        <div className="max-w-lg mx-auto px-6 py-16 text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <Hourglass className="w-8 h-8 text-amber-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Your application is under review</h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            Thanks for signing up as a BariQ partner! Our team is reviewing your account. You'll be able to see your referral code and client dashboard as soon as you're approved.
          </p>
        </div>
      </div>
    );
  }

  // ── Deactivated ────────────────────────────────────────────────────────────
  if (partner?.status === "inactive") {
    return (
      <div className="min-h-screen bg-gray-50">
        <PartnerHeader name={partner?.name} onLogout={() => logout.mutate()} />
        <div className="max-w-lg mx-auto px-6 py-16 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <Ban className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Account deactivated</h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            Your partner account is currently deactivated. Please contact TirthonTech support if you believe this is a mistake.
          </p>
        </div>
      </div>
    );
  }

  const statCards = [
    { label: "Active", value: stats?.active ?? 0, icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "On Trial", value: stats?.trial ?? 0, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Expired", value: stats?.expired ?? 0, icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <PartnerHeader name={partner?.name} onLogout={() => logout.mutate()} />

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* Referral code card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Handshake className="w-4 h-4 text-teal-600" />
            <h2 className="font-semibold text-gray-900">Your Referral Code</h2>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-3 bg-teal-50 border border-teal-100 rounded-xl px-5 py-3">
              <span className="font-mono font-bold text-xl text-teal-800 tracking-wider">{partner?.referralCode ?? "…"}</span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 text-xs text-teal-700 font-medium hover:text-teal-800 transition-colors"
              >
                {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <p className="text-sm text-gray-500 max-w-md">
              Share this code with clinics. When they enter it while signing up (or while subscribing), they'll show up here automatically — commission rate: <span className="font-semibold text-gray-700">{partner?.commissionPercent ?? 10}%</span>.
            </p>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Or share your referral link</p>
            <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5">
              <span className="font-mono text-sm text-gray-700 truncate flex-1">{referralLink || "…"}</span>
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 text-xs text-teal-700 font-medium hover:text-teal-800 transition-colors shrink-0"
              >
                {linkCopied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {linkCopied ? "Copied!" : "Copy Link"}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              Clinics who click this link land on sign up with your code already filled in.
            </p>
          </div>
        </div>

        {/* Registered vs Paid — the headline conversion numbers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="w-11 h-11 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats?.registered ?? 0}</p>
              <p className="text-gray-500 text-xs mt-0.5">Registered through your link</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="w-11 h-11 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {stats?.paidCount ?? 0}
                <span className="text-sm font-normal text-gray-400 ml-1.5">
                  / {stats?.registered ?? 0} {stats?.registered ? `(${Math.round((stats.paidCount / stats.registered) * 100)}%)` : ""}
                </span>
              </p>
              <p className="text-gray-500 text-xs mt-0.5">Subscribed / paid at least once</p>
            </div>
          </div>
        </div>

        {/* Revenue + commission */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="w-11 h-11 bg-teal-50 rounded-xl flex items-center justify-center shrink-0">
              <IndianRupee className="w-5 h-5 text-teal-700" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{fmtRupees(stats?.totalRevenue)}</p>
              <p className="text-gray-500 text-xs mt-0.5">Revenue from your clinics</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="w-11 h-11 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0">
              <IndianRupee className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{fmtRupees(stats?.commissionEarned)}</p>
              <p className="text-gray-500 text-xs mt-0.5">Your commission ({stats?.commissionPercent ?? partner?.commissionPercent ?? 10}%)</p>
            </div>
          </div>
        </div>

        {/* Status breakdown */}
        <div className="grid grid-cols-3 gap-4">
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

        {/* Clients table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-5">
            <Users className="w-4 h-4 text-teal-600" />
            <h2 className="font-semibold text-gray-900">Your Clinics</h2>
            <span className="ml-auto text-sm text-gray-400">{clients.length} clinics</span>
          </div>

          {isLoading ? (
            <p className="text-center text-gray-400 py-12 text-sm">Loading...</p>
          ) : clients.length === 0 ? (
            <p className="text-center text-gray-400 py-12 text-sm">
              No clinics yet. Share your referral code above to get started.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Clinic</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Paid?</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Revenue Paid</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((c: any) => {
                    const statusLabel = c.isExpired ? "expired" : c.planStatus;
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium text-gray-900">{c.name}</TableCell>
                        <TableCell className="text-gray-500">{c.email}{c.phone ? ` · ${c.phone}` : ""}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${planBadge(c.planStatus, c.isExpired)}`}>
                            {statusLabel}
                          </span>
                        </TableCell>
                        <TableCell>
                          {c.hasPaid ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700">
                              <CheckCircle className="w-2.5 h-2.5" /> Yes
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-500">
                              Not yet
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-gray-500">{fmtDate(c.createdAt)}</TableCell>
                        <TableCell className="text-emerald-600 font-medium">{fmtRupees(c.totalPaid)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
