import { Layout } from "@/components/Layout";
import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { usePatients } from "@/hooks/use-patients";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  Pill, Plus, Search, AlertTriangle, TrendingUp, Package,
  Edit2, Trash2, X, ShoppingCart, Printer, IndianRupee,
  ChevronRight, RefreshCw, BarChart2, Clock, CheckCircle,
} from "lucide-react";

type Tab = "dashboard" | "inventory" | "billing" | "bills";

const CATEGORIES = ["General", "Antibiotic", "Analgesic", "Antacid", "Antidiabetic",
  "Antihypertensive", "Vitamin", "Antihistamine", "Antifungal", "Cardiovascular",
  "Dermatology", "Eye/Ear Drops", "Injection", "Syrup", "Other"];
const UNITS = ["Strip", "Tablet", "Capsule", "Bottle", "Vial", "Sachet", "Tube", "Cream", "Ointment", "Drops", "Injection", "Syrup"];
const GST_OPTIONS = [0, 5, 12, 18];
const PAYMENT_METHODS = ["Cash", "UPI", "Card", "Online"];

interface Medicine {
  id: number; clinicId: number; name: string; genericName?: string; category: string;
  manufacturer?: string; batchNo?: string; expiryDate?: string;
  costPrice: number; sellingPrice: number; stockQty: number; minStockQty: number;
  unit: string; hsnCode?: string; gstPercent: number; isActive: boolean; createdAt?: string;
}

interface CartItem {
  medicineId: number; name: string; unit: string; sellingPrice: number;
  gstPercent: number; qty: number; gstAmount: number; total: number;
}

interface PharmacyBill {
  id: number; clinicId: number; patientId?: number; patientName?: string;
  patientPhone?: string; items: CartItem[]; subtotal: number; discountPercent: number;
  discountAmount: number; gstTotal: number; totalAmount: number;
  paymentMethod?: string; status: string; notes?: string; createdAt: string;
}

interface Stats {
  totalMedicines: number; lowStockCount: number; expiringSoonCount: number;
  todaySales: number; monthSales: number;
}

function rupees(paise: number) { return (paise / 100).toFixed(2); }

// ── Medicine Form Dialog ────────────────────────────────────────────────────

