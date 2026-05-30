import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAppointments, useCreateAppointment, useUpdateAppointment, useDeleteAppointment } from "@/hooks/use-appointments";
import { useDoctors } from "@/hooks/use-doctors";
import { usePatients } from "@/hooks/use-patients";
import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarIcon, Plus, User, RefreshCw, ListOrdered, Search, Printer, Phone, X, Trash2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format, isToday, isFuture, isPast, isSameDay, parseISO } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertAppointmentSchema } from "@shared/schema";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Loading } from "@/components/ui/loading";
import { z } from "zod";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useCreatePatient } from "@/hooks/use-patients";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useRole } from "@/hooks/use-role";

// Frontend needs slightly different schema for the form (string date instead of Date object initially)
const appointmentFormSchema = z.object({
  date: z.string().min(1, "Date is required"),
  slot: z.string().optional(),
  patientId: z.coerce.number().min(1, "Patient is required"),
  doctorId: z.string().min(1, "Doctor is required"),
  status: z.enum(["booked", "checked_in", "in_progress", "completed", "cancelled", "no_show"]),
  reason: z.string().optional(),
  notes: z.string().optional(),
});

function generateTimeSlots(availability: any, dayOfWeek: string, selectedDate?: string): string[] {
  if (!availability || !availability[dayOfWeek] || !availability[dayOfWeek].enabled) {
    return [];
  }
  const daySlots: { start: string; end: string }[] = availability[dayOfWeek].slots || [];
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const isSelectedToday = selectedDate === todayStr;
  const nowMins = new Date().getHours() * 60 + new Date().getMinutes();

  return daySlots
    .filter(slot => {
      if (!isSelectedToday) return true;
      const [endH, endM] = slot.end.split(":").map(Number);
      return endH * 60 + endM > nowMins;
    })
    .map(slot => `${slot.start}-${slot.end}`);
}

type AppointmentFormValues = z.infer<typeof appointmentFormSchema>;

const rescheduleSchema = z.object({
  date: z.string().min(1, "Date is required"),
  slot: z.string().optional(),
});
type RescheduleFormValues = z.infer<typeof rescheduleSchema>;

