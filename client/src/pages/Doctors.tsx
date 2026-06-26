import { PageHeader } from "@/components/ui/PageHeader";
import { useDoctors, useCreateDoctor, useNotifyDelay, useUpdateDoctorProfile, useDeleteDoctor } from "@/hooks/use-doctors";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, BellRing, Clock, Settings2, Pencil, Check, ChevronDown, ChevronUp, Calendar, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema, type InsertUser } from "@shared/schema";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Loading } from "@/components/ui/loading";
import { Switch } from "@/components/ui/switch";
import { z } from "zod";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

const createDoctorSchema = insertUserSchema.extend({
  name: z.string().min(1, "Full name is required"),
  specialization: z.string().optional(),
  avgConsultationTime: z.coerce.number().min(1).default(15),
  availability: z.record(z.object({ enabled: z.boolean() })).optional()
});

type CreateDoctorValues = z.infer<typeof createDoctorSchema>;

const DEFAULT_AVAILABILITY = {
  monday: { enabled: true },
  tuesday: { enabled: true },
  wednesday: { enabled: true },
  thursday: { enabled: true },
  friday: { enabled: true },
  saturday: { enabled: false },
  sunday: { enabled: false },
};

function AvailabilityEditor({ value, onChange }: { value: any, onChange: (val: any) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {DAYS.map(day => (
        <div key={day} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100">
          <span className={`text-sm font-medium capitalize ${value[day]?.enabled ? 'text-slate-700' : 'text-slate-400'}`}>{day}</span>
          <Switch
            checked={value[day]?.enabled ?? false}
            onCheckedChange={(enabled) => onChange({ ...value, [day]: { enabled } })}
          />
        </div>
      ))}
    </div>
  );
}

