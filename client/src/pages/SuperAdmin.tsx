import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Building2, Users, Clock, CheckCircle, XCircle, IndianRupee, LogOut,
  Stethoscope, AlertTriangle, TrendingUp, CreditCard,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtAmount(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

function planBadge(status: string) {
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

export default function SuperAdmin() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: stats } = useQuery<any>({ queryKey: ["/api/admin/stats"] });
  const { data: clinics = [] } = useQuery<any[]>({ queryKey: ["/api/admin/clinics"] });
  const { data: payments = [] } = useQuery<any[]>({ queryKey: ["/api/admin/payments"] });

  const logout = useMutation({
    mutationFn: () => apiRequest("POST", "/api/auth/logout").then(r => r.json()),
    onSuccess: () => {
      qc.clear();
      window.location.href = "/login";
    },
  });

  const clinicAction = useMutation({
    mutationFn: ({ id, action }: { id: number; action: string }) =>
      apiRequest("PATCH", `/api/admin/clinics/${id}`, { action }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/clinics"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Done", description: "Clinic updated" });
    },
    onError: () => toast({ title: "Error", description: "Action failed", variant: "destructive" }),
  });

  const deleteClinic = useMutation({
    mutationFn: (id: number) =>
      apiRequest("DELETE", `/api/admin/clinics/${id}`).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/clinics"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Clinic deleted" });
    },
    onError: () => toast({ title: "Error", description: "Delete failed", variant: "destructive" }),
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
    onError: () => toast({ title: "Error", description: "Payment action failed", variant: "destructive" }),
  });

  const expiringSoon: any[] = clinics.filter((c: any) => {
    if (c.planStatus !== "trial" || !c.trialEndsAt) return false;
    const daysLeft = Math.ceil((new Date(c.trialEndsAt).getTime() - Date.now()) / 86400000);
    return daysLeft <= 3 && daysLeft >= 0;
  });

  const statCards = [
    { label: "Total Clinics", value: stats?.total ?? 0, icon: Building2, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Trial", value: stats?.trial ?? 0, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Active", value: stats?.active ?? 0, icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Expired", value: stats?.expired ?? 0, icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
    { label: "Pending Payments", value: stats?.pending ?? 0, icon: CreditCard, color: "text-purple-600", bg: "bg-purple-50" },
    { label: "Total Revenue", value: stats?.totalRevenue ? `₹${Number(stats.totalRevenue).toLocaleString("en-IN")}` : "₹0", icon: IndianRupee, color: "text-teal-600", bg: "bg-teal-50" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
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
        <Button
          variant="ghost"
          size="sm"
          className="text-white hover:bg-white/10"
          onClick={() => logout.mutate()}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Logout
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

        {/* Expiring Soon */}
        {expiringSoon.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <h2 className="font-semibold text-amber-800">Trials Expiring Soon</h2>
            </div>
            <div className="space-y-3">
              {expiringSoon.map((c: any) => {
                const daysLeft = Math.ceil((new Date(c.trialEndsAt).getTime() - Date.now()) / 86400000);
                return (
                  <div key={c.id} className="flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-amber-100">
                    <div>
                      <p className="font-medium text-gray-900">{c.name}</p>
                      <p className="text-sm text-amber-600">{daysLeft} day{daysLeft !== 1 ? "s" : ""} left · {c.email}</p>
                    </div>
                    <Button
                      size="sm"
                      className="bg-teal-700 hover:bg-teal-800 text-white rounded-lg"
                      onClick={() => clinicAction.mutate({ id: c.id, action: "extend-trial" })}
                    >
                      Extend Trial
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Revenue Chart + Pending Payments */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Monthly Revenue */}
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

          {/* Payment History */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Recent Payments</h2>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3 max-h-64 overflow-auto">
              {payments.length === 0 && (
                <p className="text-center text-gray-400 py-8 text-sm">No payments yet</p>
              )}
              {payments.map((p: any) => (
                <div key={p.id} className="border border-gray-100 rounded-xl p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-sm text-gray-900">{p.clinicName}</p>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${paymentBadge(p.status)}`}>
                      {p.status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 space-y-0.5">
                    <p>{fmtAmount(p.amount)} · <span className="capitalize">{p.planType || "—"}</span></p>
                    <p className="font-mono">UTR: {p.utr || "—"}</p>
                  </div>
                  {p.status === "pending" && (
                    <div className="flex gap-1 pt-1">
                      <Button size="sm" className="h-7 flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded" onClick={() => paymentAction.mutate({ id: p.id, status: "approved" })}>Approve</Button>
                      <Button size="sm" variant="outline" className="h-7 flex-1 text-red-600 border-red-200 hover:bg-red-50 text-xs rounded" onClick={() => paymentAction.mutate({ id: p.id, status: "rejected" })}>Reject</Button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-auto max-h-64">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead>Clinic</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>UTR</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-gray-400 py-8 text-sm">No payments yet</TableCell></TableRow>
                  )}
                  {payments.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium text-sm">{p.clinicName}</TableCell>
                      <TableCell className="text-xs capitalize text-gray-600">{p.planType || "—"}</TableCell>
                      <TableCell className="text-sm">{fmtAmount(p.amount)}</TableCell>
                      <TableCell className="text-xs text-gray-500 font-mono">{p.utr || "—"}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${paymentBadge(p.status)}`}>
                          {p.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        {p.status === "pending" && (
                          <div className="flex gap-1">
                            <Button size="sm" className="h-7 px-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded" onClick={() => paymentAction.mutate({ id: p.id, status: "approved" })}>Approve</Button>
                            <Button size="sm" variant="outline" className="h-7 px-2 text-red-600 border-red-200 hover:bg-red-50 text-xs rounded" onClick={() => paymentAction.mutate({ id: p.id, status: "rejected" })}>Reject</Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        {/* All Clinics */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-5">
            <Users className="w-4 h-4 text-teal-600" />
            <h2 className="font-semibold text-gray-900">All Clinics</h2>
            <span className="ml-auto text-sm text-gray-400">{clinics.length} clinics</span>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {clinics.length === 0 && (
              <p className="text-center text-gray-400 py-10 text-sm">No clinics yet</p>
            )}
            {clinics.map((c: any) => (
              <div key={c.id} className="border border-gray-100 rounded-xl p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{c.name}</p>
                    <p className="text-xs text-gray-500 truncate">{c.email}</p>
                    {c.phone && <p className="text-xs text-gray-500">{c.phone}</p>}
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize flex-shrink-0 ${planBadge(c.planStatus)}`}>
                    {c.planStatus}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-gray-500">
                  {c.trialEndsAt && <p>Trial: {fmtDate(c.trialEndsAt)}</p>}
                  {c.subscriptionEndsAt && <p>Sub: {fmtDate(c.subscriptionEndsAt)}</p>}
                  <p>Joined: {fmtDate(c.createdAt)}</p>
                </div>
                <div className="flex items-center gap-1 flex-wrap pt-1 border-t border-gray-100">
                  <Button size="sm" className="h-6 px-2 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white rounded" onClick={() => clinicAction.mutate({ id: c.id, action: "activate" })}>Activate</Button>
                  <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] text-amber-600 border-amber-200 hover:bg-amber-50 rounded" onClick={() => clinicAction.mutate({ id: c.id, action: "extend-trial" })}>+Trial</Button>
                  <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] text-red-600 border-red-200 hover:bg-red-50 rounded" onClick={() => { if (confirm(`Delete ${c.name}?`)) deleteClinic.mutate(c.id); }}>Delete</Button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead>Clinic</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Trial Ends</TableHead>
                  <TableHead>Sub Ends</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clinics.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-gray-400 py-12 text-sm">No clinics yet</TableCell></TableRow>
                )}
                {clinics.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium text-sm">{c.name}</TableCell>
                    <TableCell className="text-sm text-gray-500">{c.email}</TableCell>
                    <TableCell className="text-sm text-gray-500">{c.phone || "—"}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${planBadge(c.planStatus)}`}>
                        {c.planStatus}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">{fmtDate(c.trialEndsAt)}</TableCell>
                    <TableCell className="text-sm text-gray-500">{fmtDate(c.subscriptionEndsAt)}</TableCell>
                    <TableCell className="text-sm text-gray-500">{fmtDate(c.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 flex-wrap">
                        <Button size="sm" className="h-6 px-2 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white rounded" onClick={() => clinicAction.mutate({ id: c.id, action: "activate" })}>Activate</Button>
                        <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] text-amber-600 border-amber-200 hover:bg-amber-50 rounded" onClick={() => clinicAction.mutate({ id: c.id, action: "extend-trial" })}>+Trial</Button>
                        <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] text-red-600 border-red-200 hover:bg-red-50 rounded" onClick={() => { if (confirm(`Delete ${c.name}?`)) deleteClinic.mutate(c.id); }}>Delete</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}