function RescheduleDialog({ appointment }: { appointment: any }) {
  const { toast } = useToast();
  const updateAppointment = useUpdateAppointment();
  const { data: doctors } = useDoctors();
  const [open, setOpen] = useState(false);

  const form = useForm<RescheduleFormValues>({
    resolver: zodResolver(rescheduleSchema),
    defaultValues: { date: "", slot: "" },
  });

  const watchedRescheduleDate = form.watch("date");

  const rescheduleSlots = useMemo(() => {
    if (!watchedRescheduleDate || !doctors) return [];
    const doctor = doctors.find(d => d.id === appointment.doctorId);
    if (!doctor?.doctorProfile?.availability) return [];
    const [y, mo, d] = watchedRescheduleDate.split("-").map(Number);
    const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][new Date(y, mo - 1, d).getDay()];
    return generateTimeSlots(doctor.doctorProfile.availability, dayOfWeek, watchedRescheduleDate);
  }, [watchedRescheduleDate, doctors, appointment.doctorId]);

  useEffect(() => {
    if (open) {
      form.reset({ date: format(new Date(appointment.date), "yyyy-MM-dd"), slot: "" });
    }
  }, [open]);

  useEffect(() => {
    if (rescheduleSlots.length > 0) {
      const current = form.getValues("slot");
      if (!current || !rescheduleSlots.includes(current)) {
        form.setValue("slot", rescheduleSlots[0], { shouldValidate: false });
      }
    } else {
      form.setValue("slot", "", { shouldValidate: false });
    }
  }, [rescheduleSlots]);

  const onSubmit = (data: RescheduleFormValues) => {
    const originalDate = new Date(appointment.date);
    let appointmentDate: Date;
    if (data.slot) {
      const [start] = data.slot.split("-");
      const [h, m] = start.split(":").map(Number);
      const [y, mo, d] = data.date.split("-").map(Number);
      appointmentDate = new Date(y, mo - 1, d, h, m);
    } else {
      const [y, mo, d] = data.date.split("-").map(Number);
      appointmentDate = new Date(y, mo - 1, d, originalDate.getHours(), originalDate.getMinutes());
    }

    updateAppointment.mutate({
      id: appointment.id,
      updates: { date: appointmentDate.toISOString() }
    }, {
      onSuccess: () => {
        toast({ title: "Success", description: "Appointment rescheduled successfully." });
        setOpen(false);
      },
      onError: (err) => {
        toast({ title: "Error", description: err.message || "Failed to reschedule", variant: "destructive" });
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg text-slate-400 hover:text-teal-700">
                <RefreshCw className="w-4 h-4" />
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>Reschedule appointment</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DialogContent className="sm:max-w-[400px] rounded-2xl">
        <DialogHeader>
          <DialogTitle>Quick Reschedule</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} min={format(new Date(), "yyyy-MM-dd")} className="rounded-xl h-11" />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="slot"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Time Slot</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ""}>
                    <FormControl>
                      <SelectTrigger className="rounded-xl h-11">
                        <SelectValue placeholder={rescheduleSlots.length === 0 ? "Keep original time" : "Select Slot"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {rescheduleSlots.length === 0 ? (
                        <div className="px-2 py-4 text-center text-sm text-slate-500">
                          No slots configured — original time will be kept
                        </div>
                      ) : (
                        rescheduleSlots.map(slot => (
                          <SelectItem key={slot} value={slot}>{slot}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={updateAppointment.isPending} className="w-full rounded-xl h-12 bg-teal-600">
              Confirm Reschedule
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function Appointments() {
  const { can } = useRole();
  const { toast } = useToast();
  const { data: appointments, isLoading } = useAppointments();
  const updateAppointment = useUpdateAppointment();
  const deleteAppointment = useDeleteAppointment();
  const { data: doctors } = useDoctors();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [filter, setFilter] = useState("all");
  const [selectedDoctor, setSelectedDoctor] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedDate, setSelectedDate] = useState("");

  if (isLoading) return <Layout><Loading /></Layout>;

  const filteredAppointments = (appointments as any[])?.filter(apt => {
    const aptDate = new Date(apt.date);
    if (filter === "today") { if (!isToday(aptDate)) return false; }
    if (filter === "upcoming") { if (!(isFuture(aptDate) && !isToday(aptDate))) return false; }
    if (filter === "past") { if (!(isPast(aptDate) && !isToday(aptDate))) return false; }
    if (selectedDoctor !== "all" && apt.doctorId !== selectedDoctor) return false;
    if (selectedStatus !== "all" && apt.status !== selectedStatus) return false;
    if (patientSearch && !apt.patient.name.toLowerCase().includes(patientSearch.toLowerCase())) return false;
    if (selectedDate) {
      if (!isSameDay(aptDate, parseISO(selectedDate))) return false;
    }
    return true;
  });

  return (
    <Layout>
      <PageHeader
        title="Appointments"
        description="Schedule and manage patient visits."
        action={
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <Tabs value={filter} onValueChange={setFilter} className="w-full sm:w-auto">
              <TabsList className="grid grid-cols-4 w-full sm:w-[400px] rounded-xl">
                <TabsTrigger value="all" className="rounded-lg text-xs">All</TabsTrigger>
                <TabsTrigger value="today" className="rounded-lg text-xs">Today</TabsTrigger>
                <TabsTrigger value="upcoming" className="rounded-lg text-xs">Upcoming</TabsTrigger>
                <TabsTrigger value="past" className="rounded-lg text-xs">Past</TabsTrigger>
              </TabsList>
            </Tabs>
            {can("appointments:create") && (
              <CreateAppointmentDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
            )}
          </div>
        }
      />

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Mobile View: Cards */}
        <div className="md:hidden divide-y divide-slate-100">
          <div className="p-3 space-y-2 bg-slate-50 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search patient..."
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                className="pl-9 rounded-lg h-9 border-slate-200 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
                <SelectTrigger className="border-slate-200 rounded-lg h-9 text-xs flex-1">
                  <SelectValue placeholder="All Doctors" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Doctors</SelectItem>
                  {doctors?.map(d => (
                    <SelectItem key={d.id} value={d.id}>Dr. {d.name}{d.doctorProfile?.specialization ? ` · ${d.doctorProfile.specialization}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="border-slate-200 rounded-lg h-9 text-xs flex-1">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="booked">Booked</SelectItem>
                  <SelectItem value="checked_in">Paid</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Consulted</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="no_show">No Show</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="rounded-lg h-9 border-slate-200 text-xs flex-1"
              />
            </div>
          </div>
          {filteredAppointments?.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <CalendarIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>No appointments found.</p>
            </div>
          ) : (
            filteredAppointments?.map((apt) => (
              <div key={apt.id} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-xs">
                      {apt.patient.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{apt.patient.name}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-slate-500">{apt.patient.phone}</p>
                        {apt.patient.phone && (
                          <div className="flex items-center gap-1">
                            <a
                              href={(() => { const d = apt.patient.phone.replace(/[^0-9]/g, ''); return `https://wa.me/${d.length === 10 ? '91' + d : d}`; })()}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-5 h-5 rounded-full bg-green-100 text-green-600 hover:bg-green-200 flex items-center justify-center"
                              title="WhatsApp"
                            >
                              <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                            </a>
                            <a
                              href={`tel:${apt.patient.phone}`}
                              className="w-5 h-5 rounded-full bg-teal-100 text-teal-700 hover:bg-blue-200 flex items-center justify-center"
                              title="Call"
                            >
                              <Phone className="w-2.5 h-2.5" />
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase
                    ${apt.status === 'booked' ? 'bg-teal-100 text-teal-700' : 
                      apt.status === 'completed' ? 'bg-green-100 text-green-700' : 
                      apt.status === 'cancelled' ? 'bg-red-100 text-red-700' : 
                      apt.status === 'checked_in' ? 'bg-emerald-100 text-emerald-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                    {apt.status === 'checked_in' ? 'Paid' : apt.status === 'completed' ? 'Consulted' : apt.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <div className="flex flex-col gap-1">
                    <span className="font-medium text-slate-700">Dr. {apt.doctor.name}</span>
                    <span className="flex items-center gap-1">
                      <CalendarIcon className="w-3 h-3" />
                      {format(new Date(apt.date), "MMM d, yyyy")}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="italic text-slate-400">{apt.reason || "No reason provided"}</p>
                  </div>
                </div>
                {apt.bill && (
                  <div className="flex items-center gap-1 mt-1">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      apt.bill.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {apt.bill.status === 'paid' ? `₹${(apt.bill.amount / 100).toFixed(0)} Paid` : 'Payment Pending'}
                    </span>
                  </div>
                )}
                {can("appointments:reschedule") && !["completed", "cancelled", "no_show"].includes(apt.status) && (
                  <div className="flex items-center gap-2 pt-1">
                    <RescheduleDialog appointment={apt} />
                    {apt.status === "booked" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-lg h-7 text-xs text-red-500 border-red-100 hover:bg-red-50"
                        onClick={() => setCancelTarget(apt)}
                      >
                        <X className="w-3 h-3 mr-1" /> Cancel
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden md:block overflow-x-auto">
          <div className="min-w-[800px]">
            {/* Column headers with inline filters */}
            <div
              className="grid gap-4 px-4 pt-3 pb-1 bg-slate-50 border-b border-slate-100 font-semibold text-slate-500 text-xs uppercase tracking-wider"
              style={{ gridTemplateColumns: `2fr 1.2fr 1fr 1fr 1fr${can("appointments:reschedule") ? " 0.5fr" : ""}` }}
            >
              <div>Patient</div>
              <div>Doctor</div>
              <div>Date</div>
              <div>Status</div>
              <div>Billing</div>
              {can("appointments:reschedule") && <div></div>}
            </div>
            <div
              className="grid gap-4 px-4 pb-3 bg-slate-50 border-b border-slate-200 items-center"
              style={{ gridTemplateColumns: `2fr 1.2fr 1fr 1fr 1fr${can("appointments:reschedule") ? " 0.5fr" : ""}` }}
            >
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <Input
                  placeholder="Search..."
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  className="pl-8 rounded-lg h-8 border-slate-200 text-xs bg-white"
                />
              </div>
              <div>
                <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
                  <SelectTrigger className="border-slate-200 rounded-lg h-8 text-xs bg-white">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {doctors?.map(d => (
                      <SelectItem key={d.id} value={d.id}>Dr. {d.name}{d.doctorProfile?.specialization ? ` · ${d.doctorProfile.specialization}` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="rounded-lg h-8 border-slate-200 text-xs bg-white"
                />
              </div>
              <div>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="border-slate-200 rounded-lg h-8 text-xs bg-white">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="booked">Booked</SelectItem>
                    <SelectItem value="checked_in">Paid</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Consulted</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="no_show">No Show</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                {(selectedDoctor !== "all" || selectedStatus !== "all" || patientSearch || selectedDate) && (
                  <button
                    onClick={() => { setSelectedDoctor("all"); setSelectedStatus("all"); setPatientSearch(""); setSelectedDate(""); }}
                    className="text-[10px] text-teal-700 hover:text-teal-800 font-medium whitespace-nowrap"
                  >
                    Clear
                  </button>
                )}
              </div>
              {can("appointments:reschedule") && <div></div>}
            </div>
            
            {filteredAppointments?.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <CalendarIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>No appointments found.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {(filteredAppointments as any[])?.map((apt) => (
                  <div
                    key={apt.id}
                    className="grid gap-4 p-4 hover:bg-slate-50 transition-colors items-center"
                    style={{ gridTemplateColumns: `2fr 1.2fr 1fr 1fr 1fr${can("appointments:reschedule") ? " 0.5fr" : ""}` }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-xs">
                        {apt.patient.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{apt.patient.name}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-slate-500">{apt.patient.phone}</p>
                          {apt.patient.phone && (
                            <div className="flex items-center gap-1">
                              <a
                                href={(() => { const d = apt.patient.phone.replace(/[^0-9]/g, ''); return `https://wa.me/${d.length === 10 ? '91' + d : d}`; })()}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-5 h-5 rounded-full bg-green-100 text-green-600 hover:bg-green-200 flex items-center justify-center"
                                title="WhatsApp"
                              >
                                <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                              </a>
                              <a
                                href={`tel:${apt.patient.phone}`}
                                className="w-5 h-5 rounded-full bg-teal-100 text-teal-700 hover:bg-blue-200 flex items-center justify-center"
                                title="Call"
                              >
                                <Phone className="w-2.5 h-2.5" />
                              </a>
                            </div>
                          )}
                        </div>
                        {apt.queueToken && apt.queuePosition && !["completed", "cancelled", "no_show"].includes(apt.status) && (
                          <a
                            href={`/patient-queue/${apt.queueToken}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-teal-700 hover:text-teal-800 hover:underline flex items-center gap-1 mt-1"
                          >
                            <ListOrdered className="w-3 h-3" />
                            Queue #{apt.queuePosition}
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="text-sm font-medium text-slate-700">Dr. {apt.doctor.name}</div>
                    <div className="text-sm text-slate-600">
                      <div className="flex items-center gap-1">
                        <CalendarIcon className="w-3 h-3" />
                        {format(new Date(apt.date), "MMM d, yyyy")}
                      </div>
                    </div>
                    <div>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold
                        ${apt.status === 'booked' ? 'bg-teal-100 text-teal-700' : 
                          apt.status === 'completed' ? 'bg-green-100 text-green-700' : 
                          apt.status === 'cancelled' ? 'bg-red-100 text-red-700' : 
                          apt.status === 'checked_in' ? 'bg-emerald-100 text-emerald-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                        {apt.status === 'checked_in' ? 'Paid' : apt.status === 'completed' ? 'Consulted' : apt.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {apt.bill ? (
                        <>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            apt.bill.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {apt.bill.status === 'paid' ? `₹${(apt.bill.amount / 100).toFixed(0)}` : 'Pending'}
                          </span>
                          {apt.bill.status === 'paid' && (
                            <button
                              onClick={() => {
                                const esc = (s: string) => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
                                const w = window.open('', '_blank');
                                if (!w) return;
                                w.document.write(`<html><head><title>Receipt - ${esc(apt.patient.name)}</title></head><body style="font-family:sans-serif;padding:40px;max-width:400px;margin:0 auto"><h1 style="color:#2563eb;font-size:18px">BariQ RECEIPT</h1><hr><p><strong>Patient:</strong> ${esc(apt.patient.name)}</p><p><strong>Doctor:</strong> Dr. ${esc(apt.doctor.name)}</p><p><strong>Date:</strong> ${esc(format(new Date(apt.bill.billingDate), "PPpp"))}</p><p><strong>Amount:</strong> ₹${esc(String((apt.bill.amount / 100).toFixed(0)))}</p><p><strong>Status:</strong> Paid</p><hr><p style="text-align:center;font-size:12px;color:#64748b">Thank you for your visit!</p><script>window.onload=()=>{window.print();window.close()}<\/script></body></html>`);
                                w.document.close();
                              }}
                              className="text-teal-700 hover:text-teal-800"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-slate-400">No bill</span>
                      )}
                    </div>
                    {can("appointments:reschedule") && (
                      <div className="flex items-center gap-1">
                        {!["completed", "cancelled", "no_show"].includes(apt.status) && (
                          <>
                            <RescheduleDialog appointment={apt} />
                            {apt.status === "booked" && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8 rounded-lg text-slate-400 hover:text-red-600"
                                      onClick={() => setCancelTarget(apt)}
                                    >
                                      <X className="w-4 h-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent><p>Cancel appointment</p></TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </>
                        )}
                        {can("appointments:delete") && ["cancelled", "no_show"].includes(apt.status) && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 rounded-lg text-slate-300 hover:text-red-600"
                                  onClick={() => setDeleteTarget(apt)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent><p>Delete record</p></TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Appointment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleteTarget?.patient?.name}</strong>'s {deleteTarget?.status} appointment with Dr. {deleteTarget?.doctor?.name}. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Keep</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-red-600 hover:bg-red-700"
              disabled={deleteAppointment.isPending}
              onClick={() => {
                if (!deleteTarget) return;
                deleteAppointment.mutate(deleteTarget.id, {
                  onSuccess: () => { toast({ title: "Appointment deleted" }); setDeleteTarget(null); },
                  onError: () => toast({ title: "Error", description: "Failed to delete appointment", variant: "destructive" }),
                });
              }}
            >
              {deleteAppointment.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={cancelTarget !== null} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Appointment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel <strong>{cancelTarget?.patient?.name}</strong>'s appointment with Dr. {cancelTarget?.doctor?.name}. This cannot be easily undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Keep It</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-red-600 hover:bg-red-700"
              disabled={updateAppointment.isPending}
              onClick={() => {
                if (!cancelTarget) return;
                updateAppointment.mutate(
                  { id: cancelTarget.id, updates: { status: "cancelled" } },
                  {
                    onSuccess: () => {
                      toast({ title: "Appointment cancelled" });
                      setCancelTarget(null);
                    },
                    onError: () => toast({ title: "Error", description: "Failed to cancel", variant: "destructive" }),
                  }
                );
              }}
            >
              {updateAppointment.isPending ? "Cancelling..." : "Yes, Cancel"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}

function CreateAppointmentDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const createAppointment = useCreateAppointment();
  const createPatient = useCreatePatient();
  const { data: doctors } = useDoctors();
  const { data: patients } = usePatients();
  const [isNewPatient, setIsNewPatient] = useState(false);
  const [isQuickCheck, setIsQuickCheck] = useState(false);

  const phoneValidation = z.string().min(1, "Phone is required").refine(v => {
    const digits = v.replace(/\D/g, "");
    return (digits.length === 10 && /^[6-9]/.test(digits)) ||
           (digits.length === 12 && digits.startsWith("91") && /^[6-9]/.test(digits.slice(2)));
  }, "Enter a valid 10-digit mobile number");

  const formSchema = useMemo(() => {
    let base = appointmentFormSchema.extend({
      patientName: z.string().optional(),
      patientPhone: z.string().optional(),
      patientEmail: z.string().optional(),
    });
    if (isNewPatient) {
      base = base.extend({
        patientId: z.any().optional(),
        patientName: z.string().min(1, "Name is required"),
        patientPhone: phoneValidation,
      }) as typeof base;
    }
    return base.superRefine((data, ctx) => {
      if (data.status !== "checked_in" && !data.slot) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Time slot is required", path: ["slot"] });
      }
    });
  }, [isNewPatient]);

  const form = useForm<any>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      status: "booked",
      reason: "",
      notes: "",
      date: format(new Date(), "yyyy-MM-dd"),
      slot: "",
      patientName: "",
      patientPhone: "",
      patientEmail: "",
    }
  });

  const watchedDoctorId = form.watch("doctorId");
  const watchedDate = form.watch("date");
  const watchedStatus = form.watch("status");

  // Generate available time slots based on selected doctor and date
  const availableSlots = useMemo(() => {
    if (!watchedDoctorId || !watchedDate || !doctors) return [];
    const doctor = doctors.find(d => d.id === watchedDoctorId);
    if (!doctor?.doctorProfile?.availability) return [];
    const [y, mo, d] = watchedDate.split("-").map(Number);
    const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][new Date(y, mo - 1, d).getDay()];
    return generateTimeSlots(doctor.doctorProfile.availability, dayOfWeek, watchedDate);
  }, [watchedDoctorId, watchedDate, doctors]);

  useEffect(() => {
    if (availableSlots.length > 0 && !form.getValues("slot")) {
      form.setValue("slot", availableSlots[0]);
    } else if (availableSlots.length > 0 && !availableSlots.includes(form.getValues("slot"))) {
      form.setValue("slot", availableSlots[0]);
    }
  }, [availableSlots]);

  const onSubmit = async (data: any) => {
    try {
      let patientId = data.patientId;

      if (isNewPatient) {
        if (!data.patientName || !data.patientPhone) {
          toast({ title: "Error", description: "Patient name and phone are required", variant: "destructive" });
          return;
        }
        
        try {
          const newPatient = await createPatient.mutateAsync({
            name: data.patientName,
            phone: data.patientPhone,
            email: data.patientEmail || undefined,
            status: "active",
            source: "internal"
          });
          patientId = newPatient.id;
        } catch (patientErr: any) {
          toast({ title: "Error", description: "Patient creation failed: " + patientErr.message, variant: "destructive" });
          return;
        }
      }

      if (!patientId && !isNewPatient) {
        toast({ title: "Error", description: "Please select a patient", variant: "destructive" });
        return;
      }

      let appointmentDate: Date;
      let finalStatus = data.status;
      let finalReason = data.reason;

      if (data.status === 'checked_in') {
        appointmentDate = new Date();
        finalReason = `EMERGENCY: ${data.reason}`;
      } else {
        if (!data.slot) {
          toast({ title: "Error", description: "Please select a time slot", variant: "destructive" });
          return;
        }
        const [start] = data.slot.split('-');
        const [hours, minutes] = start.split(':');
        const [y, mo, d] = data.date.split('-').map(Number);
        appointmentDate = new Date(y, mo - 1, d, parseInt(hours), parseInt(minutes));
      }

      const appointmentData = {
        ...data,
        patientId: Number(patientId),
        date: appointmentDate.toISOString(),
        status: finalStatus,
        reason: finalReason,
        isQuickCheck: isQuickCheck
      };
      
      createAppointment.mutate(appointmentData as any, {
        onSuccess: () => {
          toast({ title: "Success", description: finalStatus === 'checked_in' ? "Emergency entry created." : "Appointment scheduled successfully." });
          onOpenChange(false);
          form.reset();
          setIsNewPatient(false);
          setIsQuickCheck(false);
        },
        onError: (err) => {
          toast({ title: "Error", description: err.message, variant: "destructive" });
        }
      });
    } catch (err: any) {
      toast({ title: "Error", description: "Failed to create patient: " + err.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="lg" className="rounded-xl bg-teal-600 hover:bg-teal-700 shadow-lg shadow-teal-600/20">
          <Plus className="w-5 h-5 mr-2" /> Book Appointment
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] rounded-2xl">
        <DialogHeader>
          <DialogTitle>Book New Appointment</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100 mb-2">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-teal-700" />
                <span className="text-sm font-medium">New Patient?</span>
              </div>
              <Switch checked={isNewPatient} onCheckedChange={setIsNewPatient} />
            </div>

            <div className="flex items-center gap-3 bg-amber-50 p-3 rounded-xl border border-amber-100">
              <Checkbox
                id="quickCheck"
                checked={isQuickCheck}
                onCheckedChange={(checked) => setIsQuickCheck(checked as boolean)}
              />
              <label
                htmlFor="quickCheck"
                className="text-sm font-medium text-amber-900 cursor-pointer flex-1"
              >
                Walk-in Quick Check (No Queue Position)
              </label>
            </div>

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Priority</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex gap-4"
                    >
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="booked" />
                        </FormControl>
                        <FormLabel className="font-normal">Regular</FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="checked_in" className="text-red-600 border-red-600" />
                        </FormControl>
                        <FormLabel className="font-normal text-red-600 font-bold">Emergency</FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {isNewPatient ? (
                <>
                  <FormField
                    control={form.control}
                    name="patientName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Patient Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Full Name" {...field} className="rounded-xl h-11" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="patientPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input placeholder="Phone Number" {...field} className="rounded-xl h-11" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              ) : (
                <FormField
                  control={form.control}
                  name="patientId"
                  render={({ field }) => (
                    <FormItem className="md:col-span-1">
                      <FormLabel>Patient</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ? String(field.value) : ""}>
                        <FormControl>
                          <SelectTrigger className="rounded-xl h-11">
                            <SelectValue placeholder="Select Patient" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {patients?.map(p => (
                            <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={form.control}
                name="doctorId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Doctor</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="rounded-xl h-11">
                          <SelectValue placeholder="Select Doctor" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {doctors?.map(d => (
                          <SelectItem key={d.id} value={d.id}>Dr. {d.name}{d.doctorProfile?.specialization ? ` · ${d.doctorProfile.specialization}` : ""}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            {watchedStatus !== "checked_in" && (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} min={format(new Date(), "yyyy-MM-dd")} className="rounded-xl h-11" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="slot"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Time Slot</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="rounded-xl h-11">
                            <SelectValue placeholder="Select Slot" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {availableSlots.length === 0 ? (
                            <div className="px-2 py-4 text-center text-sm text-slate-500">
                              {watchedDoctorId && watchedDate
                                ? "No availability for this day"
                                : "Select doctor and date first"}
                            </div>
                          ) : (
                            availableSlots.map(slot => (
                              <SelectItem key={slot} value={slot}>{slot}</SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason for Visit</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Annual Checkup, Fever" {...field} value={field.value || ""} className="rounded-xl h-11" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button 
              type="submit" 
              disabled={createAppointment.isPending} 
              className={`w-full rounded-xl h-12 font-semibold mt-4 ${watchedStatus === 'checked_in' ? 'bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/20' : ''}`}
            >
              {createAppointment.isPending ? "Booking..." : (watchedStatus === 'checked_in' ? "Create Emergency Entry" : "Confirm Booking")}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
