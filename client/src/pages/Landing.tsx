import { useState } from "react";
import { Link } from "wouter";
import {
  Activity, Clock, Users, FileText, BarChart3, Shield,
  Star, CheckCircle, ArrowRight, Stethoscope, Zap, MessageCircle,
  Pill, Package, Bell, Heart, Printer, AlertTriangle, Menu, X, Phone, Mail, MapPin,
  Handshake, IndianRupee, Link2, QrCode, Wallet, Truck, Layers, Sparkles,
  ShieldCheck, Globe, Smile, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const WHATSAPP = "https://wa.me/919424575918";

const stats = [
  { value: "120+", label: "Clinics" },
  { value: "15,000+", label: "Patients Managed" },
  { value: "₹5 Cr+", label: "Billing Processed" },
];

const features = [
  {
    icon: Clock,
    title: "Live Queue Management",
    desc: "Live digital tokens with instant push updates. Patients track their position from their phone. No more crowded waiting rooms.",
    badge: null,
  },
  {
    icon: QrCode,
    title: "Kiosk Self Check In",
    desc: "Patients scan a QR code, enter their phone number, and join the queue themselves. No receptionist typing required at peak hours.",
    badge: "New",
  },
  {
    icon: Heart,
    title: "Complete Patient Records",
    desc: "Full medical history per visit: vitals (BP, pulse, SpO₂, temperature, weight), diagnoses, prescriptions, and a one tap printable medical summary.",
    badge: "New",
  },
  {
    icon: Pill,
    title: "Smart Pharmacy POS",
    desc: "Full pharmacy billing with FEFO auto selection. The batch closest to expiry is always sold first. Batch tracking, GST, and instant print invoices.",
    badge: "New",
  },
  {
    icon: Bell,
    title: "Expiry and Reorder Alerts",
    desc: "Live alerts for expired stock, medicines nearing expiry in 7, 30, or 90 days, and low stock. Print a purchase order for your supplier in one tap.",
    badge: "New",
  },
  {
    icon: AlertTriangle,
    title: "Allergy and Safety Alerts",
    desc: "Patient allergies show as a red banner on every visit. Doctors can't miss it. Blood group, age, and gender always visible at a glance.",
    badge: "New",
  },
  {
    icon: Wallet,
    title: "Daily Cash Reconciliation",
    desc: "Close every day with expected versus actual cash, UPI, card, and online totals reconciled in one screen. Catch shortfalls the same day.",
    badge: "New",
  },
  {
    icon: Truck,
    title: "Suppliers and Wastage Tracking",
    desc: "A directory of pharmacy suppliers with payment terms and lead times, plus a clean log of returns and written off stock with the reason and cost.",
    badge: "New",
  },
  {
    icon: FileText,
    title: "Digital Prescriptions",
    desc: "Doctors write and print prescriptions digitally. Full history per patient. Expand any past prescription, reprint it, or delete it with one tap.",
  },
  {
    icon: Users,
    title: "Patient CRM and Campaigns",
    desc: "Full patient profiles with demographics, follow up reminders, funnel tracking, and bulk WhatsApp or SMS campaigns to any patient list.",
  },
  {
    icon: BarChart3,
    title: "Billing and Analytics",
    desc: "Automated billing, cash, UPI, and card tracking, and daily revenue reports. Know exactly where every rupee comes from.",
  },
  {
    icon: Shield,
    title: "Role Based Access",
    desc: "Separate logins for doctors, receptionists, pharmacists, and admins. Each sees only what they need. No confusion, no data leaks.",
  },
];

const specialtyModules = [
  {
    icon: Smile,
    title: "Dental Charting",
    body: "A full tooth by tooth chart for permanent or primary dentition, with condition, surfaces, and a running treatment log per patient.",
  },
  {
    icon: Activity,
    title: "Ortho and Physio Body Charts",
    body: "Region by region charting for orthopaedic and physiotherapy practices, with severity and a treatment history over time.",
  },
];

const whyBariq = [
  {
    icon: Layers,
    title: "One platform, not five",
    body: "Queue, patient records, prescriptions, pharmacy, billing, and CRM live in one screen instead of five disconnected tools that never sync with each other.",
  },
  {
    icon: Globe,
    title: "Built for Indian clinics",
    body: "GST billing, cash, UPI, and card reconciliation, WhatsApp first patient communication, and queue windows that respect IST. Not a template built for another market.",
  },
  {
    icon: Zap,
    title: "Real time by default",
    body: "Every queue update reaches a patient's phone and the waiting room screen instantly over a live connection, not a page they refresh every few minutes.",
  },
  {
    icon: ShieldCheck,
    title: "Safety built into the visit",
    body: "Allergy banners and vitals sit inside the patient's record itself, right where a doctor is prescribing, not in a form nobody opens.",
  },
  {
    icon: Sparkles,
    title: "Pharmacy that thinks ahead",
    body: "FEFO batch selection, expiry alerts, and one tap reorder mean fewer expired shelves and fewer last minute calls to your supplier.",
  },
  {
    icon: IndianRupee,
    title: "Fair, human pricing",
    body: "A plan sized to your clinic instead of a rigid rate card, a real 7 day trial, and no credit card required to start.",
  },
];

const testimonials = [
  {
    name: "Dr. Priya Sharma",
    clinic: "Sharma Multispecialty Clinic, Pune",
    text: "Patient wait time dropped from 45 minutes to under 15. Our reception team is half as stressed now.",
  },
  {
    name: "Dr. Rohan Mehta",
    clinic: "Mehta Paediatrics, Mumbai",
    text: "The allergy banner and vitals tracking alone have made our clinic safer. We can't imagine going back to paper records.",
  },
  {
    name: "Dr. Kavitha Iyer",
    clinic: "Iyer Women's Clinic, Bangalore",
    text: "The pharmacy expiry alerts saved us from dispensing expired stock twice last quarter. The reorder feature is brilliant.",
  },
];

const planIncludes = [
  "Live Queue Management",
  "Kiosk Self Check In",
  "Digital Prescriptions",
  "Smart Pharmacy POS",
  "FEFO Batch Tracking",
  "Expiry and Reorder Alerts",
  "Allergy Safety Alerts",
  "Patient Vitals per Visit",
  "Printable Medical Records",
  "Dental Charting Module",
  "Ortho and Physio Charting",
  "Daily Cash Reconciliation",
  "Supplier and Wastage Log",
  "Patient CRM and Follow Ups",
  "Bulk WhatsApp and SMS",
  "Billing and Revenue Reports",
  "Role Based Access",
  "Doctor Analytics",
  "Appointment Booking",
  "Pharmacy Billing and GST",
  "Unlimited Staff Accounts",
];

const newHighlights = [
  {
    icon: Pill,
    title: "FEFO Pharmacy",
    body: "Automatically sells the batch closest to expiry first, reducing waste and compliance risk without any manual effort.",
  },
  {
    icon: Bell,
    title: "Smart Alerts",
    body: "Expired stock, low inventory, and near expiry medicines all flagged instantly with a live count badge.",
  },
  {
    icon: Package,
    title: "One Tap Reorder",
    body: "Generates a ready to print purchase order with suggested quantities based on minimum stock levels and reorder settings.",
  },
  {
    icon: Heart,
    title: "Vitals Per Visit",
    body: "Record BP, pulse, temperature, weight, SpO₂, and height for every appointment, inline and in seconds.",
  },
  {
    icon: AlertTriangle,
    title: "Allergy Banner",
    body: "Patient allergies appear as a red banner at the top of their history page. Impossible to miss before prescribing.",
  },
  {
    icon: Printer,
    title: "Print Medical Records",
    body: "One tap printable patient summary with demographics, visit history, diagnoses, and past prescriptions.",
  },
];

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Pharmacy", href: "#pharmacy" },
  { label: "Patient Records", href: "#records" },
  { label: "Why BariQ", href: "#why-bariq" },
  { label: "Partners", href: "#partner" },
  { label: "FAQ", href: "#faq" },
  { label: "Contact", href: "#contact" },
];

