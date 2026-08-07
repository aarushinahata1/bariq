import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Plus, Trash2, Smile } from "lucide-react";
import { format } from "date-fns";

// ── Types ──────────────────────────────────────────────────────────────────────

type ToothState = {
  condition: string;
  surfaces?: string[];
  note?: string;
  updatedAt?: string;
};

type TreatmentLogEntry = {
  id: string;
  date: string;
  teeth: string[];
  procedure: string;
  note?: string;
};

type DentalChartData = {
  patientId: number;
  dentitionType: "permanent" | "primary";
  teeth: Record<string, ToothState>;
  treatmentLog: TreatmentLogEntry[];
  notes: string | null;
};

// ── Constants ──────────────────────────────────────────────────────────────────

const CONDITIONS: { value: string; label: string; color: string; textColor: string }[] = [
  { value: "healthy", label: "Healthy", color: "bg-white border-slate-300", textColor: "text-slate-400" },
  { value: "caries", label: "Caries / Decay", color: "bg-red-500 border-red-600", textColor: "text-white" },
  { value: "filled", label: "Filled", color: "bg-blue-400 border-blue-500", textColor: "text-white" },
  { value: "crown", label: "Crown", color: "bg-amber-400 border-amber-500", textColor: "text-white" },
  { value: "rct", label: "Root Canal (RCT)", color: "bg-purple-500 border-purple-600", textColor: "text-white" },
  { value: "implant", label: "Implant", color: "bg-cyan-500 border-cyan-600", textColor: "text-white" },
  { value: "bridge", label: "Bridge", color: "bg-indigo-500 border-indigo-600", textColor: "text-white" },
  { value: "fractured", label: "Fractured", color: "bg-rose-600 border-rose-700", textColor: "text-white" },
  { value: "impacted", label: "Impacted", color: "bg-fuchsia-600 border-fuchsia-700", textColor: "text-white" },
  { value: "extraction_planned", label: "Extraction Planned", color: "bg-orange-400 border-orange-500 border-dashed", textColor: "text-white" },
  { value: "missing", label: "Missing / Extracted", color: "bg-slate-100 border-slate-300", textColor: "text-slate-300" },
];
const conditionMap = Object.fromEntries(CONDITIONS.map(c => [c.value, c]));
const SURFACES = ["M", "O", "D", "B", "L"];

// FDI numbering, arranged left-to-right as conventionally charted (18 above 48, 21 above 31)
const PERMANENT_UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const PERMANENT_LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
const PRIMARY_UPPER = [55, 54, 53, 52, 51, 61, 62, 63, 64, 65];
const PRIMARY_LOWER = [85, 84, 83, 82, 81, 71, 72, 73, 74, 75];

// ── Tooth button ───────────────────────────────────────────────────────────────

