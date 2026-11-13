"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, Plus, Trash2, X } from "lucide-react";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";
import { computeTotals } from "@/lib/calc";
import { formatInvoiceNumber, money } from "@/lib/format";
import { DEFAULT_ACCENT, type Service, type Settings } from "@/lib/types";
import NumInput from "./NumInput";
import { useToast } from "./Toast";

const CURRENCIES = ["FJD", "NZD", "AUD", "USD", "GBP", "EUR", "WST", "TOP", "VUV", "SBD", "PGK"];
// Colours for the rules on the invoice. The first is the gold used in the template.
const ACCENTS = ["#B08A2E", "#0F535B", "#16211F", "#1F3A68", "#5B2A4E", "#7A3B12"];

async function shrinkImage(file: File, maxSide = 480): Promise<string> {
  const src = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(new Error("The image could not be read."));
    r.readAsDataURL(file);
  });
  if (file.type === "image/svg+xml") return src;
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("That file is not an image this browser can open."));
    i.src = src;
  });
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

export default function SettingsForm({ initial, services: initialServices }: { initial: Settings; services: Service[] }) {
  const router = useRouter();
  const toast = useToast();
  const [s, setS] = useState(initial);
  const [services, setServices] = useState(initialServices);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => { setS((p) => ({ ...p, [k]: v })); setDirty(true); };
  const editService = (id: string, patch: Partial<Service>) => { setServices((a) => a.map((x) => (x.id === id ? { ...x, ...patch } : x))); setDirty(true); };

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const sample = computeTotals([{ quantity: 1, unit_price: 1000, taxable: true }], {
    taxRate: s.tax_rate, taxInclusive: s.prices_include_tax, discountType: "percent", discountValue: 0,
  });
  const accentOk = /^#[0-9a-fA-F]{6}$/.test(s.accent_color);

  async function onLogo(file: File | undefined) {
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { toast("err", "Choose an image under 3 MB."); return; }
    try { set("logo_data", await shrinkImage(file)); } catch (e: any) { toast("err", e.message); }
  }

  async function save() {
    if (!s.company_name.trim()) { toast("err", "Enter your company name."); return; }
    if (s.tax_rate < 0 || s.tax_rate > 100) { toast("err", "The tax rate must be between 0 and 100."); return; }
    if (!accentOk) { toast("err", "Choose a valid brand colour."); return; }
    if (s.invoice_prefix.length > 12) { toast("err", "Keep the invoice prefix to 12 characters or fewer."); return; }
    setBusy(true);
    const supabase = createClient();
    const { id, ...rest } = s;
    const { error } = await supabase.from("settings").update({ ...rest, updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) { toast("err", error.message); setBusy(false); return; }

    const next: Service[] = [];
    for (const sv of services) {
      const payload = { name: sv.name.trim(), unit_price: sv.unit_price, taxable: sv.taxable };
      if (!payload.name) continue;
      if (sv.id.startsWith("new-")) {
        const { data, error } = await supabase.from("services").insert(payload).select().single();
        if (error) { toast("err", error.message); setBusy(false); return; }
        next.push({ ...data, unit_price: Number(data.unit_price) } as Service);
      } else {
        const { error } = await supabase.from("services").update(payload).eq("id", sv.id);
        if (error) { toast("err", error.message); setBusy(false); return; }
        next.push(sv);
      }
    }
    setServices(next);
    setBusy(false);
    setDirty(false);
    toast("ok", "Settings saved. New invoices will use them.");
    router.refresh();
  }

  async function removeService(sv: Service) {
    if (!sv.id.startsWith("new-")) {
      const { error } = await createClient().from("services").delete().eq("id", sv.id);
      if (error) { toast("err", error.message); return; }
    }
    setServices((a) => a.filter((x) => x.id !== sv.id));
  }

  const text = (label: string, k: keyof Settings, ph = "") => (
    <div><label className="label" htmlFor={`s-${String(k)}`}>{label}</label><input id={`s-${String(k)}`} className="input" placeholder={ph} value={String(s[k] ?? "")} onChange={(e) => set(k, e.target.value as never)} /></div>
  );

  return (
    <div className="space-y-6 pb-16">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="mt-1 text-sm text-ink-500">Defaults for every new invoice. Invoices you have already made keep their own values.</p>
        </div>
      </header>

      <Section title="Tax" text="Totals, tax and balances are worked out from these values. You can still change the rate on a single invoice.">
        <div className="grid gap-4 sm:grid-cols-3">
          {text("Tax name", "tax_label", "GST")}
          <div><label className="label" htmlFor="s-rate">Rate %</label><NumInput id="s-rate" className="input num" value={s.tax_rate} onChange={(n) => set("tax_rate", n)} /></div>
          <div>
            <label className="label" htmlFor="s-cur">Currency</label>
            <select id="s-cur" className="input" value={s.currency} onChange={(e) => set("currency", e.target.value)}>
              {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-4 grid gap-1 rounded-lg bg-ink-100 p-1 text-sm font-medium sm:inline-grid sm:grid-cols-2" role="group" aria-label="How prices are entered">
          {[{ v: false, l: `Add ${s.tax_label} on top of prices` }, { v: true, l: `Prices already include ${s.tax_label}` }].map((o) => (
            <button key={String(o.v)} onClick={() => set("prices_include_tax", o.v)} aria-pressed={s.prices_include_tax === o.v}
              className={clsx("rounded-md px-3 py-1.5 transition-colors", s.prices_include_tax === o.v ? "bg-white shadow-sm" : "text-ink-500")}>{o.l}</button>
          ))}
        </div>
        <p className="num mt-4 text-sm text-ink-600">
          A line priced at {money(1000, s.currency)} comes to {money(sample.subtotal, s.currency)} plus {money(sample.tax, s.currency)} {s.tax_label}, so <b className="text-ink-900">{money(sample.total, s.currency)}</b> in total.
        </p>
      </Section>

      <Section title="Your company" text="Printed at the top of every invoice.">
        <div className="grid gap-4 sm:grid-cols-2">
          {text("Company name", "company_name")}
          {text("Legal or trading line", "company_legal_line", "Example: ABC PTY LTD trading as Your Company")}
          {text("Tax number label", "tax_number_label", "ABN")}
          {text("Tax number", "company_tax_number", "Example: 32 621 662 397")}
          {text("Licence line", "company_licence", "Example: RLA 353 444")}
          <div className="hidden sm:block" />
          {text("Email", "company_email")}
          {text("Phone", "company_phone")}
          <div className="sm:col-span-2"><label className="label" htmlFor="s-addr">Address</label><textarea id="s-addr" className="input" rows={3} value={s.company_address} onChange={(e) => set("company_address", e.target.value)} /></div>
          {text("Payment heading", "payment_method_title", "By Direct Debit / Bank Transfer")}
          <div className="hidden sm:block" />
          <div className="sm:col-span-2"><label className="label" htmlFor="s-bank">Payment details</label><textarea id="s-bank" className="input" rows={4} placeholder={"Account name: \nBSB: \nAccount number: "} value={s.bank_details} onChange={(e) => set("bank_details", e.target.value)} /></div>
        </div>
      </Section>

      <Section title="Branding" text="Your logo and the colour of the rules on the invoice.">
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <p className="label">Logo</p>
            <div className="flex items-center gap-4">
              <div className="grid h-20 w-36 place-items-center rounded-lg border border-dashed border-ink-300 bg-ink-50 p-2">
                {s.logo_data ? <img src={s.logo_data} alt="Current logo" className="max-h-full max-w-full object-contain" /> : <span className="text-[13px] text-ink-400">No logo</span>}
              </div>
              <div className="flex flex-col gap-2">
                <label className="btn-ghost cursor-pointer"><ImagePlus size={15} /> {s.logo_data ? "Replace" : "Upload"}
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" onChange={(e) => { onLogo(e.target.files?.[0]); e.target.value = ""; }} />
                </label>
                {s.logo_data && <button className="btn-quiet" onClick={() => set("logo_data", "")}><X size={15} /> Remove</button>}
              </div>
            </div>
          </div>
          <div>
            <p className="label">Brand colour</p>
            <div className="flex flex-wrap items-center gap-2">
              {ACCENTS.map((c) => (
                <button key={c} onClick={() => set("accent_color", c)} aria-label={`Use colour ${c}`} aria-pressed={s.accent_color.toLowerCase() === c.toLowerCase()}
                  className={clsx("h-8 w-8 rounded-full ring-offset-2 transition", s.accent_color.toLowerCase() === c.toLowerCase() ? "ring-2 ring-ink-900" : "hover:ring-2 hover:ring-ink-300")}
                  style={{ background: c }} />
              ))}
              <input type="color" aria-label="Custom colour" className="h-8 w-10 cursor-pointer rounded border border-ink-200 bg-white p-0.5" value={/^#[0-9a-fA-F]{6}$/.test(s.accent_color) ? s.accent_color : DEFAULT_ACCENT} onChange={(e) => set("accent_color", e.target.value)} />
            </div>
            <div className="mt-4">
              <div className="h-[2px]" style={{ background: accentOk ? s.accent_color : DEFAULT_ACCENT }} />
              <p className="mt-2 text-sm font-bold">How to pay</p>
              <div className="mt-2 h-[2px]" style={{ background: accentOk ? s.accent_color : DEFAULT_ACCENT }} />
              <p className="mt-1.5 text-[13px] text-ink-500">Rules on the invoice use this colour.</p>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Numbering and terms">
        <div className="grid gap-4 sm:grid-cols-3">
          {text("Document title", "document_title", "Tax invoice")}
          {text("Subtitle under the title", "document_subtitle", "Professional Service Invoice")}
          <label className="flex items-center gap-2 pt-7 text-sm text-ink-700"><input type="checkbox" className="h-4 w-4 accent-brand-700" checked={s.show_freight} onChange={(e) => set("show_freight", e.target.checked)} />Always show a freight row</label>
          {text("Invoice prefix", "invoice_prefix", "Leave empty for plain numbers")}
          <div><label className="label" htmlFor="s-pad">Number length</label><NumInput id="s-pad" className="input num" value={s.number_padding} onChange={(n) => set("number_padding", Math.min(Math.max(Math.floor(n) || 1, 1), 10))} /></div>
          <div><label className="label" htmlFor="s-next">Next number</label><NumInput id="s-next" className="input num" value={s.next_number} onChange={(n) => set("next_number", Math.max(1, Math.floor(n)))} /></div>
          <div><label className="label" htmlFor="s-days">Days to pay</label><NumInput id="s-days" className="input num" value={s.payment_terms_days} onChange={(n) => set("payment_terms_days", Math.max(0, Math.floor(n)))} /></div>
          <div className="sm:col-span-3"><label className="label" htmlFor="s-terms">Default terms, shown in the invoice footer</label><textarea id="s-terms" className="input" rows={2} value={s.default_terms} onChange={(e) => set("default_terms", e.target.value)} /></div>
          <div className="sm:col-span-3"><label className="label" htmlFor="s-notes">Default notes</label><textarea id="s-notes" className="input" rows={2} value={s.default_notes} onChange={(e) => set("default_notes", e.target.value)} /></div>
        </div>
        <p className="num mt-3 text-[13px] text-ink-500">The next invoice will be {formatInvoiceNumber(s.invoice_prefix, s.next_number, s.number_padding)}, due {s.payment_terms_days} day{s.payment_terms_days === 1 ? "" : "s"} after it is issued.</p>
      </Section>

      <Section title="Service list" text="Common charges you can add to an invoice in one click."
        action={<button className="btn-ghost" onClick={() => { setServices((a) => [...a, { id: `new-${Math.random().toString(36).slice(2)}`, name: "", unit_price: 0, taxable: true }]); setDirty(true); }}><Plus size={15} /> Add service</button>}>
        <div className="space-y-2">
          {services.length === 0 && <p className="text-sm text-ink-500">No services yet.</p>}
          {services.length > 0 && (
            <div className="hidden grid-cols-[1fr_9rem_5rem_2.25rem] gap-3 px-1 text-[13px] font-medium text-ink-500 sm:grid">
              <span>Name</span><span className="text-right">Price</span><span>{s.tax_label}</span><span />
            </div>
          )}
          {services.map((sv) => (
            <div key={sv.id} className="grid grid-cols-[1fr_7rem_auto_auto] items-center gap-3 sm:grid-cols-[1fr_9rem_5rem_2.25rem]">
              <input className="input" placeholder="Service name" aria-label="Service name" value={sv.name} onChange={(e) => editService(sv.id, { name: e.target.value })} />
              <NumInput className="input num text-right" aria-label="Price" value={Number(sv.unit_price)} onChange={(n) => editService(sv.id, { unit_price: n })} />
              <label className="flex items-center gap-2 text-sm text-ink-600"><input type="checkbox" className="h-4 w-4 accent-brand-700" checked={sv.taxable} onChange={(e) => editService(sv.id, { taxable: e.target.checked })} /><span className="sm:sr-only">{s.tax_label}</span></label>
              <button className="rounded p-2 text-ink-400 hover:bg-late-50 hover:text-late-600" onClick={() => removeService(sv)} aria-label={`Remove ${sv.name || "service"}`}><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      </Section>

      {/* Sticky save bar appears only when something changed */}
      <div className={clsx("fixed inset-x-0 bottom-16 z-20 transition lg:bottom-0 lg:left-60", dirty ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0")}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 border-t border-ink-200 bg-white px-6 py-3 lg:rounded-t-xl lg:border-x">
          <p className="text-sm font-medium text-brass-700">You have unsaved changes</p>
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={() => { setS(initial); setServices(initialServices); setDirty(false); }} disabled={busy}>Discard</button>
            <button className="btn-primary" onClick={save} disabled={busy}>{busy && <Loader2 size={16} className="animate-spin" />} Save settings</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, text, action, children }: { title: string; text?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="card grid gap-6 p-6 lg:grid-cols-[14rem_1fr]">
      <div>
        <h2 className="section-title">{title}</h2>
        {text && <p className="mt-1 text-[13px] leading-relaxed text-ink-500">{text}</p>}
        {action && <div className="mt-3">{action}</div>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}
