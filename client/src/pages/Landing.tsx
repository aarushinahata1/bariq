import { Link } from "wouter";
import { Activity, Clock, Users, FileText, BarChart3, Shield, Star, CheckCircle, ArrowRight, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: Clock,
    title: "Live Queue Management",
    desc: "Real-time digital queue with auto tokens. Patients track their wait time from their phone — no more crowded waiting rooms.",
  },
  {
    icon: Users,
    title: "Patient CRM",
    desc: "Full patient history, follow-up reminders, and funnel tracking. Never lose a lead or miss a follow-up again.",
  },
  {
    icon: FileText,
    title: "Digital Prescriptions",
    desc: "Doctors write prescriptions digitally. Auto-saved to patient history, printable anytime.",
  },
  {
    icon: BarChart3,
    title: "Revenue & Billing",
    desc: "Automated billing, cash/UPI/card tracking, and daily revenue reports. Know exactly where every rupee comes from.",
  },
  {
    icon: Activity,
    title: "Doctor Analytics",
    desc: "Average consultation time, patient load per doctor, and efficiency metrics — optimize your clinic operations.",
  },
  {
    icon: Shield,
    title: "Multi-Role Access",
    desc: "Separate logins for doctors, receptionists, and admin. Each sees only what they need.",
  },
];

const testimonials = [
  { name: "Dr. Priya Sharma", clinic: "Sharma Multi-Specialty Clinic, Pune", text: "Patient wait time dropped from 45 minutes to under 15. Our reception team is half as stressed now." },
  { name: "Dr. Rohan Mehta", clinic: "Mehta Paediatrics, Mumbai", text: "Parents love getting WhatsApp updates. We've had zero 'how long will it take?' calls since switching." },
  { name: "Dr. Kavitha Iyer", clinic: "Iyer Women's Clinic, Bangalore", text: "The billing dashboard alone saved us 2 hours a day. Setup took less than 30 minutes." },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-teal-700 rounded-lg flex items-center justify-center">
              <Stethoscope className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">BariQ</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" className="text-gray-600 hover:text-teal-700">Login</Button>
            </Link>
            <Link href="/signup">
              <Button className="bg-teal-700 hover:bg-teal-800 text-white px-5">Start Free Trial</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-28 pb-20 px-6 bg-gradient-to-b from-teal-50 to-white">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-teal-100 text-teal-700 px-4 py-1.5 rounded-full text-sm font-medium mb-6">
            <Star className="w-3.5 h-3.5 fill-teal-500 text-teal-500" />
            Trusted by 200+ clinics across India
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 leading-tight mb-6">
            Run Your Clinic <br />
            <span className="text-teal-700">Smarter, Not Harder</span>
          </h1>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-10">
            BariQ is the all-in-one clinic management system — queue management, patient CRM, digital prescriptions, and billing. Built for Indian clinics.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup">
              <Button size="lg" className="bg-teal-700 hover:bg-teal-800 text-white text-base px-8 h-13 rounded-xl shadow-lg shadow-teal-200">
                Start 7-Day Free Trial
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
            <p className="text-sm text-gray-400">No credit card required · Cancel anytime</p>
          </div>
        </div>

        {/* Hero image placeholder */}
        <div className="max-w-5xl mx-auto mt-16">
          <div className="bg-teal-800 rounded-2xl shadow-2xl p-6 aspect-video flex items-center justify-center">
            <div className="text-center text-white/60">
              <Activity className="w-16 h-16 mx-auto mb-4" />
              <p className="text-lg font-medium text-white/80">Live Dashboard Preview</p>
              <p className="text-sm">Queue · Patients · Revenue · Analytics</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Everything your clinic needs</h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">One platform. No juggling between apps. No paper records. No missed follow-ups.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div key={f.title} className="bg-gray-50 rounded-2xl p-6 hover:shadow-md transition-shadow">
                <div className="w-11 h-11 bg-teal-100 rounded-xl flex items-center justify-center mb-4">
                  <f.icon className="w-5 h-5 text-teal-700" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social proof */}
      <section className="py-20 px-6 bg-teal-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">Doctors love BariQ</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div key={t.name} className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="flex gap-0.5 mb-4">
                  {[1,2,3,4,5].map(i => <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />)}
                </div>
                <p className="text-gray-600 text-sm leading-relaxed mb-4">"{t.text}"</p>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{t.name}</p>
                  <p className="text-gray-400 text-xs">{t.clinic}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing / CTA */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="bg-teal-700 rounded-3xl p-10 md:p-14 text-center text-white">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Start your free 7-day trial</h2>
            <p className="text-teal-100 text-lg mb-8 max-w-xl mx-auto">
              Full access to all features. No credit card needed. After trial, simple ₹1,499/month — less than a cup of coffee per day.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
              {["Queue Management", "Patient CRM", "Digital Rx", "Billing", "Analytics"].map(f => (
                <div key={f} className="flex items-center gap-1.5 text-teal-100 text-sm">
                  <CheckCircle className="w-4 h-4 text-teal-300" />
                  {f}
                </div>
              ))}
            </div>
            <Link href="/signup">
              <Button size="lg" className="bg-white text-teal-700 hover:bg-teal-50 font-semibold px-10 h-13 rounded-xl shadow-lg">
                Sign Up Free — 7 Day Free Trial
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-teal-700 rounded-lg flex items-center justify-center">
              <Stethoscope className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-white font-bold">BariQ</span>
            <span className="text-gray-600 text-sm ml-1">by TirthonTech</span>
          </div>
          <p className="text-sm">© 2026 TirthonTech. All rights reserved.</p>
          <div className="flex gap-6 text-sm">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="mailto:support@tirthontech.com" className="hover:text-white transition-colors">Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
