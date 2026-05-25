import { Layout } from "@/components/Layout";
import { usePatient, useUpdatePatient } from "@/hooks/use-patients";
import { useAppointments, useCreateAppointment } from "@/hooks/use-appointments";
import { useDoctors } from "@/hooks/use-doctors";
import { useParams, useLocation } from "wouter";
import { Loading } from "@/components/ui/loading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { useState, useEffect, useMemo } from "react";
import {
  History, Calendar, Phone, Mail, FileText, Clock,
  ArrowLeft, ChevronRight, Pencil, Check, X,
  Pill, Receipt, CalendarPlus, Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  checked_in: "bg-emerald-100 text-emerald-700",
  in_progress: "bg-teal-100 text-teal-700",
  booked: "bg-slate-100 text-slate-700",
  no_show: "bg-orange-100 text-orange-700",
};

const STATUS_LABELS: Record<string, string> = {
  completed: "Consulted",
  checked_in: "Paid",
  in_progress: "In Progress",
  no_show: "No Show",
  booked: "Booked",
  cancelled: "Cancelled",
};

const DOT_COLORS: Record<string, string> = {
  completed: "bg-green-500",
  cancelled: "bg-red-500",
  no_show: "bg-orange-500",
  in_progress: "bg-teal-600",
  checked_in: "bg-emerald-500",
  booked: "bg-slate-400",
};

const DAY_NAMES = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"] as const;

function generateTimeSlots(availability: any, dayOfWeek: string): string[] {
  if (!availability || !availability[dayOfWeek] || !availability[dayOfWeek].enabled) return [];
  return (availability[dayOfWeek].slots || []).map((s: any) => `${s.start}-${s.end}`);
}

