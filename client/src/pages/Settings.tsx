import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { MessageCircle, MessageSquare, CheckCircle2, AlertCircle, Eye, EyeOff, Save, ChevronRight, CreditCard, Clock, CheckCircle, XCircle, Copy, RefreshCw, Building2, QrCode, ExternalLink, Printer, Smartphone, Wifi, WifiOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import QRCode from "react-qr-code";

type Tab = "clinic" | "billing" | "whatsapp" | "sms";

const WHATSAPP_PROVIDERS = [
  { value: "web", label: "WhatsApp Web (Free — scan QR)" },
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

interface ClinicProfileSettings {
  clinicName: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  doctorName: string;
  qualifications: string;
  registrationNo: string;
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

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildQRPrintHtml(svgString: string, clinicName: string, tagline?: string | null, address?: string | null): string {
  const steps = [
    { num: "1", title: "Scan QR Code", desc: "Open your phone camera and point it at this QR code" },
    { num: "2", title: "Enter Your Details", desc: "Fill in your name and 10-digit mobile number" },
    { num: "3", title: "Choose Your Doctor", desc: "Select the doctor you want to consult today" },
    { num: "4", title: "Track Live", desc: "See your real-time queue position on your phone" },
  ];
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Patient Registration – ${esc(clinicName)}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,-apple-system,sans-serif;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
@page{size:A4;margin:0}
.page{width:210mm;min-height:297mm;display:flex;flex-direction:column;background:#fff}
.header{background:linear-gradient(135deg,#0f766e 0%,#0d9488 55%,#0891b2 100%);color:white;padding:36px 44px 32px;text-align:center}
.clinic-name{font-size:30px;font-weight:900;letter-spacing:-0.5px;margin-bottom:8px}
.tagline{font-size:14px;opacity:.85;margin-bottom:8px}
.address{font-size:12px;opacity:.7;line-height:1.6}
.body{flex:1;display:flex;flex-direction:column;align-items:center;padding:32px 44px;gap:28px}
.scan-label{font-size:12px;font-weight:700;color:#0f766e;text-transform:uppercase;letter-spacing:2.5px;text-align:center}
.qr-wrapper{border:3px solid #0f766e;border-radius:20px;padding:20px;background:#fff;box-shadow:0 8px 40px rgba(15,118,110,.12);display:flex;align-items:center;justify-content:center}
.steps-section{width:100%}
.steps-title{font-size:15px;font-weight:700;color:#1e293b;text-align:center;margin-bottom:18px}
.steps-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.step-card{background:#f0fdfa;border:1.5px solid #99f6e4;border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:8px}
.step-num{width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#0f766e,#0d9488);color:white;font-size:15px;font-weight:900;display:flex;align-items:center;justify-content:center}
.step-title{font-size:13px;font-weight:700;color:#0f766e}
.step-desc{font-size:11.5px;color:#475569;line-height:1.55}
.footer{background:#f8fafc;border-top:1.5px solid #e2e8f0;padding:14px 44px;display:flex;align-items:center;justify-content:space-between}
.brand{display:flex;align-items:center;gap:8px}
.brand-dot{width:22px;height:22px;border-radius:7px;background:linear-gradient(135deg,#0f766e,#0d9488);color:white;font-weight:900;font-size:12px;display:flex;align-items:center;justify-content:center}
.brand-name{font-size:14px;font-weight:900;color:#1e293b}
.footer-note{font-size:11px;color:#94a3b8}
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="clinic-name">${esc(clinicName)}</div>
    ${tagline ? `<div class="tagline">${esc(tagline)}</div>` : ""}
    ${address ? `<div class="address">${esc(address).replace(/\n/g, "<br>")}</div>` : ""}
  </div>
  <div class="body">
    <div class="scan-label">Scan to Register &amp; Join the Queue</div>
    <div class="qr-wrapper">${svgString}</div>
    <div class="steps-section">
      <div class="steps-title">How it works — 4 simple steps</div>
      <div class="steps-grid">
        ${steps.map(s => `<div class="step-card"><div class="step-num">${s.num}</div><div class="step-title">${s.title}</div><div class="step-desc">${s.desc}</div></div>`).join("")}
      </div>
    </div>
  </div>
  <div class="footer">
    <div class="brand"><div class="brand-dot">B</div><div class="brand-name">BariQ</div></div>
    <div class="footer-note">Smart Queue Management for Modern Clinics</div>
  </div>
</div>
<script>window.onload=()=>window.print()</script>
</body>
</html>`;
}

function RegistrationQR({ token, clinicName, tagline, address }: { token: string; clinicName?: string; tagline?: string; address?: string }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);
  const regUrl = `${window.location.origin}/register/${token}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(regUrl);
      setCopied(true);
      toast({ title: "Link copied!", description: "Share this with patients or print it near the QR code." });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const handleDownload = () => {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgData], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "patient-registration-qr.svg";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGElement;
    clone.setAttribute("width", "280");
    clone.setAttribute("height", "280");
    const svgString = new XMLSerializer().serializeToString(clone);
    const html = buildQRPrintHtml(svgString, clinicName || "Our Clinic", tagline, address);
    const win = window.open("", "_blank");
    if (!win) { toast({ title: "Pop-up blocked", description: "Allow pop-ups for this site to print the poster.", variant: "destructive" }); return; }
    win.document.write(html);
    win.document.close();
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
        <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center">
          <QrCode className="w-5 h-5 text-teal-700" />
        </div>
        <div>
          <h2 className="font-semibold text-slate-900">Patient Self-Registration</h2>
          <p className="text-xs text-slate-500">Patients scan this QR code to join the queue themselves</p>
        </div>
      </div>

      <div className="mt-5 flex flex-col sm:flex-row items-center gap-6">
        {/* QR code */}
        <div ref={qrRef} className="shrink-0 p-4 bg-white rounded-2xl border-2 border-slate-100 shadow-sm">
          <QRCode
            value={regUrl}
            size={160}
            fgColor="#0f766e"
            bgColor="#ffffff"
            level="M"
          />
        </div>

        {/* Info + actions */}
        <div className="flex-1 w-full space-y-4">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Registration Link</p>
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
              <p className="text-xs text-slate-500 font-mono break-all leading-relaxed">{regUrl}</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={handlePrint}
              className="flex-1 rounded-xl h-10 bg-teal-600 hover:bg-teal-700"
            >
              <Printer className="w-4 h-4 mr-2" /> Print Poster
            </Button>
            <Button
              onClick={handleCopy}
              variant="outline"
              className="flex-1 rounded-xl h-10"
            >
              {copied
                ? <><CheckCircle className="w-4 h-4 mr-2" /> Copied!</>
                : <><Copy className="w-4 h-4 mr-2" /> Copy Link</>}
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleDownload}
              className="flex-1 rounded-xl h-9 text-sm"
            >
              <QrCode className="w-4 h-4 mr-2" /> Download QR
            </Button>
            <a
              href={regUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors shrink-0"
              title="Preview registration page"
            >
              <ExternalLink className="w-4 h-4 text-slate-500" />
            </a>
          </div>

          <div className="bg-teal-50 border border-teal-100 rounded-xl p-3.5 space-y-1.5">
            <p className="text-xs font-semibold text-teal-800">How to use</p>
            <ul className="text-xs text-teal-700 space-y-1">
              <li>• Print and place the QR code at your reception desk or waiting area</li>
              <li>• Patients scan it with their phone camera to self-register</li>
              <li>• New registrations appear in your queue instantly</li>
            </ul>
          </div>
        </div>
      </div>
    </Card>
  );
}

function WhatsAppWebPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: statusData, refetch } = useQuery<{ status: string; qr?: string }>({
    queryKey: ["/api/whatsapp-web/status"],
    queryFn: async () => {
      const r = await fetch("/api/whatsapp-web/status", { credentials: "include" });
      return r.json();
    },
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      return s === "connecting" || s === "qr" ? 3000 : false;
    },
  });

  const status = statusData?.status ?? "disconnected";
  const qr = statusData?.qr;

  const connect = async () => {
    const r = await fetch("/api/whatsapp-web/connect", { method: "POST", credentials: "include" });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      toast({ title: "Failed to start", description: err.message, variant: "destructive" });
      return;
    }
    refetch();
  };

  const disconnect = async () => {
    await fetch("/api/whatsapp-web/disconnect", { method: "POST", credentials: "include" });
    refetch();
    toast({ title: "WhatsApp Web disconnected" });
  };

  return (
    <div className="mt-2 p-4 rounded-xl border border-slate-100 bg-slate-50 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-slate-600" />
          <span className="text-sm font-semibold text-slate-700">WhatsApp Web Connection</span>
        </div>
        <span className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold",
          status === "ready" ? "bg-emerald-100 text-emerald-700" :
          status === "qr" || status === "connecting" ? "bg-amber-100 text-amber-700" :
          "bg-slate-100 text-slate-500"
        )}>
          {status === "ready" && <><Wifi className="w-3 h-3" /> Connected</>}
          {(status === "connecting") && <><Loader2 className="w-3 h-3 animate-spin" /> Connecting…</>}
          {status === "qr" && <><Loader2 className="w-3 h-3 animate-spin" /> Scan QR</>}
          {status === "disconnected" && <><WifiOff className="w-3 h-3" /> Disconnected</>}
        </span>
      </div>

      {status === "ready" && (
        <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <div>
            <p className="text-sm font-semibold text-emerald-800">WhatsApp is connected</p>
            <p className="text-xs text-emerald-700 mt-0.5">Messages will be sent via your linked WhatsApp account</p>
          </div>
          <Button size="sm" variant="outline" onClick={disconnect} className="rounded-xl text-red-600 border-red-200 hover:bg-red-50">
            Disconnect
          </Button>
        </div>
      )}

      {status === "qr" && qr && (
        <div className="flex flex-col items-center gap-3 py-2">
          <p className="text-sm text-slate-600 text-center">Open WhatsApp on your phone → three dots → Linked Devices → Link a Device → scan below</p>
          <div className="p-4 bg-white rounded-2xl border-2 border-emerald-200 shadow-sm">
            <QRCode value={qr} size={200} fgColor="#166534" bgColor="#ffffff" level="M" />
          </div>
          <p className="text-xs text-slate-400">QR refreshes automatically. Keep this page open while scanning.</p>
        </div>
      )}

      {status === "connecting" && (
        <div className="flex flex-col items-center gap-2 py-4 text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
          <p className="text-sm">Starting WhatsApp Web client…</p>
        </div>
      )}

      {status === "disconnected" && (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            Connect your WhatsApp account to send messages without any API keys.
            The phone must stay connected to the internet.
          </p>
          <Button onClick={connect} className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 gap-2">
            <Smartphone className="w-4 h-4" /> Connect WhatsApp Web
          </Button>
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-2.5 leading-relaxed">
            <strong>Note:</strong> This uses an unofficial WhatsApp Web bridge. Use a secondary number to avoid your primary number being blocked. Suitable for low-volume clinic notifications.
          </p>
        </div>
      )}
    </div>
  );
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState<Tab>("clinic");
  const { toast } = useToast();
  const qc = useQueryClient();
  const { clinic } = useAuth();

  const now = new Date();
  const isSubExpired = clinic?.planStatus === "active" && !!clinic.subscriptionEndsAt && new Date(clinic.subscriptionEndsAt) < now;
  const isTrialExpired = clinic?.planStatus === "trial" && !!clinic.trialEndsAt && new Date(clinic.trialEndsAt) < now;
  const effectivePlanStatus = (isSubExpired || isTrialExpired) ? "expired" : (clinic?.planStatus ?? "trial");

  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "quarterly" | "annual">("quarterly");
  const [utr, setUtr] = useState("");
  const [upiCopied, setUpiCopied] = useState(false);

  const UPI_ID = "akshatnahata05@okibl";
  const PLANS = [
    { key: "monthly" as const, label: "Monthly", display: "₹4,999/mo" },
    { key: "quarterly" as const, label: "Quarterly", display: "₹12,999/qtr", note: "Save ₹1,998" },
    { key: "annual" as const, label: "Annual", display: "₹49,999/yr", note: "Save ₹9,989" },
  ];

  const submitPayment = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/payments", { utr: utr.trim(), planType: selectedPlan });
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/payments"] });
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Payment submitted", description: "We'll verify and activate your account shortly." });
      setUtr("");
    },
    onError: (err: Error) => {
      let description = err.message;
      try {
        const match = err.message.match(/^\d+: (.+)$/s);
        if (match) {
          const body = JSON.parse(match[1]);
          if (body.message) description = body.message;
        }
      } catch {}
      toast({ title: "Submission failed", description, variant: "destructive" });
    },
  });

  function handleUpiCopy() {
    navigator.clipboard.writeText(UPI_ID);
    setUpiCopied(true);
    setTimeout(() => setUpiCopied(false), 2000);
  }

  const { data: settings, isLoading } = useQuery<Record<string, any>>({
    queryKey: ["/api/settings"],
    queryFn: async () => {
      const r = await fetch("/api/settings", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch settings");
      return r.json();
    },
  });

  const [wa, setWa] = useState<WhatsAppSettings>({ provider: "meta", accessToken: "", phoneNumberId: "", wabaId: "", enabled: false });
  const [sms, setSms] = useState<SmsSettings>({ provider: "msg91", apiKey: "", senderId: "", enabled: false });
  const [clinicProfile, setClinicProfile] = useState<ClinicProfileSettings>({
    clinicName: "", tagline: "", address: "", phone: "", email: "",
    doctorName: "", qualifications: "", registrationNo: "",
  });

  useEffect(() => {
    if (!settings) return;
    if (settings.whatsapp) setWa(s => ({ ...s, ...settings.whatsapp }));
    if (settings.sms) setSms(s => ({ ...s, ...settings.sms }));
    if (settings.clinicProfile) setClinicProfile(s => ({ ...s, ...settings.clinicProfile }));
    else if (clinic?.name && !clinicProfile.clinicName) setClinicProfile(s => ({ ...s, clinicName: clinic.name }));
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async ({ key, data }: { key: string; data: any }) => {
      const r = await fetch(`/api/settings/${key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: (_, { key }) => {
      qc.invalidateQueries({ queryKey: ["/api/settings"] });
      const labels: Record<string, string> = { whatsapp: "WhatsApp", sms: "SMS", clinicProfile: "Clinic profile" };
      toast({ title: `${labels[key] || "Settings"} saved` });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    },
  });

  const { data: payments = [] } = useQuery<any[]>({
    queryKey: ["/api/payments"],
    queryFn: () => apiRequest("GET", "/api/payments").then(r => r.json()),
  });

  const hasPending = payments.some((p: any) => p.status === "pending");

  const tabs: { id: Tab; label: string; icon: typeof MessageCircle; color: string }[] = [
    { id: "clinic", label: "Clinic Profile", icon: Building2, color: "text-teal-700" },
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
            // Messaging tabs show their own enabled/disabled badge; billing tab has no such concept
            const messagingEnabled = tab.id === "whatsapp"
              ? (active ? wa.enabled : !!settings?.whatsapp?.enabled)
              : tab.id === "sms"
              ? (active ? sms.enabled : !!settings?.sms?.enabled)
              : null;
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
                {!isLoading && messagingEnabled !== null && <StatusBadge enabled={messagingEnabled} />}
              </button>
            );
          })}
        </div>

        {/* Clinic Profile Panel */}
        {activeTab === "clinic" && (
          <div className="space-y-5">
            <Card className="p-6 space-y-5">
              <div className="flex items-center gap-3 pb-1">
                <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-teal-700" />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-900">Clinic Profile</h2>
                  <p className="text-xs text-slate-500">Shown on printed receipts and prescriptions</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Clinic / Hospital Name *</Label>
                  <Input
                    value={clinicProfile.clinicName}
                    onChange={e => setClinicProfile(s => ({ ...s, clinicName: e.target.value }))}
                    placeholder="e.g. City Multi-Specialty Clinic"
                    className="rounded-xl h-11"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Tagline <span className="text-slate-400 font-normal">(optional)</span></Label>
                  <Input
                    value={clinicProfile.tagline}
                    onChange={e => setClinicProfile(s => ({ ...s, tagline: e.target.value }))}
                    placeholder="e.g. Compassionate care for every patient"
                    className="rounded-xl h-11"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Address</Label>
                  <Textarea
                    value={clinicProfile.address}
                    onChange={e => setClinicProfile(s => ({ ...s, address: e.target.value }))}
                    placeholder="123, Main Street, City, State - 400001"
                    className="rounded-xl resize-none h-20"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Phone</Label>
                  <Input
                    value={clinicProfile.phone}
                    onChange={e => setClinicProfile(s => ({ ...s, phone: e.target.value }))}
                    placeholder="+91 98765 43210"
                    className="rounded-xl h-11"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Email</Label>
                  <Input
                    type="email"
                    value={clinicProfile.email}
                    onChange={e => setClinicProfile(s => ({ ...s, email: e.target.value }))}
                    placeholder="clinic@example.com"
                    className="rounded-xl h-11"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">Doctor Details — for Prescriptions</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Doctor Name</Label>
                    <Input
                      value={clinicProfile.doctorName}
                      onChange={e => setClinicProfile(s => ({ ...s, doctorName: e.target.value }))}
                      placeholder="Dr. Firstname Lastname"
                      className="rounded-xl h-11"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Qualifications</Label>
                    <Input
                      value={clinicProfile.qualifications}
                      onChange={e => setClinicProfile(s => ({ ...s, qualifications: e.target.value }))}
                      placeholder="MBBS, MD (Medicine)"
                      className="rounded-xl h-11"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700 mb-1.5 block">Medical Registration No.</Label>
                    <Input
                      value={clinicProfile.registrationNo}
                      onChange={e => setClinicProfile(s => ({ ...s, registrationNo: e.target.value }))}
                      placeholder="e.g. MCI-123456"
                      className="rounded-xl h-11"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={() => saveMutation.mutate({ key: "clinicProfile", data: clinicProfile })}
                  disabled={saveMutation.isPending || !clinicProfile.clinicName.trim()}
                  className="bg-teal-600 hover:bg-teal-700 text-white gap-2 rounded-xl h-11 px-6"
                >
                  <Save className="w-4 h-4" />
                  {saveMutation.isPending ? "Saving…" : "Save Clinic Profile"}
                </Button>
              </div>
            </Card>

            {/* Patient Self-Registration QR Code */}
            {settings?.registrationToken && (
              <RegistrationQR
                token={settings.registrationToken}
                clinicName={clinicProfile.clinicName || clinic?.name || ""}
                tagline={clinicProfile.tagline}
                address={clinicProfile.address}
              />
            )}
          </div>
        )}

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

            {/* Payment form */}
            {effectivePlanStatus !== "active" && (
              <Card className="p-6 space-y-5">
                <div>
                  <h2 className="font-semibold text-slate-900">Upgrade to BariQ</h2>
                  <p className="text-sm text-slate-500 mt-0.5">Choose a plan, pay via UPI, then paste your UTR to activate.</p>
                </div>

                {hasPending ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                    <Clock className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-amber-800">Payment under review</p>
                      <p className="text-xs text-amber-700 mt-0.5">Your payment request is being verified. We'll activate your account shortly. Questions? <a href="https://wa.me/91942457591" target="_blank" rel="noopener noreferrer" className="underline">WhatsApp us</a>.</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Plan selector */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {PLANS.map(p => (
                        <button
                          key={p.key}
                          type="button"
                          onClick={() => setSelectedPlan(p.key)}
                          className={cn(
                            "relative rounded-xl border-2 p-4 text-left transition-all",
                            selectedPlan === p.key ? "border-teal-600 bg-teal-50" : "border-slate-200 hover:border-slate-300"
                          )}
                        >
                          {p.key === "quarterly" && (
                            <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-teal-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">Popular</span>
                          )}
                          <p className="text-xs font-semibold text-slate-600">{p.label}</p>
                          <p className="text-base font-bold text-slate-900 mt-0.5">{p.display}</p>
                          {p.note && <p className="text-[10px] text-teal-600 font-medium">{p.note}</p>}
                        </button>
                      ))}
                    </div>

                    {/* Step 1 — UPI */}
                    <div className="bg-teal-50 border border-teal-100 rounded-xl p-4 space-y-2">
                      <p className="text-xs font-semibold text-slate-700">Step 1 — Pay via UPI</p>
                      <div className="flex items-center gap-3 bg-white rounded-lg border border-teal-200 px-4 py-3">
                        <span className="font-mono font-semibold text-slate-900 flex-1 text-sm">{UPI_ID}</span>
                        <button
                          type="button"
                          onClick={handleUpiCopy}
                          className="flex items-center gap-1.5 text-xs text-teal-700 font-medium hover:text-teal-800 transition-colors"
                        >
                          {upiCopied ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          {upiCopied ? "Copied!" : "Copy"}
                        </button>
                      </div>
                      <p className="text-xs text-slate-500">Open GPay, PhonePe, or Paytm → pay to UPI ID above → note the UTR / Ref No.</p>
                    </div>

                    {/* Step 2 — UTR */}
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-slate-700">Step 2 — Enter UTR / Reference Number</Label>
                      <Input
                        value={utr}
                        onChange={e => setUtr(e.target.value)}
                        placeholder="e.g. 423198765432 (12-digit UTR from your payment app)"
                        className="font-mono h-11 rounded-xl"
                      />
                      <p className="text-xs text-slate-400">Find this in your UPI app under transaction details.</p>
                    </div>

                    <Button
                      onClick={() => submitPayment.mutate()}
                      disabled={!utr.trim() || submitPayment.isPending}
                      className="w-full h-11 rounded-xl bg-teal-600 hover:bg-teal-700 font-semibold"
                    >
                      {submitPayment.isPending ? (
                        <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Submitting…</>
                      ) : "Submit Payment Request"}
                    </Button>
                    <p className="text-center text-xs text-slate-400">
                      Need help?{" "}
                      <a href="https://wa.me/91942457591" target="_blank" rel="noopener noreferrer" className="text-teal-700 hover:underline">WhatsApp us</a>
                    </p>
                  </>
                )}
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

              {wa.provider !== "web" && (
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
              )}

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

            {wa.provider === "web" && <WhatsAppWebPanel />}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t border-slate-100">
              {wa.provider !== "web" ? (
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
              ) : <div />}
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
