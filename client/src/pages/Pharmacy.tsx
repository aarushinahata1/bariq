import { MedicineNameAutocomplete } from "@/components/MedicineNameAutocomplete";
import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { usePatients } from "@/hooks/use-patients";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  Pill, Plus, Search, AlertTriangle, TrendingUp, Package,
  Edit2, Trash2, X, ShoppingCart, Printer, IndianRupee,
  ChevronRight, RefreshCw, BarChart2, Clock, CheckCircle,
  PackagePlus, FileText, ChevronDown, ChevronUp,
  AlertOctagon, ClipboardList, ListChecks, ArrowUpDown, Truck,
  RotateCcw, Building2, Banknote, Download, Calendar, Users,
} from "lucide-react";

type Tab = "dashboard" | "inventory" | "billing" | "bills" | "alerts" | "reorder" | "returns" | "wastage" | "suppliers" | "closing";

const CATEGORIES = [
  "General", "Antibiotic", "Analgesic", "Antacid", "Antidiabetic",
  "Antihypertensive", "Vitamin", "Antihistamine", "Antifungal", "Cardiovascular",
  "Dermatology", "Eye/Ear Drops", "Injection", "Syrup", "Other",
];
const UNITS = ["Strip", "Tablet", "Capsule", "Bottle", "Vial", "Sachet", "Tube", "Cream", "Ointment", "Drops", "Injection", "Syrup"];
const GST_OPTIONS = [0, 5, 12, 18];
const PAYMENT_METHODS = ["Cash", "UPI", "Card", "Online"];