function FollowUpDialog({ patient, onClose }: { patient: any; onClose: () => void }) {
  const { toast } = useToast();
  const createAppointment = useCreateAppointment();
  const { data: doctors } = useDoctors();
  const [doctorId, setDoctorId] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [slot, setSlot] = useState("");
  const [reason, setReason] = useState("Follow-up visit");

  const availableSlots = useMemo(() => {
    if (!doctorId || !date || !doctors) return [];
    const doctor = doctors.find(d => d.id === doctorId);
    if (!doctor?.doctorProfile?.availability) return [];
    const dayOfWeek = DAY_NAMES[new Date(date).getDay()];
    return generateTimeSlots(doctor.doctorProfile.availability, dayOfWeek);
  }, [doctorId, date, doctors]);

  const handleSubmit = () => {
    if (!doctorId || !date || !slot) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }
    const [start] = slot.split("-");
    const [hours, minutes] = start.split(":");
    const appointmentDate = new Date(date);
    appointmentDate.setHours(parseInt(hours), parseInt(minutes));

    createAppointment.mutate({
      patientId: patient.id,
      doctorId,
      date: appointmentDate.toISOString(),
      status: "booked",
      reason,
      isQuickCheck: false,
    }, {
      onSuccess: () => {
        toast({ title: "Follow-up booked!", description: `Appointment scheduled for ${format(appointmentDate, "MMM d, h:mm a")}` });
        onClose();
      },
      onError: (err) => {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    });
  };

  return (
    <div className="space-y-4 py-2">
      <div className="bg-teal-50 p-4 rounded-xl">
        <p className="font-semibold text-blue-900">{patient.name}</p>
        <p className="text-sm text-teal-700">{patient.phone}</p>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Doctor *</label>
        <Select value={doctorId} onValueChange={v => { setDoctorId(v); setSlot(""); }}>
          <SelectTrigger className="rounded-xl h-11">
            <SelectValue placeholder="Select doctor" />
          </SelectTrigger>
          <SelectContent>
            {doctors?.map(d => (
              <SelectItem key={d.id} value={d.id}>Dr. {d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <label className="text-sm font-medium">Date *</label>
          <Input
            type="date"
            value={date}
            min={format(new Date(), "yyyy-MM-dd")}
            onChange={e => { setDate(e.target.value); setSlot(""); }}
            className="rounded-xl h-11"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Time Slot *</label>
          <Select value={slot} onValueChange={setSlot} disabled={!availableSlots.length}>
            <SelectTrigger className="rounded-xl h-11">
              <SelectValue placeholder={availableSlots.length ? "Select slot" : "No slots"} />
            </SelectTrigger>
            <SelectContent>
              {availableSlots.map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Reason</label>
        <Input value={reason} onChange={e => setReason(e.target.value)} className="rounded-xl h-11" />
      </div>
      <Button
        onClick={handleSubmit}
        disabled={createAppointment.isPending}
        className="w-full rounded-xl h-11 bg-teal-600 hover:bg-teal-700"
      >
        {createAppointment.isPending ? "Booking..." : "Book Follow-up"}
      </Button>
    </div>
  );
}

export default function PatientHistory() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { data: patientData, isLoading: isLoadingPatient } = usePatient(Number(id));
  const { data: patientAppointments, isLoading: isLoadingAppts } = useAppointments({ patientId: Number(id) });
  const updatePatient = useUpdatePatient();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showFollowUp, setShowFollowUp] = useState(false);

  const patient = patientData;
  const appointments = [...(patientAppointments || [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editNotes, setEditNotes] = useState("");

  useEffect(() => {
    if (patient) {
      setEditName(patient.name);
      setEditPhone(patient.phone);
      setEditEmail(patient.email || "");
      setEditNotes(patient.notes || "");
    }
  }, [patient]);

  // Fetch prescriptions for this patient
  const { data: prescriptions } = useQuery<any[]>({
    queryKey: ["/api/prescriptions", { patientId: Number(id) }],
    queryFn: async () => {
      const res = await fetch(`/api/prescriptions?patientId=${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch prescriptions");
      return res.json();
    },
    enabled: !!id,
  });

  // Fetch bills for this patient
  const { data: bills } = useQuery<any[]>({
    queryKey: ["/api/bills", { patientId: Number(id) }],
    queryFn: async () => {
      const res = await fetch(`/api/bills?patientId=${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch bills");
      return res.json();
    },
    enabled: !!id,
  });

  const prescriptionsByAppt = useMemo(() => {
    const map = new Map<number, any[]>();
    (prescriptions || []).forEach(p => {
      const arr = map.get(p.appointmentId) || [];
      arr.push(p);
      map.set(p.appointmentId, arr);
    });
    return map;
  }, [prescriptions]);

  const billsByAppt = useMemo(() => {
    const map = new Map<number, any>();
    (bills || []).forEach(b => map.set(b.appointmentId, b));
    return map;
  }, [bills]);

  // Stats
  const totalVisits = appointments?.length || 0;
  const completedVisits = appointments?.filter(a => a.status === "completed").length || 0;
  const totalSpent = bills?.filter(b => b.status === "paid").reduce((acc, b) => acc + b.amount, 0) || 0;

  const handleSave = async () => {
    if (!editName.trim() || !editPhone.trim()) {
      toast({ title: "Name and phone are required", variant: "destructive" });
      return;
    }
    try {
      await updatePatient.mutateAsync({
        id: Number(id),
        updates: {
          name: editName.trim(),
          phone: editPhone.trim(),
          email: editEmail.trim() || undefined,
          notes: editNotes.trim() || undefined,
        },
      });
      queryClient.invalidateQueries({ queryKey: [api.patients.get.path, Number(id)] });
      setIsEditing(false);
      toast({ title: "Patient updated" });
    } catch {
      toast({ title: "Failed to update patient", variant: "destructive" });
    }
  };

  if (isLoadingPatient || isLoadingAppts) return <Layout><Loading /></Layout>;
  if (!patient) return <Layout><div className="p-8 text-slate-500">Patient not found.</div></Layout>;

  return (
    <Layout>
      <div className="mb-6">
        <Button variant="ghost" onClick={() => setLocation("/patients")} className="text-slate-500 hover:text-slate-900 -ml-2">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Patients
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Patient Info Card */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="rounded-2xl border-slate-100 shadow-sm overflow-hidden">
            <div className="h-20 bg-gradient-to-r from-blue-600 to-blue-500" />
            <CardContent className="p-6 -mt-10">
              <div className="w-20 h-20 rounded-2xl bg-white p-1 shadow-xl mb-4">
                <div className="w-full h-full rounded-[14px] bg-slate-100 flex items-center justify-center text-3xl">👤</div>
              </div>

              {isEditing ? (
                <div className="space-y-3 mb-4">
                  <div>
                    <label className="text-xs font-medium text-slate-500 mb-1 block">Name</label>
                    <Input value={editName} onChange={e => setEditName(e.target.value)} className="rounded-xl h-10" />
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="text-xl font-black text-slate-900 mb-0.5">{patient.name}</h2>
                  <p className="text-slate-400 text-xs mb-4">#PAT-{patient.id}</p>
                </>
              )}

              <div className="space-y-3">
                <div className="flex items-center gap-3 text-slate-600">
                  <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
                    <Phone className="w-4 h-4 text-slate-400" />
                  </div>
                  {isEditing ? (
                    <Input value={editPhone} onChange={e => setEditPhone(e.target.value)} className="rounded-xl h-9 text-sm" />
                  ) : (
                    <a href={`tel:${patient.phone}`} className="text-sm font-medium hover:text-teal-700">{patient.phone}</a>
                  )}
                </div>
                <div className="flex items-center gap-3 text-slate-600">
                  <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4 text-slate-400" />
                  </div>
                  {isEditing ? (
                    <Input value={editEmail} onChange={e => setEditEmail(e.target.value)} className="rounded-xl h-9 text-sm" placeholder="Email (optional)" />
                  ) : (
                    <span className="text-sm font-medium text-slate-600">{patient.email || <span className="text-slate-300">No email</span>}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-slate-600">
                  <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
                    <Calendar className="w-4 h-4 text-slate-400" />
                  </div>
                  <span className="text-sm font-medium">Since {format(new Date(patient.createdAt || Date.now()), "MMM yyyy")}</span>
                </div>
              </div>

              <div className="mt-5 flex gap-2">
                {isEditing ? (
                  <>
                    <Button size="sm" onClick={handleSave} disabled={updatePatient.isPending} className="rounded-xl bg-teal-600 text-white flex-1">
                      <Check className="w-4 h-4 mr-1.5" /> {updatePatient.isPending ? "Saving..." : "Save"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setIsEditing(false)} className="rounded-xl">
                      <X className="w-4 h-4 mr-1.5" /> Cancel
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setIsEditing(true)} className="rounded-xl text-slate-500">
                    <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Total Visits", value: totalVisits, icon: Activity, color: "text-teal-700 bg-teal-50" },
              { label: "Completed", value: completedVisits, icon: Check, color: "text-green-600 bg-green-50" },
              { label: "Spent (₹)", value: (totalSpent / 100).toFixed(0), icon: Receipt, color: "text-purple-600 bg-purple-50" },
            ].map(stat => (
              <div key={stat.label} className="bg-white rounded-2xl border border-slate-100 p-3 text-center shadow-sm">
                <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center mx-auto mb-2", stat.color)}>
                  <stat.icon className="w-4 h-4" />
                </div>
                <p className="text-lg font-black text-slate-900">{stat.value}</p>
                <p className="text-[10px] text-slate-400 font-medium">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Notes */}
          <Card className="rounded-2xl border-slate-100 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <FileText className="w-4 h-4" /> Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <Textarea
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  placeholder="Allergies, chronic conditions, general notes..."
                  className="rounded-xl text-sm min-h-[100px] resize-none"
                />
              ) : (
                <p className="text-sm text-slate-600 leading-relaxed">
                  {patient.notes || <span className="text-slate-300 italic">No notes added yet.</span>}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Follow-up button */}
          <Button
            onClick={() => setShowFollowUp(true)}
            className="w-full rounded-2xl h-12 bg-teal-600 hover:bg-teal-700 shadow-lg shadow-teal-600/20"
          >
            <CalendarPlus className="w-5 h-5 mr-2" /> Book Follow-up
          </Button>
        </div>

        {/* Timeline */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xl font-black text-slate-900">Medical History</h3>
            <span className="text-sm font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">{totalVisits} Visit{totalVisits !== 1 ? "s" : ""}</span>
          </div>

          {(!appointments || appointments.length === 0) ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-slate-100">
              <History className="w-16 h-16 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-400 font-semibold">No appointment history</p>
              <p className="text-sm text-slate-300 mt-1">Book an appointment to get started</p>
              <Button onClick={() => setShowFollowUp(true)} size="sm" className="mt-4 rounded-xl bg-teal-600">
                <CalendarPlus className="w-4 h-4 mr-2" /> Book First Appointment
              </Button>
            </div>
          ) : (
            <div className="relative space-y-6 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
              {appointments.map((apt) => {
                const apptPrescriptions = prescriptionsByAppt.get(apt.id) || [];
                const apptBill = billsByAppt.get(apt.id);
                return (
                  <div key={apt.id} className="relative flex items-start gap-6 group">
                    <div className="absolute left-0 mt-2 w-10 h-10 rounded-full bg-white border-4 border-slate-50 shadow-sm flex items-center justify-center z-10">
                      <div className={cn("w-2.5 h-2.5 rounded-full", DOT_COLORS[apt.status] || "bg-slate-400")} />
                    </div>

                    <div className="flex-1 ml-12">
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                        {format(new Date(apt.date), "MMMM dd, yyyy")}
                      </div>
                      <Card className="rounded-2xl border-slate-100 shadow-sm group-hover:shadow-md transition-shadow">
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h4 className="font-bold text-slate-900">Dr. {apt.doctor.name}</h4>
                              <p className="text-xs text-teal-700 font-medium">{apt.reason || "General Consultation"}</p>
                            </div>
                            <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider", STATUS_COLORS[apt.status] || "bg-slate-100 text-slate-700")}>
                              {STATUS_LABELS[apt.status] || apt.status}
                            </span>
                          </div>

                          {apt.notes && (
                            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 mb-3">
                              <div className="flex items-center gap-2 mb-1.5 text-slate-400">
                                <FileText className="w-3 h-3" />
                                <span className="text-[10px] font-bold uppercase">Clinical Notes</span>
                              </div>
                              <p className="text-sm text-slate-600 italic">"{apt.notes}"</p>
                            </div>
                          )}

                          {/* Prescriptions */}
                          {apptPrescriptions.length > 0 && (
                            <div className="p-3 rounded-xl bg-purple-50 border border-purple-100 mb-3">
                              <div className="flex items-center gap-2 mb-2 text-purple-600">
                                <Pill className="w-3.5 h-3.5" />
                                <span className="text-[10px] font-bold uppercase">Prescription</span>
                              </div>
                              <div className="space-y-1.5">
                                {apptPrescriptions[0].medications?.slice(0, 3).map((med: any, i: number) => (
                                  <div key={i} className="flex items-center justify-between text-xs">
                                    <span className="font-semibold text-purple-900">{med.name}</span>
                                    <span className="text-purple-600">{med.dosage} · {med.duration}</span>
                                  </div>
                                ))}
                                {apptPrescriptions[0].medications?.length > 3 && (
                                  <p className="text-xs text-purple-500">+{apptPrescriptions[0].medications.length - 3} more</p>
                                )}
                                {apptPrescriptions[0].notes && (
                                  <p className="text-xs text-purple-600 italic mt-1">{apptPrescriptions[0].notes}</p>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Bill */}
                          {apptBill && (
                            <div className={cn(
                              "flex items-center justify-between p-3 rounded-xl border text-xs",
                              apptBill.status === "paid" ? "bg-green-50 border-green-100" : "bg-yellow-50 border-yellow-100"
                            )}>
                              <div className="flex items-center gap-2">
                                <Receipt className={cn("w-3.5 h-3.5", apptBill.status === "paid" ? "text-green-600" : "text-yellow-600")} />
                                <span className={cn("font-semibold", apptBill.status === "paid" ? "text-green-700" : "text-yellow-700")}>
                                  {apptBill.status === "paid" ? "Paid" : "Pending"}
                                </span>
                              </div>
                              <span className={cn("font-bold", apptBill.status === "paid" ? "text-green-700" : "text-yellow-700")}>
                                ₹{(apptBill.amount / 100).toFixed(0)}
                                {apptBill.paymentMethod && ` · ${apptBill.paymentMethod.toUpperCase()}`}
                              </span>
                            </div>
                          )}

                          <div className="mt-3 flex items-center gap-4 text-xs text-slate-400">
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-3 h-3" />
                              {format(new Date(apt.date), "hh:mm a")}
                            </div>
                            {apt.queuePosition && (
                              <div className="flex items-center gap-1.5">
                                <ChevronRight className="w-3 h-3" />
                                Queue #{apt.queuePosition}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Follow-up Dialog */}
      <Dialog open={showFollowUp} onOpenChange={setShowFollowUp}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Book Follow-up Appointment</DialogTitle>
          </DialogHeader>
          <FollowUpDialog patient={patient} onClose={() => setShowFollowUp(false)} />
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
