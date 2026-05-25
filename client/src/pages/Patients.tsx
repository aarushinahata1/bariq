import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/ui/PageHeader";
import { usePatients, useCreatePatient } from "@/hooks/use-patients";
import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Phone, Mail, History, ChevronRight, Users, UserPlus, TrendingUp } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertPatientSchema, type InsertPatient } from "@shared/schema";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loading } from "@/components/ui/loading";
import { format, isThisMonth } from "date-fns";
import { useLocation } from "wouter";
import { useRole } from "@/hooks/use-role";
import { cn } from "@/lib/utils";

const SOURCE_LABELS: Record<string, string> = {
  internal: "Direct",
  online: "Online",
  referral: "Referral",
  social: "Social",
};

const SOURCE_COLORS: Record<string, string> = {
  internal: "bg-teal-100 text-teal-700",
  online: "bg-purple-100 text-purple-700",
  referral: "bg-green-100 text-green-700",
  social: "bg-pink-100 text-pink-700",
};

const LAST_STATUS_COLORS: Record<string, string> = {
  booked: "bg-teal-100 text-teal-700",
  checked_in: "bg-emerald-100 text-emerald-700",
  in_progress: "bg-indigo-100 text-indigo-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  no_show: "bg-orange-100 text-orange-700",
};

const LAST_STATUS_LABELS: Record<string, string> = {
  booked: "Booked",
  checked_in: "Paid",
  in_progress: "In Progress",
  completed: "Consulted",
  cancelled: "Cancelled",
  no_show: "No Show",
};

