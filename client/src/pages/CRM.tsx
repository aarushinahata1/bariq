import { Layout } from "@/components/Layout";
import { PageHeader } from "@/components/ui/PageHeader";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { Patient } from "@shared/schema";
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { MessageSquare, Send, Users, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loading } from "@/components/ui/loading";

export default function CRM() {
  const { toast } = useToast();
  const [selectedPatients, setSelectedPatients] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [funnelFilter, setFunnelFilter] = useState("all");
  const [message, setMessage] = useState("");
  const [channel, setChannel] = useState<"whatsapp" | "sms">("whatsapp");

  const { data: patients, isLoading } = useQuery<Patient[]>({
    queryKey: ["/api/patients", { search, funnelStage: funnelFilter === "all" ? undefined : funnelFilter }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      // funnelStage filtering is done client-side since the API filters by patient.status
      const url = params.toString() ? `/api/patients?${params.toString()}` : "/api/patients";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch patients");
      return res.json();
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (data: { patientIds: number[], message: string, channel: string }) => {
      const res = await apiRequest("POST", "/api/crm/send-bulk", data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Messages Sent",
        description: `Successfully sent ${selectedPatients.length} ${channel} messages.`,
      });
      setSelectedPatients([]);
      setMessage("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send messages. Please try again.",
        variant: "destructive",
      });
    }
  });

  const togglePatient = (id: number) => {
    setSelectedPatients(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedPatients.length === filteredPatients.length) {
      setSelectedPatients([]);
    } else {
      setSelectedPatients(filteredPatients.map(p => p.id));
    }
  };

  const filteredPatients = (patients || []).filter(p => {
    if (funnelFilter === "all") return true;
    return (p as any).funnelStage === funnelFilter;
  });

  if (isLoading) return <Layout><Loading /></Layout>;

  return (
    <Layout>
      <PageHeader 
        title="CRM & Marketing" 
        description="Engage with your patients through bulk WhatsApp and SMS campaigns."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <CardTitle>Select Patients</CardTitle>
                <CardDescription>Choose the recipients for your message.</CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                  <Input 
                    placeholder="Search patients..." 
                    className="pl-9 w-full"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <Select value={funnelFilter} onValueChange={setFunnelFilter}>
                  <SelectTrigger className="w-full sm:w-36">
                    <SelectValue placeholder="Stage" />
                  </SelectTrigger>
                  <SelectContent position="item-aligned">
                    <SelectItem value="all">All Stages</SelectItem>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="consulted">Consulted</SelectItem>
                    <SelectItem value="follow_up">Follow-up</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {/* Mobile: card list */}
              <div className="md:hidden space-y-2">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <Checkbox 
                    checked={selectedPatients.length === filteredPatients.length && filteredPatients.length > 0}
                    onCheckedChange={toggleAll}
                  />
                  <span className="text-xs font-medium text-slate-500">Select All</span>
                </div>
                {filteredPatients.map((patient) => {
                  const s = (patient as any).lastAppointmentStatus;
                  const styles: Record<string, string> = {
                    booked: 'bg-teal-100 text-teal-700',
                    checked_in: 'bg-green-100 text-green-700',
                    in_progress: 'bg-indigo-100 text-indigo-700',
                    completed: 'bg-emerald-100 text-emerald-700',
                    cancelled: 'bg-red-100 text-red-700',
                    no_show: 'bg-orange-100 text-orange-700',
                  };
                  const labels: Record<string, string> = {
                    booked: 'Booked',
                    checked_in: 'Paid',
                    in_progress: 'In Progress',
                    completed: 'Consulted',
                    cancelled: 'Cancelled',
                    no_show: 'No Show',
                  };
                  return (
                    <div key={patient.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50">
                      <Checkbox 
                        checked={selectedPatients.includes(patient.id)}
                        onCheckedChange={() => togglePatient(patient.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-slate-900 truncate">{patient.name}</p>
                        <p className="text-xs text-slate-500">{patient.phone}</p>
                      </div>
                      {s ? (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${styles[s] || 'bg-slate-100 text-slate-700'}`}>
                          {labels[s] || s}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 shrink-0">New</span>
                      )}
                    </div>
                  );
                })}
                {filteredPatients.length === 0 && (
                  <div className="p-8 text-center text-slate-400">No patients found.</div>
                )}
              </div>

              {/* Desktop: table */}
              <div className="hidden md:block border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="p-3 text-left w-10">
                        <Checkbox 
                          checked={selectedPatients.length === filteredPatients.length && filteredPatients.length > 0}
                          onCheckedChange={toggleAll}
                        />
                      </th>
                      <th className="p-3 text-left font-semibold text-slate-600">Patient Name</th>
                      <th className="p-3 text-left font-semibold text-slate-600">Phone</th>
                      <th className="p-3 text-left font-semibold text-slate-600">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredPatients.map((patient) => {
                      const s = (patient as any).lastAppointmentStatus;
                      const styles: Record<string, string> = {
                        booked: 'bg-teal-100 text-teal-700',
                        checked_in: 'bg-green-100 text-green-700',
                        in_progress: 'bg-indigo-100 text-indigo-700',
                        completed: 'bg-emerald-100 text-emerald-700',
                        cancelled: 'bg-red-100 text-red-700',
                        no_show: 'bg-orange-100 text-orange-700',
                      };
                      const labels: Record<string, string> = {
                        booked: 'Booked',
                        checked_in: 'Paid',
                        in_progress: 'In Progress',
                        completed: 'Consulted',
                        cancelled: 'Cancelled',
                        no_show: 'No Show',
                      };
                      return (
                        <tr key={patient.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3">
                            <Checkbox 
                              checked={selectedPatients.includes(patient.id)}
                              onCheckedChange={() => togglePatient(patient.id)}
                            />
                          </td>
                          <td className="p-3 font-medium">{patient.name}</td>
                          <td className="p-3 text-slate-500">{patient.phone}</td>
                          <td className="p-3">
                            {s ? (
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[s] || 'bg-slate-100 text-slate-700'}`}>
                                {labels[s] || s}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">New</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {filteredPatients.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-slate-400">No patients found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Compose Message</CardTitle>
              <CardDescription>Send customized messages to selected recipients.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Channel</label>
                <div className="flex gap-2">
                  <Button 
                    variant={channel === 'whatsapp' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setChannel('whatsapp')}
                  >
                    WhatsApp
                  </Button>
                  <Button 
                    variant={channel === 'sms' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setChannel('sms')}
                  >
                    SMS
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Message Content</label>
                <Textarea 
                  placeholder="Type your message here... Use {name} for personalization."
                  className="min-h-[200px]"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
                <p className="text-xs text-slate-400">
                  Tip: Start with "Hello &#123;name&#125;," to automatically include the patient's name.
                </p>
              </div>

              <div className="p-4 bg-teal-50 border border-teal-100 rounded-xl">
                <div className="flex items-center gap-3 text-teal-700">
                  <Users className="h-5 w-5" />
                  <span className="font-semibold">{selectedPatients.length} Patients selected</span>
                </div>
              </div>

              <Button 
                className="w-full h-12 text-lg font-bold"
                disabled={selectedPatients.length === 0 || !message || sendMessageMutation.isPending}
                onClick={() => sendMessageMutation.mutate({ 
                  patientIds: selectedPatients, 
                  message, 
                  channel 
                })}
              >
                {sendMessageMutation.isPending ? "Sending..." : (
                  <>
                    <Send className="w-5 h-5 mr-2" /> Send Campaign
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Templates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { title: "Follow-up", text: "Hi {name}, hope you're doing well! Just following up on your last visit." },
                { title: "Promotional", text: "Special offer for {name}! Get 20% off on your next dental cleaning." },
                { title: "Health Tip", text: "Health Tip for {name}: Remember to drink at least 8 glasses of water today!" }
              ].map((template, i) => (
                <Button 
                  key={i}
                  variant="outline" 
                  className="w-full justify-start text-left h-auto py-3 px-4"
                  onClick={() => setMessage(template.text)}
                >
                  <div className="truncate">
                    <p className="font-bold text-sm">{template.title}</p>
                    <p className="text-xs text-slate-500 truncate">{template.text}</p>
                  </div>
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
