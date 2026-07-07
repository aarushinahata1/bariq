import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Stethoscope, Eye, EyeOff, CheckCircle, Handshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const perks = [
  "Unique referral code for every clinic you bring",
  "Track all your referred clinics in one dashboard",
  "Earn commission on every subscription you refer",
];

export default function PartnerSignup() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showPw, setShowPw] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "" });

  const signup = useMutation({
    mutationFn: (body: typeof form) =>
      apiRequest("POST", "/api/auth/partner-signup", body).then(r => r.json()),
    onSuccess: (data) => {
      qc.setQueryData(["/api/auth/me"], data);
      navigate("/partner-dashboard");
    },
    onError: (err: any) => {
      const raw = err?.message || "Signup failed";
      let msg = raw;
      try { msg = JSON.parse(raw.replace(/^\d+: /, "")).message || raw; } catch {}
      toast({ title: "Signup failed", description: msg, variant: "destructive" });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) {
      toast({ title: "Required fields missing", description: "Please fill all required fields", variant: "destructive" });
      return;
    }
    if (form.password.length < 8) {
      toast({ title: "Weak password", description: "Password must be at least 8 characters", variant: "destructive" });
      return;
    }
    signup.mutate(form);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-4xl grid md:grid-cols-2 gap-10 items-center">
        {/* Left panel */}
        <div className="hidden md:block">
          <Link href="/">
            <div className="inline-flex items-center gap-2 cursor-pointer mb-8">
              <div className="w-10 h-10 bg-teal-700 rounded-xl flex items-center justify-center">
                <Stethoscope className="w-5 h-5 text-white" />
              </div>
              <span className="text-2xl font-bold text-gray-900">BariQ</span>
            </div>
          </Link>
          <div className="inline-flex items-center gap-2 bg-teal-50 border border-teal-100 text-teal-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-5">
            <Handshake className="w-3.5 h-3.5" /> Partner Program
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4 leading-snug">
            Earn by referring clinics to BariQ
          </h2>
          <p className="text-gray-500 mb-8">Get your own referral code and dashboard. Every clinic that signs up with your code shows up under you, automatically.</p>
          <div className="space-y-3">
            {perks.map(p => (
              <div key={p} className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-teal-600 flex-shrink-0" />
                <span className="text-gray-700 font-medium">{p}</span>
              </div>
            ))}
          </div>
          <div className="mt-10 bg-teal-50 border border-teal-100 rounded-2xl p-5">
            <p className="text-teal-800 font-semibold text-sm mb-1">Not a clinic owner?</p>
            <p className="text-teal-700 text-base font-semibold">This is for referral partners</p>
            <p className="text-teal-600 text-xs mt-1">Clinics should <Link href="/signup" className="underline">sign up here</Link> instead.</p>
          </div>
        </div>

        {/* Form */}
        <div>
          <div className="text-center mb-6 md:hidden">
            <Link href="/">
              <div className="inline-flex items-center gap-2 cursor-pointer">
                <div className="w-9 h-9 bg-teal-700 rounded-xl flex items-center justify-center">
                  <Stethoscope className="w-4 h-4 text-white" />
                </div>
                <span className="text-xl font-bold text-gray-900">BariQ</span>
              </div>
            </Link>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Become a partner</h1>
            <p className="text-gray-500 text-sm mb-7">Get your referral code in seconds</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-gray-700 font-medium">Full Name <span className="text-red-500">*</span></Label>
                <Input
                  id="name"
                  placeholder="e.g. Rahul Verma"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="h-11 rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-gray-700 font-medium">Email <span className="text-red-500">*</span></Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="h-11 rounded-xl"
                  autoComplete="email"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-gray-700 font-medium">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="9876543210"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  className="h-11 rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-gray-700 font-medium">Password <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPw ? "text" : "password"}
                    placeholder="Min 8 characters"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    className="h-11 rounded-xl pr-10"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-teal-700 hover:bg-teal-800 text-white rounded-xl font-semibold mt-2"
                disabled={signup.isPending}
              >
                {signup.isPending ? "Creating account..." : "Create Partner Account"}
              </Button>
            </form>

            <p className="text-center text-sm text-gray-500 mt-6">
              Already a partner?{" "}
              <Link href="/login" className="text-teal-700 font-semibold hover:underline">Login</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