export default function Patients() {
  const { can } = useRole();
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [, setLocation] = useLocation();
  const { data: patients, isLoading } = usePatients({ search });
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const filteredPatients = useMemo(() => {
    if (!patients) return [];
    if (sourceFilter === "all") return patients;
    return patients.filter(p => p.source === sourceFilter);
  }, [patients, sourceFilter]);

  const stats = useMemo(() => {
    if (!patients) return { total: 0, newThisMonth: 0, withEmail: 0 };
    return {
      total: patients.length,
      newThisMonth: patients.filter(p => p.createdAt && isThisMonth(new Date(p.createdAt))).length,
      withEmail: patients.filter(p => p.email).length,
    };
  }, [patients]);

  if (isLoading) return <Layout><Loading /></Layout>;

  return (
    <Layout>
      <PageHeader
        title="Patient Directory"
        description="Manage patient records and medical profiles."
        action={
          can("patients:create")
            ? <CreatePatientDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
            : undefined
        }
      />

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Total Patients", value: stats.total, icon: Users, color: "text-teal-700 bg-teal-50" },
          { label: "New This Month", value: stats.newThisMonth, icon: UserPlus, color: "text-green-600 bg-green-50" },
          { label: "With Email", value: stats.withEmail, icon: TrendingUp, color: "text-purple-600 bg-purple-50" },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", stat.color)}>
              <stat.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-black text-slate-900">{stat.value}</p>
              <p className="text-xs text-slate-400 font-medium">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search + Filter row */}
      <div className="flex gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <Input
            className="pl-10 h-11 rounded-xl border-slate-200 bg-white shadow-sm focus:ring-2 focus:ring-teal-100 focus:border-teal-500 transition-all"
            placeholder="Search by name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-36 h-11 rounded-xl border-slate-200 bg-white shadow-sm">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="internal">Direct</SelectItem>
            <SelectItem value="online">Online</SelectItem>
            <SelectItem value="referral">Referral</SelectItem>
            <SelectItem value="social">Social</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-8">
        {filteredPatients.length === 0 ? (
          <div className="text-center py-20">
            <Users className="w-16 h-16 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-400 font-semibold">No patients found</p>
            <p className="text-sm text-slate-300 mt-1">
              {search ? "Try a different search term" : "Add your first patient to get started"}
            </p>
            {!search && can("patients:create") && (
              <Button onClick={() => setIsCreateOpen(true)} size="sm" className="mt-4 rounded-xl bg-teal-600">
                <Plus className="w-4 h-4 mr-2" /> Add Patient
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-50 bg-slate-50/50">
                  <th className="px-4 md:px-6 py-4">Patient</th>
                  <th className="px-4 md:px-6 py-4 hidden sm:table-cell">Contact</th>
                  <th className="px-4 md:px-6 py-4 hidden md:table-cell">Source</th>
                  <th className="px-4 md:px-6 py-4 hidden lg:table-cell">Joined</th>
                  <th className="px-4 md:px-6 py-4 hidden md:table-cell">Last Status</th>
                  <th className="px-4 md:px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredPatients.map((patient) => {
                  const lastStatus = (patient as any).lastAppointmentStatus;
                  return (
                    <tr
                      key={patient.id}
                      className="hover:bg-slate-50/50 transition-colors cursor-pointer group"
                      onClick={() => setLocation(`/patients/${patient.id}`)}
                    >
                      <td className="px-4 md:px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center text-teal-700 font-bold text-sm shrink-0">
                            {patient.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 group-hover:text-teal-700 transition-colors truncate">
                              {patient.name}
                            </div>
                            <div className="text-xs text-slate-400">#PAT-{patient.id}</div>
                            <div className="sm:hidden text-xs text-slate-500 mt-0.5">{patient.phone}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 md:px-6 py-4 hidden sm:table-cell">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {patient.phone}
                          </div>
                          {patient.email && (
                            <div className="flex items-center gap-2 text-xs text-slate-400">
                              <Mail className="w-3 h-3" />
                              <span className="truncate max-w-[140px]">{patient.email}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 md:px-6 py-4 hidden md:table-cell">
                        <span className={cn(
                          "px-2.5 py-1 rounded-full text-xs font-semibold",
                          SOURCE_COLORS[patient.source || "internal"] || "bg-slate-100 text-slate-600"
                        )}>
                          {SOURCE_LABELS[patient.source || "internal"] || patient.source}
                        </span>
                      </td>
                      <td className="px-4 md:px-6 py-4 text-sm text-slate-500 hidden lg:table-cell">
                        {format(new Date(patient.createdAt || Date.now()), "MMM dd, yyyy")}
                      </td>
                      <td className="px-4 md:px-6 py-4 hidden md:table-cell">
                        {lastStatus ? (
                          <span className={cn(
                            "px-2.5 py-1 rounded-full text-xs font-semibold",
                            LAST_STATUS_COLORS[lastStatus] || "bg-slate-100 text-slate-600"
                          )}>
                            {LAST_STATUS_LABELS[lastStatus] || lastStatus}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300">No visits</span>
                        )}
                      </td>
                      <td className="px-4 md:px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" className="rounded-lg h-8 text-slate-400 group-hover:text-teal-700 hidden sm:flex">
                            <History className="w-4 h-4 mr-1.5" /> History
                          </Button>
                          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}

function CreatePatientDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const createPatient = useCreatePatient();

  const form = useForm<InsertPatient>({
    resolver: zodResolver(insertPatientSchema),
    defaultValues: { name: "", phone: "", email: "", notes: "", source: "internal" }
  });

  const onSubmit = (data: InsertPatient) => {
    createPatient.mutate(data as any, {
      onSuccess: () => {
        toast({ title: "Patient added", description: "Record created successfully." });
        onOpenChange(false);
        form.reset();
      },
      onError: (err) => {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="lg" className="rounded-xl bg-teal-600 hover:bg-teal-700 shadow-lg shadow-teal-600/20">
          <Plus className="w-5 h-5 mr-2" /> Add Patient
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] rounded-2xl">
        <DialogHeader>
          <DialogTitle>Add New Patient</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name *</FormLabel>
                <FormControl><Input placeholder="e.g. Ravi Sharma" {...field} className="rounded-xl" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone *</FormLabel>
                  <FormControl><Input placeholder="+91 98765 43210" {...field} className="rounded-xl" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl><Input placeholder="ravi@example.com" {...field} value={field.value || ""} className="rounded-xl" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="source" render={({ field }) => (
              <FormItem>
                <FormLabel>Patient Source</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value || "internal"}>
                  <FormControl>
                    <SelectTrigger className="rounded-xl h-11">
                      <SelectValue placeholder="How did they find us?" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="internal">Direct / Walk-in</SelectItem>
                    <SelectItem value="online">Online / Website</SelectItem>
                    <SelectItem value="referral">Referral</SelectItem>
                    <SelectItem value="social">Social Media</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Medical Notes</FormLabel>
                <FormControl>
                  <Textarea placeholder="Allergies, chronic conditions, special needs..." {...field} value={field.value || ""} className="rounded-xl resize-none h-24" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <Button type="submit" disabled={createPatient.isPending} className="w-full rounded-xl h-12 font-semibold">
              {createPatient.isPending ? "Creating..." : "Create Patient Record"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