interface Medicine {
  id: number; clinicId: number; name: string; genericName?: string; category: string;
  manufacturer?: string; batchNo?: string; expiryDate?: string;
  costPrice: number; sellingPrice: number; stockQty: number; minStockQty: number;
  unit: string; hsnCode?: string; gstPercent: number; isActive: boolean;
  supplierName?: string; reorderQty?: number; reorderedAt?: string | null; createdAt?: string;
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

interface PharmacySupplier {
  id: number; clinicId: number; name: string; contactPerson?: string; phone?: string;
  email?: string; address?: string; paymentTerms?: string; leadTimeDays?: number;
  notes?: string; isActive: boolean; createdAt: string;
}

interface ReturnRecord {
  id: number; clinicId: number; originalBillId?: number; patientName?: string;
  patientPhone?: string; items: any[]; totalAmount: number; refundMethod?: string;
  reason?: string; createdAt: string;
}

interface WastageEntry {
  id: number; clinicId: number; medicineId?: number; medicineName: string;
  batchNo?: string; qty: number; unit: string; costPrice: number; totalCost: number;
  reason: string; notes?: string; createdAt: string;
}

interface DailyClosing {
  id: number; clinicId: number; closingDate: string; cashExpected: number;
  cashActual: number; upiTotal: number; cardTotal: number; onlineTotal: number;
  totalSales: number; totalReturns: number; notes?: string; createdAt: string;
}

interface ConsumptionItem { medicineId: number; totalQty30d: number; dailyRate: number; }

interface TodaySummary {
  date: string; cashExpected: number; upiTotal: number; cardTotal: number;
  onlineTotal: number; totalSales: number; totalReturns: number; netSales: number;
  billCount: number; existingClosing?: DailyClosing | null;
}

function rupees(paise: number) { return (paise / 100).toFixed(2); }

// ── Printable bill builder (clinic-branded) ─────────────────────────────────

function buildBillHtml(bill: PharmacyBill, clinicProfile?: Record<string, any>): string {
  const esc = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const rows = (bill.items as CartItem[]).map(i =>
    `<tr>
      <td>${esc(i.name)}</td>
      <td style="text-align:center">${i.qty} ${esc(i.unit)}</td>
      <td style="text-align:right">₹${rupees(i.sellingPrice)}</td>
      <td style="text-align:right">${i.gstPercent}%</td>
      <td style="text-align:right;font-weight:600">₹${rupees(i.total)}</td>
    </tr>`
  ).join("");
  const cName = esc(clinicProfile?.clinicName || "Pharmacy");
  const cAddr = clinicProfile?.address ? `<p class="clinic-detail">${esc(clinicProfile.address).replace(/\n/g, "<br>")}</p>` : "";
  const cPhone = clinicProfile?.phone ? `<p class="clinic-detail">${esc(clinicProfile.phone)}</p>` : "";
  const cTagline = clinicProfile?.tagline ? `<p class="clinic-sub">${esc(clinicProfile.tagline)}</p>` : "";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Bill #${bill.id} – ${cName}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',system-ui,Arial,sans-serif;background:#fff;color:#1e293b;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{max-width:520px;margin:0 auto}
.accent{height:5px;background:linear-gradient(90deg,#0f766e,#0891b2)}
.header{padding:18px 24px 14px;border-bottom:2px solid #e2e8f0}
.clinic-name{font-size:20px;font-weight:900;color:#0f766e;letter-spacing:-.3px;margin-bottom:3px}
.clinic-sub{font-size:11px;color:#64748b;font-style:italic;margin-top:2px}
.clinic-detail{font-size:12px;color:#475569;line-height:1.5;margin-top:3px}
.body{padding:12px 24px 20px}
.doc-label{text-align:center;font-size:9px;font-weight:800;letter-spacing:.25em;color:#94a3b8;text-transform:uppercase;margin:12px 0 10px}
.meta{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px;margin-bottom:14px}
.meta p{font-size:12.5px;color:#1e293b;margin:2px 0}
.meta .lbl{color:#64748b;font-size:12px}
.divider{border:none;border-top:1px dashed #cbd5e1;margin:12px 0}
table{width:100%;border-collapse:collapse;margin-bottom:12px;font-size:12.5px}
thead th{font-size:9px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:.08em;padding:7px 8px;background:#0f766e;text-align:left}
tbody td{padding:7px 8px;border-bottom:1px solid #f1f5f9;vertical-align:top}
tbody tr:nth-child(even){background:#f8fafc}
tbody tr:last-child td{border-bottom:none}
.totals{width:100%;border-collapse:collapse;margin-top:4px}
.totals td{padding:5px 8px;font-size:12.5px}
.totals td:last-child{text-align:right}
.totals .total-row td{font-weight:700;font-size:14px;color:#0f766e;border-top:2px solid #e2e8f0;padding-top:8px}
.footer{padding:10px 24px 16px;text-align:center}
.thank-you{font-size:12px;color:#475569;margin-bottom:6px}
.branding{font-size:8px;color:#cbd5e1}
@media print{.body{padding:8px 18px}.header{padding:12px 18px 10px}}
</style></head><body>
<div class="page">
  <div class="accent"></div>
  <div class="header">
    <p class="clinic-name">${cName}</p>
    ${cTagline}${cAddr}${cPhone}
  </div>
  <div class="body">
    <p class="doc-label">Pharmacy Receipt</p>
    <div class="meta">
      <p><span class="lbl">Bill No: </span><strong>#${bill.id}</strong></p>
      <p><span class="lbl">Date: </span>${format(new Date(bill.createdAt), "dd MMM yyyy, h:mm a")}</p>
      <p><span class="lbl">Patient: </span><strong>${esc(bill.patientName || "Walk-in")}</strong></p>
      ${bill.patientPhone ? `<p><span class="lbl">Phone: </span>${esc(bill.patientPhone)}</p>` : ""}
      <p><span class="lbl">Payment: </span>${esc(bill.paymentMethod || "Cash")}</p>
    </div>
    <table>
      <thead><tr><th>Medicine</th><th style="text-align:center">Qty</th><th style="text-align:right">Rate</th><th style="text-align:right">GST</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <hr class="divider">
    <table class="totals"><tbody>
      <tr><td style="color:#64748b">Subtotal</td><td>₹${rupees(bill.subtotal)}</td></tr>
      <tr><td style="color:#64748b">GST</td><td>₹${rupees(bill.gstTotal)}</td></tr>
      ${bill.discountAmount ? `<tr><td style="color:#16a34a">Discount (${bill.discountPercent}%)</td><td style="color:#16a34a">− ₹${rupees(bill.discountAmount)}</td></tr>` : ""}
      <tr class="total-row"><td>TOTAL</td><td>₹${rupees(bill.totalAmount)}</td></tr>
    </tbody></table>
    ${bill.notes ? `<p style="margin-top:10px;font-size:11px;color:#64748b;font-style:italic">${esc(bill.notes)}</p>` : ""}
  </div>
  <div class="footer">
    <p class="thank-you">Thank you for visiting ${cName}!</p>
    <p class="branding">Powered by BariQ</p>
  </div>
</div>
<script>window.onload=()=>{window.print();}</script>
</body></html>`;
}

// ── Restock Dialog ──────────────────────────────────────────────────────────

function RestockDialog({ medicine, open, onClose }: {
  medicine: Medicine | null; open: boolean; onClose: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [qty, setQty] = useState("");

  useEffect(() => { if (open) setQty(""); }, [open]);

  const save = useMutation({
    mutationFn: async () => {
      const n = parseInt(qty);
      if (!medicine || isNaN(n) || n <= 0) throw new Error("Enter a valid quantity");
      const r = await fetch(`/api/pharmacy/medicines/${medicine.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stockQty: medicine.stockQty + n }),
        credentials: "include",
      });
      if (!r.ok) throw new Error("Failed to update stock");
      // clear reordered flag since stock has arrived
      if (medicine.reorderedAt) {
        await fetch(`/api/pharmacy/medicines/${medicine.id}/reorder`, {
          method: "PATCH", credentials: "include",
        });
      }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/pharmacy/medicines"] });
      qc.invalidateQueries({ queryKey: ["/api/pharmacy/stats"] });
      toast({ title: "Stock added", description: `${medicine?.name} +${qty} ${medicine?.unit}s` });
      onClose();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const newTotal = medicine && parseInt(qty) > 0 ? medicine.stockQty + parseInt(qty) : null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-xs rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-base">Add Stock</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="bg-slate-50 rounded-xl px-4 py-3">
            <p className="font-semibold text-slate-800 text-sm">{medicine?.name}</p>
            {medicine?.genericName && <p className="text-xs text-slate-400">{medicine.genericName}</p>}
            <p className="text-xs text-slate-500 mt-1.5">
              Current:{" "}
              <span className={cn("font-bold", medicine && medicine.stockQty <= medicine.minStockQty ? "text-red-600" : "text-slate-700")}>
                {medicine?.stockQty} {medicine?.unit}s
              </span>
              {" · "}Min alert: {medicine?.minStockQty}
            </p>
          </div>
          <div>
            <Label className="text-xs font-semibold text-slate-600 mb-1 block">Units to Add *</Label>
            <Input
              type="number" min="1" value={qty}
              onChange={e => setQty(e.target.value)}
              placeholder="e.g. 50"
              className="rounded-xl h-10"
              autoFocus
              onKeyDown={e => e.key === "Enter" && save.mutate()}
            />
          </div>
          {newTotal !== null && (
            <p className="text-xs bg-green-50 border border-green-100 text-green-700 rounded-lg px-3 py-2">
              New stock: <strong>{newTotal} {medicine?.unit}s</strong>
            </p>
          )}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 rounded-xl h-10" onClick={onClose}>Cancel</Button>
            <Button
              className="flex-1 rounded-xl h-10 bg-violet-600 hover:bg-violet-700"
              onClick={() => save.mutate()}
              disabled={save.isPending || !qty || parseInt(qty) <= 0}
            >
              {save.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-1.5" /> : <PackagePlus className="w-4 h-4 mr-1.5" />}
              Add Stock
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Medicine Form Dialog ────────────────────────────────────────────────────

function MedicineDialog({ open, onClose, medicine, prefill }: {
  open: boolean; onClose: () => void; medicine?: Medicine | null; prefill?: Medicine | null;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const isEdit = !!medicine;
  const isRestock = !isEdit && !!prefill;
  const empty = {
    name: "", genericName: "", category: "General", manufacturer: "", batchNo: "",
    expiryDate: "", costPrice: "", sellingPrice: "", stockQty: "", minStockQty: "10",
    unit: "Strip", hsnCode: "", gstPercent: "12", supplierName: "", reorderQty: "",
  };
  const [form, setForm] = useState(empty);

  useEffect(() => {
    if (open) {
      if (medicine) {
        setForm({
          name: medicine.name, genericName: medicine.genericName ?? "",
          category: medicine.category, manufacturer: medicine.manufacturer ?? "",
          batchNo: medicine.batchNo ?? "", expiryDate: medicine.expiryDate ?? "",
          costPrice: String(medicine.costPrice / 100), sellingPrice: String(medicine.sellingPrice / 100),
          stockQty: String(medicine.stockQty), minStockQty: String(medicine.minStockQty),
          unit: medicine.unit, hsnCode: medicine.hsnCode ?? "", gstPercent: String(medicine.gstPercent),
          supplierName: medicine.supplierName ?? "", reorderQty: medicine.reorderQty ? String(medicine.reorderQty) : "",
        });
      } else if (prefill) {
        // New batch restock: copy all details except batch no, expiry, and stock qty
        setForm({
          name: prefill.name, genericName: prefill.genericName ?? "",
          category: prefill.category, manufacturer: prefill.manufacturer ?? "",
          batchNo: "", expiryDate: "",
          costPrice: String(prefill.costPrice / 100), sellingPrice: String(prefill.sellingPrice / 100),
          stockQty: "", minStockQty: String(prefill.minStockQty),
          unit: prefill.unit, hsnCode: prefill.hsnCode ?? "", gstPercent: String(prefill.gstPercent),
          supplierName: prefill.supplierName ?? "", reorderQty: prefill.reorderQty ? String(prefill.reorderQty) : "",
        });
      } else {
        setForm(empty);
      }
    }
  }, [open, medicine, prefill]);

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
        reorderQty: form.reorderQty ? parseInt(form.reorderQty) : null,
        supplierName: form.supplierName.trim() || null,
      };
      const url = isEdit ? `/api/pharmacy/medicines/${medicine!.id}` : "/api/pharmacy/medicines";
      const r = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body), credentials: "include",
      });
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
      <Input type={opts?.type ?? "text"} value={(form as any)[key]} onChange={e => set(key, e.target.value)}
        placeholder={opts?.placeholder} className="rounded-xl h-10" />
    </div>
  );

  const highlightField = (label: string, key: string, opts?: { type?: string; required?: boolean; placeholder?: string }) => (
    <div>
      <Label className="text-xs font-semibold text-amber-700 mb-1 block flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />{label} *
      </Label>
      <Input type={opts?.type ?? "text"} value={(form as any)[key]} onChange={e => set(key, e.target.value)}
        placeholder={opts?.placeholder} className="rounded-xl h-10 border-amber-300 focus-visible:ring-amber-400" />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-[620px] rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Medicine" : isRestock ? `New Batch: ${prefill!.name}` : "Add Medicine"}
          </DialogTitle>
        </DialogHeader>

        {isRestock && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800">Adding new batch stock</p>
              <p className="text-amber-700 text-xs mt-0.5">
                Details are pre-filled from the existing entry. Enter the <strong>new batch number</strong>, <strong>expiry date</strong>, and <strong>quantity received</strong> for this shipment.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="col-span-2">
            <Label className="text-xs font-semibold text-slate-600 mb-1 block">Medicine Name *</Label>
            <MedicineNameAutocomplete
              value={form.name}
              onChange={v => set("name", v)}
              placeholder="e.g. Paracetamol 500mg"
              className="rounded-xl h-10"
            />
          </div>
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
          {isRestock ? highlightField("Batch No.", "batchNo", { placeholder: "e.g. BT2025001" }) : field("Batch No.", "batchNo", { placeholder: "e.g. BT2024001" })}
          {field("Cost Price (₹)", "costPrice", { type: "number", required: true, placeholder: "0.00" })}
          {field("Selling Price (₹)", "sellingPrice", { type: "number", required: true, placeholder: "0.00" })}
          {isRestock ? highlightField("Stock Qty (New Batch)", "stockQty", { type: "number" }) : field("Stock Qty", "stockQty", { type: "number", required: true })}
          {field("Min Stock Alert", "minStockQty", { type: "number" })}
          {isRestock ? highlightField("Expiry Date", "expiryDate", { type: "date" }) : field("Expiry Date", "expiryDate", { type: "date" })}
          {field("Supplier / Vendor", "supplierName", { placeholder: "e.g. Cipla Distributor" })}
          {field("Reorder Qty", "reorderQty", { type: "number", placeholder: "e.g. 100" })}
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
            disabled={save.isPending || !form.name.trim() || !form.sellingPrice || (isRestock && (!form.batchNo.trim() || !form.expiryDate || !form.stockQty))}
          >
            {save.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
            {isEdit ? "Save Changes" : isRestock ? "Add New Batch" : "Add Medicine"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Prescription → Cart Import ──────────────────────────────────────────────

function findInventoryMatch(rxName: string, meds: Medicine[]): Medicine | null {
  if (!rxName) return null;
  const clean = rxName.replace(/\s*\(.*?\)\s*/g, "").trim().toLowerCase();
  const exact = meds.find(m => m.isActive && m.name.toLowerCase() === clean);
  if (exact) return exact;
  const words = clean.split(/\s+/).filter(w => w.length >= 3);
  return meds.find(m => m.isActive && words.some(w => m.name.toLowerCase().includes(w))) ?? null;
}

function RxImportSection({ patientId, medicines, onAddToCart }: {
  patientId: number; medicines: Medicine[]; onAddToCart: (med: Medicine) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const { data: rxList = [] } = useQuery<any[]>({
    queryKey: ["/api/prescriptions", "billing", patientId],
    queryFn: () => fetch(`/api/prescriptions?patientId=${patientId}`, { credentials: "include" }).then(r => r.json()),
    staleTime: 0,
    enabled: !!patientId,
  });

  const rx = rxList[0];
  if (!rx || !(rx.medications as any[])?.length) return null;

  const items = (rx.medications as any[]).map((m: any) => ({
    rxMed: m,
    match: findInventoryMatch(m.name ?? "", medicines),
  }));
  const availCount = items.filter(i => i.match).length;

  return (
    <div className="border border-violet-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-violet-50 hover:bg-violet-100 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-violet-800">
          <FileText className="w-3.5 h-3.5 shrink-0" />
          Doctor's Prescription
          {rx.diagnosis && (
            <span className="font-normal text-violet-500 text-xs truncate max-w-[100px]">· {rx.diagnosis}</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {availCount > 0 && (
            <span className="text-[10px] bg-violet-600 text-white rounded-full px-2 py-0.5 font-bold">
              {availCount} in stock
            </span>
          )}
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-violet-500" /> : <ChevronDown className="w-3.5 h-3.5 text-violet-500" />}
        </div>
      </button>
      {expanded && (
        <div className="bg-white p-3 space-y-1.5">
          {items.map(({ rxMed, match }, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-100">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 leading-tight truncate">{rxMed.name}</p>
                <p className="text-[11px] text-slate-400">
                  {[rxMed.dosage, rxMed.frequency, rxMed.duration].filter(Boolean).join(" · ")}
                </p>
              </div>
              {match ? (
                <Button size="sm" onClick={() => onAddToCart(match)}
                  className="h-7 px-2.5 text-xs rounded-lg bg-violet-600 hover:bg-violet-700 gap-1 shrink-0">
                  <Plus className="w-3 h-3" /> Add
                </Button>
              ) : (
                <span className="text-[11px] text-slate-400 shrink-0">Not stocked</span>
              )}
            </div>
          ))}
          {availCount > 1 && (
            <button
              onClick={() => items.forEach(({ match }) => match && onAddToCart(match))}
              className="w-full text-center text-xs font-semibold text-violet-700 hover:text-violet-900 py-1 transition-colors"
            >
              Add all {availCount} available →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Alerts Tab ──────────────────────────────────────────────────────────────

function AlertsTab({ medicines, today, onRestock, onDelete, onGoToInventory }: {
  medicines: Medicine[]; today: string;
  onRestock: (m: Medicine) => void;
  onDelete: (id: number) => void;
  onGoToInventory: () => void;
}) {
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];
  const in90 = new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0];

  const expired = medicines.filter(m => m.expiryDate && m.expiryDate < today).sort((a, b) => (a.expiryDate ?? "").localeCompare(b.expiryDate ?? ""));
  const critical = medicines.filter(m => m.expiryDate && m.expiryDate >= today && m.expiryDate <= in7).sort((a, b) => (a.expiryDate ?? "").localeCompare(b.expiryDate ?? ""));
  const warning = medicines.filter(m => m.expiryDate && m.expiryDate > in7 && m.expiryDate <= in30).sort((a, b) => (a.expiryDate ?? "").localeCompare(b.expiryDate ?? ""));
  const notice = medicines.filter(m => m.expiryDate && m.expiryDate > in30 && m.expiryDate <= in90).sort((a, b) => (a.expiryDate ?? "").localeCompare(b.expiryDate ?? ""));
  const lowStock = medicines.filter(m => m.stockQty <= m.minStockQty && m.isActive);

  const total = expired.length + critical.length + warning.length + notice.length + lowStock.length;

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <CheckCircle className="w-8 h-8 text-green-500" />
        </div>
        <h3 className="font-semibold text-slate-700 text-lg mb-1">All Clear!</h3>
        <p className="text-slate-400 text-sm">No expiry or stock alerts right now.</p>
      </div>
    );
  }

  function MedRow({ m, accent, badge }: { m: Medicine; accent: string; badge: string }) {
    return (
      <div className={cn("flex items-center gap-3 bg-white rounded-xl px-3 py-2.5 border", accent)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-slate-900">{m.name}</p>
            <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full", badge)}>{m.category}</span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {m.batchNo && <span>Batch: {m.batchNo} · </span>}
            {m.stockQty} {m.unit}s in stock
            {m.expiryDate && <span> · Exp: {format(new Date(m.expiryDate), "dd MMM yyyy")}</span>}
            {m.supplierName && <span> · {m.supplierName}</span>}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onRestock(m)}
            title="Add stock"
            className="h-7 px-2 rounded-lg text-xs font-semibold bg-violet-50 text-violet-700 hover:bg-violet-100 flex items-center gap-1 transition-colors"
          >
            <PackagePlus className="w-3 h-3" /> Restock
          </button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                title="Remove from inventory"
                className="h-7 w-7 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle>Remove from inventory?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete <span className="font-semibold text-slate-800">{m.name}</span> from the inventory. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(m.id)}
                  className="rounded-xl bg-red-600 hover:bg-red-700"
                >Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    );
  }

  function Section({ title, items, colorClass, badgeClass, icon }: {
    title: string; items: Medicine[]; colorClass: string; badgeClass: string; icon: React.ReactNode;
  }) {
    const [show, setShow] = useState(true);
    if (items.length === 0) return null;
    return (
      <div className={cn("rounded-2xl border p-4 space-y-2", colorClass)}>
        <button onClick={() => setShow(v => !v)} className="w-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon}
            <p className="font-semibold text-sm">{title}</p>
            <span className="font-bold text-xs bg-white/60 px-1.5 py-0.5 rounded-full">{items.length}</span>
          </div>
          {show ? <ChevronUp className="w-4 h-4 opacity-60" /> : <ChevronDown className="w-4 h-4 opacity-60" />}
        </button>
        {show && (
          <div className="space-y-1.5 mt-1">
            {items.map(m => <MedRow key={m.id} m={m} accent="border-slate-100" badge={badgeClass} />)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{total} alert{total !== 1 ? "s" : ""} need attention</p>
        <button onClick={onGoToInventory} className="text-xs text-violet-700 font-medium hover:text-violet-900 flex items-center gap-1">
          View Inventory <ChevronRight className="w-3 h-3" />
        </button>
      </div>
      <Section
        title="Expired: Remove from Shelf"
        items={expired}
        colorClass="bg-red-50 border-red-200 text-red-800"
        badgeClass="bg-red-100 text-red-700"
        icon={<AlertOctagon className="w-4 h-4 text-red-500" />}
      />
      <Section
        title="Expiring Within 7 Days"
        items={critical}
        colorClass="bg-orange-50 border-orange-200 text-orange-800"
        badgeClass="bg-orange-100 text-orange-700"
        icon={<AlertTriangle className="w-4 h-4 text-orange-500" />}
      />
      <Section
        title="Expiring in 7–30 Days: Sell First (FEFO)"
        items={warning}
        colorClass="bg-amber-50 border-amber-200 text-amber-800"
        badgeClass="bg-amber-100 text-amber-700"
        icon={<Clock className="w-4 h-4 text-amber-500" />}
      />
      <Section
        title="Expiring in 30–90 Days"
        items={notice}
        colorClass="bg-yellow-50 border-yellow-200 text-yellow-800"
        badgeClass="bg-yellow-100 text-yellow-700"
        icon={<Clock className="w-4 h-4 text-yellow-500" />}
      />
      <Section
        title="Low Stock: Below Minimum Level"
        items={lowStock}
        colorClass="bg-blue-50 border-blue-200 text-blue-800"
        badgeClass="bg-blue-100 text-blue-700"
        icon={<Package className="w-4 h-4 text-blue-500" />}
      />
    </div>
  );
}

// ── Reorder Tab ──────────────────────────────────────────────────────────────

function buildReorderHtml(items: Medicine[], clinicProfile?: Record<string, any>): string {
  const esc = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const cName = esc(clinicProfile?.clinicName || "Pharmacy");
  const cAddr = clinicProfile?.address ? `<p class="clinic-detail">${esc(clinicProfile.address).replace(/\n/g, "<br>")}</p>` : "";
  const cPhone = clinicProfile?.phone ? `<p class="clinic-detail">${esc(clinicProfile.phone)}</p>` : "";
  const cTagline = clinicProfile?.tagline ? `<p class="clinic-sub">${esc(clinicProfile.tagline)}</p>` : "";
  const rows = items.map(m => {
    const suggested = m.reorderQty ?? Math.max(m.minStockQty * 2 - m.stockQty, m.minStockQty);
    return `<tr>
      <td><strong>${esc(m.name)}</strong>${m.genericName ? `<br><span style="font-size:10px;color:#64748b">${esc(m.genericName)}</span>` : ""}</td>
      <td>${esc(m.category)}</td>
      <td>${esc(m.batchNo || "—")}</td>
      <td>${m.stockQty} ${esc(m.unit)}</td>
      <td>${m.minStockQty}</td>
      <td style="font-weight:700;color:#0f766e">${suggested} ${esc(m.unit)}</td>
      <td>${esc(m.supplierName || "—")}</td>
    </tr>`;
  }).join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Reorder List – ${cName}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',system-ui,Arial,sans-serif;background:#fff;color:#1e293b;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{max-width:900px;margin:0 auto}
.accent{height:5px;background:linear-gradient(90deg,#0f766e,#0891b2)}
.header{display:flex;justify-content:space-between;align-items:flex-start;padding:18px 32px 14px;border-bottom:2px solid #e2e8f0}
.clinic-name{font-size:20px;font-weight:900;color:#0f766e;letter-spacing:-.3px;margin-bottom:3px}
.clinic-sub{font-size:11px;color:#64748b;font-style:italic;margin-top:2px}
.clinic-detail{font-size:12px;color:#475569;line-height:1.5;margin-top:3px}
.doc-info{text-align:right}
.doc-title{font-size:14px;font-weight:800;color:#1e293b}
.doc-date{font-size:12px;color:#64748b;margin-top:4px}
.doc-count{font-size:11px;color:#94a3b8;margin-top:2px}
.body{padding:16px 32px 24px}
table{width:100%;border-collapse:collapse;font-size:12px}
thead th{font-size:9px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:.08em;padding:8px 10px;background:#0f766e;text-align:left}
tbody td{padding:8px 10px;border-bottom:1px solid #f1f5f9;vertical-align:top}
tbody tr:nth-child(even){background:#f8fafc}
tbody tr:last-child td{border-bottom:none}
.footer{padding:10px 32px 16px;text-align:center}
.branding{font-size:8px;color:#cbd5e1}
@media print{.body{padding:10px 24px}.header{padding:12px 24px 10px}}
</style></head><body>
<div class="page">
  <div class="accent"></div>
  <div class="header">
    <div>
      <p class="clinic-name">${cName}</p>
      ${cTagline}${cAddr}${cPhone}
    </div>
    <div class="doc-info">
      <p class="doc-title">Purchase Order / Reorder List</p>
      <p class="doc-date">Date: ${today}</p>
      <p class="doc-count">${items.length} item${items.length !== 1 ? "s" : ""}</p>
    </div>
  </div>
  <div class="body">
    <table>
      <thead><tr><th>Medicine</th><th>Category</th><th>Batch</th><th>In Stock</th><th>Min Level</th><th>Order Qty</th><th>Supplier</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  <div class="footer">
    <p class="branding">Powered by BariQ</p>
  </div>
</div>
<script>window.onload=()=>window.print();</script>
</body></html>`;
}

function ReorderTab({ medicines, today, settings, onRestock }: {
  medicines: Medicine[]; today: string; settings?: Record<string, any>;
  onRestock: (m: Medicine) => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [sortBy, setSortBy] = useState<"stock" | "expiry" | "name">("stock");

  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

  const toggleReorder = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/pharmacy/medicines/${id}/reorder`, {
        method: "PATCH", credentials: "include",
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/pharmacy/medicines"] }),
    onError: () => toast({ title: "Error", description: "Could not update reorder status", variant: "destructive" }),
  });

  const needsReorder = useMemo(() => {
    const list = medicines.filter(m =>
      m.isActive && (
        m.stockQty <= m.minStockQty ||
        (m.expiryDate && m.expiryDate <= in30)
      )
    );
    if (sortBy === "stock") return [...list].sort((a, b) => a.stockQty - b.stockQty);
    if (sortBy === "expiry") return [...list].sort((a, b) => {
      if (!a.expiryDate && !b.expiryDate) return 0;
      if (!a.expiryDate) return 1;
      if (!b.expiryDate) return -1;
      return a.expiryDate.localeCompare(b.expiryDate);
    });
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [medicines, sortBy, in30]);

  // orderedItems: all medicines with reorderedAt set (persisted in DB)
  const orderedItems = useMemo(() =>
    medicines.filter(m => m.isActive && m.reorderedAt).sort((a, b) => a.name.localeCompare(b.name)),
    [medicines]
  );

  // pendingItems: need reorder AND not yet marked as ordered
  const pendingItems = needsReorder.filter(m => !m.reorderedAt);

  function printReorderList() {
    const toPrint = pendingItems.length > 0 ? pendingItems : needsReorder;
    const w = window.open("", "_blank");
    if (w) { w.document.write(buildReorderHtml(toPrint, settings?.clinicProfile)); w.document.close(); }
  }

  const hasAnything = needsReorder.length > 0 || orderedItems.length > 0;

  if (!hasAnything) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <CheckCircle className="w-8 h-8 text-green-500" />
        </div>
        <h3 className="font-semibold text-slate-700 text-lg mb-1">Stock levels are healthy!</h3>
        <p className="text-slate-400 text-sm">No medicines need reordering right now.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Needs Ordering section ── */}
      {needsReorder.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-800">Needs Ordering</h3>
              <span className="text-xs bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-full">{pendingItems.length} pending</span>
              {orderedItems.length > 0 && <span className="text-xs bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">{orderedItems.length} ordered</span>}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
                {(["stock", "expiry", "name"] as const).map(s => (
                  <button key={s} onClick={() => setSortBy(s)}
                    className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all",
                      sortBy === s ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}
                  >{s === "stock" ? "Low Stock" : s === "expiry" ? "Expiry" : "Name"}</button>
                ))}
              </div>
              <Button size="sm" variant="outline" onClick={printReorderList} className="rounded-xl h-9 gap-1.5">
                <Printer className="w-3.5 h-3.5" /> Print Order
              </Button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <div className="grid text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-2.5 bg-slate-50 border-b border-slate-100"
              style={{ gridTemplateColumns: "1fr 80px 80px 100px 120px 110px" }}>
              <span>Medicine</span>
              <span className="text-right">In Stock</span>
              <span className="text-right">Min Level</span>
              <span className="text-right">Order Qty</span>
              <span>Supplier</span>
              <span className="text-right">Action</span>
            </div>
            <div className="divide-y divide-slate-50">
              {pendingItems.length === 0 ? (
                <p className="text-center text-slate-400 text-sm py-8">All items marked as ordered</p>
              ) : pendingItems.map(m => {
                const isLow = m.stockQty <= m.minStockQty;
                const isExpiring = m.expiryDate && m.expiryDate <= in30;
                const isExpired = m.expiryDate && m.expiryDate < today;
                const suggested = m.reorderQty ?? Math.max(m.minStockQty * 2 - m.stockQty, m.minStockQty);
                return (
                  <div key={m.id} className="grid items-center px-4 py-3 hover:bg-slate-50 transition-colors"
                    style={{ gridTemplateColumns: "1fr 80px 80px 100px 120px 110px" }}>
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">{m.name}</p>
                      <div className="flex items-center gap-2 flex-wrap mt-0.5">
                        {m.batchNo && <span className="text-[10px] text-slate-400">Batch: {m.batchNo}</span>}
                        {isExpired && <span className="text-[10px] bg-red-100 text-red-600 font-bold px-1.5 py-0.5 rounded-full">EXPIRED</span>}
                        {!isExpired && isExpiring && <span className="text-[10px] bg-amber-100 text-amber-600 font-bold px-1.5 py-0.5 rounded-full">Exp {format(new Date(m.expiryDate!), "dd MMM")}</span>}
                        {isLow && !isExpired && <span className="text-[10px] bg-red-50 text-red-500 font-semibold px-1.5 py-0.5 rounded-full">Low Stock</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={cn("font-bold text-sm", isLow ? "text-red-600" : "text-slate-700")}>{m.stockQty}</span>
                      <p className="text-[10px] text-slate-400">{m.unit}s</p>
                    </div>
                    <div className="text-right text-sm text-slate-500">{m.minStockQty}</div>
                    <div className="text-right">
                      <span className="font-bold text-violet-700 text-sm">{suggested}</span>
                      <p className="text-[10px] text-slate-400">{m.unit}s</p>
                    </div>
                    <div className="text-sm text-slate-500 truncate pr-2">{m.supplierName || <span className="text-slate-300">-</span>}</div>
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => onRestock(m)} title="Add stock" className="h-7 w-7 rounded-lg text-slate-400 hover:text-green-600 hover:bg-green-50 flex items-center justify-center transition-colors">
                        <PackagePlus className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => toggleReorder.mutate(m.id)}
                        disabled={toggleReorder.isPending}
                        className="h-7 px-2 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-green-100 hover:text-green-700 transition-colors whitespace-nowrap"
                      >
                        Mark Ordered
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Ordered items (persistent, from DB) ── */}
      {orderedItems.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-800">Ordered: Awaiting Delivery</h3>
            <span className="text-xs bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">{orderedItems.length} item{orderedItems.length > 1 ? "s" : ""}</span>
          </div>
          <div className="bg-white rounded-2xl border border-green-100 overflow-hidden">
            <div className="grid text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-2.5 bg-green-50 border-b border-green-100"
              style={{ gridTemplateColumns: "1fr 80px 80px 120px 120px 80px" }}>
              <span>Medicine</span>
              <span className="text-right">In Stock</span>
              <span className="text-right">Min Level</span>
              <span>Supplier</span>
              <span>Ordered On</span>
              <span className="text-right">Action</span>
            </div>
            <div className="divide-y divide-green-50">
              {orderedItems.map(m => {
                const isLow = m.stockQty <= m.minStockQty;
                const orderedDate = m.reorderedAt ? format(new Date(m.reorderedAt), "dd MMM, hh:mm a") : "";
                return (
                  <div key={m.id} className="grid items-center px-4 py-3 hover:bg-green-50/50 transition-colors"
                    style={{ gridTemplateColumns: "1fr 80px 80px 120px 120px 80px" }}>
                    <div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                        <p className="font-semibold text-slate-700 text-sm">{m.name}</p>
                      </div>
                      {m.genericName && <p className="text-[10px] text-slate-400 ml-5">{m.genericName}</p>}
                    </div>
                    <div className="text-right">
                      <span className={cn("font-bold text-sm", isLow ? "text-red-500" : "text-slate-700")}>{m.stockQty}</span>
                      <p className="text-[10px] text-slate-400">{m.unit}s</p>
                    </div>
                    <div className="text-right text-sm text-slate-500">{m.minStockQty}</div>
                    <div className="text-sm text-slate-500 truncate pr-2">{m.supplierName || <span className="text-slate-300">-</span>}</div>
                    <div className="text-xs text-slate-400">{orderedDate}</div>
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => onRestock(m)} title="Stock received" className="h-7 w-7 rounded-lg text-slate-400 hover:text-green-600 hover:bg-green-50 flex items-center justify-center transition-colors">
                        <PackagePlus className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => toggleReorder.mutate(m.id)}
                        disabled={toggleReorder.isPending}
                        className="h-7 px-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                        title="Undo mark ordered"
                      >
                        Undo
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <p className="text-xs text-slate-400 text-center">
            Add stock via <PackagePlus className="inline w-3 h-3" /> when delivery arrives. It will automatically clear from this list.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Billing Tab ─────────────────────────────────────────────────────────────

function BillingTab({ medicines, settings }: { medicines: Medicine[]; settings?: Record<string, any> }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: patients = [] } = usePatients();

  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [patientMode, setPatientMode] = useState<"registered" | "walkin">("registered");
  const [billingPhone, setBillingPhone] = useState("");
  const [selectedBillingPatient, setSelectedBillingPatient] = useState<{ id: number; name: string } | null>(null);
  const [billingNewName, setBillingNewName] = useState("");
  const [billingAddingNew, setBillingAddingNew] = useState(false);
  const [walkinName, setWalkinName] = useState("");
  const [walkinPhone, setWalkinPhone] = useState("");

  const billingPhoneDigits = billingPhone.replace(/\D/g, "").slice(-10);
  const billingPhoneReady = billingPhoneDigits.length >= 10;

  const billingMatches = useMemo(() => {
    if (!billingPhoneReady || patientMode === "walkin") return [];
    return (patients as any[]).filter(p =>
      (p.phone || "").replace(/\D/g, "").slice(-10) === billingPhoneDigits
    );
  }, [billingPhoneDigits, billingPhoneReady, patients, patientMode]);

  useEffect(() => {
    if (patientMode === "walkin") { setSelectedBillingPatient(null); return; }
    if (billingMatches.length === 1 && !billingAddingNew) {
      setSelectedBillingPatient({ id: billingMatches[0].id, name: billingMatches[0].name });
      setBillingNewName("");
    } else if (billingMatches.length !== 1 || billingAddingNew) {
      if (!billingAddingNew) setSelectedBillingPatient(null);
    }
  }, [billingMatches, billingAddingNew, patientMode]);

  function switchMode(mode: "registered" | "walkin") {
    setPatientMode(mode);
    setBillingPhone(""); setSelectedBillingPatient(null);
    setBillingNewName(""); setBillingAddingNew(false);
    setWalkinName(""); setWalkinPhone("");
  }
  const [discountPercent, setDiscountPercent] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [notes, setNotes] = useState("");

  const medStockMap = useMemo(() => {
    const m = new Map<number, number>();
    medicines.forEach(med => m.set(med.id, med.stockQty));
    return m;
  }, [medicines]);

  const in30days = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];
  const todayStr = new Date().toISOString().split("T")[0];

  const filtered = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return medicines
      .filter(m =>
        m.isActive && m.stockQty > 0 &&
        (m.name.toLowerCase().includes(q) || (m.genericName ?? "").toLowerCase().includes(q))
      )
      // FEFO: sort by expiry date soonest-first so pharmacist auto-grabs batch expiring earliest
      .sort((a, b) => {
        if (!a.expiryDate && !b.expiryDate) return 0;
        if (!a.expiryDate) return 1;
        if (!b.expiryDate) return -1;
        return a.expiryDate.localeCompare(b.expiryDate);
      })
      .slice(0, 10);
  }, [search, medicines]);

  function calcItem(item: CartItem): CartItem {
    const base = item.sellingPrice * item.qty;
    const gstAmt = Math.round(base * item.gstPercent / 100);
    return { ...item, gstAmount: gstAmt, total: base + gstAmt };
  }

  function addToCart(med: Medicine) {
    const currentQtyInCart = cart.find(i => i.medicineId === med.id)?.qty ?? 0;
    if (currentQtyInCart >= med.stockQty) {
      toast({ title: `Only ${med.stockQty} ${med.unit}s in stock`, variant: "destructive" });
      return;
    }
    setCart(prev => {
      const exists = prev.find(i => i.medicineId === med.id);
      if (exists) return prev.map(i => i.medicineId === med.id ? calcItem({ ...i, qty: i.qty + 1 }) : i);
      return [...prev, calcItem({ medicineId: med.id, name: med.name, unit: med.unit, sellingPrice: med.sellingPrice, gstPercent: med.gstPercent, qty: 1, gstAmount: 0, total: 0 })];
    });
    setSearch("");
  }

  function updateQty(medicineId: number, qty: number) {
    if (qty <= 0) { setCart(c => c.filter(i => i.medicineId !== medicineId)); return; }
    const maxStock = medStockMap.get(medicineId) ?? Infinity;
    if (qty > maxStock) {
      toast({ title: `Only ${maxStock} units available`, variant: "destructive" });
      return;
    }
    setCart(c => c.map(i => i.medicineId === medicineId ? calcItem({ ...i, qty }) : i));
  }

  const subtotal = cart.reduce((s, i) => s + i.sellingPrice * i.qty, 0);
  const gstTotal = cart.reduce((s, i) => s + i.gstAmount, 0);
  const discountAmount = Math.round((subtotal + gstTotal) * discountPercent / 100);
  const totalAmount = subtotal + gstTotal - discountAmount;

  const submit = useMutation({
    mutationFn: async () => {
      const body = {
        items: cart, subtotal, discountPercent, discountAmount, gstTotal, totalAmount,
        paymentMethod: paymentMethod.toLowerCase(), status: "paid",
        notes: notes.trim() || null,
        ...(patientMode === "walkin"
          ? { patientName: walkinName.trim() || "Walk-in", patientPhone: walkinPhone.trim() || null }
          : selectedBillingPatient
            ? { patientId: selectedBillingPatient.id }
            : { patientName: billingNewName.trim() || "Walk-in", patientPhone: billingPhone.trim() || null }),
      };
      const r = await fetch("/api/pharmacy/bills", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body), credentials: "include",
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.message); }
      return r.json();
    },
    onSuccess: (bill) => {
      qc.invalidateQueries({ queryKey: ["/api/pharmacy/bills"] });
      qc.invalidateQueries({ queryKey: ["/api/pharmacy/stats"] });
      qc.invalidateQueries({ queryKey: ["/api/pharmacy/medicines"] });
      toast({ title: "Bill created" });
      const w = window.open("", "_blank");
      if (w) { w.document.write(buildBillHtml(bill, settings?.clinicProfile)); w.document.close(); }
      setCart([]); setBillingPhone(""); setSelectedBillingPatient(null); setBillingNewName(""); setBillingAddingNew(false);
      setWalkinName(""); setWalkinPhone("");
      setDiscountPercent(0); setNotes(""); setPaymentMethod("Cash");
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: Search + Cart */}
      <div className="lg:col-span-2 space-y-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
          <h3 className="font-semibold text-slate-800">Search & Add Medicines</h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by medicine name or generic…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 rounded-xl h-11"
            />
          </div>
          {filtered.length > 0 && (
            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
              {filtered.map(m => {
                const isExpired = m.expiryDate && m.expiryDate < todayStr;
                const isExpiring = !isExpired && m.expiryDate && m.expiryDate <= in30days;
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      if (isExpired) {
                        toast({ title: `${m.name} is expired`, description: "Expired stock cannot be dispensed.", variant: "destructive" });
                        return;
                      }
                      addToCart(m);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-4 py-3 transition-colors text-left",
                      isExpired ? "opacity-60 cursor-not-allowed hover:bg-transparent" : "hover:bg-violet-50"
                    )}
                  >
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">{m.name}</p>
                      <p className="text-xs text-slate-400">
                        {m.genericName ? `${m.genericName} · ` : ""}{m.category} · {m.unit}
                        {isExpired && <span className="text-red-600 font-semibold"> · EXPIRED {format(new Date(m.expiryDate!), "MMM yy")}</span>}
                        {isExpiring && <span className="text-amber-600"> · Exp {format(new Date(m.expiryDate!), "MMM yy")}</span>}
                      </p>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <p className="font-bold text-violet-700 text-sm">₹{rupees(m.sellingPrice)}</p>
                      <p className={cn("text-xs", m.stockQty <= m.minStockQty ? "text-red-500 font-semibold" : "text-slate-400")}>
                        {m.stockQty} {m.unit}s
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Cart */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-violet-600" /> Cart
              {cart.length > 0 && (
                <span className="bg-violet-100 text-violet-700 text-xs font-bold px-2 py-0.5 rounded-full">{cart.length}</span>
              )}
            </h3>
            {cart.length > 0 && (
              <button onClick={() => setCart([])} className="text-xs text-red-500 hover:text-red-700">Clear all</button>
            )}
          </div>

          {cart.length === 0 ? (
            <div className="py-10 text-center text-slate-400">
              <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Search medicines above or import from prescription</p>
            </div>
          ) : (
            <div className="space-y-2">
              {cart.map(item => {
                const maxStock = medStockMap.get(item.medicineId) ?? Infinity;
                return (
                  <div key={item.medicineId} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 text-sm truncate">{item.name}</p>
                      <p className="text-xs text-slate-400">₹{rupees(item.sellingPrice)}/{item.unit} · GST {item.gstPercent}%</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => updateQty(item.medicineId, item.qty - 1)}
                        className="w-7 h-7 rounded-lg bg-slate-200 hover:bg-slate-300 flex items-center justify-center font-bold text-sm">−</button>
                      <input
                        type="number"
                        min="1"
                        max={maxStock}
                        value={item.qty}
                        onChange={e => {
                          const v = parseInt(e.target.value);
                          if (!isNaN(v) && v >= 1) updateQty(item.medicineId, v);
                        }}
                        onBlur={e => {
                          const v = parseInt(e.target.value);
                          if (isNaN(v) || v < 1) updateQty(item.medicineId, 1);
                        }}
                        className="w-12 h-7 text-center font-bold text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
                      />
                      <button
                        onClick={() => updateQty(item.medicineId, item.qty + 1)}
                        disabled={item.qty >= maxStock}
                        className="w-7 h-7 rounded-lg bg-slate-200 hover:bg-slate-300 flex items-center justify-center font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                      >+</button>
                    </div>
                    <div className="text-right shrink-0 min-w-[70px]">
                      <p className="font-bold text-slate-900 text-sm">₹{rupees(item.total)}</p>
                      <p className="text-xs text-slate-400">incl. GST</p>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button className="text-slate-300 hover:text-red-500 transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-2xl">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove from cart?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Remove <span className="font-semibold text-slate-800">{item.name}</span> from the bill?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => updateQty(item.medicineId, 0)}
                            className="rounded-xl bg-red-600 hover:bg-red-700"
                          >Remove</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right: Patient + Summary */}
      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Patient</h3>
          </div>

          {/* Mode toggle */}
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
            <button
              onClick={() => switchMode("registered")}
              className={cn(
                "flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all",
                patientMode === "registered" ? "bg-white text-violet-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              Registered Patient
            </button>
            <button
              onClick={() => switchMode("walkin")}
              className={cn(
                "flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all",
                patientMode === "walkin" ? "bg-white text-violet-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              Walk-in
            </button>
          </div>

          {patientMode === "registered" ? (
            <>
              <Input
                placeholder="Search by phone number"
                value={billingPhone}
                onChange={e => { setBillingPhone(e.target.value); setBillingAddingNew(false); setSelectedBillingPatient(null); }}
                className="rounded-xl h-10"
              />
              {billingPhoneReady && billingMatches.length > 0 && !billingAddingNew && (
                <div className="flex flex-wrap gap-2">
                  {billingMatches.map((p: any) => (
                    <button
                      key={p.id}
                      onClick={() => { setSelectedBillingPatient({ id: p.id, name: p.name }); setBillingNewName(""); }}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-sm font-medium border transition-all",
                        selectedBillingPatient?.id === p.id
                          ? "bg-violet-600 text-white border-violet-600"
                          : "bg-white text-slate-700 border-slate-300 hover:border-violet-400"
                      )}
                    >
                      {p.name}
                    </button>
                  ))}
                  <button
                    onClick={() => { setBillingAddingNew(true); setSelectedBillingPatient(null); setBillingNewName(""); }}
                    className="px-3 py-1.5 rounded-full text-sm font-medium border border-dashed border-slate-300 text-slate-500 hover:border-violet-400 hover:text-violet-600 transition-all"
                  >
                    + Someone else
                  </button>
                </div>
              )}
              {billingPhoneReady && (billingMatches.length === 0 || billingAddingNew) && (
                <Input
                  placeholder="Patient name (optional)"
                  value={billingNewName}
                  onChange={e => setBillingNewName(e.target.value)}
                  className="rounded-xl h-10"
                  autoFocus={billingAddingNew}
                />
              )}
              {selectedBillingPatient && (
                <RxImportSection
                  patientId={selectedBillingPatient.id}
                  medicines={medicines}
                  onAddToCart={addToCart}
                />
              )}
            </>
          ) : (
            <div className="space-y-2">
              <Input
                placeholder="Patient name (optional)"
                value={walkinName}
                onChange={e => setWalkinName(e.target.value)}
                className="rounded-xl h-10"
                autoFocus
              />
              <Input
                placeholder="Phone number (optional)"
                value={walkinPhone}
                onChange={e => setWalkinPhone(e.target.value)}
                className="rounded-xl h-10"
              />
              <p className="text-xs text-slate-400">Bill will be recorded as "Walk-in" if name is left blank.</p>
            </div>
          )}
        </div>

        {/* Bill Summary */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
          <h3 className="font-semibold text-slate-800">Bill Summary</h3>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>₹{rupees(subtotal)}</span></div>
            <div className="flex justify-between text-slate-600"><span>GST</span><span>₹{rupees(gstTotal)}</span></div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600 text-sm">Discount %</span>
              <input
                type="number" min="0" max="100" value={discountPercent}
                onChange={e => setDiscountPercent(Math.min(100, Math.max(0, Number(e.target.value))))}
                className="w-16 border border-slate-200 rounded-lg px-2 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
              />
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-green-600"><span>Discount</span><span>-₹{rupees(discountAmount)}</span></div>
            )}
            <div className="flex justify-between font-bold text-base text-slate-900 border-t border-slate-100 pt-2 mt-2">
              <span>Total</span>
              <span className="text-violet-700">₹{rupees(totalAmount)}</span>
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold text-slate-600 mb-1.5 block">Payment Method</Label>
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
            className="w-full rounded-xl h-12 bg-violet-600 hover:bg-violet-700 font-semibold gap-2 shadow-lg shadow-violet-600/20"
          >
            {submit.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
            {submit.isPending ? "Creating…" : `Create Bill · ₹${rupees(totalAmount)}`}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Return Dialog ───────────────────────────────────────────────────────────

function ReturnDialog({ bill, open, onClose }: { bill: PharmacyBill | null; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [selected, setSelected] = useState<Record<number, number>>({});
  const [refundMethod, setRefundMethod] = useState("Cash");
  const [reason, setReason] = useState("");

  useEffect(() => { if (open) { setSelected({}); setRefundMethod("Cash"); setReason(""); } }, [open]);

  const items = (bill?.items as CartItem[]) ?? [];

  function toggle(idx: number, qty: number) {
    setSelected(prev => {
      const next = { ...prev };
      if (next[idx] !== undefined) { delete next[idx]; } else { next[idx] = qty; }
      return next;
    });
  }

  function updateQty(idx: number, v: number) {
    const max = items[idx]?.qty ?? 1;
    setSelected(prev => ({ ...prev, [idx]: Math.min(Math.max(1, v), max) }));
  }

  const returnItems = Object.entries(selected).map(([idx, qty]) => ({
    ...items[Number(idx)], qty,
  }));
  const returnTotal = returnItems.reduce((s, i) => s + Math.round((i.sellingPrice * i.qty) * (1 + (i.gstPercent ?? 0) / 100)), 0);

  const submit = useMutation({
    mutationFn: async () => {
      if (!returnItems.length) throw new Error("Select at least one item to return");
      const r = await fetch("/api/pharmacy/returns", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalBillId: bill?.id,
          patientName: bill?.patientName,
          patientPhone: bill?.patientPhone,
          items: returnItems,
          totalAmount: returnTotal,
          refundMethod: refundMethod.toLowerCase(),
          reason: reason.trim() || null,
        }),
        credentials: "include",
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.message); }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/pharmacy/returns"] });
      qc.invalidateQueries({ queryKey: ["/api/pharmacy/medicines"] });
      qc.invalidateQueries({ queryKey: ["/api/pharmacy/stats"] });
      toast({ title: "Return processed", description: `₹${rupees(returnTotal)} refunded via ${refundMethod}` });
      onClose();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-md rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-orange-500" /> Process Return — Bill #{bill?.id}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <p className="text-xs text-slate-500">Select items to return. Stock will be credited back automatically.</p>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {items.map((item, idx) => {
              const checked = selected[idx] !== undefined;
              return (
                <div key={idx} className={cn("flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors",
                  checked ? "border-orange-300 bg-orange-50" : "border-slate-100 bg-slate-50")}>
                  <input type="checkbox" checked={checked} onChange={() => toggle(idx, item.qty)}
                    className="w-4 h-4 accent-orange-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{item.name}</p>
                    <p className="text-xs text-slate-400">Billed qty: {item.qty} {item.unit} · ₹{rupees(item.sellingPrice)}</p>
                  </div>
                  {checked && (
                    <Input type="number" min={1} max={item.qty} value={selected[idx]}
                      onChange={e => updateQty(idx, parseInt(e.target.value) || 1)}
                      className="w-16 h-8 rounded-lg text-center text-sm" />
                  )}
                </div>
              );
            })}
          </div>
          <div>
            <Label className="text-xs font-semibold text-slate-600 mb-1 block">Refund Method</Label>
            <Select value={refundMethod} onValueChange={setRefundMethod}>
              <SelectTrigger className="rounded-xl h-10"><SelectValue /></SelectTrigger>
              <SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-semibold text-slate-600 mb-1 block">Reason (optional)</Label>
            <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Wrong medicine dispensed"
              className="rounded-xl h-10" />
          </div>
          {returnItems.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-2 text-sm">
              <span className="text-orange-700">Refund amount: </span>
              <span className="font-bold text-orange-800">₹{rupees(returnTotal)}</span>
              <span className="text-orange-500 text-xs ml-1">({returnItems.length} item{returnItems.length > 1 ? "s" : ""})</span>
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 rounded-xl h-10" onClick={onClose}>Cancel</Button>
            <Button
              className="flex-1 rounded-xl h-10 bg-orange-500 hover:bg-orange-600"
              onClick={() => submit.mutate()}
              disabled={submit.isPending || !returnItems.length}
            >
              {submit.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-1.5" /> : <RotateCcw className="w-4 h-4 mr-1.5" />}
              Process Return
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Wastage Dialog ──────────────────────────────────────────────────────────

function WastageDialog({ medicines, open, onClose }: { medicines: Medicine[]; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [medId, setMedId] = useState("");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("expired");
  const [notes, setNotes] = useState("");

  useEffect(() => { if (open) { setMedId(""); setQty(""); setReason("expired"); setNotes(""); } }, [open]);

  const selectedMed = medicines.find(m => m.id === Number(medId));

  const submit = useMutation({
    mutationFn: async () => {
      const n = parseInt(qty);
      if (!selectedMed) throw new Error("Select a medicine");
      if (!n || n <= 0) throw new Error("Enter a valid quantity");
      const r = await fetch("/api/pharmacy/wastage", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medicineId: selectedMed.id,
          medicineName: selectedMed.name,
          batchNo: selectedMed.batchNo || null,
          qty: n,
          unit: selectedMed.unit,
          costPrice: selectedMed.costPrice,
          reason,
          notes: notes.trim() || null,
        }),
        credentials: "include",
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.message); }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/pharmacy/wastage"] });
      qc.invalidateQueries({ queryKey: ["/api/pharmacy/medicines"] });
      qc.invalidateQueries({ queryKey: ["/api/pharmacy/stats"] });
      toast({ title: "Wastage logged", description: `${qty} ${selectedMed?.unit}s of ${selectedMed?.name} written off` });
      onClose();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const totalLoss = selectedMed && parseInt(qty) > 0 ? Math.round(selectedMed.costPrice * parseInt(qty)) : null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-red-500" /> Log Wastage / Write-off
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div>
            <Label className="text-xs font-semibold text-slate-600 mb-1 block">Medicine *</Label>
            <Select value={medId} onValueChange={setMedId}>
              <SelectTrigger className="rounded-xl h-10"><SelectValue placeholder="Select medicine…" /></SelectTrigger>
              <SelectContent>
                {medicines.map(m => (
                  <SelectItem key={m.id} value={String(m.id)}>
                    {m.name} ({m.stockQty} {m.unit}s)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedMed && (
            <div className="bg-slate-50 rounded-xl px-3 py-2 text-xs text-slate-500">
              Batch: {selectedMed.batchNo || "—"} · Cost: ₹{rupees(selectedMed.costPrice)}/{selectedMed.unit}
              {selectedMed.expiryDate && ` · Exp: ${format(new Date(selectedMed.expiryDate), "MMM yyyy")}`}
            </div>
          )}
          <div>
            <Label className="text-xs font-semibold text-slate-600 mb-1 block">Quantity to Write Off *</Label>
            <Input type="number" min="1" value={qty} onChange={e => setQty(e.target.value)}
              placeholder="e.g. 10" className="rounded-xl h-10" />
          </div>
          <div>
            <Label className="text-xs font-semibold text-slate-600 mb-1 block">Reason *</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="rounded-xl h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="damaged">Damaged / Broken</SelectItem>
                <SelectItem value="recalled">Supplier Recall</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-semibold text-slate-600 mb-1 block">Notes (optional)</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional details…"
              className="rounded-xl h-10" />
          </div>
          {totalLoss !== null && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2 text-sm">
              <span className="text-red-600">Estimated loss: </span>
              <span className="font-bold text-red-700">₹{rupees(totalLoss)}</span>
              <span className="text-red-400 text-xs ml-1">(at cost price)</span>
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 rounded-xl h-10" onClick={onClose}>Cancel</Button>
            <Button
              className="flex-1 rounded-xl h-10 bg-red-600 hover:bg-red-700"
              onClick={() => submit.mutate()}
              disabled={submit.isPending || !medId || !qty || parseInt(qty) <= 0}
            >
              {submit.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-1.5" /> : <Trash2 className="w-4 h-4 mr-1.5" />}
              Write Off
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Supplier Dialog ─────────────────────────────────────────────────────────

function SupplierDialog({ supplier, open, onClose }: { supplier?: PharmacySupplier | null; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const empty = { name: "", contactPerson: "", phone: "", email: "", address: "", paymentTerms: "", leadTimeDays: "", notes: "" };
  const [form, setForm] = useState(empty);

  useEffect(() => {
    if (open) {
      setForm(supplier ? {
        name: supplier.name, contactPerson: supplier.contactPerson ?? "",
        phone: supplier.phone ?? "", email: supplier.email ?? "",
        address: supplier.address ?? "", paymentTerms: supplier.paymentTerms ?? "",
        leadTimeDays: supplier.leadTimeDays ? String(supplier.leadTimeDays) : "",
        notes: supplier.notes ?? "",
      } : empty);
    }
  }, [open, supplier]);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: async () => {
      const body = { ...form, leadTimeDays: form.leadTimeDays ? parseInt(form.leadTimeDays) : null };
      const url = supplier ? `/api/pharmacy/suppliers/${supplier.id}` : "/api/pharmacy/suppliers";
      const r = await fetch(url, {
        method: supplier ? "PUT" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body), credentials: "include",
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.message); }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/pharmacy/suppliers"] });
      toast({ title: supplier ? "Supplier updated" : "Supplier added" });
      onClose();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const fld = (label: string, key: string, opts?: { placeholder?: string; type?: string }) => (
    <div>
      <Label className="text-xs font-semibold text-slate-600 mb-1 block">{label}</Label>
      <Input type={opts?.type ?? "text"} value={(form as any)[key]} onChange={e => set(key, e.target.value)}
        placeholder={opts?.placeholder} className="rounded-xl h-10" />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-md rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{supplier ? "Edit Supplier" : "Add Supplier"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="col-span-2">{fld("Company / Supplier Name *", "name", { placeholder: "e.g. Cipla Distributors Pvt Ltd" })}</div>
          {fld("Contact Person", "contactPerson", { placeholder: "e.g. Ramesh Kumar" })}
          {fld("Phone", "phone", { placeholder: "e.g. 9876543210" })}
          {fld("Email", "email", { placeholder: "orders@cipladist.com" })}
          {fld("Lead Time (days)", "leadTimeDays", { type: "number", placeholder: "e.g. 3" })}
          {fld("Payment Terms", "paymentTerms", { placeholder: "e.g. Net 30" })}
          <div className="col-span-2">{fld("Address", "address", { placeholder: "Full address…" })}</div>
          <div className="col-span-2">{fld("Notes", "notes", { placeholder: "Any special instructions…" })}</div>
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose}>Cancel</Button>
          <Button className="flex-1 rounded-xl bg-violet-600 hover:bg-violet-700"
            onClick={() => save.mutate()} disabled={save.isPending || !form.name.trim()}>
            {save.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
            {supplier ? "Save Changes" : "Add Supplier"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Suppliers Tab ───────────────────────────────────────────────────────────

function SuppliersTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dialog, setDialog] = useState<{ open: boolean; supplier?: PharmacySupplier | null }>({ open: false });

  const { data: suppliers = [] } = useQuery<PharmacySupplier[]>({
    queryKey: ["/api/pharmacy/suppliers"],
    queryFn: () => fetch("/api/pharmacy/suppliers", { credentials: "include" }).then(r => r.json()),
  });

  const deleteSupplier = useMutation({
    mutationFn: (id: number) => fetch(`/api/pharmacy/suppliers/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/pharmacy/suppliers"] }); toast({ title: "Supplier removed" }); },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-800">Suppliers</h3>
          <p className="text-xs text-slate-400 mt-0.5">{suppliers.length} active supplier{suppliers.length !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={() => setDialog({ open: true })} className="rounded-xl bg-violet-600 hover:bg-violet-700 gap-2 h-9">
          <Plus className="w-4 h-4" /> Add Supplier
        </Button>
      </div>

      {suppliers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-2xl border border-slate-100">
          <div className="w-14 h-14 bg-violet-50 rounded-full flex items-center justify-center mb-3">
            <Building2 className="w-7 h-7 text-violet-300" />
          </div>
          <p className="font-semibold text-slate-600 mb-1">No suppliers yet</p>
          <p className="text-xs text-slate-400">Add your medicine distributors and vendors here</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-xs text-slate-500 uppercase tracking-wide">
                  <th className="px-4 py-3 text-left font-semibold">Supplier</th>
                  <th className="px-4 py-3 text-left font-semibold">Contact</th>
                  <th className="px-4 py-3 text-left font-semibold">Phone</th>
                  <th className="px-4 py-3 text-left font-semibold">Lead Time</th>
                  <th className="px-4 py-3 text-left font-semibold">Payment Terms</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {suppliers.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{s.name}</p>
                      {s.email && <p className="text-xs text-slate-400">{s.email}</p>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{s.contactPerson || <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-3 text-slate-600">{s.phone || <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-3 text-slate-600">{s.leadTimeDays ? `${s.leadTimeDays} days` : <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-3 text-slate-600">{s.paymentTerms || <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setDialog({ open: true, supplier: s })}
                          className="w-8 h-8 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 flex items-center justify-center transition-colors">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button className="w-8 h-8 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="rounded-2xl">
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove supplier?</AlertDialogTitle>
                              <AlertDialogDescription>This will remove <span className="font-semibold">{s.name}</span> from your supplier list.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteSupplier.mutate(s.id)} className="rounded-xl bg-red-600 hover:bg-red-700">Remove</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <SupplierDialog open={dialog.open} supplier={dialog.supplier} onClose={() => setDialog({ open: false })} />
    </div>
  );
}

// ── Wastage Tab ─────────────────────────────────────────────────────────────

function WastageTab({ medicines }: { medicines: Medicine[] }) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: records = [] } = useQuery<WastageEntry[]>({
    queryKey: ["/api/pharmacy/wastage"],
    queryFn: () => fetch("/api/pharmacy/wastage", { credentials: "include" }).then(r => r.json()),
  });

  const totalLoss = records.reduce((s, r) => s + r.totalCost, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-800">Write-offs & Wastage</h3>
          <p className="text-xs text-slate-400 mt-0.5">Total cost of wastage: ₹{rupees(totalLoss)}</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="rounded-xl bg-red-600 hover:bg-red-700 gap-2 h-9">
          <Plus className="w-4 h-4" /> Log Wastage
        </Button>
      </div>

      {records.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-2xl border border-slate-100">
          <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mb-3">
            <CheckCircle className="w-7 h-7 text-green-300" />
          </div>
          <p className="font-semibold text-slate-600 mb-1">No wastage recorded</p>
          <p className="text-xs text-slate-400">Log expired or damaged stock here for accounting purposes</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-xs text-slate-500 uppercase tracking-wide">
                  <th className="px-4 py-3 text-left font-semibold">Medicine</th>
                  <th className="px-4 py-3 text-left font-semibold">Reason</th>
                  <th className="px-4 py-3 text-right font-semibold">Qty</th>
                  <th className="px-4 py-3 text-right font-semibold">Cost Loss</th>
                  <th className="px-4 py-3 text-left font-semibold">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {records.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800">{r.medicineName}</p>
                      {r.batchNo && <p className="text-xs text-slate-400">Batch: {r.batchNo}</p>}
                      {r.notes && <p className="text-xs text-slate-400 italic">{r.notes}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-semibold capitalize",
                        r.reason === "expired" ? "bg-red-100 text-red-700" :
                        r.reason === "damaged" ? "bg-orange-100 text-orange-700" :
                        r.reason === "recalled" ? "bg-purple-100 text-purple-700" :
                        "bg-slate-100 text-slate-600")}
                      >{r.reason}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-700">{r.qty} {r.unit}s</td>
                    <td className="px-4 py-3 text-right font-bold text-red-600">₹{rupees(r.totalCost)}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{format(new Date(r.createdAt), "dd MMM yyyy, h:mm a")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-400">{records.length} record{records.length !== 1 ? "s" : ""}</p>
            <p className="text-xs font-semibold text-red-600">Total loss: ₹{rupees(totalLoss)}</p>
          </div>
        </div>
      )}

      <WastageDialog medicines={medicines} open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
}

// ── Returns Tab ─────────────────────────────────────────────────────────────

function ReturnsTab({ bills, settings }: { bills: PharmacyBill[]; settings?: Record<string, any> }) {
  const [returnBill, setReturnBill] = useState<PharmacyBill | null>(null);
  const [search, setSearch] = useState("");

  const { data: returns = [] } = useQuery<ReturnRecord[]>({
    queryKey: ["/api/pharmacy/returns"],
    queryFn: () => fetch("/api/pharmacy/returns", { credentials: "include" }).then(r => r.json()),
  });

  const totalRefunded = returns.reduce((s, r) => s + r.totalAmount, 0);

  const filteredBills = useMemo(() => {
    if (!search.trim()) return bills.slice(0, 20);
    const q = search.toLowerCase();
    return bills.filter(b =>
      String(b.id).includes(q) ||
      (b.patientName || "").toLowerCase().includes(q) ||
      (b.patientPhone || "").includes(q)
    ).slice(0, 20);
  }, [bills, search]);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-4">
          <p className="text-xs text-slate-500 mb-1">Total Returns</p>
          <p className="text-2xl font-black text-orange-600">{returns.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-4">
          <p className="text-xs text-slate-500 mb-1">Total Refunded</p>
          <p className="text-2xl font-black text-orange-600">₹{rupees(totalRefunded)}</p>
        </div>
      </div>

      {/* Select a bill to return from */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
        <h3 className="font-semibold text-slate-800 text-sm">Process a Return</h3>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Search bill # or patient name…" value={search} onChange={e => setSearch(e.target.value)}
            className="pl-9 rounded-xl h-10" />
        </div>
        <div className="space-y-1.5 max-h-56 overflow-y-auto">
          {filteredBills.map(b => (
            <div key={b.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <div>
                <p className="text-sm font-semibold text-slate-800">#{b.id} — {b.patientName || "Walk-in"}</p>
                <p className="text-xs text-slate-400">
                  {format(new Date(b.createdAt), "dd MMM yyyy, h:mm a")} · {(b.items as any[]).length} items · ₹{rupees(b.totalAmount)}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setReturnBill(b)}
                className="h-8 px-3 rounded-lg text-xs border-orange-300 text-orange-600 hover:bg-orange-50 gap-1">
                <RotateCcw className="w-3 h-3" /> Return
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Return history */}
      {returns.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800 text-sm">Return History</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[550px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-xs text-slate-500 uppercase tracking-wide">
                  <th className="px-4 py-3 text-left font-semibold">Return #</th>
                  <th className="px-4 py-3 text-left font-semibold">Patient</th>
                  <th className="px-4 py-3 text-left font-semibold">Original Bill</th>
                  <th className="px-4 py-3 text-right font-semibold">Refunded</th>
                  <th className="px-4 py-3 text-left font-semibold">Method</th>
                  <th className="px-4 py-3 text-left font-semibold">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {returns.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-semibold text-orange-600">R#{r.id}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800">{r.patientName || "Walk-in"}</p>
                      {r.patientPhone && <p className="text-xs text-slate-400">{r.patientPhone}</p>}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{r.originalBillId ? `#${r.originalBillId}` : "—"}</td>
                    <td className="px-4 py-3 text-right font-bold text-orange-600">₹{rupees(r.totalAmount)}</td>
                    <td className="px-4 py-3 capitalize">
                      <span className="px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 text-xs font-semibold">{r.refundMethod || "cash"}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{format(new Date(r.createdAt), "dd MMM yyyy, h:mm a")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ReturnDialog bill={returnBill} open={!!returnBill} onClose={() => setReturnBill(null)} />
    </div>
  );
}

// ── Closing Tab ─────────────────────────────────────────────────────────────

function ClosingTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [cashActual, setCashActual] = useState("");
  const [notes, setNotes] = useState("");

  const { data: summary, refetch: refetchSummary } = useQuery<TodaySummary>({
    queryKey: ["/api/pharmacy/closing/today"],
    queryFn: () => fetch("/api/pharmacy/closing/today", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 30000,
  });

  const { data: history = [] } = useQuery<DailyClosing[]>({
    queryKey: ["/api/pharmacy/closing"],
    queryFn: () => fetch("/api/pharmacy/closing", { credentials: "include" }).then(r => r.json()),
  });

  useEffect(() => {
    if (summary?.existingClosing) {
      setCashActual(String(summary.existingClosing.cashActual / 100));
      setNotes(summary.existingClosing.notes ?? "");
    } else if (summary) {
      setCashActual(String(summary.cashExpected / 100));
    }
  }, [summary?.date]);

  const saveClosing = useMutation({
    mutationFn: async () => {
      if (!summary) throw new Error("No summary loaded");
      const r = await fetch("/api/pharmacy/closing", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          closingDate: summary.date,
          cashExpected: summary.cashExpected,
          cashActual: Math.round(parseFloat(cashActual || "0") * 100),
          upiTotal: summary.upiTotal,
          cardTotal: summary.cardTotal,
          onlineTotal: summary.onlineTotal,
          totalSales: summary.totalSales,
          totalReturns: summary.totalReturns,
          notes: notes.trim() || null,
        }),
        credentials: "include",
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.message); }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/pharmacy/closing"] });
      refetchSummary();
      toast({ title: "Day closed successfully" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const cashActualPaise = Math.round(parseFloat(cashActual || "0") * 100);
  const cashDiff = summary ? cashActualPaise - summary.cashExpected : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-800">Daily Cash Closing</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {summary?.date ? format(new Date(summary.date), "dd MMMM yyyy") : "Today"}
            {summary?.existingClosing && <span className="ml-2 text-green-600 font-semibold">· Closed</span>}
          </p>
        </div>
        <button onClick={() => refetchSummary()} className="w-8 h-8 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 flex items-center justify-center transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Today's breakdown */}
      {summary && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Cash Sales", value: summary.cashExpected, color: "text-green-700", bg: "bg-green-50" },
              { label: "UPI Sales", value: summary.upiTotal, color: "text-blue-700", bg: "bg-blue-50" },
              { label: "Card Sales", value: summary.cardTotal, color: "text-purple-700", bg: "bg-purple-50" },
              { label: "Online Sales", value: summary.onlineTotal, color: "text-teal-700", bg: "bg-teal-50" },
            ].map(c => (
              <div key={c.label} className={cn("rounded-xl p-3 border", c.bg, "border-slate-100")}>
                <p className="text-xs text-slate-500 mb-1">{c.label}</p>
                <p className={cn("text-lg font-black", c.color)}>₹{rupees(c.value)}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border border-slate-100 p-3">
              <p className="text-xs text-slate-500 mb-1">Gross Sales</p>
              <p className="text-lg font-black text-slate-800">₹{rupees(summary.totalSales)}</p>
              <p className="text-[10px] text-slate-400">{summary.billCount} bills</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-100 p-3">
              <p className="text-xs text-slate-500 mb-1">Returns</p>
              <p className="text-lg font-black text-orange-600">− ₹{rupees(summary.totalReturns)}</p>
            </div>
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
              <p className="text-xs text-slate-500 mb-1">Net Sales</p>
              <p className="text-lg font-black text-slate-900">₹{rupees(summary.netSales)}</p>
            </div>
          </div>

          {/* Cash reconciliation */}
          <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
            <h4 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
              <Banknote className="w-4 h-4 text-green-500" /> Cash Reconciliation
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-slate-500 mb-1 block">Expected Cash (from bills)</Label>
                <div className="h-10 rounded-xl bg-slate-50 border border-slate-200 px-3 flex items-center text-sm font-semibold text-slate-700">
                  ₹{rupees(summary.cashExpected)}
                </div>
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-600 mb-1 block">Actual Cash in Drawer *</Label>
                <Input type="number" value={cashActual} onChange={e => setCashActual(e.target.value)}
                  placeholder="0.00" className="rounded-xl h-10" />
              </div>
            </div>
            {cashActual && (
              <div className={cn("px-3 py-2 rounded-xl text-sm font-semibold",
                cashDiff === 0 ? "bg-green-50 text-green-700" :
                cashDiff > 0 ? "bg-blue-50 text-blue-700" : "bg-red-50 text-red-700")}>
                {cashDiff === 0 ? "✓ Cash matches perfectly" :
                  cashDiff > 0 ? `↑ Excess: ₹${rupees(Math.abs(cashDiff))}` :
                  `↓ Shortage: ₹${rupees(Math.abs(cashDiff))}`}
              </div>
            )}
            <div>
              <Label className="text-xs font-semibold text-slate-600 mb-1 block">Notes</Label>
              <Input value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Closing remarks…" className="rounded-xl h-10" />
            </div>
            <Button
              onClick={() => saveClosing.mutate()}
              disabled={saveClosing.isPending || !cashActual}
              className="w-full rounded-xl bg-violet-600 hover:bg-violet-700 h-10"
            >
              {saveClosing.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              {summary.existingClosing ? "Update Closing" : "Close Day"}
            </Button>
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h4 className="font-semibold text-slate-800 text-sm">Closing History</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                  <th className="px-4 py-2.5 text-left font-semibold">Date</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Gross</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Returns</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Net</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Cash Expected</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Cash Actual</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Diff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {history.map(c => {
                  const diff = c.cashActual - c.cashExpected;
                  return (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-slate-700">{format(new Date(c.closingDate), "dd MMM yyyy")}</td>
                      <td className="px-4 py-3 text-right text-slate-700">₹{rupees(c.totalSales)}</td>
                      <td className="px-4 py-3 text-right text-orange-500">₹{rupees(c.totalReturns)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">₹{rupees(c.totalSales - c.totalReturns)}</td>
                      <td className="px-4 py-3 text-right text-slate-500">₹{rupees(c.cashExpected)}</td>
                      <td className="px-4 py-3 text-right text-slate-700">₹{rupees(c.cashActual)}</td>
                      <td className={cn("px-4 py-3 text-right font-semibold text-xs", diff === 0 ? "text-green-600" : diff > 0 ? "text-blue-600" : "text-red-600")}>
                        {diff === 0 ? "✓" : diff > 0 ? `+₹${rupees(Math.abs(diff))}` : `-₹${rupees(Math.abs(diff))}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
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
  const [inventorySortBy, setInventorySortBy] = useState<"name" | "expiry" | "stock">("name");
  const [billSearch, setBillSearch] = useState("");
  const [billDateFilter, setBillDateFilter] = useState<"all" | "today" | "week" | "month">("all");
  const [medicineDialog, setMedicineDialog] = useState<{ open: boolean; medicine?: Medicine | null; prefill?: Medicine | null }>({ open: false });
  const [returnBillFromHistory, setReturnBillFromHistory] = useState<PharmacyBill | null>(null);

  const { data: settings } = useQuery<Record<string, any>>({ queryKey: ["/api/settings"] });

  const { data: stats } = useQuery<Stats>({
    queryKey: ["/api/pharmacy/stats"],
    queryFn: () => fetch("/api/pharmacy/stats", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 30000,
  });

  const { data: medicines = [] } = useQuery<Medicine[]>({
    queryKey: ["/api/pharmacy/medicines"],
    queryFn: () => fetch("/api/pharmacy/medicines", { credentials: "include" }).then(r => r.json()),
  });

  // Always fetch bills (not just on bills tab) so dashboard recent bills works
  const { data: bills = [] } = useQuery<PharmacyBill[]>({
    queryKey: ["/api/pharmacy/bills"],
    queryFn: () => fetch("/api/pharmacy/bills", { credentials: "include" }).then(r => r.json()),
    staleTime: 30000,
  });

  const { data: consumption = [] } = useQuery<ConsumptionItem[]>({
    queryKey: ["/api/pharmacy/consumption"],
    queryFn: () => fetch("/api/pharmacy/consumption", { credentials: "include" }).then(r => r.json()),
    staleTime: 60000,
  });

  const consumptionMap = useMemo(() => {
    const m = new Map<number, ConsumptionItem>();
    consumption.forEach(c => m.set(c.medicineId, c));
    return m;
  }, [consumption]);

  const [gstMonth, setGstMonth] = useState(() => new Date().toISOString().slice(0, 7));

  function downloadGstExport() {
    const url = `/api/pharmacy/gst-export?month=${gstMonth}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `gst-report-${gstMonth}.csv`;
    a.click();
  }

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
    if (inventorySortBy === "expiry") {
      list = [...list].sort((a, b) => {
        if (!a.expiryDate && !b.expiryDate) return a.name.localeCompare(b.name);
        if (!a.expiryDate) return 1;
        if (!b.expiryDate) return -1;
        return a.expiryDate.localeCompare(b.expiryDate);
      });
    } else if (inventorySortBy === "stock") {
      list = [...list].sort((a, b) => a.stockQty - b.stockQty);
    }
    return list;
  }, [medicines, search, categoryFilter, showLowStock, inventorySortBy]);

  const filteredBills = useMemo(() => {
    let result = bills;
    if (billSearch.trim()) {
      const q = billSearch.toLowerCase();
      result = result.filter(b =>
        (b.patientName || "walk-in").toLowerCase().includes(q) ||
        (b.patientPhone || "").includes(q) ||
        String(b.id).includes(q)
      );
    }
    if (billDateFilter !== "all") {
      const now = new Date();
      let cutoff: Date;
      if (billDateFilter === "today") { cutoff = new Date(now); cutoff.setHours(0, 0, 0, 0); }
      else if (billDateFilter === "week") { cutoff = new Date(now.getTime() - 7 * 86400000); }
      else { cutoff = new Date(now.getFullYear(), now.getMonth(), 1); }
      result = result.filter(b => new Date(b.createdAt) >= cutoff);
    }
    return result;
  }, [bills, billSearch, billDateFilter]);

  const today = format(new Date(), "yyyy-MM-dd");
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

  const alertCount = useMemo(() => {
    const expired = medicines.filter(m => m.expiryDate && m.expiryDate < today).length;
    const expiring = medicines.filter(m => m.expiryDate && m.expiryDate >= today && m.expiryDate <= in30).length;
    const low = medicines.filter(m => m.stockQty <= m.minStockQty && m.isActive).length;
    return expired + expiring + low;
  }, [medicines, today, in30]);

  return (
    <>
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
              <Pill className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Pharmacy</h1>
              <p className="text-xs text-slate-500">Inventory · Billing · Prescriptions</p>
            </div>
          </div>
          {tab === "inventory" && (
            <Button onClick={() => setMedicineDialog({ open: true })} className="rounded-xl bg-violet-600 hover:bg-violet-700 gap-2">
              <Plus className="w-4 h-4" /> Add Medicine
            </Button>
          )}
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={v => setTab(v as Tab)}>
          <TabsList className="flex w-full overflow-x-auto rounded-xl gap-0 h-auto p-1">
            <TabsTrigger value="dashboard" className="rounded-lg text-xs gap-1 shrink-0"><BarChart2 className="w-3.5 h-3.5" />Dashboard</TabsTrigger>
            <TabsTrigger value="inventory" className="rounded-lg text-xs gap-1 shrink-0"><Package className="w-3.5 h-3.5" />Inventory</TabsTrigger>
            <TabsTrigger value="billing" className="rounded-lg text-xs gap-1 shrink-0"><ShoppingCart className="w-3.5 h-3.5" />New Bill</TabsTrigger>
            <TabsTrigger value="bills" className="rounded-lg text-xs gap-1 shrink-0"><Clock className="w-3.5 h-3.5" />History</TabsTrigger>
            <TabsTrigger value="alerts" className="rounded-lg text-xs gap-1 shrink-0 relative">
              <AlertOctagon className="w-3.5 h-3.5" />Alerts
              {alertCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {alertCount > 99 ? "99+" : alertCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="reorder" className="rounded-lg text-xs gap-1 shrink-0"><ListChecks className="w-3.5 h-3.5" />Reorder</TabsTrigger>
            <TabsTrigger value="returns" className="rounded-lg text-xs gap-1 shrink-0"><RotateCcw className="w-3.5 h-3.5" />Returns</TabsTrigger>
            <TabsTrigger value="wastage" className="rounded-lg text-xs gap-1 shrink-0"><Trash2 className="w-3.5 h-3.5" />Wastage</TabsTrigger>
            <TabsTrigger value="suppliers" className="rounded-lg text-xs gap-1 shrink-0"><Building2 className="w-3.5 h-3.5" />Suppliers</TabsTrigger>
            <TabsTrigger value="closing" className="rounded-lg text-xs gap-1 shrink-0"><Banknote className="w-3.5 h-3.5" />Closing</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* ── DASHBOARD ── */}
        {tab === "dashboard" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {[
                { label: "Total Medicines", value: stats?.totalMedicines ?? "-", icon: Pill, color: "bg-violet-100 text-violet-600", textColor: "text-violet-700" },
                { label: "Low Stock", value: stats?.lowStockCount ?? "-", icon: AlertTriangle, color: "bg-red-100 text-red-600", textColor: "text-red-700" },
                { label: "Expiring Soon", value: stats?.expiringSoonCount ?? "-", icon: Clock, color: "bg-amber-100 text-amber-600", textColor: "text-amber-700" },
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

            {/* Expired medicines alert */}
            {medicines.filter(m => m.expiryDate && m.expiryDate < today).length > 0 && (
              <div className="bg-red-100 border border-red-300 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <AlertOctagon className="w-4 h-4 text-red-600" />
                    <p className="font-bold text-red-900 text-sm">
                      {medicines.filter(m => m.expiryDate && m.expiryDate < today).length} Medicine(s) EXPIRED: Remove from shelf immediately
                    </p>
                  </div>
                  <button onClick={() => setTab("alerts")} className="text-xs text-red-700 font-semibold hover:text-red-900 flex items-center gap-1">
                    View <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {medicines.filter(m => m.expiryDate && m.expiryDate < today).slice(0, 3).map(m => (
                    <span key={m.id} className="text-xs bg-white border border-red-200 text-red-700 font-semibold px-2 py-1 rounded-lg">{m.name}</span>
                  ))}
                  {medicines.filter(m => m.expiryDate && m.expiryDate < today).length > 3 && (
                    <span className="text-xs text-red-500">+{medicines.filter(m => m.expiryDate && m.expiryDate < today).length - 3} more</span>
                  )}
                </div>
              </div>
            )}

            {/* Low stock alert */}
            {(stats?.lowStockCount ?? 0) > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    <p className="font-semibold text-red-800 text-sm">Low Stock ({stats?.lowStockCount})</p>
                  </div>
                  <button onClick={() => setTab("alerts")}
                    className="text-xs text-red-700 hover:text-red-900 font-medium flex items-center gap-1">
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
                  {medicines
                    .filter(m => m.expiryDate && m.expiryDate <= new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0] && m.expiryDate >= today)
                    .slice(0, 5)
                    .map(m => (
                      <div key={m.id} className="flex items-center justify-between bg-white rounded-xl px-3 py-2.5 border border-amber-100">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{m.name}</p>
                          <p className="text-xs text-slate-400">{m.stockQty} {m.unit}s in stock</p>
                        </div>
                        <p className="text-sm font-bold text-amber-700">
                          Exp: {m.expiryDate ? format(new Date(m.expiryDate), "dd MMM yyyy") : "-"}
                        </p>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Recent bills */}
            <div className="bg-white rounded-2xl border border-slate-100 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-800">Recent Bills</h3>
                <button onClick={() => setTab("bills")}
                  className="text-xs text-violet-700 hover:text-violet-900 font-medium flex items-center gap-1">
                  View all <ChevronRight className="w-3 h-3" />
                </button>
              </div>
              {bills.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">No bills yet</p>
              ) : (
                <div className="space-y-2">
                  {bills.slice(0, 5).map(b => (
                    <div key={b.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-50">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{b.patientName || "Walk-in"}</p>
                        <p className="text-xs text-slate-400">
                          #{b.id} · {format(new Date(b.createdAt), "dd MMM, h:mm a")} · {(b.items as any[]).length} item{(b.items as any[]).length !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-violet-700">₹{rupees(b.totalAmount)}</p>
                        <p className="text-xs capitalize text-slate-400">{b.paymentMethod || "cash"}</p>
                      </div>
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
              <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
                <ArrowUpDown className="w-3 h-3 text-slate-400 ml-1" />
                {(["name", "expiry", "stock"] as const).map(s => (
                  <button key={s} onClick={() => setInventorySortBy(s)}
                    className={cn("px-2.5 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all",
                      inventorySortBy === s ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}
                  >{s === "expiry" ? "FEFO" : s === "stock" ? "Stock" : "A–Z"}</button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[750px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-xs text-slate-500 uppercase tracking-wide">
                      <th className="px-4 py-3 text-left font-semibold">Medicine</th>
                      <th className="px-4 py-3 text-left font-semibold">Category</th>
                      <th className="px-4 py-3 text-right font-semibold">Stock</th>
                      <th className="px-4 py-3 text-right font-semibold">Days Left</th>
                      <th className="px-4 py-3 text-right font-semibold">MRP</th>
                      <th className="px-4 py-3 text-left font-semibold">Batch / Expiry</th>
                      <th className="px-4 py-3 text-left font-semibold">Supplier</th>
                      <th className="px-4 py-3 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredMedicines.length === 0 ? (
                      <tr><td colSpan={8} className="text-center text-slate-400 py-12">No medicines found</td></tr>
                    ) : filteredMedicines.map(m => {
                      const isLow = m.stockQty <= m.minStockQty;
                      const isExpiring = m.expiryDate && m.expiryDate <= new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0] && m.expiryDate >= today;
                      const isExpired = m.expiryDate && m.expiryDate < today;
                      const cons = consumptionMap.get(m.id);
                      const daysLeft = cons && cons.dailyRate > 0 ? Math.floor(m.stockQty / cons.dailyRate) : null;
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
                          <td className="px-4 py-3 text-right">
                            {daysLeft !== null ? (
                              <span className={cn("font-semibold text-xs", daysLeft <= 7 ? "text-red-600" : daysLeft <= 14 ? "text-amber-600" : "text-slate-600")}>
                                ~{daysLeft}d
                              </span>
                            ) : <span className="text-slate-300 text-xs">—</span>}
                            {cons && <p className="text-[10px] text-slate-400">{cons.dailyRate}/day</p>}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">₹{rupees(m.sellingPrice)}</td>
                          <td className="px-4 py-3">
                            {m.batchNo && <p className="text-xs text-slate-400 mb-0.5">Batch: {m.batchNo}</p>}
                            {m.expiryDate ? (
                              <span className={cn("text-xs font-semibold", isExpired ? "text-red-600" : isExpiring ? "text-amber-600" : "text-slate-500")}>
                                {format(new Date(m.expiryDate), "MMM yyyy")}
                                {isExpired && <span className="ml-1 bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full text-[10px] font-bold">EXPIRED</span>}
                                {!isExpired && isExpiring && <span className="ml-1 bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full text-[10px] font-bold">Soon</span>}
                              </span>
                            ) : <span className="text-slate-300 text-xs">—</span>}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">{m.supplierName || <span className="text-slate-300">-</span>}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => setMedicineDialog({ open: true, prefill: m })}
                                title="Add stock"
                                className="w-8 h-8 rounded-lg text-slate-400 hover:text-green-600 hover:bg-green-50 flex items-center justify-center transition-colors"
                              >
                                <PackagePlus className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setMedicineDialog({ open: true, medicine: m })}
                                className="w-8 h-8 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 flex items-center justify-center transition-colors"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <button
                                    className="w-8 h-8 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="rounded-2xl">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Remove from inventory?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will permanently delete <span className="font-semibold text-slate-800">{m.name}</span> from the inventory. This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteMedicine.mutate(m.id)}
                                      className="rounded-xl bg-red-600 hover:bg-red-700"
                                    >Delete</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
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

        {/* ── ALERTS ── */}
        {tab === "alerts" && (
          <AlertsTab
            medicines={medicines}
            today={today}
            onRestock={m => setMedicineDialog({ open: true, prefill: m })}
            onDelete={id => deleteMedicine.mutate(id)}
            onGoToInventory={() => setTab("inventory")}
          />
        )}

        {/* ── REORDER ── */}
        {tab === "reorder" && (
          <ReorderTab
            medicines={medicines}
            today={today}
            settings={settings}
            onRestock={m => setMedicineDialog({ open: true, prefill: m })}
          />
        )}

        {/* ── BILLING ── */}
        {tab === "billing" && <BillingTab medicines={medicines} settings={settings} />}

        {/* ── BILLS HISTORY ── */}
        {tab === "bills" && (
          <div className="space-y-4">
            {/* Search + filters */}
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search by patient name, phone, bill #…"
                  value={billSearch}
                  onChange={e => setBillSearch(e.target.value)}
                  className="pl-9 rounded-xl h-10"
                />
              </div>
              <div className="flex rounded-xl overflow-hidden border border-slate-200">
                {(["all", "today", "week", "month"] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setBillDateFilter(f)}
                    className={cn("px-3 py-2 text-xs font-semibold transition-colors",
                      billDateFilter === f ? "bg-violet-600 text-white" : "text-slate-500 hover:bg-slate-50")}
                  >
                    {f === "all" ? "All" : f === "today" ? "Today" : f === "week" ? "7 days" : "Month"}
                  </button>
                ))}
              </div>
              {/* GST Export */}
              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 h-10">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <input type="month" value={gstMonth} onChange={e => setGstMonth(e.target.value)}
                  className="text-xs text-slate-600 bg-transparent outline-none" />
                <button onClick={downloadGstExport}
                  className="flex items-center gap-1 text-xs font-semibold text-violet-700 hover:text-violet-900 transition-colors ml-1">
                  <Download className="w-3.5 h-3.5" /> GST
                </button>
              </div>
            </div>

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
                      <th className="px-4 py-3 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredBills.length === 0 ? (
                      <tr><td colSpan={7} className="text-center text-slate-400 py-12">
                        {billSearch || billDateFilter !== "all" ? "No bills match your filter" : "No bills yet"}
                      </td></tr>
                    ) : filteredBills.map(b => (
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
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setReturnBillFromHistory(b)}
                              title="Process return"
                              className="w-8 h-8 rounded-lg text-slate-400 hover:text-orange-600 hover:bg-orange-50 flex items-center justify-center transition-colors"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                const w = window.open("", "_blank");
                                if (w) { w.document.write(buildBillHtml(b, settings?.clinicProfile)); w.document.close(); }
                              }}
                              className="w-8 h-8 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 flex items-center justify-center transition-colors"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredBills.length > 0 && (
                <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
                  <p className="text-xs text-slate-400">{filteredBills.length} bill{filteredBills.length !== 1 ? "s" : ""}</p>
                  <p className="text-xs font-semibold text-slate-600">
                    Total: ₹{rupees(filteredBills.reduce((s, b) => s + b.totalAmount, 0))}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── RETURNS ── */}
        {tab === "returns" && <ReturnsTab bills={bills} settings={settings} />}

        {/* ── WASTAGE ── */}
        {tab === "wastage" && <WastageTab medicines={medicines} />}

        {/* ── SUPPLIERS ── */}
        {tab === "suppliers" && <SuppliersTab />}

        {/* ── CLOSING ── */}
        {tab === "closing" && <ClosingTab />}
      </div>

      <MedicineDialog
        open={medicineDialog.open}
        onClose={() => setMedicineDialog({ open: false })}
        medicine={medicineDialog.medicine}
        prefill={medicineDialog.prefill}
      />

      <ReturnDialog
        bill={returnBillFromHistory}
        open={!!returnBillFromHistory}
        onClose={() => setReturnBillFromHistory(null)}
      />
    </>
  );
}