const partnerPerks = [
  {
    icon: Link2,
    title: "Your own referral code",
    body: "Sign up as a partner and get a unique code to share with clinics you bring on board.",
  },
  {
    icon: Users,
    title: "Track every client",
    body: "See every clinic that signed up under your code, and their subscription status, in your own dashboard.",
  },
  {
    icon: IndianRupee,
    title: "Earn commission",
    body: "Get paid a share of the subscription revenue for every clinic you refer, for as long as they stay subscribed.",
  },
];

const faqs = [
  {
    q: "Is there a setup fee or a long term contract?",
    a: "No. BariQ starts with a free 7 day trial with full platform access and no credit card required. Pricing after that is a plan built around your clinic's size, not a fixed rate card, and there is no long term lock in.",
  },
  {
    q: "Do I need a paid WhatsApp Business API to use WhatsApp features?",
    a: "No. You can connect WhatsApp Web by scanning a QR code from your own phone, or connect a Meta Business API or Twilio account if you already have one. Either way, patients get queue links and reminders on WhatsApp.",
  },
  {
    q: "Can more than one doctor use BariQ at the same clinic?",
    a: "Yes. Each doctor gets their own live queue and console, and receptionists, pharmacists, and admins each get their own role with only the access they need.",
  },
  {
    q: "Is patient data secure?",
    a: "Every clinic's data is kept separate at the database level, staff logins are role based, and passwords are never stored in plain text. Only your own team can see your patients' records.",
  },
  {
    q: "What if my clinic is a dental or physiotherapy practice?",
    a: "BariQ includes opt in dental charting and ortho and physio body charts, so specialty clinics get the tools they need without cluttering the interface for clinics that do not.",
  },
  {
    q: "How is BariQ different from a paper register or a spreadsheet?",
    a: "A paper register cannot alert you before a medicine expires, text a patient their queue number, or show a doctor a patient's allergies before they prescribe. BariQ does all of that automatically, from one screen.",
  },
];

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function Landing() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: "#f0f0ea", color: "#111" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-gray-200 bg-[#f0f0ea]/95 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 bg-teal-700 rounded-lg flex items-center justify-center">
              <Stethoscope className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900">BariQ</span>
          </div>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map(l => (
              <a key={l.label} href={l.href}
                className="text-sm text-gray-600 hover:text-gray-900 font-medium px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors">
                {l.label}
              </a>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-2">
            <Link href="/login">
              <button className="text-sm text-gray-600 hover:text-gray-900 font-medium px-3 py-2 transition-colors">
                Sign In
              </button>
            </Link>
            <Link href="/signup">
              <Button className="bg-teal-700 hover:bg-teal-800 text-white px-5 h-9 text-sm font-semibold rounded-lg">
                Get Started
                <ArrowRight className="ml-1.5 w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
            onClick={() => setMobileOpen(v => !v)}>
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-gray-200 bg-[#f0f0ea] px-6 py-4 space-y-1">
            {navLinks.map(l => (
              <a key={l.label} href={l.href} onClick={() => setMobileOpen(false)}
                className="block text-sm text-gray-700 font-medium px-3 py-2.5 rounded-lg hover:bg-gray-100 transition-colors">
                {l.label}
              </a>
            ))}
            <div className="border-t border-gray-200 pt-3 mt-3 flex flex-col gap-2">
              <Link href="/login" onClick={() => setMobileOpen(false)}>
                <button className="w-full text-sm text-gray-700 font-medium px-3 py-2.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors">
                  Sign In
                </button>
              </Link>
              <Link href="/signup" onClick={() => setMobileOpen(false)}>
                <Button className="w-full bg-teal-700 hover:bg-teal-800 text-white h-10 text-sm font-semibold rounded-lg">
                  Get Started Free
                </Button>
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Hero */}
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
            BariQ is clinic management software that brings your entire clinic onto one screen: queue, patients, prescriptions, pharmacy, and billing. Focus on care, not paperwork.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-5">
            <Link href="/signup">
              <Button size="lg" className="bg-teal-700 hover:bg-teal-800 text-white px-8 h-12 rounded-xl font-semibold text-base shadow-md">
                Start Free Trial
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
            <a href={WHATSAPP} target="_blank" rel="noopener noreferrer">
              <Button size="lg" variant="outline" className="h-12 px-8 rounded-xl border-gray-300 bg-white text-gray-700 hover:bg-gray-50 font-semibold text-base gap-2">
                <MessageCircle className="w-4 h-4" /> Talk to Us
              </Button>
            </a>
          </div>

          <p className="text-sm text-gray-400">
            7 day free trial · no credit card required · full access from day one
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

      {/* What's New */}
      <section className="py-20 px-6 bg-teal-700">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-teal-600 border border-teal-500 text-teal-100 px-4 py-1.5 rounded-full text-sm font-semibold mb-5">
              <Zap className="w-3.5 h-3.5" /> Just Shipped
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-3">
              New: Smart Pharmacy Plus Complete Patient Records
            </h2>
            <p className="text-teal-200 text-lg max-w-2xl mx-auto">
              The features clinics asked for most, now live. No extra cost, no setup needed.
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

      {/* Features */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">
              Everything a clinic actually needs
            </h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">
              Built from the ground up for Indian clinics, whether you run a solo practice or a clinic with many doctors.
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

      {/* Specialty modules */}
      <section className="py-20 px-6" style={{ backgroundColor: "#f8f8f4" }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-teal-50 border border-teal-100 text-teal-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-5">
              <Layers className="w-3.5 h-3.5" /> Specialty Modules
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">
              Extra tools for specialty clinics
            </h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">
              Dental and orthopaedic or physiotherapy practices get dedicated charting on top of everything else. Turn them on only if you need them.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-3xl mx-auto">
            {specialtyModules.map((m) => (
              <div key={m.title} className="bg-white rounded-2xl p-7 border border-gray-100 shadow-sm">
                <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center mb-5">
                  <m.icon className="w-5 h-5 text-teal-700" />
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-2">{m.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{m.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pharmacy deep dive */}
      <section id="pharmacy" className="py-20 px-6">
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
                BariQ's pharmacy automatically applies FEFO (First Expiry, First Out). The batch closest to expiry is always sold first. Combined with live alerts and smart reorder suggestions, you'll never be caught off guard again.
              </p>
              <div className="space-y-4">
                {[
                  { icon: Bell, text: "Live alerts for expired stock, medicines nearing expiry in 7, 30, or 90 days, and low stock levels" },
                  { icon: Package, text: "Suggested reorder quantities with supplier info. Print a purchase order in one tap." },
                  { icon: Pill, text: "FEFO batch selection happens automatically during billing. No manual batch picking required." },
                  { icon: Truck, text: "A supplier directory with payment terms and lead times, plus a returns and wastage log with cost impact" },
                  { icon: Wallet, text: "Daily cash, UPI, card, and online reconciliation, and GST ready billing and revenue reports" },
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

      {/* Patient Records deep dive */}
      <section id="records" className="py-20 px-6" style={{ backgroundColor: "#f8f8f4" }}>
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 order-2 lg:order-1">
              <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">Visit Record Preview</p>
              <div className="flex items-start gap-3 p-3 rounded-xl bg-red-50 border border-red-200 mb-4">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-black text-red-700 text-xs">KNOWN ALLERGIES</p>
                  <p className="text-red-600 text-xs">Penicillin, Sulfa drugs</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap mb-4">
                <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-full">42 yrs</span>
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">Male</span>
                <span className="text-xs font-black text-red-600 bg-red-50 px-2 py-1 rounded-full">B+</span>
              </div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Vitals · Today's Visit</p>
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="text-xs bg-red-50 text-red-600 px-2.5 py-1 rounded-full font-medium">🩸 130/85</span>
                <span className="text-xs bg-pink-50 text-pink-600 px-2.5 py-1 rounded-full font-medium">❤️ 78 bpm</span>
                <span className="text-xs bg-orange-50 text-orange-600 px-2.5 py-1 rounded-full font-medium">🌡️ 98.4°F</span>
                <span className="text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full font-medium">⚖️ 72 kg</span>
                <span className="text-xs bg-cyan-50 text-cyan-600 px-2.5 py-1 rounded-full font-medium">💨 97%</span>
              </div>
              <div className="p-3 rounded-xl bg-purple-50 border border-purple-100 mb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase text-purple-600">Prescription · 3 meds</span>
                  <div className="flex gap-1">
                    <div className="w-6 h-6 rounded-lg bg-purple-100 flex items-center justify-center"><Printer className="w-3 h-3 text-purple-500" /></div>
                  </div>
                </div>
                <p className="text-xs font-bold text-purple-700 mb-2">Dx: Hypertension Stage 1</p>
                <div className="space-y-1">
                  {["Amlodipine 5mg · Morning · 30 days", "Telma 40mg · Night · 30 days"].map(m => (
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
                Every visit now captures vitals, diagnosis, and prescription in one place. Patient allergies are impossible to miss. They appear as a red banner before you prescribe anything.
              </p>
              <div className="space-y-4">
                {[
                  { icon: AlertTriangle, text: "Allergy banner on every visit. Never prescribe something a patient reacts to." },
                  { icon: Activity, text: "Record BP, pulse, SpO₂, temperature, weight, and height per appointment" },
                  { icon: FileText, text: "View, expand, print, or delete any past prescription in two clicks" },
                  { icon: Printer, text: "A printable medical summary in one tap, with full visit history for referrals" },
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

      {/* Why BariQ */}
      <section id="why-bariq" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 bg-teal-50 border border-teal-100 text-teal-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-5">
              <Sparkles className="w-3.5 h-3.5" /> Why BariQ
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">
              Why clinics choose BariQ over paper and generic software
            </h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">
              Most clinics land here after outgrowing a paper register or a handful of tools that never agree with each other. Here is what actually changes.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {whyBariq.map((w) => (
              <div key={w.title} className="bg-white rounded-2xl p-7 border border-gray-100 shadow-sm">
                <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center mb-5">
                  <w.icon className="w-5 h-5 text-teal-700" />
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-2">{w.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{w.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Partner Program */}
      <section id="partner" className="py-20 px-6" style={{ backgroundColor: "#f8f8f4" }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 bg-teal-50 border border-teal-100 text-teal-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-5">
              <Handshake className="w-3.5 h-3.5" /> Partner Program
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">
              Become a BariQ Partner
            </h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">
              Know clinics that could use BariQ? Refer them, track them, and earn commission, all from your own partner dashboard.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
            {partnerPerks.map((p) => (
              <div key={p.title} className="bg-white rounded-2xl p-7 border border-gray-100 shadow-sm">
                <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center mb-5">
                  <p.icon className="w-5 h-5 text-teal-700" />
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-2">{p.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
          <div className="text-center">
            <Link href="/partner-signup">
              <Button size="lg" className="bg-teal-700 hover:bg-teal-800 text-white px-8 h-12 rounded-xl font-semibold text-base shadow-md">
                Become a Partner
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-3">
              120+ clinics trust BariQ
            </h2>
            <p className="text-gray-500 text-lg">
              From small practices in smaller Indian cities to busy hospitals with many doctors
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

      {/* What's Included */}
      <section className="py-20 px-6" style={{ backgroundColor: "#f8f8f4" }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">
              Everything included. No hidden extras.
            </h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">
              Every BariQ clinic gets the complete platform: queue, pharmacy, patient records, prescriptions, billing, and analytics.
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-3">
              {planIncludes.map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle className="w-4 h-4 text-teal-600 flex-shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">
              Frequently asked questions
            </h2>
            <p className="text-gray-500 text-lg">
              Everything clinics usually ask before switching to BariQ
            </p>
          </div>
          <div className="space-y-3">
            {faqs.map((f, i) => {
              const isOpen = openFaq === i;
              return (
                <div key={f.q} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                    className="w-full flex items-center justify-between gap-4 text-left px-6 py-5"
                    aria-expanded={isOpen}
                  >
                    <span className="font-bold text-gray-900 text-sm sm:text-base">{f.q}</span>
                    <ChevronDown className={`w-4 h-4 text-teal-600 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isOpen && (
                    <p className="px-6 pb-5 text-gray-500 text-sm leading-relaxed">{f.a}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Contact / Pricing CTA */}
      <section id="contact" className="py-20 px-6" style={{ backgroundColor: "#f8f8f4" }}>
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-teal-50 border border-teal-100 text-teal-700 px-4 py-1.5 rounded-full text-sm font-semibold mb-6">
            <Phone className="w-3.5 h-3.5" /> Custom Pricing for Every Clinic
          </div>
          <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">
            Let's talk about what works for you
          </h2>
          <p className="text-gray-500 text-lg mb-10 leading-relaxed max-w-xl mx-auto">
            We believe every clinic is different. Reach out and we'll put together a plan that fits your practice size and budget. No standard rate card, just a fair conversation.
          </p>

          {/* Contact details */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-8 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-teal-600 shrink-0" />
              <span>B56, Tilak Nagar, Indore, India</span>
            </div>
            <a href="tel:+919424575918" className="flex items-center gap-2 hover:text-teal-700 transition-colors">
              <Phone className="w-4 h-4 text-teal-600 shrink-0" />
              <span>+91 94245 75918</span>
            </a>
            <a href="mailto:business@tirthontech.com" className="flex items-center gap-2 hover:text-teal-700 transition-colors">
              <Mail className="w-4 h-4 text-teal-600 shrink-0" />
              <span>business@tirthontech.com</span>
            </a>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto mb-8">
            <a href={WHATSAPP} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-3 bg-teal-700 hover:bg-teal-800 text-white rounded-2xl px-6 py-4 font-semibold transition-colors shadow-md">
              <MessageCircle className="w-5 h-5" />
              <div className="text-left">
                <p className="text-sm font-bold">WhatsApp Us</p>
                <p className="text-teal-200 text-xs">Quick response, Monday to Saturday</p>
              </div>
            </a>
            <a href="mailto:business@tirthontech.com"
              className="flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-800 rounded-2xl px-6 py-4 font-semibold border border-gray-200 transition-colors">
              <Mail className="w-5 h-5 text-teal-700" />
              <div className="text-left">
                <p className="text-sm font-bold">Email Us</p>
                <p className="text-gray-400 text-xs">We reply within 24 hours</p>
              </div>
            </a>
          </div>

          <p className="text-sm text-gray-400">
            Or{" "}
            <Link href="/signup" className="text-teal-700 font-semibold hover:underline">
              start your free 7 day trial
            </Link>
            . No payment required, full platform access from day one.
          </p>
        </div>
      </section>

      {/* Final CTA */}
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
              Join 120+ clinics already using BariQ. Your first 7 days are completely free. No setup fees, no contracts, no credit card.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/signup">
                <Button size="lg" className="bg-teal-700 hover:bg-teal-800 text-white px-10 h-12 rounded-xl font-semibold text-base">
                  Start Free Trial
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
              <a href={WHATSAPP} target="_blank" rel="noopener noreferrer">
                <Button size="lg" variant="outline" className="h-12 px-8 rounded-xl border-gray-300 bg-white text-gray-700 hover:bg-gray-50 font-semibold text-base gap-2">
                  <MessageCircle className="w-4 h-4" /> Contact for Pricing
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 px-6 py-10">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-7 h-7 bg-teal-700 rounded-lg flex items-center justify-center">
                  <Stethoscope className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="font-bold text-gray-900">BariQ</span>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed">India's smartest clinic management platform. Built for doctors, by people who care about healthcare.</p>
            </div>
            {/* Product */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-3">Product</p>
              <div className="space-y-2">
                {[
                  { label: "Features", href: "#features" },
                  { label: "Pharmacy", href: "#pharmacy" },
                  { label: "Patient Records", href: "#records" },
                  { label: "Why BariQ", href: "#why-bariq" },
                  { label: "FAQ", href: "#faq" },
                ].map(l => (
                  <a key={l.label} href={l.href} className="block text-sm text-gray-400 hover:text-gray-700 transition-colors">{l.label}</a>
                ))}
              </div>
            </div>
            {/* Account */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-3">Account</p>
              <div className="space-y-2">
                <Link href="/signup" className="block text-sm text-gray-400 hover:text-gray-700 transition-colors">Sign Up Free</Link>
                <Link href="/login" className="block text-sm text-gray-400 hover:text-gray-700 transition-colors">Sign In</Link>
                <Link href="/partner-signup" className="block text-sm text-gray-400 hover:text-gray-700 transition-colors">Become a Partner</Link>
              </div>
            </div>
            {/* Contact */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-3">Contact</p>
              <div className="space-y-2.5">
                <div className="flex items-start gap-2 text-sm text-gray-400">
                  <MapPin className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                  <span>B56, Tilak Nagar, Indore, India</span>
                </div>
                <a href="tel:+919424575918" className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-700 transition-colors">
                  <Phone className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                  <span>+91 94245 75918</span>
                </a>
                <a href="mailto:business@tirthontech.com" className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-700 transition-colors">
                  <Mail className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                  <span>business@tirthontech.com</span>
                </a>
                <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className="block text-sm text-gray-400 hover:text-gray-700 transition-colors">WhatsApp Support</a>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-200 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-400">© 2026 BariQ. Made with care for Indian clinics.</p>
            <p className="text-sm text-gray-400">
              Built by{' '}
              <a href="https://www.tirthontech.com" target="_blank" rel="noopener noreferrer" className="text-teal-700 hover:underline font-medium">
                TirthonTech
              </a>
            </p>
            <div className="flex gap-6 text-sm text-gray-400">
              <a href="#" className="hover:text-gray-700 transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-gray-700 transition-colors">Terms of Use</a>
            </div>
          </div>
        </div>
      </footer>

      {/* Floating WhatsApp bubble */}
      <a
        href={WHATSAPP}
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