function ToothButton({ num, state, onClick }: { num: number; state: ToothState; onClick: () => void }) {
  const cfg = conditionMap[state.condition] || conditionMap.healthy;
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Tooth ${num} — ${cfg.label}${state.note ? `: ${state.note}` : ""}`}
      className={cn(
        "relative w-8 h-8 sm:w-9 sm:h-9 rounded-lg border-2 flex items-center justify-center text-[10px] font-bold transition-transform hover:scale-110 hover:z-10",
        cfg.color, cfg.textColor
      )}
    >
      {num}
      {!!state.surfaces?.length && (
        <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-slate-700 text-white text-[8px] flex items-center justify-center leading-none">
          {state.surfaces.length}
        </span>
      )}
    </button>
  );
}

// ── Odontogram ─────────────────────────────────────────────────────────────────

function Odontogram({
  teeth, dentitionType, onToothClick,
}: {
  teeth: Record<string, ToothState>;
  dentitionType: "permanent" | "primary";
  onToothClick: (tooth: string) => void;
}) {
  const upperRow = dentitionType === "primary" ? PRIMARY_UPPER : PERMANENT_UPPER;
  const lowerRow = dentitionType === "primary" ? PRIMARY_LOWER : PERMANENT_LOWER;
  const half = upperRow.length / 2;

  const renderRow = (row: number[]) => (
    <div className="flex items-center justify-center gap-1">
      <div className="flex gap-1">
        {row.slice(0, half).map(n => (
          <ToothButton key={n} num={n} state={teeth[n] || { condition: "healthy" }} onClick={() => onToothClick(String(n))} />
        ))}
      </div>
      <div className="w-px h-7 bg-slate-200 mx-1.5 shrink-0" />
      <div className="flex gap-1">
        {row.slice(half).map(n => (
          <ToothButton key={n} num={n} state={teeth[n] || { condition: "healthy" }} onClick={() => onToothClick(String(n))} />
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-3 overflow-x-auto py-1">
      {renderRow(upperRow)}
      {renderRow(lowerRow)}
    </div>
  );
}

// ── Tooth edit dialog ────────────────────────────────────────────────────────

function ToothEditDialog({
  toothNum, state, onSave, onClose,
}: {
  toothNum: string;
  state: ToothState;
  onSave: (state: ToothState | null) => void;
  onClose: () => void;
}) {
  const [condition, setCondition] = useState(state.condition);
  const [surfaces, setSurfaces] = useState<string[]>(state.surfaces || []);
  const [note, setNote] = useState(state.note || "");

  const toggleSurface = (s: string) =>
    setSurfaces(v => (v.includes(s) ? v.filter(x => x !== s) : [...v, s]));

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="rounded-2xl sm:max-w-sm">
        <DialogHeader><DialogTitle>Tooth #{toothNum}</DialogTitle></DialogHeader>
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
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Affected Surfaces</label>
            <div className="flex gap-1.5 flex-wrap">
              {SURFACES.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSurface(s)}
                  className={cn(
                    "w-8 h-8 rounded-lg border text-xs font-bold transition-colors",
                    surfaces.includes(s) ? "bg-teal-600 text-white border-teal-600" : "bg-white border-slate-200 text-slate-500 hover:border-teal-300"
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
              placeholder="Optional clinical note for this tooth"
              className="rounded-xl text-sm min-h-[60px] resize-none"
            />
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1 rounded-xl" onClick={() => onSave(null)}>
            Reset to Healthy
          </Button>
          <Button
            className="flex-1 rounded-xl bg-teal-600 hover:bg-teal-700"
            onClick={() => onSave({ condition, surfaces, note: note.trim() || undefined })}
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
  const [teethInput, setTeethInput] = useState("");
  const [procedure, setProcedure] = useState("");
  const [note, setNote] = useState("");

  function submit() {
    if (!procedure.trim()) return;
    onAdd({
      date,
      procedure: procedure.trim(),
      teeth: teethInput.split(",").map(t => t.trim()).filter(Boolean),
      note: note.trim() || undefined,
    });
    setDate(format(new Date(), "yyyy-MM-dd"));
    setTeethInput("");
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
            <Input value={teethInput} onChange={e => setTeethInput(e.target.value)} placeholder="Teeth e.g. 16, 17" className="rounded-lg h-9 text-sm" />
          </div>
          <Input value={procedure} onChange={e => setProcedure(e.target.value)} placeholder="Procedure e.g. Root Canal Treatment" className="rounded-lg h-9 text-sm" />
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
                  {e.teeth.length > 0 && <span className="text-teal-600 font-normal"> · Tooth {e.teeth.join(", ")}</span>}
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

export default function DentalChart({ patientId }: { patientId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const queryKey = ["/api/dental-charts", patientId];

  const [editingTooth, setEditingTooth] = useState<string | null>(null);
  const [chartNotes, setChartNotes] = useState("");
  const [notesDirty, setNotesDirty] = useState(false);

  const { data: chart, isLoading } = useQuery<DentalChartData>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/dental-charts/${patientId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load dental chart");
      return res.json();
    },
    enabled: !!patientId,
  });

  useEffect(() => {
    if (chart && !notesDirty) setChartNotes(chart.notes || "");
  }, [chart, notesDirty]);

  const saveMutation = useMutation({
    mutationFn: async (updates: Partial<DentalChartData>) => {
      const res = await fetch(`/api/dental-charts/${patientId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to save dental chart");
      return res.json() as Promise<DentalChartData>;
    },
    onSuccess: (data) => queryClient.setQueryData(queryKey, data),
    onError: () => toast({ title: "Failed to save dental chart", variant: "destructive" }),
  });

  if (isLoading || !chart) {
    return <div className="py-10 text-center text-slate-400 text-sm">Loading dental chart…</div>;
  }

  const teeth = chart.teeth || {};

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Smile className="w-4 h-4 text-teal-600" />
          <h3 className="font-bold text-slate-900 text-sm">Dental Chart</h3>
        </div>
        <Select value={chart.dentitionType} onValueChange={v => saveMutation.mutate({ dentitionType: v as "permanent" | "primary" })}>
          <SelectTrigger className="rounded-lg h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="permanent">Permanent (Adult)</SelectItem>
            <SelectItem value="primary">Primary (Child)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Odontogram teeth={teeth} dentitionType={chart.dentitionType} onToothClick={setEditingTooth} />

      <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-5 pt-4 border-t border-slate-100">
        {CONDITIONS.filter(c => c.value !== "healthy").map(c => (
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
        <label className="text-xs font-semibold text-slate-500 mb-1.5 block">General Dental Notes</label>
        <Textarea
          value={chartNotes}
          onChange={e => { setChartNotes(e.target.value); setNotesDirty(true); }}
          onBlur={() => {
            if (notesDirty) { saveMutation.mutate({ notes: chartNotes.trim() || null }); setNotesDirty(false); }
          }}
          placeholder="Oral hygiene, habits, general observations..."
          className="rounded-xl text-sm min-h-[60px] resize-none"
        />
      </div>

      {editingTooth && (
        <ToothEditDialog
          toothNum={editingTooth}
          state={teeth[editingTooth] || { condition: "healthy" }}
          onSave={(state) => {
            const nextTeeth = { ...teeth };
            if (!state || state.condition === "healthy") delete nextTeeth[editingTooth];
            else nextTeeth[editingTooth] = { ...state, updatedAt: new Date().toISOString() };
            saveMutation.mutate({ teeth: nextTeeth });
            setEditingTooth(null);
          }}
          onClose={() => setEditingTooth(null)}
        />
      )}
    </div>
  );
}