export default function Doctors() {
  const { data: doctors, isLoading } = useDoctors();
  const [editingAvailability, setEditingAvailability] = useState<any>(null);
  const [editingConsultationTime, setEditingConsultationTime] = useState<number | null>(null);
  const [editingSpecialization, setEditingSpecialization] = useState<string | null>(null);
  const [editingConsultationFee, setEditingConsultationFee] = useState<number | null>(null);
  const [expandedAvailability, setExpandedAvailability] = useState<string | null>(null);
  const [editingAvailabilityFor, setEditingAvailabilityFor] = useState<string | null>(null);

  const updateProfile = useUpdateDoctorProfile();
  const deleteDoctor = useDeleteDoctor();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [notifyId, setNotifyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  const [inlineName, setInlineName] = useState("");
  const [inlineSpecialization, setInlineSpecialization] = useState("");
  const [inlineFee, setInlineFee] = useState("");

  const startInlineEdit = (doc: any) => {
    setInlineEditId(doc.id);
    setInlineName(doc.name);
    setInlineSpecialization(doc.doctorProfile?.specialization || "");
    setInlineFee(String((doc.doctorProfile?.consultationFee ?? 15000) / 100));
  };

  const cancelInlineEdit = () => {
    setInlineEditId(null);
  };

  const saveInlineEdit = (userId: string) => {
    if (!inlineName.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    const parsedFee = parseFloat(inlineFee || "0");
    if (isNaN(parsedFee) || parsedFee < 0) {
      toast({ title: "Invalid fee", description: "Enter a valid consultation fee (₹)", variant: "destructive" });
      return;
    }
    updateProfile.mutate({
      id: userId,
      updates: {
        name: inlineName.trim(),
        specialization: inlineSpecialization.trim() || undefined,
        consultationFee: Math.round(parsedFee * 100),
      } as any,
    }, {
      onSuccess: () => {
        toast({ title: "Doctor updated" });
        setInlineEditId(null);
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to update doctor details", variant: "destructive" });
      },
    });
  };

  const handleUpdateAvailability = (userId: string) => {
    const updates: any = {};
    if (editingAvailability) updates.availability = editingAvailability;
    if (editingConsultationTime !== null) updates.avgConsultationTime = editingConsultationTime;
    if (editingSpecialization !== null) updates.specialization = editingSpecialization;
    if (editingConsultationFee !== null) updates.consultationFee = Math.round(editingConsultationFee * 100);

    updateProfile.mutate({
      id: userId,
      updates
    }, {
      onSuccess: () => {
        toast({ title: "Success", description: "Schedule updated successfully." });
        setEditingAvailability(null);
        setEditingConsultationTime(null);
        setEditingSpecialization(null);
        setEditingConsultationFee(null);
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to save schedule", variant: "destructive" });
      },
    });
  };
  const handleEmergencyToggle = (userId: string, isAvailable: boolean) => {
    updateProfile.mutate({ id: userId, updates: { isAvailable } }, {
      onSuccess: () => {
        toast({
          title: isAvailable ? "Clinic Resumed" : "Doctor Unavailable",
          description: isAvailable ? "Doctor is now accepting patients." : "Doctor marked as unavailable. Use 'Notify Delay' to alert waiting patients.",
        });
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to update availability", variant: "destructive" });
      },
    });
  };

  if (isLoading) return <Loading />;

  // Filter to show only doctors from user list if mixed
  const doctorList = doctors?.filter(u => u.role === 'doctor');

  return (
    <>
      <PageHeader
        title="Medical Staff"
        description="Manage doctors and their availability."
        action={<CreateDoctorDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {doctorList?.map((doc) => (
          <div key={doc.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div className="flex gap-4">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-2xl shrink-0">
                  👨‍⚕️
                </div>
                {inlineEditId === doc.id ? (
                  <div className="space-y-2 flex-1 min-w-0">
                    <Input
                      value={inlineName}
                      onChange={(e) => setInlineName(e.target.value)}
                      className="rounded-xl h-9 text-lg font-bold"
                      placeholder="Doctor name"
                    />
                    <Input
                      value={inlineSpecialization}
                      onChange={(e) => setInlineSpecialization(e.target.value)}
                      className="rounded-xl h-8 text-sm"
                      placeholder="Specialization"
                    />
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm text-slate-500">₹</span>
                      <Input
                        type="number"
                        value={inlineFee}
                        onChange={(e) => setInlineFee(e.target.value)}
                        className="rounded-xl h-8 text-sm w-28"
                        placeholder="Fee"
                      />
                      <span className="text-xs text-slate-400">/ visit</span>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        onClick={() => saveInlineEdit(doc.id)}
                        disabled={updateProfile.isPending}
                        className="rounded-xl bg-teal-600 hover:bg-teal-700 text-white h-8 text-xs"
                      >
                        <Check className="w-3.5 h-3.5 mr-1" />
                        {updateProfile.isPending ? "Saving..." : "Save"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={cancelInlineEdit}
                        className="rounded-xl h-8 text-xs"
                      >
                        <X className="w-3.5 h-3.5 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-bold text-slate-900">Dr. {doc.name}</h3>
                      <button
                        onClick={() => startInlineEdit(doc)}
                        className="text-slate-300 hover:text-slate-500 transition-colors"
                        title="Edit details"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-teal-700 font-medium">{doc.doctorProfile?.specialization || "General Physician"}</p>
                    <div className="flex items-center gap-2 mt-2 text-sm text-slate-500">
                      <Clock className="w-4 h-4" />
                      {doc.doctorProfile?.avgConsultationTime || 15} mins / consult
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
                      <span>₹{((doc.doctorProfile?.consultationFee ?? 15000) / 100).toFixed(0)} / visit</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-xs font-bold ${doc.doctorProfile?.isAvailable ? "text-green-600" : "text-red-500"}`}>
                  {doc.doctorProfile?.isAvailable ? "Available" : "Unavailable"}
                </span>
                <Switch
                  checked={doc.doctorProfile?.isAvailable ?? true}
                  onCheckedChange={(checked) => handleEmergencyToggle(doc.id, checked)}
                />
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3">

              {/* Availability summary */}
              <div className="border border-slate-100 rounded-xl overflow-hidden">
                <button
                  onClick={() => {
                    const isExpanding = expandedAvailability !== doc.id;
                    setExpandedAvailability(isExpanding ? doc.id : null);
                    if (isExpanding) {
                      setEditingAvailabilityFor(null);
                    }
                  }}
                  className="w-full flex items-center justify-between p-3 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Calendar className="w-4 h-4 text-teal-600" />
                    Weekly Availability
                  </div>
                  {expandedAvailability === doc.id ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </button>
                {expandedAvailability === doc.id && (
                  <div className="border-t border-slate-100 p-3 space-y-2">
                    {editingAvailabilityFor === doc.id ? (
                      <div className="space-y-3">
                        <AvailabilityEditor
                          value={editingAvailability || doc.doctorProfile?.availability || DEFAULT_AVAILABILITY}
                          onChange={setEditingAvailability}
                        />
                        <div className="flex gap-2 pt-2">
                          <Button
                            size="sm"
                            className="flex-1 rounded-xl bg-teal-600 hover:bg-teal-700"
                            disabled={updateProfile.isPending}
                            onClick={() => {
                              handleUpdateAvailability(doc.id);
                              setEditingAvailabilityFor(null);
                            }}
                          >
                            {updateProfile.isPending ? "Saving..." : "Save Schedule"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-xl"
                            onClick={() => setEditingAvailabilityFor(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-1.5">
                          {DAYS.map(day => {
                            const avail = (doc.doctorProfile?.availability as any)?.[day];
                            const isEnabled = avail?.enabled;
                            return (
                              <div key={day} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-50 text-sm">
                                <span className={`capitalize font-medium ${isEnabled ? 'text-slate-700' : 'text-slate-400'}`}>{day.slice(0, 3)}</span>
                                <span className={`text-xs font-semibold ${isEnabled ? 'text-teal-600' : 'text-slate-300'}`}>{isEnabled ? 'On' : 'Off'}</span>
                              </div>
                            );
                          })}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full rounded-xl mt-2 text-teal-700 border-blue-200 hover:bg-teal-50"
                          onClick={() => {
                            setEditingAvailability(doc.doctorProfile?.availability || DEFAULT_AVAILABILITY);
                            setEditingConsultationTime(doc.doctorProfile?.avgConsultationTime || 15);
                            setEditingSpecialization(doc.doctorProfile?.specialization || "");
                            setEditingConsultationFee((doc.doctorProfile?.consultationFee ?? 15000) / 100);
                            setEditingAvailabilityFor(doc.id);
                          }}
                        >
                          <Settings2 className="w-4 h-4 mr-2" /> Edit Schedule
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-3 border-t border-slate-100">
                <Button
                  onClick={() => setNotifyId(doc.id)}
                  className="flex-1 rounded-xl bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100 hover:border-orange-300"
                >
                  <BellRing className="w-4 h-4 mr-2" /> Notify Delay
                </Button>
                <Button
                  variant="outline"
                  className="rounded-xl border-red-100 text-red-500 hover:bg-red-50 hover:border-red-200"
                  onClick={() => setDeleteTarget({ id: doc.id, name: doc.name || "Doctor" })}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <NotifyDelayDialog doctorId={notifyId} open={!!notifyId} onOpenChange={(open) => !open && setNotifyId(null)} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Doctor?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <strong>Dr. {deleteTarget?.name}</strong> from the system. Their upcoming booked appointments will be cancelled. Past appointment records are preserved. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (!deleteTarget) return;
                deleteDoctor.mutate(deleteTarget.id, {
                  onSuccess: () => { toast({ title: "Doctor removed" }); setDeleteTarget(null); },
                  onError: () => toast({ title: "Error", description: "Failed to remove doctor", variant: "destructive" }),
                });
              }}
            >
              Remove Doctor
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function CreateDoctorDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const createDoctor = useCreateDoctor();
  
  const form = useForm<CreateDoctorValues>({
    resolver: zodResolver(createDoctorSchema),
    defaultValues: { 
      email: "", 
      name: "", 
      role: "doctor", 
      specialization: "", 
      avgConsultationTime: 15,
      availability: DEFAULT_AVAILABILITY
    }
  });

  const onSubmit = (data: CreateDoctorValues) => {
    createDoctor.mutate({
      ...data,
      doctorProfile: {
        specialization: data.specialization,
        avgConsultationTime: data.avgConsultationTime,
        isAvailable: true,
        availability: data.availability,
      }
    }, {
      onSuccess: () => {
        toast({ title: "Success", description: "Doctor added successfully." });
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
          <Plus className="w-5 h-5 mr-2" /> Add Doctor
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] rounded-2xl">
        <DialogHeader>
          <DialogTitle>Add New Doctor</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl><Input placeholder="Jane Smith" {...field} value={field.value || ""} className="rounded-xl" /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl><Input placeholder="drjane@example.com" {...field} value={field.value || ""} className="rounded-xl" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="specialization"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Specialization</FormLabel>
                    <FormControl><Input placeholder="Cardiology" {...field} value={field.value || ""} className="rounded-xl" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="avgConsultationTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Avg Time (mins)</FormLabel>
                    <FormControl><Input type="number" {...field} className="rounded-xl" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
              <label className="text-sm font-medium">Availability Schedule</label>
              <FormField
                control={form.control}
                name="availability"
                render={({ field }) => (
                  <AvailabilityEditor value={field.value} onChange={field.onChange} />
                )}
              />
            </div>

            <Button type="submit" disabled={createDoctor.isPending} className="w-full rounded-xl h-12 font-semibold">
              {createDoctor.isPending ? "Creating..." : "Create Account"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function NotifyDelayDialog({ doctorId, open, onOpenChange }: { doctorId: string | null, open: boolean, onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const notifyDelay = useNotifyDelay();
  const [minutes, setMinutes] = useState(15);
  const [reason, setReason] = useState("Emergency case");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctorId) return;

    notifyDelay.mutate({ id: doctorId as any, delayMinutes: minutes, reason }, {
      onSuccess: (data) => {
        toast({ title: "Notifications Sent", description: `Notified ${data.notifiedCount} patients of the delay.` });
        onOpenChange(false);
      },
      onError: (err) => {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>Broadcast Delay Notification</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Delay Duration (minutes)</label>
            <div className="flex gap-2">
              {[15, 30, 45, 60].map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMinutes(m)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors border ${
                    minutes === m 
                      ? "bg-teal-600 text-white border-teal-600" 
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {m}m
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Reason</label>
            <Input 
              value={reason} 
              onChange={e => setReason(e.target.value)} 
              placeholder="e.g. Emergency surgery"
              className="rounded-xl"
            />
          </div>
          <Button type="submit" disabled={notifyDelay.isPending} className="w-full rounded-xl h-12 bg-orange-600 hover:bg-orange-700 text-white font-semibold">
            {notifyDelay.isPending ? "Sending..." : "Send Notifications"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