function MedicineDialog({
  open, onClose, medicine,
}: { open: boolean; onClose: () => void; medicine?: Medicine | null }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const isEdit = !!medicine;

  const empty = {
    name: "", genericName: "", category: "General", manufacturer: "", batchNo: "",
    expiryDate: "", costPrice: "", sellingPrice: "", stockQty: "", minStockQty: "10",
    unit: "Strip", hsnCode: "", gstPercent: "12",
  };

  const [form, setForm] = useState(empty);

  useEffect(() => {
    if (open) {
      setForm(medicine ? {
        name: medicine.name, genericName: medicine.genericName ?? "",
        category: medicine.category, manufacturer: medicine.manufacturer ?? "",
        batchNo: medicine.batchNo ?? "", expiryDate: medicine.expiryDate ?? "",
        costPrice: String(medicine.costPrice / 100), sellingPrice: String(medicine.sellingPrice / 100),
        stockQty: String(medicine.stockQty), minStockQty: String(medicine.minStockQty),
        unit: medicine.unit, hsnCode: medicine.hsnCode ?? "", gstPercent: String(medicine.gstPercent),
      } : empty);
    }
  }, [open, medicine]);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        ...form,
        costPrice: Math.round(parseFloat(form.costPrice || "0") * 100),
        sellingPrice: Math.round(parseFloat(form.sellingPrice || "0") * 100),
        stockQty: parseInt(form.stockQty || "0"),
        minStockQty: parseInt(form.minStockQty || "10"),
        gstPercent: parseInt(form.gstPercent || "12"),
      };
      const url = isEdit ? `/api/pharmacy/medicines/${medicine!.id}` : "/api/pharmacy/medicines";
      const method = isEdit ? "PUT" : "POST";
      const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), credentials: "include" });
      if (!r.ok) { const e = await r.json(); throw new Error(e.message); }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/pharmacy/medicines"] });
      qc.invalidateQueries({ queryKey: ["/api/pharmacy/stats"] });
      toast({ title: isEdit ? "Medicine updated" : "Medicine added" });
      onClose();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const field = (label: string, key: string, opts?: { type?: string; required?: boolean; placeholder?: string }) => (
    <div>
      <Label className="text-xs font-semibold text-slate-600 mb-1 block">{label}{opts?.required && " *"}</Label>
      <Input
        type={opts?.type ?? "text"}
        value={(form as any)[key]}
        onChange={e => set(key, e.target.value)}
        placeholder={opts?.placeholder}
        className="rounded-xl h-10"
      />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-[620px] rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Medicine" : "Add Medicine"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="col-span-2">{field("Medicine Name", "name", { required: true, placeholder: "e.g. Paracetamol 500mg" })}</div>
          <div className="col-span-2">{field("Generic Name", "genericName", { placeholder: "e.g. Acetaminophen" })}</div>

          <div>
            <Label className="text-xs font-semibold text-slate-600 mb-1 block">Category *</Label>
            <Select value={form.category} onValueChange={v => set("category", v)}>
              <SelectTrigger className="rounded-xl h-10"><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-semibold text-slate-600 mb-1 block">Unit</Label>
            <Select value={form.unit} onValueChange={v => set("unit", v)}>
              <SelectTrigger className="rounded-xl h-10"><SelectValue /></SelectTrigger>
              <SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {field("Manufacturer", "manufacturer", { placeholder: "e.g. Cipla" })}
          {field("Batch No.", "batchNo", { placeholder: "e.g. BT2024001" })}

          {field("Cost Price (₹)", "costPrice", { type: "number", required: true, placeholder: "0.00" })}
          {field("Selling Price (₹)", "sellingPrice", { type: "number", required: true, placeholder: "0.00" })}

          {field("Stock Qty", "stockQty", { type: "number", required: true })}
          {field("Min Stock Alert", "minStockQty", { type: "number" })}

          {field("Expiry Date", "expiryDate", { type: "date" })}
          <div>
            <Label className="text-xs font-semibold text-slate-600 mb-1 block">GST %</Label>
            <Select value={form.gstPercent} onValueChange={v => set("gstPercent", v)}>
              <SelectTrigger className="rounded-xl h-10"><SelectValue /></SelectTrigger>
              <SelectContent>{GST_OPTIONS.map(g => <SelectItem key={g} value={String(g)}>{g}%</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {field("HSN Code", "hsnCode", { placeholder: "e.g. 30049099" })}
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose}>Cancel</Button>
          <Button
            className="flex-1 rounded-xl bg-violet-600 hover:bg-violet-700"
            onClick={() => save.mutate()}
            disabled={save.isPending || !form.name.trim() || !form.sellingPrice}
          >
            {save.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
            {isEdit ? "Save Changes" : "Add Medicine"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Billing Tab ─────────────────────────────────────────────────────────────

function BillingTab({ medicines }: { medicines: Medicine[] }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: patients = [] } = usePatients();

  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [patientMode, setPatientMode] = useState<"walkin" | "existing">("walkin");
  const [patientName, setPatientName] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [discountPercent, setDiscountPercent] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [notes, setNotes] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return medicines.filter(m =>
      m.stockQty > 0 &&
      (m.name.toLowerCase().includes(q) || (m.genericName ?? "").toLowerCase().includes(q))
    ).slice(0, 8);
  }, [search, medicines]);

  function addToCart(med: Medicine) {
    setCart(prev => {
      const exists = prev.find(i => i.medicineId === med.id);
      if (exists) {
        return prev.map(i => i.medicineId === med.id ? calcItem({ ...i, qty: i.qty + 1 }) : i);
      }
      return [...prev, calcItem({ medicineId: med.id, name: med.name, unit: med.unit, sellingPrice: med.sellingPrice, gstPercent: med.gstPercent, qty: 1, gstAmount: 0, total: 0 })];
    });
    setSearch("");
  }

  function calcItem(item: CartItem): CartItem {
    const base = item.sellingPrice * item.qty;
    const gstAmt = Math.round(base * item.gstPercent / 100);
    return { ...item, gstAmount: gstAmt, total: base + gstAmt };
  }

  function updateQty(medicineId: number, qty: number) {
    if (qty <= 0) { setCart(c => c.filter(i => i.medicineId !== medicineId)); return; }
    setCart(c => c.map(i => i.medicineId === medicineId ? calcItem({ ...i, qty }) : i));
  }

  const subtotal = cart.reduce((s, i) => s + i.sellingPrice * i.qty, 0);
  const gstTotal = cart.reduce((s, i) => s + i.gstAmount, 0);
  const discountAmount = Math.round((subtotal + gstTotal) * discountPercent / 100);
  const totalAmount = subtotal + gstTotal - discountAmount;

  const submit = useMutation({
    mutationFn: async () => {
      const body = {
        items: cart,
        subtotal,
        discountPercent,
        discountAmount,
        gstTotal,
        totalAmount,
        paymentMethod: paymentMethod.toLowerCase(),
        status: "paid",
        notes: notes.trim() || null,
        ...(patientMode === "existing" && selectedPatientId
          ? { patientId: Number(selectedPatientId) }
          : { patientName: patientName.trim() || "Walk-in", patientPhone: patientPhone.trim() || null }),
      };
      const r = await fetch("/api/pharmacy/bills", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), credentials: "include" });
      if (!r.ok) { const e = await r.json(); throw new Error(e.message); }
      return r.json();
    },
    onSuccess: (bill) => {
      qc.invalidateQueries({ queryKey: ["/api/pharmacy/bills"] });
      qc.invalidateQueries({ queryKey: ["/api/pharmacy/stats"] });
      qc.invalidateQueries({ queryKey: ["/api/pharmacy/medicines"] });
      toast({ title: "Bill created successfully" });
      printBill(bill);
      setCart([]); setPatientName(""); setPatientPhone(""); setSelectedPatientId("");
      setDiscountPercent(0); setNotes(""); setPaymentMethod("Cash");
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function printBill(bill: PharmacyBill) {
    const esc = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const rows = (bill.items as CartItem[]).map(i =>
      `<tr><td>${esc(i.name)}</td><td style="text-align:center">${i.qty} ${esc(i.unit)}</td><td style="text-align:right">₹${rupees(i.sellingPrice)}</td><td style="text-align:right">${i.gstPercent}%</td><td style="text-align:right">₹${rupees(i.total)}</td></tr>`
    ).join("");
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Pharmacy Bill</title>
<style>body{font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px;font-size:13px}
h2{text-align:center;margin-bottom:4px}p{margin:2px 0}
table{width:100%;border-collapse:collapse;margin-top:12px}
th{background:#f1f5f9;padding:6px 8px;text-align:left;font-size:12px}
td{padding:5px 8px;border-bottom:1px solid #e2e8f0}
.total-row{font-weight:bold;font-size:14px}.right{text-align:right}
hr{border:none;border-top:1px dashed #94a3b8;margin:10px 0}
</style></head><body>
<h2>Pharmacy Bill</h2>
<p><strong>Bill #:</strong> ${bill.id}</p>
<p><strong>Date:</strong> ${format(new Date(bill.createdAt), "dd MMM yyyy, h:mm a")}</p>
<p><strong>Patient:</strong> ${esc(bill.patientName || "Walk-in")}</p>
${bill.patientPhone ? `<p><strong>Phone:</strong> ${esc(bill.patientPhone)}</p>` : ""}
<hr/>
<table><thead><tr><th>Medicine</th><th style="text-align:center">Qty</th><th style="text-align:right">Price</th><th style="text-align:right">GST</th><th style="text-align:right">Total</th></tr></thead>
<tbody>${rows}</tbody></table>
<hr/>
<table><tbody>
<tr><td>Subtotal</td><td class="right">₹${rupees(bill.subtotal)}</td></tr>
<tr><td>GST</td><td class="right">₹${rupees(bill.gstTotal)}</td></tr>
${bill.discountAmount ? `<tr><td>Discount (${bill.discountPercent}%)</td><td class="right">-₹${rupees(bill.discountAmount)}</td></tr>` : ""}
<tr class="total-row"><td><strong>Total</strong></td><td class="right"><strong>₹${rupees(bill.totalAmount)}</strong></td></tr>
<tr><td>Payment</td><td class="right">${esc(bill.paymentMethod || "Cash")}</td></tr>
</tbody></table>
<hr/><p style="text-align:center;font-size:11px;color:#64748b">Thank you for your purchase!</p>
<script>window.onload=()=>{window.print();}</script></body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: Search + Cart */}
      <div className="lg:col-span-2 space-y-4">
        {/* Medicine Search */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
          <h3 className="font-semibold text-slate-800">Search & Add Medicines</h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by name or generic name…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 rounded-xl h-11"
            />
          </div>
          {filtered.length > 0 && (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              {filtered.map(m => (
                <button
                  key={m.id}
                  onClick={() => addToCart(m)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-violet-50 transition-colors border-b border-slate-100 last:border-0 text-left"
                >
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">{m.name}</p>
                    <p className="text-xs text-slate-400">{m.genericName ? `${m.genericName} · ` : ""}{m.category} · {m.unit}</p>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <p className="font-bold text-violet-700 text-sm">₹{rupees(m.sellingPrice)}</p>
                    <p className={cn("text-xs", m.stockQty <= m.minStockQty ? "text-red-500 font-semibold" : "text-slate-400")}>
                      Stock: {m.stockQty}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Cart */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-violet-600" /> Cart
              {cart.length > 0 && <span className="bg-violet-100 text-violet-700 text-xs font-bold px-2 py-0.5 rounded-full">{cart.length}</span>}
            </h3>
            {cart.length > 0 && (
              <button onClick={() => setCart([])} className="text-xs text-red-500 hover:text-red-700">Clear all</button>
            )}
          </div>

          {cart.length === 0 ? (
            <div className="py-10 text-center text-slate-400">
              <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Search and add medicines above</p>
            </div>
          ) : (
            <div className="space-y-2">
              {cart.map(item => (
                <div key={item.medicineId} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-sm truncate">{item.name}</p>
                    <p className="text-xs text-slate-400">₹{rupees(item.sellingPrice)}/{item.unit} · GST {item.gstPercent}%</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => updateQty(item.medicineId, item.qty - 1)} className="w-7 h-7 rounded-lg bg-slate-200 hover:bg-slate-300 flex items-center justify-center font-bold">−</button>
                    <span className="w-8 text-center font-bold text-sm">{item.qty}</span>
                    <button onClick={() => updateQty(item.medicineId, item.qty + 1)} className="w-7 h-7 rounded-lg bg-slate-200 hover:bg-slate-300 flex items-center justify-center font-bold">+</button>
                  </div>
                  <div className="text-right shrink-0 min-w-[70px]">
                    <p className="font-bold text-slate-900 text-sm">₹{rupees(item.total)}</p>
                    <p className="text-xs text-slate-400">incl. GST</p>
                  </div>
                  <button onClick={() => updateQty(item.medicineId, 0)} className="text-slate-300 hover:text-red-500 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: Patient + Summary */}
      <div className="space-y-4">
        {/* Patient Info */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
          <h3 className="font-semibold text-slate-800">Patient</h3>
          <div className="flex rounded-xl overflow-hidden border border-slate-200">
            <button
              onClick={() => setPatientMode("walkin")}
              className={cn("flex-1 py-2 text-xs font-semibold transition-colors", patientMode === "walkin" ? "bg-violet-600 text-white" : "text-slate-500 hover:bg-slate-50")}
            >Walk-in</button>
            <button
              onClick={() => setPatientMode("existing")}
              className={cn("flex-1 py-2 text-xs font-semibold transition-colors", patientMode === "existing" ? "bg-violet-600 text-white" : "text-slate-500 hover:bg-slate-50")}
            >Existing</button>
          </div>

          {patientMode === "walkin" ? (
            <div className="space-y-2">
              <Input placeholder="Patient name (optional)" value={patientName} onChange={e => setPatientName(e.target.value)} className="rounded-xl h-10" />
              <Input placeholder="Phone (optional)" value={patientPhone} onChange={e => setPatientPhone(e.target.value)} className="rounded-xl h-10" />
            </div>
          ) : (
            <Select value={selectedPatientId} onValueChange={setSelectedPatientId}>
              <SelectTrigger className="rounded-xl h-10"><SelectValue placeholder="Select patient" /></SelectTrigger>
              <SelectContent>
                {(patients as any[]).map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name} · {p.phone}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Bill Summary */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
          <h3 className="font-semibold text-slate-800">Bill Summary</h3>

          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span><span>₹{rupees(subtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>GST</span><span>₹{rupees(gstTotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Discount %</span>
              <input
                type="number" min="0" max="100" value={discountPercent}
                onChange={e => setDiscountPercent(Math.min(100, Math.max(0, Number(e.target.value))))}
                className="w-16 border border-slate-200 rounded-lg px-2 py-1 text-right text-sm"
              />
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount</span><span>-₹{rupees(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base text-slate-900 border-t border-slate-200 pt-2 mt-2">
              <span>Total</span><span>₹{rupees(totalAmount)}</span>
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold text-slate-600 mb-1 block">Payment Method</Label>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map(m => (
                <button
                  key={m}
                  onClick={() => setPaymentMethod(m)}
                  className={cn("py-2 rounded-xl border text-xs font-semibold transition-all", paymentMethod === m ? "border-violet-500 bg-violet-50 text-violet-700" : "border-slate-200 text-slate-500 hover:border-slate-300")}
                >{m}</button>
              ))}
            </div>
          </div>

          <Input placeholder="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} className="rounded-xl h-10" />

          <Button
            onClick={() => submit.mutate()}
            disabled={cart.length === 0 || submit.isPending}
            className="w-full rounded-xl h-12 bg-violet-600 hover:bg-violet-700 font-semibold gap-2"
          >
            {submit.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
            {submit.isPending ? "Creating…" : "Create Bill & Print"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Pharmacy Page ──────────────────────────────────────────────────────

export default function Pharmacy() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showLowStock, setShowLowStock] = useState(false);
  const [medicineDialog, setMedicineDialog] = useState<{ open: boolean; medicine?: Medicine | null }>({ open: false });

  const { data: stats } = useQuery<Stats>({
    queryKey: ["/api/pharmacy/stats"],
    queryFn: () => fetch("/api/pharmacy/stats", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 30000,
  });

  const { data: medicines = [] } = useQuery<Medicine[]>({
    queryKey: ["/api/pharmacy/medicines"],
    queryFn: () => fetch("/api/pharmacy/medicines", { credentials: "include" }).then(r => r.json()),
  });

  const { data: bills = [] } = useQuery<PharmacyBill[]>({
    queryKey: ["/api/pharmacy/bills"],
    queryFn: () => fetch("/api/pharmacy/bills", { credentials: "include" }).then(r => r.json()),
    enabled: tab === "bills",
  });

  const deleteMedicine = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/pharmacy/medicines/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/pharmacy/medicines"] });
      qc.invalidateQueries({ queryKey: ["/api/pharmacy/stats"] });
      toast({ title: "Medicine removed" });
    },
  });

  const filteredMedicines = useMemo(() => {
    let list = medicines;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(m => m.name.toLowerCase().includes(q) || (m.genericName ?? "").toLowerCase().includes(q));
    }
    if (categoryFilter !== "all") list = list.filter(m => m.category === categoryFilter);
    if (showLowStock) list = list.filter(m => m.stockQty <= m.minStockQty);
    return list;
  }, [medicines, search, categoryFilter, showLowStock]);

  function printBillFromHistory(bill: PharmacyBill) {
    const esc = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const rows = (bill.items as CartItem[]).map(i =>
      `<tr><td>${esc(i.name)}</td><td style="text-align:center">${i.qty} ${esc(i.unit)}</td><td style="text-align:right">₹${rupees(i.sellingPrice)}</td><td style="text-align:right">₹${rupees(i.total)}</td></tr>`
    ).join("");
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Pharmacy Bill #${bill.id}</title>
<style>body{font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px;font-size:13px}h2{text-align:center}p{margin:2px 0}table{width:100%;border-collapse:collapse;margin-top:12px}th{background:#f1f5f9;padding:6px 8px;text-align:left}td{padding:5px 8px;border-bottom:1px solid #e2e8f0}.right{text-align:right}hr{border:none;border-top:1px dashed #94a3b8;margin:10px 0}</style>
</head><body><h2>Pharmacy Bill #${bill.id}</h2>
<p><strong>Date:</strong> ${format(new Date(bill.createdAt), "dd MMM yyyy, h:mm a")}</p>
<p><strong>Patient:</strong> ${esc(bill.patientName || "Walk-in")}</p>
${bill.patientPhone ? `<p><strong>Phone:</strong> ${esc(bill.patientPhone)}</p>` : ""}
<hr/><table><thead><tr><th>Medicine</th><th>Qty</th><th class="right">Price</th><th class="right">Total</th></tr></thead><tbody>${rows}</tbody></table>
<hr/><p><strong>GST:</strong> ₹${rupees(bill.gstTotal)}</p>${bill.discountAmount ? `<p><strong>Discount:</strong> -₹${rupees(bill.discountAmount)}</p>` : ""}
<p style="font-size:15px;font-weight:bold;margin-top:8px">Total: ₹${rupees(bill.totalAmount)}</p>
<p>Payment: ${esc(bill.paymentMethod || "Cash")}</p>
<hr/><p style="text-align:center;font-size:11px;color:#64748b">Thank you!</p>
<script>window.onload=()=>{window.print();}</script></body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
  }

  const today = format(new Date(), "yyyy-MM-dd");

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
              <Pill className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Pharmacy</h1>
              <p className="text-xs text-slate-500">Inventory & Billing</p>
            </div>
          </div>
          {tab === "inventory" && (
            <Button onClick={() => setMedicineDialog({ open: true })} className="rounded-xl bg-violet-600 hover:bg-violet-700 gap-2">
              <Plus className="w-4 h-4" /> Add Medicine
            </Button>
          )}
          {tab === "billing" && (
            <Button onClick={() => setTab("billing")} variant="outline" className="rounded-xl gap-2">
              <ShoppingCart className="w-4 h-4" /> New Bill
            </Button>
          )}
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={v => setTab(v as Tab)}>
          <TabsList className="grid grid-cols-4 w-full sm:w-auto sm:inline-grid rounded-xl">
            <TabsTrigger value="dashboard" className="rounded-lg text-xs gap-1"><BarChart2 className="w-3.5 h-3.5" />Dashboard</TabsTrigger>
            <TabsTrigger value="inventory" className="rounded-lg text-xs gap-1"><Package className="w-3.5 h-3.5" />Inventory</TabsTrigger>
            <TabsTrigger value="billing" className="rounded-lg text-xs gap-1"><ShoppingCart className="w-3.5 h-3.5" />New Bill</TabsTrigger>
            <TabsTrigger value="bills" className="rounded-lg text-xs gap-1"><Clock className="w-3.5 h-3.5" />History</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* ── DASHBOARD ── */}
        {tab === "dashboard" && (
          <div className="space-y-6">
            {/* Stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {[
                { label: "Total Medicines", value: stats?.totalMedicines ?? "—", icon: Pill, color: "bg-violet-100 text-violet-600", textColor: "text-violet-700" },
                { label: "Low Stock", value: stats?.lowStockCount ?? "—", icon: AlertTriangle, color: "bg-red-100 text-red-600", textColor: "text-red-700" },
                { label: "Expiring Soon", value: stats?.expiringSoonCount ?? "—", icon: Clock, color: "bg-amber-100 text-amber-600", textColor: "text-amber-700" },
                { label: "Today's Sales", value: `₹${rupees(stats?.todaySales ?? 0)}`, icon: IndianRupee, color: "bg-green-100 text-green-600", textColor: "text-green-700" },
                { label: "Month Sales", value: `₹${rupees(stats?.monthSales ?? 0)}`, icon: TrendingUp, color: "bg-teal-100 text-teal-600", textColor: "text-teal-700" },
              ].map(s => {
                const Icon = s.icon;
                return (
                  <div key={s.label} className="bg-white rounded-2xl border border-slate-100 p-4">
                    <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center mb-3", s.color)}>
                      <Icon className="w-4.5 h-4.5" style={{ width: "1.125rem", height: "1.125rem" }} />
                    </div>
                    <p className={cn("text-xl font-black", s.textColor)}>{s.value}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
                  </div>
                );
              })}
            </div>

            {/* Alerts */}
            {(stats?.lowStockCount ?? 0) > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    <p className="font-semibold text-red-800 text-sm">Low Stock Alerts ({stats?.lowStockCount})</p>
                  </div>
                  <button onClick={() => { setTab("inventory"); setShowLowStock(true); }} className="text-xs text-red-700 hover:text-red-900 font-medium flex items-center gap-1">
                    View all <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
                <div className="space-y-1.5">
                  {medicines.filter(m => m.stockQty <= m.minStockQty).slice(0, 5).map(m => (
                    <div key={m.id} className="flex items-center justify-between bg-white rounded-xl px-3 py-2.5 border border-red-100">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{m.name}</p>
                        <p className="text-xs text-slate-400">{m.category}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-red-600">{m.stockQty} {m.unit}s left</p>
                        <p className="text-xs text-slate-400">Min: {m.minStockQty}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Expiring soon */}
            {medicines.filter(m => m.expiryDate && m.expiryDate <= new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0] && m.expiryDate >= today).length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <p className="font-semibold text-amber-800 text-sm">Expiring Within 30 Days</p>
                </div>
                <div className="space-y-1.5">
                  {medicines.filter(m => m.expiryDate && m.expiryDate <= new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0] && m.expiryDate >= today).slice(0, 5).map(m => (
                    <div key={m.id} className="flex items-center justify-between bg-white rounded-xl px-3 py-2.5 border border-amber-100">
                      <p className="text-sm font-semibold text-slate-800">{m.name}</p>
                      <p className="text-sm font-bold text-amber-700">Exp: {m.expiryDate ? format(new Date(m.expiryDate), "dd MMM yyyy") : "—"}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent bills */}
            <div className="bg-white rounded-2xl border border-slate-100 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-800">Recent Bills</h3>
                <button onClick={() => setTab("bills")} className="text-xs text-violet-700 hover:text-violet-900 font-medium flex items-center gap-1">
                  View all <ChevronRight className="w-3 h-3" />
                </button>
              </div>
              {bills.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">No bills yet today</p>
              ) : (
                <div className="space-y-2">
                  {bills.slice(0, 5).map(b => (
                    <div key={b.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-50">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{b.patientName || "Walk-in"}</p>
                        <p className="text-xs text-slate-400">{format(new Date(b.createdAt), "h:mm a")} · {(b.items as any[]).length} item{(b.items as any[]).length !== 1 ? "s" : ""}</p>
                      </div>
                      <p className="font-bold text-violet-700">₹{rupees(b.totalAmount)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── INVENTORY ── */}
        {tab === "inventory" && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input placeholder="Search medicines…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 rounded-xl h-10" />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-44 rounded-xl h-10"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <button
                onClick={() => setShowLowStock(v => !v)}
                className={cn("px-4 h-10 rounded-xl border text-sm font-semibold transition-all gap-2 flex items-center",
                  showLowStock ? "border-red-400 bg-red-50 text-red-700" : "border-slate-200 text-slate-600 hover:border-slate-300")}
              >
                <AlertTriangle className="w-3.5 h-3.5" /> Low Stock
              </button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[700px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-xs text-slate-500 uppercase tracking-wide">
                      <th className="px-4 py-3 text-left font-semibold">Medicine</th>
                      <th className="px-4 py-3 text-left font-semibold">Category</th>
                      <th className="px-4 py-3 text-right font-semibold">Stock</th>
                      <th className="px-4 py-3 text-right font-semibold">MRP</th>
                      <th className="px-4 py-3 text-left font-semibold">Expiry</th>
                      <th className="px-4 py-3 text-left font-semibold">GST</th>
                      <th className="px-4 py-3 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredMedicines.length === 0 ? (
                      <tr><td colSpan={7} className="text-center text-slate-400 py-12">No medicines found</td></tr>
                    ) : filteredMedicines.map(m => {
                      const isLow = m.stockQty <= m.minStockQty;
                      const isExpiring = m.expiryDate && m.expiryDate <= new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0] && m.expiryDate >= today;
                      const isExpired = m.expiryDate && m.expiryDate < today;
                      return (
                        <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-900">{m.name}</p>
                            {m.genericName && <p className="text-xs text-slate-400">{m.genericName}</p>}
                            {m.manufacturer && <p className="text-xs text-slate-400">{m.manufacturer}</p>}
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 text-xs font-semibold">{m.category}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={cn("font-bold", isLow ? "text-red-600" : "text-slate-700")}>
                              {m.stockQty} {m.unit}s
                            </span>
                            {isLow && <p className="text-[10px] text-red-500">Low stock</p>}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">₹{rupees(m.sellingPrice)}</td>
                          <td className="px-4 py-3">
                            {m.expiryDate ? (
                              <span className={cn("text-xs font-semibold", isExpired ? "text-red-600" : isExpiring ? "text-amber-600" : "text-slate-500")}>
                                {format(new Date(m.expiryDate), "MMM yyyy")}
                                {isExpired && " · Expired"}
                                {!isExpired && isExpiring && " · Soon"}
                              </span>
                            ) : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-slate-500">{m.gstPercent}%</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => setMedicineDialog({ open: true, medicine: m })} className="w-8 h-8 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 flex items-center justify-center transition-colors">
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => deleteMedicine.mutate(m.id)} className="w-8 h-8 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── BILLING ── */}
        {tab === "billing" && <BillingTab medicines={medicines} />}

        {/* ── BILLS HISTORY ── */}
        {tab === "bills" && (
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-xs text-slate-500 uppercase tracking-wide">
                    <th className="px-4 py-3 text-left font-semibold">Bill #</th>
                    <th className="px-4 py-3 text-left font-semibold">Patient</th>
                    <th className="px-4 py-3 text-left font-semibold">Date & Time</th>
                    <th className="px-4 py-3 text-right font-semibold">Items</th>
                    <th className="px-4 py-3 text-right font-semibold">Total</th>
                    <th className="px-4 py-3 text-left font-semibold">Payment</th>
                    <th className="px-4 py-3 text-right font-semibold">Print</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {bills.length === 0 ? (
                    <tr><td colSpan={7} className="text-center text-slate-400 py-12">No bills yet</td></tr>
                  ) : bills.map(b => (
                    <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-mono font-semibold text-violet-700">#{b.id}</td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">{b.patientName || "Walk-in"}</p>
                        {b.patientPhone && <p className="text-xs text-slate-400">{b.patientPhone}</p>}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{format(new Date(b.createdAt), "dd MMM yyyy, h:mm a")}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{(b.items as any[]).length}</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900">₹{rupees(b.totalAmount)}</td>
                      <td className="px-4 py-3">
                        <span className="capitalize px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-semibold">
                          {b.paymentMethod || "Cash"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => printBillFromHistory(b)} className="w-8 h-8 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 flex items-center justify-center ml-auto transition-colors">
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <MedicineDialog
        open={medicineDialog.open}
        onClose={() => setMedicineDialog({ open: false })}
        medicine={medicineDialog.medicine}
      />
    </Layout>
  );
}
