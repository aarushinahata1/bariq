import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Plus, Trash2, PersonStanding } from "lucide-react";
import { format } from "date-fns";

// ── Types ──────────────────────────────────────────────────────────────────────

type RegionState = {
  condition: string;
  severity?: "mild" | "moderate" | "severe";
  note?: string;
  updatedAt?: string;
};

type TreatmentLogEntry = {
  id: string;
  date: string;
  regions: string[];
  procedure: string;
  note?: string;
};

type BodyChartData = {
  patientId: number;
  regions: Record<string, RegionState>;
  treatmentLog: TreatmentLogEntry[];
  notes: string | null;
};

// ── Constants ──────────────────────────────────────────────────────────────────

const CONDITIONS: { value: string; label: string; color: string; textColor: string }[] = [
  { value: "normal", label: "Normal", color: "bg-white border-slate-300", textColor: "text-slate-400" },
  { value: "pain", label: "Pain", color: "bg-red-500 border-red-600", textColor: "text-white" },
  { value: "sprain_strain", label: "Sprain / Strain", color: "bg-orange-400 border-orange-500", textColor: "text-white" },
  { value: "fracture", label: "Fracture", color: "bg-rose-600 border-rose-700", textColor: "text-white" },
  { value: "post_surgery", label: "Post-Surgery", color: "bg-purple-500 border-purple-600", textColor: "text-white" },
  { value: "inflammation", label: "Inflammation / Tendinitis", color: "bg-amber-400 border-amber-500", textColor: "text-white" },
  { value: "reduced_rom", label: "Reduced ROM", color: "bg-blue-400 border-blue-500", textColor: "text-white" },
  { value: "swelling", label: "Swelling", color: "bg-cyan-500 border-cyan-600", textColor: "text-white" },
  { value: "numbness", label: "Numbness / Tingling", color: "bg-fuchsia-600 border-fuchsia-700", textColor: "text-white" },
  { value: "chronic", label: "Chronic / Recurring", color: "bg-indigo-500 border-indigo-600", textColor: "text-white" },
];
const conditionMap = Object.fromEntries(CONDITIONS.map(c => [c.value, c]));
const SEVERITIES = ["mild", "moderate", "severe"] as const;

const UPPER_LIMB = ["shoulder", "upper_arm", "elbow", "forearm", "wrist", "hand"];
const LOWER_LIMB = ["hip", "thigh", "knee", "shin", "ankle", "foot"];
const TRUNK = ["neck", "chest", "upper_back", "abdomen", "lower_back"];

const REGION_LABELS: Record<string, string> = {
  shoulder: "Shoulder", upper_arm: "Upper Arm", elbow: "Elbow", forearm: "Forearm", wrist: "Wrist", hand: "Hand",
  hip: "Hip", thigh: "Thigh", knee: "Knee", shin: "Shin / Calf", ankle: "Ankle", foot: "Foot",
  neck: "Neck", chest: "Chest", upper_back: "Upper Back", abdomen: "Abdomen", lower_back: "Lower Back",
};

function fullLabel(regionId: string): string {
  const [part, side] = regionId.split("-");
  const base = REGION_LABELS[part] || part;
  return side === "L" ? `Left ${base}` : side === "R" ? `Right ${base}` : base;
}

// ── Region button ──────────────────────────────────────────────────────────────

