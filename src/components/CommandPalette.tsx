"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Plus, Search, User } from "lucide-react";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";
import { NAV, OPEN_PALETTE } from "./nav";

interface Item { id: string; label: string; hint: string; href: string; group: "Go to" | "Invoices" | "Clients"; icon: any }

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [records, setRecords] = useState<Item[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_PALETTE, onOpen);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener(OPEN_PALETTE, onOpen); };
  }, []);

  useEffect(() => {
    if (!open) return;
    setQ(""); setActive(0);
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const [inv, cl] = await Promise.all([
        supabase.from("invoices").select("id,number,property_address,client_id").order("created_at", { ascending: false }).limit(500),
        supabase.from("clients").select("id,name").order("name").limit(500),
      ]);
      if (cancelled) return;
      const clients: { id: string; name: string }[] = cl.data ?? [];
      const nameOf = new Map<string, string>(clients.map((c) => [c.id, c.name]));
      setRecords([
        ...((inv.data ?? []) as any[]).map((i): Item => ({
          id: `i-${i.id}`, label: i.number, hint: [nameOf.get(i.client_id), i.property_address].filter(Boolean).join(", "),
          href: `/invoices/${i.id}`, group: "Invoices", icon: FileText,
        })),
        ...clients.map((c): Item => ({ id: `c-${c.id}`, label: c.name, hint: "Client", href: `/clients/${c.id}`, group: "Clients", icon: User })),
      ]);
    })();
    return () => { cancelled = true; window.clearTimeout(t); };
  }, [open]);

  const items = useMemo(() => {
    const base: Item[] = [
      { id: "new", label: "New invoice", hint: "", href: "/invoices/new", group: "Go to", icon: Plus },
      ...NAV.map((n): Item => ({ id: n.href, label: n.label, hint: "", href: n.href, group: "Go to", icon: n.icon })),
    ];
    const term = q.trim().toLowerCase();
    const match = (i: Item) => !term || `${i.label} ${i.hint}`.toLowerCase().includes(term);
    const found = (records ?? []).filter(match);
    return [...base.filter(match), ...(term ? found.slice(0, 12) : found.filter((i) => i.group === "Invoices").slice(0, 5))];
  }, [q, records]);

  useEffect(() => { setActive(0); }, [q]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function go(item: Item | undefined) {
    if (!item) return;
    setOpen(false);
    router.push(item.href);
  }

  if (!open) return null;
  let lastGroup = "";

  return (
    <div className="no-print fixed inset-0 z-50 flex items-start justify-center bg-ink-900/40 px-4 pt-[14vh]" onMouseDown={() => setOpen(false)}>
      <div role="dialog" aria-modal="true" aria-label="Search" onMouseDown={(e) => e.stopPropagation()}
        className="pop-in w-full max-w-lg overflow-hidden rounded-xl border border-ink-200 bg-white shadow-pop">
        <div className="flex items-center gap-3 border-b border-ink-200 px-4">
          <Search size={17} className="text-ink-400" />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find an invoice, client or page"
            className="w-full bg-transparent py-3.5 text-[15px] outline-none placeholder:text-ink-400"
            role="combobox" aria-expanded="true" aria-controls="palette-list" aria-activedescendant={items[active] ? `opt-${items[active].id}` : undefined}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
              else if (e.key === "Enter") { e.preventDefault(); go(items[active]); }
              else if (e.key === "Escape") setOpen(false);
            }} />
          <kbd className="rounded border border-ink-200 bg-ink-50 px-1.5 text-[11px] text-ink-500">Esc</kbd>
        </div>
        <div ref={listRef} id="palette-list" role="listbox" className="max-h-80 overflow-y-auto p-2">
          {items.length === 0 && <p className="px-3 py-6 text-center text-sm text-ink-500">Nothing matches "{q}".</p>}
          {items.map((it, idx) => {
            const header = it.group !== lastGroup ? it.group : null;
            lastGroup = it.group;
            return (
              <div key={it.id}>
                {header && <p className="px-3 pb-1 pt-2 text-xs font-medium text-ink-400">{header}</p>}
                <button id={`opt-${it.id}`} role="option" aria-selected={idx === active} data-idx={idx}
                  onMouseEnter={() => setActive(idx)} onClick={() => go(it)}
                  className={clsx("flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm", idx === active ? "bg-brand-50 text-brand-900" : "text-ink-800")}>
                  <it.icon size={16} className="shrink-0 text-ink-400" />
                  <span className="font-medium">{it.label}</span>
                  {it.hint && <span className="truncate text-ink-500">{it.hint}</span>}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
