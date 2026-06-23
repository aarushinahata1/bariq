import { Link } from "wouter";
import {
  Activity, Clock, Users, FileText, BarChart3, Shield,
  Star, CheckCircle, ArrowRight, Stethoscope, Zap, MessageCircle,
  Pill, Package, Bell, Heart, Printer, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const stats = [
  { value: "500+", label: "Clinics" },
  { value: "15,000+", label: "Patients Managed" },
  { value: "₹5 Cr+", label: "Billing Processed" },
];

const features = [
  {
    icon: Clock,
    title: "Live Queue Management",
    desc: "Real-time digital tokens with SSE push updates. Patients track their position from their phone — no more crowded waiting rooms.",
    badge: null,
  },
  {
    icon: Heart,
    title: "Complete Patient Records",
    desc: "Full medical history per visit — vitals (BP, pulse, SpO₂, temp, weight), diagnoses, prescriptions, and a one-click printable medical summary.",
    badge: "New",
  },
  {
    icon: Pill,
    title: "Smart Pharmacy POS",
    desc: "Full pharmacy billing with FEFO auto-selection — the soonest-expiring batch is always sold first. Batch tracking, GST, and instant print invoices.",
    badge: "New",
  },
  {
    icon: Bell,
    title: "Expiry & Reorder Alerts",
    desc: "Live alerts for expired stock, medicines expiring in 7 / 30 / 90 days, and low stock. Print a purchase order for your supplier in one click.",
    badge: "New",
  },
  {
    icon: AlertTriangle,
    title: "Allergy & Safety Alerts",
    desc: "Patient allergies show as a red banner on every visit — doctors can't miss it. Blood group, age, gender always visible at a glance.",
    badge: "New",
  },
  {
    icon: FileText,
    title: "Digital Prescriptions",
    desc: "Doctors write and print prescriptions digitally. Full history per patient — expand any past Rx, reprint it, or delete it with one tap.",
  },
  {
    icon: Users,
    title: "Patient CRM",
    desc: "Full patient profiles with demographics, follow-up reminders, and funnel tracking. Never lose a patient or miss a follow-up again.",
  },
  {
    icon: BarChart3,
    title: "Billing & Analytics",
    desc: "Automated billing, cash / UPI / card tracking, daily revenue reports. Know exactly where every rupee comes from.",
  },
  {
    icon: Shield,
    title: "Multi-Role Access",
    desc: "Separate logins for doctors, receptionists, pharmacists, and admin. Each sees only what they need — no confusion, no data leaks.",
  },
];

const testimonials = [
  {
    name: "Dr. Priya Sharma",
    clinic: "Sharma Multi-Specialty Clinic — Pune",
    text: "Patient wait time dropped from 45 minutes to under 15. Our reception team is half as stressed now.",
  },
  {
    name: "Dr. Rohan Mehta",
    clinic: "Mehta Paediatrics — Mumbai",
    text: "The allergy banner and vitals tracking alone have made our clinic safer. We can't imagine going back to paper records.",
  },
  {
    name: "Dr. Kavitha Iyer",
    clinic: "Iyer Women's Clinic — Bangalore",
    text: "The pharmacy expiry alerts saved us from dispensing expired stock twice last quarter. The reorder feature is brilliant.",
  },
];

const planIncludes = [
  "Live Queue Management",
  "Digital Prescriptions",
  "Smart Pharmacy POS",
  "FEFO Batch Tracking",
  "Expiry & Reorder Alerts",
  "Allergy Safety Alerts",
  "Patient Vitals per Visit",
  "Printable Medical Records",
  "Patient CRM & Follow-ups",
  "Billing & Revenue Reports",
  "WhatsApp Integration",
  "Multi-Role Access",
  "Doctor Analytics",
  "Appointment Booking",
  "Pharmacy Billing & GST",
  "Unlimited Staff Accounts",
];

const plans = [
  {
    name: "Monthly",
    price: "₹4,999",
    per: "/month",
    note: "Pay month to month, cancel anytime",
    highlight: false,
    badge: null,
  },
  {
    name: "Quarterly",
    price: "₹12,999",
    per: "/quarter",
    note: "3 months — save ₹1,998 vs monthly",
    highlight: true,
    badge: "Save ₹1,998",
  },
  {
    name: "Annual",
    price: "₹49,999",
    per: "/year",
    note: "12 months — save ₹9,989 vs monthly",
    highlight: false,
    badge: "Best Value",
  },
];

const newHighlights = [
  {
    icon: Pill,
    title: "FEFO Pharmacy",
    body: "Automatically sells the batch closest to expiry first — reducing waste and compliance risk without any manual effort.",
  },
  {
    icon: Bell,
    title: "Smart Alerts",
    body: "Expired stock, low inventory, and near-expiry medicines all flagged in real-time with a live count badge.",
  },
  {
    icon: Package,
    title: "One-Click Reorder",
    body: "Generates a ready-to-print purchase order with suggested quantities based on minimum stock levels and reorder settings.",
  },
  {
    icon: Heart,
    title: "Vitals Per Visit",
    body: "Record BP, pulse, temperature, weight, SpO₂, and height for every appointment — inline, in seconds.",
  },
  {
    icon: AlertTriangle,
    title: "Allergy Banner",
    body: "Patient allergies appear as a red banner at the top of their history page — impossible to miss before prescribing.",
  },
  {
    icon: Printer,
    title: "Print Medical Records",
    body: "One-click printable patient summary — demographics, visit history, diagnoses, and past prescriptions.",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: "#f0f0ea", color: "#111" }}>

      {/* ── Nav ──────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-gray-200 bg-[#f0f0ea]/95 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-teal-700 rounded-lg flex items-center justify-center flex-shrink-0">
              <Stethoscope className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900">BariQ</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <button className="text-sm text-gray-600 hover:text-gray-900 font-medium px-3 py-2 transition-colors">
                Sign In
              </button>
            </Link>
            <Link href="/signup">
              <Button className="bg-teal-700 hover:bg-teal-800 text-white px-5 h-9 text-sm font-semibold rounded-lg">
                Sign Up Free
                <ArrowRight className="ml-1.5 w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="pt-24 pb-20 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 border border-gray-300 bg-white/60 text-gray-600 px-4 py-1.5 rounded-full text-sm font-medium mb-8">
            <Zap className="w-3.5 h-3.5 text-teal-600" />
            India's Most Advanced Clinic Management Platform
          </div>

          <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 leading-[1.1] mb-5">
            Run Your Clinic
            <br />
            <span className="text-teal-700">Business Smarter</span>
          </h1>

          <p className="text-lg text-gray-500 max-w-xl mx-auto mb-10 leading-relaxed">
            BariQ brings your entire clinic onto one screen — queue, patients, prescriptions, pharmacy, and billing — so you can focus on care, not paperwork.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-5">
            <Link href="/signup">
              <Button size="lg" className="bg-teal-700 hover:bg-teal-800 text-white px-8 h-12 rounded-xl font-semibold text-base shadow-md">
                Sign Up Now — 7 Day Free Trial
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="h-12 px-8 rounded-xl border-gray-300 bg-white text-gray-700 hover:bg-gray-50 font-semibold text-base">
                See a Live Demo
              </Button>
            </Link>
          </div>

          <p className="text-sm text-gray-400">
            No credit card needed · 7-day free trial · cancel anytime
            <span className="mx-3 text-gray-300">|</span>
            <Link href="/login" className="text-teal-700 hover:underline font-medium">
              Already have an account? Sign In →
            </Link>
          </p>
        </div>

        {/* Stats */}
        <div className="max-w-2xl mx-auto mt-16 grid grid-cols-3 gap-4">
          {stats.map((s) => (
            <div key={s.label} className="bg-white rounded-2xl p-6 text-center border border-gray-100 shadow-sm">
              <p className="text-3xl font-extrabold text-gray-900">{s.value}</p>
              <p className="text-sm text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── What's New ────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-teal-700">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-teal-600 border border-teal-500 text-teal-100 px-4 py-1.5 rounded-full text-sm font-semibold mb-5">
              <Zap className="w-3.5 h-3.5" /> Just Shipped
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-3">
              New: Smart Pharmacy + Complete Patient Records
            </h2>
            <p className="text-teal-200 text-lg max-w-2xl mx-auto">
              The features clinics asked for most — now live. No extra cost, no setup needed.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {newHighlights.map((h) => (
              <div key={h.title} className="bg-teal-600/50 rounded-2xl border border-teal-500/60 p-6 hover:bg-teal-600/70 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-teal-500/50 flex items-center justify-center mb-4">
                  <h.icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-white font-bold text-base mb-2">{h.title}</h3>
                <p className="text-teal-200 text-sm leading-relaxed">{h.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">
              Everything a clinic actually needs
            </h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">
              Built from the ground up for Indian clinics — whether you run a single room or a multi-doctor practice.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => (
              <div key={f.title} className="relative bg-white rounded-2xl p-7 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                {f.badge && (
                  <span className="absolute top-5 right-5 text-[10px] font-black uppercase tracking-wider bg-teal-600 text-white px-2 py-0.5 rounded-full">
                    {f.badge}
                  </span>
                )}
                <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center mb-5">
                  <f.icon className="w-5 h-5 text-teal-700" />
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pharmacy deep-dive ────────────────────────────────────── */}
      <section className="py-20 px-6" style={{ backgroundColor: "#f8f8f4" }}>
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-teal-50 border border-teal-100 text-teal-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-5">
                <Pill className="w-3.5 h-3.5" /> Pharmacy Module
              </div>
              <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-5">
                Stop losing money on expired stock
              </h2>
              <p className="text-gray-500 text-base leading-relaxed mb-8">
                BariQ's pharmacy automatically applies FEFO (First Expiry, First Out) — the closest-to-expiry batch is always sold first. Combined with live alerts and smart reorder suggestions, you'll never be caught off guard again.
              </p>
              <div className="space-y-4">
                {[
                  { icon: Bell, text: "Live alerts for expired, near-expiry (7 / 30 / 90 days), and low-stock medicines" },
                  { icon: Package, text: "Suggested reorder quantities with supplier info — print a purchase order in one click" },
                  { icon: Pill, text: "FEFO auto-selection in billing — no manual batch picking required" },
                  { icon: BarChart3, text: "Batch tracking, GST billing, and daily pharmacy revenue reports" },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-teal-50 flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="w-3.5 h-3.5 text-teal-700" />
                    </div>
                    <p className="text-gray-600 text-sm leading-relaxed">{text}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">Live Alert Preview</p>
              {[
                { label: "Expired", count: 2, color: "bg-red-100 text-red-700 border-red-200", dot: "bg-red-500" },
                { label: "Expiring in 7 days", count: 4, color: "bg-orange-100 text-orange-700 border-orange-200", dot: "bg-orange-500" },
                { label: "Expiring in 30 days", count: 11, color: "bg-yellow-100 text-yellow-700 border-yellow-200", dot: "bg-yellow-500" },
                { label: "Low stock items", count: 7, color: "bg-blue-100 text-blue-700 border-blue-200", dot: "bg-blue-500" },
              ].map(({ label, count, color, dot }) => (
                <div key={label} className={`flex items-center justify-between p-4 rounded-xl border ${color}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${dot}`} />
                    <span className="font-semibold text-sm">{label}</span>
                  </div>
                  <span className="font-black text-lg">{count}</span>
                </div>
              ))}
              <div className="pt-2">
                <div className="h-10 rounded-xl bg-teal-600 flex items-center justify-center gap-2 text-white text-sm font-semibold">
                  <Package className="w-4 h-4" /> Print Reorder List
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Patient Records deep-dive ─────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 order-2 lg:order-1">
              <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">Visit Record Preview</p>
              {/* Allergy banner */}
              <div className="flex items-start gap-3 p-3 rounded-xl bg-red-50 border border-red-200 mb-4">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-black text-red-700 text-xs">KNOWN ALLERGIES</p>
                  <p className="text-red-600 text-xs">Penicillin, Sulfa drugs</p>
                </div>
              </div>
              {/* Patient badges */}
              <div className="flex items-center gap-2 flex-wrap mb-4">
                <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-full">42 yrs</span>
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">Male</span>
                <span className="text-xs font-black text-red-600 bg-red-50 px-2 py-1 rounded-full">B+</span>
              </div>
              {/* Vitals chips */}
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Vitals — Today's Visit</p>
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="text-xs bg-red-50 text-red-600 px-2.5 py-1 rounded-full font-medium">🩸 130/85</span>
                <span className="text-xs bg-pink-50 text-pink-600 px-2.5 py-1 rounded-full font-medium">❤️ 78 bpm</span>
                <span className="text-xs bg-orange-50 text-orange-600 px-2.5 py-1 rounded-full font-medium">🌡️ 98.4°F</span>
                <span className="text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full font-medium">⚖️ 72 kg</span>
                <span className="text-xs bg-cyan-50 text-cyan-600 px-2.5 py-1 rounded-full font-medium">💨 97%</span>
              </div>
              {/* Mini prescription */}
              <div className="p-3 rounded-xl bg-purple-50 border border-purple-100 mb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase text-purple-600">Prescription · 3 meds</span>
                  <div className="flex gap-1">
                    <div className="w-6 h-6 rounded-lg bg-purple-100 flex items-center justify-center"><Printer className="w-3 h-3 text-purple-500" /></div>
                  </div>
                </div>
                <p className="text-xs font-bold text-purple-700 mb-2">Dx: Hypertension Stage 1</p>
                <div className="space-y-1">
                  {["Amlodipine 5mg · 1–0–0 · 30 days", "Telma 40mg · 0–0–1 · 30 days"].map(m => (
                    <div key={m} className="text-xs text-purple-900">{m}</div>
                  ))}
                  <div className="text-xs text-purple-500">+1 more medicine</div>
                </div>
              </div>
              <div className="h-9 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center gap-2 text-slate-500 text-xs font-semibold">
                <Printer className="w-3.5 h-3.5" /> Print Patient Summary
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <div className="inline-flex items-center gap-2 bg-teal-50 border border-teal-100 text-teal-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-5">
                <Heart className="w-3.5 h-3.5" /> Patient Records
              </div>
              <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-5">
                Everything a doctor needs at a glance
              </h2>
              <p className="text-gray-500 text-base leading-relaxed mb-8">
                Every visit now captures vitals, diagnosis, and prescription in one place. Patient allergies are impossible to miss — they appear as a red banner before you prescribe anything.
              </p>
              <div className="space-y-4">
                {[
                  { icon: AlertTriangle, text: "Allergy banner on every visit — never prescribe something a patient reacts to" },
                  { icon: Activity, text: "Record BP, pulse, SpO₂, temperature, weight, and height per appointment" },
                  { icon: FileText, text: "View, expand, print, or delete any past prescription in two clicks" },
                  { icon: Printer, text: "One-click printable medical summary with full visit history for referrals" },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-teal-50 flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="w-3.5 h-3.5 text-teal-700" />
                    </div>
                    <p className="text-gray-600 text-sm leading-relaxed">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Testimonials ─────────────────────────────────────────── */}
      <section className="py-20 px-6" style={{ backgroundColor: "#f8f8f4" }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-3">
              500+ clinics trust BariQ
            </h2>
            <p className="text-gray-500 text-lg">
              From small practices in Tier-2 cities to busy multi-doctor hospitals
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {testimonials.map((t) => (
              <div key={t.name} className="bg-white rounded-2xl p-7 border border-gray-100 shadow-sm">
                <div className="flex gap-0.5 mb-5">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} className="w-4 h-4 fill-teal-500 text-teal-500" />
                  ))}
                </div>
                <p className="text-gray-600 text-sm leading-relaxed mb-5">"{t.text}"</p>
                <div>
                  <p className="font-bold text-gray-900 text-sm">{t.name}</p>
                  <p className="text-gray-400 text-xs mt-0.5">{t.clinic}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">
              One plan. All features. No limits.
            </h2>
            <p className="text-gray-500 text-lg">
              Every plan includes the complete BariQ suite — queue, pharmacy, patient records, prescriptions, billing, and analytics.
            </p>
          </div>

          {/* What's included */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 mb-8">
            <p className="text-center text-sm font-semibold text-gray-700 mb-6">Everything included in every plan:</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-3">
              {planIncludes.map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle className="w-4 h-4 text-teal-600 flex-shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* Plan cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative bg-white rounded-2xl border p-8 shadow-sm flex flex-col ${
                  plan.highlight ? "border-teal-700 shadow-md ring-1 ring-teal-700" : "border-gray-100"
                }`}
              >
                {plan.badge && (
                  <div className={`absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold text-white ${
                    plan.highlight ? "bg-teal-700" : "bg-teal-600"
                  }`}>
                    {plan.badge}
                  </div>
                )}
                <p className="font-bold text-gray-900 text-lg mb-1">{plan.name}</p>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-extrabold text-gray-900">{plan.price}</span>
                  <span className="text-gray-500 text-sm">{plan.per}</span>
                </div>
                <p className="text-gray-400 text-sm mb-8">{plan.note}</p>
                <Link href="/signup" className="mt-auto">
                  <Button
                    className={`w-full h-11 rounded-xl font-semibold ${
                      plan.highlight
                        ? "bg-teal-700 hover:bg-teal-800 text-white"
                        : "bg-white hover:bg-gray-50 text-gray-800 border border-gray-200"
                    }`}
                  >
                    Start Free Trial
                  </Button>
                </Link>
              </div>
            ))}
          </div>

          <p className="text-center text-sm text-gray-400 mt-6">
            All plans start with a <span className="font-semibold text-gray-600">7-day free trial</span> — no credit card required. Starting at ₹4,999/month after trial.
          </p>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-12 text-center">
            <div className="w-16 h-16 bg-teal-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Stethoscope className="w-8 h-8 text-teal-700" />
            </div>
            <h2 className="text-3xl font-extrabold text-gray-900 mb-3">
              Ready to simplify your clinic?
            </h2>
            <p className="text-gray-500 mb-8 leading-relaxed">
              Join 500+ clinics already using BariQ. Your first 7 days are completely free — no setup fees, no contracts.
            </p>
            <Link href="/signup">
              <Button size="lg" className="bg-teal-700 hover:bg-teal-800 text-white px-10 h-12 rounded-xl font-semibold text-base">
                Sign Up Free
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer className="border-t border-gray-200 px-6 py-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-teal-700 rounded-lg flex items-center justify-center">
              <Stethoscope className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-gray-900">BariQ</span>
            <span className="text-gray-400 text-sm ml-1">India's Smartest Clinic Platform</span>
          </div>
          <p className="text-sm text-gray-400">© 2026 TirthonTech. Made with care for Indian clinics.</p>
          <div className="flex gap-6 text-sm text-gray-400">
            <a href="#" className="hover:text-gray-700 transition-colors">Privacy</a>
            <a href="#" className="hover:text-gray-700 transition-colors">Terms</a>
            <a href="https://wa.me/91942457591" target="_blank" rel="noopener noreferrer" className="hover:text-gray-700 transition-colors">Support</a>
          </div>
        </div>
      </footer>

      {/* ── Floating WhatsApp bubble ──────────────────────────────── */}
      <a
        href="https://wa.me/91942457591"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 w-14 h-14 bg-teal-700 hover:bg-teal-800 text-white rounded-full flex items-center justify-center shadow-lg transition-colors z-50"
        aria-label="Chat on WhatsApp"
      >
        <MessageCircle className="w-6 h-6" />
      </a>
    </div>
  );
}