function RegionButton({ regionId, state, onClick }: { regionId: string; state: RegionState; onClick: () => void }) {
  const cfg = conditionMap[state.condition] || conditionMap.normal;
  const [part, side] = regionId.split("-");
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${fullLabel(regionId)} — ${cfg.label}${state.severity ? ` (${state.severity})` : ""}${state.note ? `: ${state.note}` : ""}`}
      className={cn(
        "w-24 sm:w-28 h-8 rounded-full border-2 flex items-center justify-center gap-1 text-[10px] font-bold px-2 transition-transform hover:scale-105 hover:z-10",
        cfg.color, cfg.textColor
      )}
    >
      {side && <span className="opacity-60">{side}</span>}
      <span className="truncate">{REGION_LABELS[part] || part}</span>
    </button>
  );
}

// ── Body map ───────────────────────────────────────────────────────────────────

function RegionGroup({
  title, parts, paired, regions, onRegionClick,
}: {
  title: string;
  parts: string[];
  paired: boolean;
  regions: Record<string, RegionState>;
  onRegionClick: (id: string) => void;
}) {
  if (!paired) {
    return (
      <div>
        <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-2 text-center">{title}</p>
        <div className="flex flex-col gap-1.5 items-center">
          {parts.map(part => (
            <RegionButton key={part} regionId={part} state={regions[part] || { condition: "normal" }} onClick={() => onRegionClick(part)} />
          ))}
        </div>
      </div>
    );
  }
  return (
    <div>
      <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-2 text-center">{title}</p>
      <div className="flex items-start justify-center gap-4">
        <div className="flex flex-col gap-1.5 items-end">
          {parts.map(part => {
            const id = `${part}-L`;
            return <RegionButton key={id} regionId={id} state={regions[id] || { condition: "normal" }} onClick={() => onRegionClick(id)} />;
          })}
        </div>
        <div className="w-px bg-slate-200 self-stretch shrink-0" />
        <div className="flex flex-col gap-1.5 items-start">
          {parts.map(part => {
            const id = `${part}-R`;
            return <RegionButton key={id} regionId={id} state={regions[id] || { condition: "normal" }} onClick={() => onRegionClick(id)} />;
          })}
        </div>
      </div>
    </div>
  );
}

function BodyMap({ regions, onRegionClick }: { regions: Record<string, RegionState>; onRegionClick: (id: string) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 overflow-x-auto py-1">
      <RegionGroup title="Upper Limbs (L / R)" parts={UPPER_LIMB} paired regions={regions} onRegionClick={onRegionClick} />
      <RegionGroup title="Trunk / Spine" parts={TRUNK} paired={false} regions={regions} onRegionClick={onRegionClick} />
      <RegionGroup title="Lower Limbs (L / R)" parts={LOWER_LIMB} paired regions={regions} onRegionClick={onRegionClick} />
    </div>
  );
}

// ── Region edit dialog ───────────────────────────────────────────────────────

function RegionEditDialog({
  regionId, state, onSave, onClose,
}: {
  regionId: string;
  state: RegionState;
  onSave: (state: RegionState | null) => void;
  onClose: () => void;
}) {
  const [condition, setCondition] = useState(state.condition);
  const [severity, setSeverity] = useState<string>(state.severity || "");
  const [note, setNote] = useState(state.note || "");

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="rounded-2xl sm:max-w-sm">
        <DialogHeader><DialogTitle>{fullLabel(regionId)}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-1">
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Condition</label>
            <Select value={condition} onValueChange={setCondition}>
              <SelectTrigger className="rounded-xl h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CONDITIONS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Severity</label>
            <div className="flex gap-1.5">
              {SEVERITIES.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSeverity(v => (v === s ? "" : s))}
                  className={cn(
                    "flex-1 h-8 rounded-lg border text-xs font-semibold capitalize transition-colors",
                    severity === s ? "bg-teal-600 text-white border-teal-600" : "bg-white border-slate-200 text-slate-500 hover:border-teal-300"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Note</label>
            <Textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Optional clinical note for this region"
              className="rounded-xl text-sm min-h-[60px] resize-none"
            />
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1 rounded-xl" onClick={() => onSave(null)}>
            Reset to Normal
          </Button>
          <Button
            className="flex-1 rounded-xl bg-teal-600 hover:bg-teal-700"
            onClick={() => onSave({ condition, severity: (severity || undefined) as RegionState["severity"], note: note.trim() || undefined })}
          >
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Treatment log ────────────────────────────────────────────────────────────

function TreatmentLog({
  entries, onAdd, onDelete,
}: {
  entries: TreatmentLogEntry[];
  onAdd: (entry: Omit<TreatmentLogEntry, "id">) => void;
  onDelete: (id: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [regionsInput, setRegionsInput] = useState("");
  const [procedure, setProcedure] = useState("");
  const [note, setNote] = useState("");

  function submit() {
    if (!procedure.trim()) return;
    onAdd({
      date,
      procedure: procedure.trim(),
      regions: regionsInput.split(",").map(r => r.trim()).filter(Boolean),
      note: note.trim() || undefined,
    });
    setDate(format(new Date(), "yyyy-MM-dd"));
    setRegionsInput("");
    setProcedure("");
    setNote("");
    setShowForm(false);
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-bold text-slate-700">Treatment Log</h4>
        <Button size="sm" variant="outline" onClick={() => setShowForm(v => !v)} className="rounded-lg h-8 text-xs">
          <Plus className="w-3.5 h-3.5 mr-1" /> Add Entry
        </Button>
      </div>

      {showForm && (
        <div className="p-3 rounded-xl bg-teal-50 border border-teal-100 mb-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="rounded-lg h-9 text-sm" />
            <Input value={regionsInput} onChange={e => setRegionsInput(e.target.value)} placeholder="Regions e.g. Left Knee, Lower Back" className="rounded-lg h-9 text-sm" />
          </div>
          <Input value={procedure} onChange={e => setProcedure(e.target.value)} placeholder="Procedure e.g. Manual Therapy, Ultrasound Therapy" className="rounded-lg h-9 text-sm" />
          <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Notes (optional)" className="rounded-lg text-sm min-h-[50px] resize-none" />
          <div className="flex gap-2">
            <Button size="sm" className="rounded-lg h-8 text-xs bg-teal-600 hover:bg-teal-700" onClick={submit} disabled={!procedure.trim()}>
              Save Entry
            </Button>
            <Button size="sm" variant="outline" className="rounded-lg h-8 text-xs" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {entries.length === 0 ? (
        <p className="text-xs text-slate-400 italic">No treatment history logged yet.</p>
      ) : (
        <div className="space-y-2">
          {entries.map(e => (
            <div key={e.id} className="flex items-start justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800">
                  {e.procedure}
                  {e.regions.length > 0 && <span className="text-teal-600 font-normal"> · {e.regions.join(", ")}</span>}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{format(new Date(e.date), "MMM d, yyyy")}</p>
                {e.note && <p className="text-xs text-slate-500 italic mt-1">{e.note}</p>}
              </div>
              <button onClick={() => onDelete(e.id)} className="text-slate-300 hover:text-red-500 shrink-0" title="Delete entry">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function BodyChart({ patientId }: { patientId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const queryKey = ["/api/body-charts", patientId];

  const [editingRegion, setEditingRegion] = useState<string | null>(null);
  const [chartNotes, setChartNotes] = useState("");
  const [notesDirty, setNotesDirty] = useState(false);

  const { data: chart, isLoading } = useQuery<BodyChartData>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/body-charts/${patientId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load body chart");
      return res.json();
    },
    enabled: !!patientId,
  });

  useEffect(() => {
    if (chart && !notesDirty) setChartNotes(chart.notes || "");
  }, [chart, notesDirty]);

  const saveMutation = useMutation({
    mutationFn: async (updates: Partial<BodyChartData>) => {
      const res = await fetch(`/api/body-charts/${patientId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to save body chart");
      return res.json() as Promise<BodyChartData>;
    },
    onSuccess: (data) => queryClient.setQueryData(queryKey, data),
    onError: () => toast({ title: "Failed to save body chart", variant: "destructive" }),
  });

  if (isLoading || !chart) {
    return <div className="py-10 text-center text-slate-400 text-sm">Loading body chart…</div>;
  }

  const regions = chart.regions || {};

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <PersonStanding className="w-4 h-4 text-teal-600" />
        <h3 className="font-bold text-slate-900 text-sm">Ortho / Physio Body Chart</h3>
      </div>

      <BodyMap regions={regions} onRegionClick={setEditingRegion} />

      <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-5 pt-4 border-t border-slate-100">
        {CONDITIONS.filter(c => c.value !== "normal").map(c => (
          <div key={c.value} className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <span className={cn("w-2.5 h-2.5 rounded-sm border shrink-0", c.color)} />
            {c.label}
          </div>
        ))}
      </div>

      <TreatmentLog
        entries={chart.treatmentLog || []}
        onAdd={(entry) => saveMutation.mutate({
          treatmentLog: [{ id: crypto.randomUUID(), ...entry }, ...(chart.treatmentLog || [])],
        })}
        onDelete={(id) => saveMutation.mutate({
          treatmentLog: (chart.treatmentLog || []).filter(e => e.id !== id),
        })}
      />

      <div className="mt-5 pt-4 border-t border-slate-100">
        <label className="text-xs font-semibold text-slate-500 mb-1.5 block">General Notes</label>
        <Textarea
          value={chartNotes}
          onChange={e => { setChartNotes(e.target.value); setNotesDirty(true); }}
          onBlur={() => {
            if (notesDirty) { saveMutation.mutate({ notes: chartNotes.trim() || null }); setNotesDirty(false); }
          }}
          placeholder="Posture, gait, functional limitations, goals..."
          className="rounded-xl text-sm min-h-[60px] resize-none"
        />
      </div>

      {editingRegion && (
        <RegionEditDialog
          regionId={editingRegion}
          state={regions[editingRegion] || { condition: "normal" }}
          onSave={(state) => {
            const nextRegions = { ...regions };
            if (!state || state.condition === "normal") delete nextRegions[editingRegion];
            else nextRegions[editingRegion] = { ...state, updatedAt: new Date().toISOString() };
            saveMutation.mutate({ regions: nextRegions });
            setEditingRegion(null);
          }}
          onClose={() => setEditingRegion(null)}
        />
      )}
    </div>
  );
}
