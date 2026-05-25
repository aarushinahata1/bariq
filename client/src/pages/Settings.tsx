import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { MessageCircle, MessageSquare, CheckCircle2, AlertCircle, Eye, EyeOff, Save, ChevronRight, CreditCard, Clock, CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";

type Tab = "billing" | "whatsapp" | "sms";

const WHATSAPP_PROVIDERS = [
  { value: "meta", label: "Meta (WhatsApp Business API)" },
  { value: "twilio", label: "Twilio" },
  { value: "gupshup", label: "Gupshup" },
  { value: "wati", label: "WATI" },
  { value: "interakt", label: "Interakt" },
];

const SMS_PROVIDERS = [
  { value: "msg91", label: "MSG91" },
  { value: "textlocal", label: "Textlocal" },
  { value: "fast2sms", label: "Fast2SMS" },
  { value: "twilio", label: "Twilio" },
  { value: "kaleyra", label: "Kaleyra" },
];

interface WhatsAppSettings {
  provider: string;
  accessToken: string;
  phoneNumberId: string;
  wabaId: string;
  enabled: boolean;
}

interface SmsSettings {
  provider: string;
  apiKey: string;
  senderId: string;
  enabled: boolean;
}

function SecretInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [visible, setVisible] = useState(false);
  const masked = value.startsWith("••••••••");
  return (
    <div className="relative">
      <Input
        type={visible && !masked ? "text" : "password"}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="pr-10 font-mono text-sm"
      />
      {!masked && (
        <button
          type="button"
          onClick={() => setVisible(v => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      )}
    </div>
  );
}

function StatusBadge({ enabled }: { enabled: boolean }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold",
      enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
    )}>
      {enabled
        ? <><CheckCircle2 className="w-3.5 h-3.5" /> Active</>
        : <><AlertCircle className="w-3.5 h-3.5" /> Inactive</>}
    </span>
  );
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState<Tab>("billing");
  const { toast } = useToast();
  const qc = useQueryClient();
  const { clinic } = useAuth();

  const now = new Date();
  const isSubExpired = clinic?.planStatus === "active" && !!clinic.subscriptionEndsAt && new Date(clinic.subscriptionEndsAt) < now;
  const isTrialExpired = clinic?.planStatus === "trial" && !!clinic.trialEndsAt && new Date(clinic.trialEndsAt) < now;
  const effectivePlanStatus = (isSubExpired || isTrialExpired) ? "expired" : (clinic?.planStatus ?? "trial");

  const { data: settings, isLoading } = useQuery<Record<string, any>>({
    queryKey: ["/api/settings"],
    queryFn: async () => {
      const r = await fetch("/api/settings");
      return r.json();
    },
  });

  const [wa, setWa] = useState<WhatsAppSettings>({ provider: "meta", accessToken: "", phoneNumberId: "", wabaId: "", enabled: false });
  const [sms, setSms] = useState<SmsSettings>({ provider: "msg91", apiKey: "", senderId: "", enabled: false });

  useEffect(() => {
    if (!settings) return;
    if (settings.whatsapp) setWa(s => ({ ...s, ...settings.whatsapp }));
    if (settings.sms) setSms(s => ({ ...s, ...settings.sms }));
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async ({ key, data }: { key: string; data: any }) => {
      const r = await fetch(`/api/settings/${key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: (_, { key }) => {
      qc.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: `${key === "whatsapp" ? "WhatsApp" : "SMS"} settings saved` });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    },
  });

  const { data: payments = [] } = useQuery<any[]>({
    queryKey: ["/api/payments"],
    queryFn: () => apiRequest("GET", "/api/payments").then(r => r.json()),
  });

  const tabs: { id: Tab; label: string; icon: typeof MessageCircle; color: string }[] = [
    { id: "billing", label: "Plan & Billing", icon: CreditCard, color: "text-teal-700" },
    { id: "whatsapp", label: "WhatsApp API", icon: MessageCircle, color: "text-emerald-600" },
    { id: "sms", label: "SMS API", icon: MessageSquare, color: "text-teal-700" },
  ];

  return (
    <Layout>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
          <p className="text-slate-500 text-sm mt-1">Configure messaging integrations for patient notifications</p>
        </div>

        {/* Tab strip */}
        <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            const enabled = activeTab === tab.id
              ? (tab.id === "whatsapp" ? wa.enabled : sms.enabled)
              : (tab.id === "whatsapp" ? settings?.whatsapp?.enabled : settings?.sms?.enabled);
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 sm:px-5 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap flex-shrink-0",
                  active
                    ? "border-teal-600 text-teal-700"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                )}
              >
                <Icon className={cn("w-4 h-4", active ? tab.color : "text-slate-400")} />
                {tab.label}
                {!isLoading && <StatusBadge enabled={!!enabled} />}
              </button>
            );
          })}
        </div>

        {/* Plan & Billing Panel */}
        {activeTab === "billing" && (
          <div className="space-y-5">
            {/* Current plan */}
            <Card className="p-6">
              <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-teal-600" />
                Current Plan
              </h2>
              {clinic ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-3 border-b border-slate-100">
                    <span className="text-sm text-slate-500">Clinic</span>
                    <span className="text-sm font-semibold text-slate-900">{clinic.name}</span>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b border-slate-100">
                    <span className="text-sm text-slate-500">Status</span>
                    <span className={cn(
                      "px-3 py-1 rounded-full text-xs font-bold",
                      effectivePlanStatus === "active" ? "bg-emerald-100 text-emerald-700" :
                      effectivePlanStatus === "trial" ? "bg-amber-100 text-amber-700" :
                      "bg-red-100 text-red-700"
                    )}>
                      {effectivePlanStatus === "trial" ? "Free Trial" : effectivePlanStatus.charAt(0).toUpperCase() + effectivePlanStatus.slice(1)}
                    </span>
                  </div>
                  {clinic.planStatus === "trial" && clinic.trialEndsAt && (
                    <div className="flex items-center justify-between py-3 border-b border-slate-100">
                      <span className="text-sm text-slate-500">Trial Ends</span>
                      <span className={cn(
                        "text-sm font-semibold",
                        new Date(clinic.trialEndsAt) < new Date() ? "text-red-600" : "text-slate-900"
                      )}>
                        {new Date(clinic.trialEndsAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                        {new Date(clinic.trialEndsAt) > new Date() && (
                          <span className="text-gray-400 font-normal ml-2">
                            ({Math.max(0, Math.ceil((new Date(clinic.trialEndsAt).getTime() - Date.now()) / 86400000))} days left)
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                  {clinic.planStatus === "active" && clinic.subscriptionEndsAt && (
                    <div className="flex items-center justify-between py-3 border-b border-slate-100">
                      <span className="text-sm text-slate-500">Subscription Valid Until</span>
                      <span className="text-sm font-semibold text-slate-900">
                        {new Date(clinic.subscriptionEndsAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between py-3">
                    <span className="text-sm text-slate-500">Member Since</span>
                    <span className="text-sm text-slate-900">
                      {clinic.createdAt ? new Date(clinic.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "—"}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">Loading plan info…</p>
              )}
            </Card>

            {/* Pricing */}
            {effectivePlanStatus !== "active" && (
              <Card className="p-6">
                <h2 className="font-semibold text-slate-900 mb-1">Upgrade to BariQ</h2>
                <p className="text-sm text-slate-500 mb-5">Pay via UPI to <span className="font-mono font-semibold text-teal-700">akshatnahata05@okibl</span>, then submit your UTR below.</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                  {[
                    { label: "Monthly", price: "₹4,999/mo" },
                    { label: "Quarterly", price: "₹12,999/qtr", note: "Save ₹1,998" },
                    { label: "Annual", price: "₹49,999/yr", note: "Save ₹9,989" },
                  ].map(p => (
                    <div key={p.label} className="border border-slate-200 rounded-xl p-4 flex sm:flex-col items-center sm:text-center justify-between sm:justify-start gap-2">
                      <p className="text-xs font-semibold text-slate-600">{p.label}</p>
                      <div className="text-right sm:text-center">
                        <p className="text-sm font-bold text-slate-900">{p.price}</p>
                        {p.note && <p className="text-[10px] text-teal-600">{p.note}</p>}
                      </div>
                    </div>
                  ))}
                </div>
                <a href="/settings" onClick={() => window.location.href = "/"} className="hidden" />
                <p className="text-xs text-slate-400 text-center">
                  Go to the payment page to submit your UTR — or{" "}
                  <a href="https://wa.me/91942457591" target="_blank" rel="noopener noreferrer" className="text-teal-700 hover:underline">WhatsApp us</a>
                </p>
              </Card>
            )}

            {/* Payment history */}
            <Card className="p-6">
              <h2 className="font-semibold text-slate-900 mb-4">Payment History</h2>
              {payments.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">No payment requests yet.</p>
              ) : (
                <div className="space-y-3">
                  {payments.map((p: any) => (
                    <div key={p.id} className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                        p.status === "approved" ? "bg-emerald-100" : p.status === "rejected" ? "bg-red-100" : "bg-amber-100"
                      )}>
                        {p.status === "approved" ? <CheckCircle className="w-4 h-4 text-emerald-600" /> :
                         p.status === "rejected" ? <XCircle className="w-4 h-4 text-red-500" /> :
                         <Clock className="w-4 h-4 text-amber-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900">
                          ₹{(p.amount / 100).toLocaleString("en-IN")}
                          {p.planType && <span className="ml-2 text-xs font-normal text-slate-500 capitalize">· {p.planType}</span>}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5 font-mono">UTR: {p.utr || "—"}</p>
                        {p.notes && <p className="text-xs text-red-500 mt-0.5">{p.notes}</p>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold",
                          p.status === "approved" ? "bg-emerald-100 text-emerald-700" :
                          p.status === "rejected" ? "bg-red-100 text-red-600" :
                          "bg-amber-100 text-amber-700"
                        )}>
                          {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                        </span>
                        <p className="text-[10px] text-slate-400 mt-1">
                          {new Date(p.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* WhatsApp Panel */}
        {activeTab === "whatsapp" && (
          <Card className="p-6 space-y-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <MessageCircle className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-900">WhatsApp Business API</h2>
                  <p className="text-xs text-slate-500">Send appointment confirmations, reminders & queue updates</p>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <span className="text-sm text-slate-600 font-medium">Enabled</span>
                <div
                  onClick={() => setWa(s => ({ ...s, enabled: !s.enabled }))}
                  className={cn(
                    "w-11 h-6 rounded-full relative transition-colors cursor-pointer",
                    wa.enabled ? "bg-emerald-500" : "bg-slate-200"
                  )}
                >
                  <div className={cn(
                    "w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-all",
                    wa.enabled ? "left-5" : "left-0.5"
                  )} />
                </div>
              </label>
            </div>

            <div className="grid gap-4">
              <div>
                <Label className="text-slate-700 mb-1.5 block">Provider</Label>
                <Select value={wa.provider} onValueChange={v => setWa(s => ({ ...s, provider: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WHATSAPP_PROVIDERS.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-slate-700 mb-1.5 block">
                  {wa.provider === "meta" ? "Access Token" : "API Token / Auth Token"}
                </Label>
                <SecretInput
                  value={wa.accessToken}
                  onChange={v => setWa(s => ({ ...s, accessToken: v }))}
                  placeholder="Paste your token here"
                />
              </div>

              {wa.provider === "meta" && (
                <>
                  <div>
                    <Label className="text-slate-700 mb-1.5 block">Phone Number ID</Label>
                    <Input
                      value={wa.phoneNumberId}
                      onChange={e => setWa(s => ({ ...s, phoneNumberId: e.target.value }))}
                      placeholder="e.g. 123456789012345"
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-slate-400 mt-1">Found in Meta Business Suite → WhatsApp → API Setup</p>
                  </div>
                  <div>
                    <Label className="text-slate-700 mb-1.5 block">WhatsApp Business Account ID (WABA ID)</Label>
                    <Input
                      value={wa.wabaId}
                      onChange={e => setWa(s => ({ ...s, wabaId: e.target.value }))}
                      placeholder="e.g. 987654321098765"
                      className="font-mono text-sm"
                    />
                  </div>
                </>
              )}

              {(wa.provider === "twilio" || wa.provider === "gupshup" || wa.provider === "wati" || wa.provider === "interakt") && (
                <div>
                  <Label className="text-slate-700 mb-1.5 block">
                    {wa.provider === "twilio" ? "From Number (WhatsApp)" : "Registered WhatsApp Number"}
                  </Label>
                  <Input
                    value={wa.phoneNumberId}
                    onChange={e => setWa(s => ({ ...s, phoneNumberId: e.target.value }))}
                    placeholder="+91XXXXXXXXXX"
                    className="font-mono text-sm"
                  />
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t border-slate-100">
              <a
                href={
                  wa.provider === "meta" ? "https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
                  : wa.provider === "twilio" ? "https://www.twilio.com/docs/whatsapp"
                  : wa.provider === "gupshup" ? "https://docs.gupshup.io"
                  : wa.provider === "wati" ? "https://docs.wati.io"
                  : "https://docs.interakt.ai"
                }
                target="_blank"
                rel="noreferrer"
                className="text-xs text-teal-700 hover:underline flex items-center gap-1"
              >
                View {WHATSAPP_PROVIDERS.find(p => p.value === wa.provider)?.label} docs
                <ChevronRight className="w-3 h-3" />
              </a>
              <Button
                onClick={() => saveMutation.mutate({ key: "whatsapp", data: wa })}
                disabled={saveMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 w-full sm:w-auto"
              >
                <Save className="w-4 h-4" />
                {saveMutation.isPending ? "Saving…" : "Save WhatsApp Settings"}
              </Button>
            </div>
          </Card>
        )}

        {/* SMS Panel */}
        {activeTab === "sms" && (
          <Card className="p-6 space-y-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-teal-700" />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-900">SMS API</h2>
                  <p className="text-xs text-slate-500">Send OTP, appointment reminders & queue position via SMS</p>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <span className="text-sm text-slate-600 font-medium">Enabled</span>
                <div
                  onClick={() => setSms(s => ({ ...s, enabled: !s.enabled }))}
                  className={cn(
                    "w-11 h-6 rounded-full relative transition-colors cursor-pointer",
                    sms.enabled ? "bg-teal-600" : "bg-slate-200"
                  )}
                >
                  <div className={cn(
                    "w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-all",
                    sms.enabled ? "left-5" : "left-0.5"
                  )} />
                </div>
              </label>
            </div>

            <div className="grid gap-4">
              <div>
                <Label className="text-slate-700 mb-1.5 block">Provider</Label>
                <Select value={sms.provider} onValueChange={v => setSms(s => ({ ...s, provider: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SMS_PROVIDERS.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-slate-700 mb-1.5 block">
                  {sms.provider === "msg91" ? "Auth Key" : sms.provider === "textlocal" ? "API Key" : "API Key / Account SID"}
                </Label>
                <SecretInput
                  value={sms.apiKey}
                  onChange={v => setSms(s => ({ ...s, apiKey: v }))}
                  placeholder="Paste your API key here"
                />
                {sms.provider === "msg91" && (
                  <p className="text-xs text-slate-400 mt-1">Get it from MSG91 Dashboard → API Keys</p>
                )}
              </div>

              <div>
                <Label className="text-slate-700 mb-1.5 block">Sender ID / From Name</Label>
                <Input
                  value={sms.senderId}
                  onChange={e => setSms(s => ({ ...s, senderId: e.target.value }))}
                  placeholder={sms.provider === "fast2sms" ? "e.g. BARIQ" : "e.g. BARIQC"}
                  className="font-mono text-sm uppercase"
                  maxLength={6}
                />
                <p className="text-xs text-slate-400 mt-1">6-character DLT-registered sender ID (India)</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t border-slate-100">
              <a
                href={
                  sms.provider === "msg91" ? "https://docs.msg91.com"
                  : sms.provider === "textlocal" ? "https://api.textlocal.in/docs"
                  : sms.provider === "fast2sms" ? "https://www.fast2sms.com/docs"
                  : sms.provider === "twilio" ? "https://www.twilio.com/docs/sms"
                  : "https://kaleyra.io/docs"
                }
                target="_blank"
                rel="noreferrer"
                className="text-xs text-teal-700 hover:underline flex items-center gap-1"
              >
                View {SMS_PROVIDERS.find(p => p.value === sms.provider)?.label} docs
                <ChevronRight className="w-3 h-3" />
              </a>
              <Button
                onClick={() => saveMutation.mutate({ key: "sms", data: sms })}
                disabled={saveMutation.isPending}
                className="bg-teal-600 hover:bg-teal-700 text-white gap-2 w-full sm:w-auto"
              >
                <Save className="w-4 h-4" />
                {saveMutation.isPending ? "Saving…" : "Save SMS Settings"}
              </Button>
            </div>
          </Card>
        )}

        {/* Info banner */}
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex gap-3 text-sm text-amber-800">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-500" />
          <p>
            API keys are stored securely and are write-only — existing keys are never returned in full.
            Actual message sending will be triggered from Queue Management and the CRM module once configured.
          </p>
        </div>
      </div>
    </Layout>
  );
}
