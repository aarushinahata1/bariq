import { Link } from "wouter";
import {
  Activity, Clock, Users, FileText, BarChart3, Shield,
  Star, CheckCircle, ArrowRight, Stethoscope, Zap, MessageCircle,
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
    desc: "Real-time digital queue with auto tokens. Patients track their position from their phone — no more crowded waiting rooms.",
  },
  {
    icon: Activity,
    title: "Smart Dashboard",
    desc: "See daily patient count, revenue, and queue status the moment you open the app — no waiting, no refresh needed.",
  },
  {
    icon: FileText,
    title: "Digital Prescriptions",
    desc: "Doctors write prescriptions digitally. Auto-saved to patient history, printable anytime, shareable on WhatsApp.",
  },
  {
    icon: Users,
    title: "Patient CRM",
    desc: "Full patient history, follow-up reminders, and funnel tracking. Never miss a follow-up or lose a patient again.",
  },
  {
    icon: BarChart3,
    title: "Billing & Payments",
    desc: "Automated billing, cash/UPI/card tracking, daily revenue reports. Know exactly where every rupee comes from.",
  },
  {
    icon: Shield,
    title: "Multi-Role Access",
    desc: "Separate access for doctors, receptionists, and admin. Each sees only what they need — no confusion, no errors.",
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
    text: "Parents love getting updates on queue position. We've had zero 'how long will it take?' calls since switching.",
  },
  {
    name: "Dr. Kavitha Iyer",
    clinic: "Iyer Women's Clinic — Bangalore",
    text: "The billing dashboard alone saved us 2 hours a day. We were up and running in under 30 minutes.",
  },
];

const planIncludes = [
  "Queue Management", "Patient CRM", "Digital Prescriptions", "Billing & POS",
  "Doctor Analytics", "WhatsApp Integration", "Multi-Role Access", "Follow-up Reminders",
  "Revenue Reports", "Appointment Booking", "Patient History", "Unlimited Staff",
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
          {/* Badge */}
          <div className="inline-flex items-center gap-2 border border-gray-300 bg-white/60 text-gray-600 px-4 py-1.5 rounded-full text-sm font-medium mb-8">
            <Zap className="w-3.5 h-3.5 text-teal-600" />
            India's Most Advanced Clinic Management Platform
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 leading-[1.1] mb-5">
            Run Your Clinic
            <br />
            <span className="text-teal-700">Business Smarter</span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg text-gray-500 max-w-xl mx-auto mb-10 leading-relaxed">
            BariQ brings your entire clinic onto one screen — queue, patients, prescriptions, and billing — so you can focus on care, not paperwork.
          </p>

          {/* CTAs */}
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
              <div key={f.title} className="bg-white rounded-2xl p-7 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
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

      {/* ── Testimonials ─────────────────────────────────────────── */}
      <section className="py-20 px-6">
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
              Every plan includes the complete BariQ suite — queue, CRM, prescriptions, billing, and analytics.
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
