import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Plus, Search } from "lucide-react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

export function MedicineNameAutocomplete({ value, onChange, placeholder, className, autoFocus }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [debouncedQ, setDebouncedQ] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(value), 280);
    return () => clearTimeout(t);
  }, [value]);

  const { data: suggestions = [] } = useQuery<string[]>({
    queryKey: ["/api/medicine-names", debouncedQ],
    queryFn: () =>
      fetch(`/api/medicine-names?q=${encodeURIComponent(debouncedQ)}`, { credentials: "include" })
        .then(r => r.json()),
    enabled: debouncedQ.trim().length >= 2,
    staleTime: 60000,
    placeholderData: [],
  });

  const trimmed = value.trim();
  const hasExactMatch = suggestions.some(s => s.toLowerCase() === trimmed.toLowerCase());
  const showAdd = trimmed.length >= 2 && !hasExactMatch;
  const showDropdown = open && (suggestions.length > 0 || showAdd);

  async function addToList() {
    if (!trimmed) return;
    await fetch("/api/medicine-names", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
      credentials: "include",
    });
    qc.invalidateQueries({ queryKey: ["/api/medicine-names"] });
    setOpen(false);
  }

  function pick(name: string) {
    onChange(name);
    setOpen(false);
    // move focus back to input
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  return (
    <div className="relative">
      <div className="relative">
        <Input
          ref={inputRef}
          value={value}
          onChange={e => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 160)}
          placeholder={placeholder ?? "e.g. Paracetamol 500mg"}
          className={cn("pr-8", className)}
          autoFocus={autoFocus}
        />
        <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300 pointer-events-none" />
      </div>

      {showDropdown && (
        <div className="absolute z-[60] top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-52 overflow-y-auto">
          {suggestions.map((name, i) => (
            <button
              key={i}
              onMouseDown={e => { e.preventDefault(); pick(name); }}
              className="w-full text-left px-3 py-2.5 hover:bg-violet-50 text-sm transition-colors border-b border-slate-100 last:border-0"
            >
              <HighlightMatch text={name} query={trimmed} />
            </button>
          ))}
          {showAdd && (
            <button
              onMouseDown={e => { e.preventDefault(); addToList(); }}
              className="w-full text-left px-3 py-2.5 hover:bg-green-50 text-sm text-green-700 font-semibold transition-colors flex items-center gap-2 border-t border-slate-100"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              Add "{trimmed}" to medicine list
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query) return <span>{text}</span>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <span>{text}</span>;
  return (
    <span>
      {text.slice(0, idx)}
      <span className="font-semibold text-violet-700 bg-violet-50 rounded-sm px-0.5">
        {text.slice(idx, idx + query.length)}
      </span>
      {text.slice(idx + query.length)}
    </span>
  );
}
