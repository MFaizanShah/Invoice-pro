"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown, ArrowUp, Ban, Calculator, CheckCircle2, ChevronLeft, Copy, Loader2, Mail, Plus, Printer, Save, Send, Trash2, UserPlus,
} from "lucide-react";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";
import { computeTotals, effectiveStatus, round2, type DiscountType, type InvoiceStatus } from "@/lib/calc";
import { addDays, fmtDate, fmtDateTime, fmtLongDate, formatInvoiceNumber, money, todayISO, uid } from "@/lib/format";
import { normalisePayment, type Client, type Invoice, type InvoiceEvent, type InvoiceItem, type Payment, type Service, type Settings } from "@/lib/types";
import StatusBadge from "./StatusBadge";
import NumInput from "./NumInput";
import AutoTextarea from "./AutoTextarea";
import { useToast } from "./Toast";

interface Props {
  settings: Settings;
  clients: Client[];
  services: Service[];
  invoice?: Invoice | null;
  items?: InvoiceItem[];
  payments?: Payment[];
  events?: InvoiceEvent[];
  presetClientId?: string | null;
}

interface Draft {
  client_id: string | null;
  status: InvoiceStatus;
  number: string;
  issue_date: string;
  due_date: string;
  reference: string;
  property_address: string;
  tax_label: string;
  tax_rate: number;
  tax_inclusive: boolean;
  discount_type: DiscountType;
  discount_value: number;
  freight_amount: number;
  freight_taxable: boolean;
  notes: string;
  terms: string;
}

// Border used by every cell of the details box, matching the template.
const CELL = "border border-[#BDBDBD]";
const METHODS = ["Bank transfer", "Cash", "Cheque", "Card", "M-PAiSA", "Other"];
const blankItem = (): InvoiceItem => ({ key: uid(), description: "", quantity: 1, unit_price: 0, taxable: true });
const snapshot = (d: Draft, items: InvoiceItem[]) =>
  JSON.stringify([d, items.map((i) => [i.description, i.quantity, i.unit_price, i.taxable])]);

export default function InvoiceEditor(props: Props) {
  const { settings, services, invoice } = props;
  const router = useRouter();
  const toast = useToast();
  const isNew = !invoice;
  const cur = settings.currency;
  const accent = settings.accent_color;

  const [clients, setClients] = useState(props.clients);
  const [items, setItems] = useState<InvoiceItem[]>(props.items?.length ? props.items : [blankItem()]);
  const [payments, setPayments] = useState<Payment[]>(props.payments ?? []);
  const [events, setEvents] = useState<InvoiceEvent[]>(props.events ?? []);
  const [draft, setDraft] = useState<Draft>(() => {
    if (invoice) {
      return {
        client_id: invoice.client_id, status: invoice.status, number: invoice.number,
        issue_date: invoice.issue_date, due_date: invoice.due_date, reference: invoice.reference,
        property_address: invoice.property_address, tax_label: invoice.tax_label, tax_rate: invoice.tax_rate,
        tax_inclusive: invoice.tax_inclusive, discount_type: invoice.discount_type, discount_value: invoice.discount_value,
        freight_amount: invoice.freight_amount, freight_taxable: invoice.freight_taxable,
        notes: invoice.notes, terms: invoice.terms,
      };
    }
    const today = todayISO();
    return {
      client_id: props.presetClientId && props.clients.some((c) => c.id === props.presetClientId) ? props.presetClientId : null,
      status: "draft", number: "", issue_date: today, due_date: addDays(today, settings.payment_terms_days),
      reference: "", property_address: "", tax_label: settings.tax_label, tax_rate: settings.tax_rate,
      tax_inclusive: settings.prices_include_tax, discount_type: "percent", discount_value: 0,
      freight_amount: 0, freight_taxable: true,
      notes: settings.default_notes ?? "", terms: settings.default_terms ?? "",
    };
  });
  const [saved, setSaved] = useState(() => snapshot(draft, items));
  const [busy, setBusy] = useState<string | null>(null);
  const [quick, setQuick] = useState<{ name: string; email: string } | null>(null);
  const [calc, setCalc] = useState<{ mode: "sale" | "rent"; base: number; rate: number } | null>(null);
  // Quantity and unit price columns only appear when some line needs them.
  const [useQty, setUseQty] = useState(() => (props.items ?? []).some((i) => i.quantity !== 1));
  const [pay, setPay] = useState({ amount: 0, paid_on: todayISO(), method: METHODS[0], reference: "" });

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const dirty = snapshot(draft, items) !== saved;
  const locked = draft.status === "void";

  const totals = useMemo(
    () => computeTotals(items, {
      taxRate: draft.tax_rate, taxInclusive: draft.tax_inclusive,
      discountType: draft.discount_type, discountValue: draft.discount_value,
      freight: draft.freight_amount, freightTaxable: draft.freight_taxable,
    }),
    [items, draft.tax_rate, draft.tax_inclusive, draft.discount_type, draft.discount_value, draft.freight_amount, draft.freight_taxable]
  );
  const paid = round2(payments.reduce((a, p) => a + p.amount, 0));
  const balance = round2(totals.total - paid);
  const status = effectiveStatus({ status: draft.status, due_date: draft.due_date, total: totals.total, amount_paid: paid });
  const client = clients.find((c) => c.id === draft.client_id) ?? null;

  // ───────── line items ─────────
  const updateItem = (key: string, patch: Partial<InvoiceItem>) =>
    setItems((arr) => arr.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  const removeItem = (key: string) => setItems((arr) => (arr.length > 1 ? arr.filter((i) => i.key !== key) : [blankItem()]));
  const moveItem = (idx: number, by: -1 | 1) =>
    setItems((arr) => {
      const to = idx + by;
      if (to < 0 || to >= arr.length) return arr;
      const next = [...arr];
      [next[idx], next[to]] = [next[to], next[idx]];
      return next;
    });
  function toggleQty(on: boolean) {
    if (on) { setUseQty(true); return; }
    if (items.some((i) => i.quantity !== 1)) {
      if (!window.confirm("Some lines have a quantity other than 1. Turning this off sets every quantity to 1 and keeps each unit price as the line amount. Continue?")) return;
      setItems((arr) => arr.map((i) => ({ ...i, unit_price: round2(i.quantity * i.unit_price), quantity: 1 })));
    }
    setUseQty(false);
  }
  const appendItem = (row: InvoiceItem) =>
    setItems((arr) => (arr.length === 1 && !arr[0].description && !arr[0].unit_price ? [row] : [...arr, row]));

  function setIssue(v: string) {
    setDraft((d) => {
      const wasAuto = d.due_date === addDays(d.issue_date, settings.payment_terms_days);
      return { ...d, issue_date: v, due_date: wasAuto && v ? addDays(v, settings.payment_terms_days) : d.due_date };
    });
  }

  function addService(id: string) {
    const s = services.find((x) => x.id === id);
    if (s) appendItem({ key: uid(), description: s.name, quantity: 1, unit_price: Number(s.unit_price), taxable: s.taxable });
  }

  function addCalcLine() {
    if (!calc || calc.base <= 0 || calc.rate <= 0) return;
    const fee = round2((calc.base * calc.rate) / 100);
    const where = draft.property_address.trim() ? `, ${draft.property_address.trim()}` : "";
    const description = calc.mode === "sale"
      ? `Sales commission${where}\n${calc.rate}% of ${money(calc.base, cur)} sale price`
      : `Property management fee${where}\n${calc.rate}% of ${money(calc.base, cur)} rent collected`;
    appendItem({ key: uid(), description, quantity: 1, unit_price: fee, taxable: true });
    setCalc(null);
  }

  async function addQuickClient() {
    if (!quick?.name.trim()) return;
    const { data, error } = await createClient().from("clients").insert({ name: quick.name.trim(), email: quick.email.trim() }).select().single();
    if (error || !data) { toast("err", error?.message ?? "The client could not be added."); return; }
    setClients((c) => [...c, data as Client].sort((a, b) => a.name.localeCompare(b.name)));
    set("client_id", data.id);
    setQuick(null);
  }

  // ───────── persistence ─────────
  function validate(next: Draft): string | null {
    const sending = next.status !== "draft" && next.status !== "void";
    if (!next.issue_date || !next.due_date) return "Set both the issue date and the due date.";
    if (sending && !items.some((i) => i.description.trim())) return "Add at least one line with a description before sending.";
    if (sending && !next.client_id) return "Choose a client before sending.";
    if (next.due_date < next.issue_date) return "The due date is before the issue date.";
    if (next.tax_rate < 0 || next.tax_rate > 100) return "The tax rate must be between 0 and 100.";
    if (next.discount_type === "percent" && next.discount_value > 100) return "A percent discount cannot be more than 100.";
    if (!isNew && !next.number.trim()) return "The invoice number cannot be empty.";
    return null;
  }

  const buildPayload = (next: Draft) => {
    const t = computeTotals(items, {
      taxRate: next.tax_rate, taxInclusive: next.tax_inclusive, discountType: next.discount_type, discountValue: next.discount_value,
      freight: next.freight_amount, freightTaxable: next.freight_taxable,
    });
    return {
      p_invoice: {
        ...next, number: next.number.trim(), client_id: next.client_id ?? "",
        subtotal: t.subtotal, discount_total: t.discount, tax_total: t.tax, total: t.total,
      },
      p_items: items
        .filter((i) => i.description.trim() || i.unit_price)
        .map((i) => ({ description: i.description.trim(), quantity: i.quantity, unit_price: i.unit_price, taxable: i.taxable })),
    };
  };

  const loadEvents = useCallback(async (id: string) => {
    const { data } = await createClient().from("invoice_events").select("id,kind,detail,created_at")
      .eq("invoice_id", id).order("created_at", { ascending: false }).limit(12);
    if (data) setEvents(data as InvoiceEvent[]);
  }, []);

  async function save(patch: Partial<Draft> = {}, action = "save", successText = "Invoice saved"): Promise<boolean> {
    if (busy) return false;
    const next = { ...draft, ...patch };
    const problem = validate(next);
    if (problem) { toast("err", problem); return false; }

    setBusy(action);
    const { data: id, error } = await createClient().rpc("save_invoice", { p_id: invoice?.id ?? null, ...buildPayload(next) });
    if (error || !id) {
      setBusy(null);
      toast("err", error?.code === "23505" ? `Invoice number ${next.number.trim()} is already in use. Choose another.` : error?.message ?? "The invoice could not be saved.");
      return false;
    }
    setDraft(next);
    setSaved(snapshot(next, items));
    if (isNew) {
      toast("ok", next.status === "sent" ? "Invoice created and marked as sent" : "Draft created");
      router.replace(`/invoices/${id}`);
      router.refresh();
      return true; // stay busy until the new page takes over
    }
    setBusy(null);
    toast("ok", successText);
    loadEvents(invoice!.id);
    router.refresh();
    return true;
  }

  // What the Save button and Ctrl S do. Explains itself instead of doing nothing.
  async function onSaveClick() {
    const pendingPayment = !isNew && pay.amount > 0;
    if (!dirty && !isNew) {
      toast(pendingPayment ? "err" : "ok", pendingPayment
        ? `Your invoice is saved, but the payment of ${money(pay.amount, cur)} is not recorded yet. Click Record payment to add it.`
        : "Everything is already saved.");
      return;
    }
    const ok = await save();
    if (ok && pendingPayment) {
      toast("err", `Invoice saved. The payment of ${money(pay.amount, cur)} is not recorded yet. Click Record payment to add it.`);
    }
  }

  // Keep a ref so the keyboard shortcut always calls the latest handler.
  const saveRef = useRef(onSaveClick);
  saveRef.current = onSaveClick;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); saveRef.current(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!dirty || busy) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, busy]);

  // ───────── payments ─────────
  async function recordPayment() {
    if (!invoice || pay.amount <= 0 || !pay.paid_on) return;
    if (dirty && !(await save({}, "pay", "Changes saved"))) return;
    setBusy("pay");
    const { data, error } = await createClient().from("payments")
      .insert({ invoice_id: invoice.id, amount: round2(pay.amount), paid_on: pay.paid_on, method: pay.method, reference: pay.reference.trim() })
      .select().single();
    setBusy(null);
    if (error || !data) { toast("err", error?.message ?? "The payment could not be recorded."); return; }
    setPayments((p) => [...p, normalisePayment(data)].sort((a, b) => a.paid_on.localeCompare(b.paid_on)));
    if (draft.status === "draft") {
      const next = { ...draft, status: "sent" as InvoiceStatus };
      setDraft(next);
      setSaved(snapshot(next, items));
    }
    setPay((p) => ({ ...p, amount: 0, reference: "" }));
    toast("ok", `Payment of ${money(round2(pay.amount), cur)} recorded`);
    loadEvents(invoice.id);
    router.refresh();
  }

  async function removePayment(p: Payment) {
    if (!invoice || !window.confirm(`Remove the payment of ${money(p.amount, cur)} from ${fmtDate(p.paid_on)}?`)) return;
    const { error } = await createClient().from("payments").delete().eq("id", p.id);
    if (error) { toast("err", error.message); return; }
    setPayments((list) => list.filter((x) => x.id !== p.id));
    toast("ok", "Payment removed");
    loadEvents(invoice.id);
    router.refresh();
  }

  // ───────── other actions ─────────
  async function duplicate() {
    if (!invoice || busy) return;
    setBusy("dup");
    const today = todayISO();
    const { data: id, error } = await createClient().rpc("save_invoice", {
      p_id: null,
      ...buildPayload({ ...draft, status: "draft", number: "", issue_date: today, due_date: addDays(today, settings.payment_terms_days) }),
    });
    if (error || !id) { setBusy(null); toast("err", error?.message ?? "The invoice could not be duplicated."); return; }
    toast("ok", "Copy created as a draft");
    router.push(`/invoices/${id}`);
    router.refresh();
  }

  async function remove() {
    if (!invoice) return;
    const warning = payments.length ? ` Its ${payments.length} recorded payment${payments.length === 1 ? "" : "s"} will be deleted too.` : "";
    if (!window.confirm(`Delete invoice ${draft.number}?${warning} This cannot be undone.`)) return;
    setBusy("del");
    const { error } = await createClient().from("invoices").delete().eq("id", invoice.id);
    if (error) { toast("err", error.message); setBusy(null); return; }
    setSaved(snapshot(draft, items));
    toast("ok", `Invoice ${draft.number} deleted`);
    router.replace("/invoices");
    router.refresh();
  }

  const mailto = client?.email
    ? `mailto:${encodeURIComponent(client.email)}?subject=${encodeURIComponent(`Invoice ${draft.number} from ${settings.company_name}`)}&body=${encodeURIComponent(
        `Hello ${client.name},\n\nInvoice ${draft.number} for ${money(totals.total, cur)} is due on ${fmtDate(draft.due_date)}.` +
        (balance > 0 && paid > 0 ? ` The balance still to pay is ${money(balance, cur)}.` : "") +
        (draft.property_address ? `\nProperty: ${draft.property_address}` : "") +
        (settings.bank_details ? `\n\nPayment details\n${settings.bank_details}` : "") +
        `\n\nThank you,\n${settings.company_name}`)}`
    : null;

  const numberPreview = formatInvoiceNumber(settings.invoice_prefix, settings.next_number, settings.number_padding);
  const docTitle = settings.document_title.trim();
  const amountHeading = draft.tax_inclusive ? `Total (inc ${draft.tax_label})` : `Total (ex ${draft.tax_label})`;
  const showFreightRow = settings.show_freight || draft.freight_amount > 0;
  const stamp = isNew ? null
    : status === "paid" ? { text: "Paid", cls: "border-brand-600 text-brand-600" }
    : status === "void" ? { text: "Void", cls: "border-ink-400 text-ink-400" }
    : status === "overdue" ? { text: "Overdue", cls: "border-late-500 text-late-500" }
    : status === "draft" ? { text: "Draft", cls: "border-ink-300 text-ink-300" }
    : null;

  return (
    <div className="space-y-5">
      {/* ───────── Top bar ───────── */}
      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/invoices" className="mb-1 inline-flex items-center gap-1 text-[13px] font-medium text-ink-500 hover:text-ink-900"><ChevronLeft size={14} /> Invoices</Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="page-title">{isNew ? "New invoice" : draft.number}</h1>
            <StatusBadge status={isNew ? "draft" : status} />
            <span className={clsx("text-[13px]", dirty ? "font-medium text-brass-700" : "text-ink-400")} aria-live="polite">
              {dirty ? "Unsaved changes" : isNew ? "" : "All changes saved"}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!isNew && mailto && <a className="btn-ghost" href={mailto} title="Opens your email app with the invoice summary. Attach the PDF from Print."><Mail size={16} /> Email client</a>}
          {!isNew && <button className="btn-ghost" onClick={() => window.print()}><Printer size={16} /> Print or save PDF</button>}
          <button className={draft.status === "draft" ? "btn-ghost" : "btn-primary"} onClick={onSaveClick} disabled={!!busy || locked} title="Ctrl S">
            {busy === "save" ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {isNew ? "Save draft" : "Save"}
          </button>
          {draft.status === "draft" && (
            <button className="btn-primary" onClick={() => save({ status: "sent" }, "send", "Invoice marked as sent")} disabled={!!busy}>
              {busy === "send" ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Save and mark as sent
            </button>
          )}
        </div>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        {/* ───────── Paper ───────── */}
        <div className="paper-scroll overflow-x-auto pb-3">
          <article className="paper relative mx-auto min-w-[48rem] max-w-[54rem] bg-white px-14 py-12 text-ink-900 shadow-paper">
            {/* Title block */}
            <header className="flex items-start justify-between gap-8">
              <div className="min-w-0">
                {settings.logo_data
                  ? <img src={settings.logo_data} alt={settings.company_name} className="max-h-20 max-w-[22rem] object-contain object-left" />
                  : <p className="text-[1.9rem] font-bold leading-none tracking-tight">{settings.company_name}</p>}
              </div>
              <div className="shrink-0 text-right">
                {docTitle && <p className="text-[1.9rem] font-bold uppercase leading-none tracking-tight">{docTitle}</p>}
                {settings.document_subtitle && <p className="mt-2 text-[13px] text-ink-500">{settings.document_subtitle}</p>}
              </div>
            </header>
            <div className="mt-5 h-[2px]" style={{ background: accent }} />

            {/* Company details */}
            <div className="mt-4 text-[13px] leading-[1.55] text-ink-500">
              <p className="font-bold text-ink-900">{settings.company_name}</p>
              {settings.company_legal_line && <p>{settings.company_legal_line}</p>}
              {settings.company_tax_number && <p>{settings.tax_number_label} {settings.company_tax_number}</p>}
              {settings.company_address && <p className="whitespace-pre-line">{settings.company_address}</p>}
              {settings.company_licence && <p>{settings.company_licence}</p>}
              {(settings.company_email || settings.company_phone) && <p>{[settings.company_email, settings.company_phone].filter(Boolean).join("   ")}</p>}
            </div>

            {/* Bill to and invoice details */}
            <section className="mt-4 grid grid-cols-[1fr_21rem] items-start gap-6">
              <div className="rounded-lg bg-[#F4F4F4] px-5 py-4">
                <p className="mb-2 text-[15px] font-bold">Bill To</p>
                {client ? (
                  <div className="text-sm leading-relaxed">
                    <p>{client.name}</p>
                    {client.address && <p className="whitespace-pre-line">{client.address}</p>}
                  </div>
                ) : (
                  <p className="text-sm text-ink-400 print:hidden">Choose a client in the side panel</p>
                )}
                <p className={clsx("mt-3 text-xs text-ink-500", !draft.property_address && "print:hidden")}>Property</p>
                <AutoTextarea className={clsx("paper-input -mx-2", !draft.property_address && "print:hidden")} placeholder="Property address, optional" aria-label="Property"
                  value={draft.property_address} onChange={(v) => set("property_address", v)} disabled={locked} />
              </div>

              <table className="w-full border-collapse text-[13px]">
                <tbody>
                  <MetaRow label="Invoice #">
                    {isNew
                      ? <p className="px-2 py-1 text-right">{numberPreview} <span className="text-ink-400 print:hidden">on save</span></p>
                      : <input aria-label="Invoice number" className="paper-input num text-right" value={draft.number} onChange={(e) => set("number", e.target.value)} disabled={locked} />}
                  </MetaRow>
                  <MetaRow label="Date"><input type="date" aria-label="Issue date" className="paper-input num text-right" value={draft.issue_date} onChange={(e) => setIssue(e.target.value)} disabled={locked} /></MetaRow>
                  <MetaRow label="Due Date"><input type="date" aria-label="Due date" className="paper-input num text-right" value={draft.due_date} onChange={(e) => set("due_date", e.target.value)} disabled={locked} /></MetaRow>
                  <MetaRow label="Reference" hideInPrint={!draft.reference}><input aria-label="Reference" className="paper-input text-right" placeholder="Optional" value={draft.reference} onChange={(e) => set("reference", e.target.value)} disabled={locked} /></MetaRow>
                </tbody>
              </table>
            </section>

            {/* Details */}
            <h2 className="mt-8 border-b-[1.5px] border-ink-900 pb-2 text-[15px] font-bold">Details</h2>
            <table className="mt-3 w-full border-collapse text-sm" style={{ height: "15rem" }}>
              <thead>
                <tr className="text-[13px] font-bold">
                  <th className="px-3 pb-2 text-left">Description</th>
                  {useQty && <th className="w-16 pb-2 text-right">Qty</th>}
                  {useQty && <th className="w-28 pb-2 text-right">Unit price</th>}
                  <th className="w-40 px-3 pb-2 text-right">{amountHeading}</th>
                  <th className="no-print w-[7rem] pb-2 text-center text-xs font-medium text-ink-400">{draft.tax_label}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => (
                  <tr key={it.key} className="group align-top">
                    <td className={`${CELL} p-1`}><AutoTextarea className="paper-input" placeholder="What is being charged" value={it.description} onChange={(v) => updateItem(it.key, { description: v })} disabled={locked} aria-label={`Line ${idx + 1} description`} /></td>
                    {useQty && <td className={`${CELL} p-1`}><NumInput className="paper-input num text-right" value={it.quantity} onChange={(n) => updateItem(it.key, { quantity: n })} disabled={locked} aria-label={`Line ${idx + 1} quantity`} /></td>}
                    {useQty && <td className={`${CELL} p-1`}><NumInput className="paper-input num text-right" allowNegative value={it.unit_price} display={(n) => money(n, cur)} onChange={(n) => updateItem(it.key, { unit_price: n })} disabled={locked} aria-label={`Line ${idx + 1} unit price`} /></td>}
                    <td className={`${CELL} p-1`}>
                      {useQty
                        ? <p className="num px-2 py-1 text-right">{money(totals.lines[idx] ?? 0, cur)}</p>
                        : <NumInput className="paper-input num text-right" allowNegative value={it.unit_price} display={(n) => money(n, cur)} onChange={(n) => updateItem(it.key, { unit_price: n, quantity: 1 })} disabled={locked} aria-label={`Line ${idx + 1} amount`} />}
                    </td>
                    <td className="no-print pl-2">
                      {!locked && (
                        <div className="flex items-center justify-end gap-0.5 pt-1">
                          <input type="checkbox" className="mr-1 h-4 w-4 accent-brand-700" checked={it.taxable} onChange={(e) => updateItem(it.key, { taxable: e.target.checked })} aria-label={`Line ${idx + 1} charged ${draft.tax_label}`} title={`Charge ${draft.tax_label} on this line`} />
                          <span className="flex opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                            <IconBtn label={`Move line ${idx + 1} up`} onClick={() => moveItem(idx, -1)} disabled={idx === 0}><ArrowUp size={14} /></IconBtn>
                            <IconBtn label={`Move line ${idx + 1} down`} onClick={() => moveItem(idx, 1)} disabled={idx === items.length - 1}><ArrowDown size={14} /></IconBtn>
                            <IconBtn label={`Remove line ${idx + 1}`} onClick={() => removeItem(it.key)} danger><Trash2 size={14} /></IconBtn>
                          </span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {/* This row soaks up the spare height so the box stays a fixed size like the template */}
                <tr style={{ height: "100%" }}>
                  <td className={CELL} />
                  {useQty && <td className={CELL} />}
                  {useQty && <td className={CELL} />}
                  <td className={CELL} />
                  <td className="no-print" />
                </tr>
              </tbody>
            </table>

            {!locked && (
              <div className="no-print mt-3 flex flex-wrap items-center gap-2">
                <button className="btn-ghost py-1.5" onClick={() => setItems((a) => [...a, blankItem()])}><Plus size={15} /> Add line</button>
                {services.length > 0 && (
                  <select className="input w-auto py-1.5" value="" onChange={(e) => addService(e.target.value)} aria-label="Add a line from the service list">
                    <option value="">Add from service list</option>
                    {services.map((s) => <option key={s.id} value={s.id}>{s.name}{Number(s.unit_price) ? ` (${money(Number(s.unit_price), cur)})` : ""}</option>)}
                  </select>
                )}
                <button className="btn-quiet py-1.5" onClick={() => setCalc(calc ? null : { mode: "sale", base: 0, rate: 0 })} aria-expanded={!!calc}><Calculator size={15} /> Commission calculator</button>
              </div>
            )}

            {calc && !locked && (
              <div className="no-print mt-3 rounded-lg border border-ink-200 bg-ink-50 p-4">
                <div className="mb-3 inline-grid grid-cols-2 gap-1 rounded-md bg-ink-200/70 p-1 text-[13px] font-medium">
                  {([["sale", "Sale commission"], ["rent", "Management fee"]] as const).map(([m, l]) => (
                    <button key={m} onClick={() => setCalc({ ...calc, mode: m })} className={clsx("rounded px-3 py-1", calc.mode === m ? "bg-white" : "text-ink-600")}>{l}</button>
                  ))}
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <div><label className="label" htmlFor="calc-base">{calc.mode === "sale" ? "Sale price" : "Rent collected"}</label><NumInput id="calc-base" className="input num w-40" value={calc.base} onChange={(n) => setCalc({ ...calc, base: n })} placeholder="0.00" /></div>
                  <div><label className="label" htmlFor="calc-rate">Rate %</label><NumInput id="calc-rate" className="input num w-24" value={calc.rate} onChange={(n) => setCalc({ ...calc, rate: n })} placeholder="0" /></div>
                  <p className="pb-2 text-sm text-ink-600">Fee <span className="num font-semibold text-ink-900">{money(round2((calc.base * calc.rate) / 100), cur)}</span></p>
                  <button className="btn-primary ml-auto" onClick={addCalcLine} disabled={calc.base <= 0 || calc.rate <= 0}>Add as a line</button>
                </div>
              </div>
            )}

            {/* Totals, attached under the details box */}
            <div className="mt-4 flex items-start justify-between gap-6 pr-[7rem] print:-mt-px print:pr-0">
              <div className="pl-2 pt-5">{stamp && <span className={clsx("stamp inline-block", stamp.cls)}>{stamp.text}</span>}</div>
              <table className="w-[22rem] shrink-0 border-collapse text-[13px]">
                <tbody>
                  {totals.discount > 0 && <TotalRow label="Before discount" value={money(totals.gross, cur)} />}
                  {totals.discount > 0 && <TotalRow label={`Discount${draft.discount_type === "percent" ? ` (${draft.discount_value}%)` : ""}`} value={`- ${money(totals.discount, cur)}`} />}
                  <TotalRow label={`Subtotal (ex ${draft.tax_label})`} value={money(totals.itemsSubtotal, cur)} />
                  {showFreightRow && <TotalRow label={`Freight (ex ${draft.tax_label})`} value={money(totals.freight, cur)} />}
                  <TotalRow label={`${draft.tax_label}${draft.tax_rate !== 10 ? ` (${draft.tax_rate}%)` : ""}`} value={money(totals.tax, cur)} />
                  <TotalRow label={`Total (inc ${draft.tax_label})`} value={money(totals.total, cur)} bold />
                  <TotalRow label="Paid to Date" value={money(paid, cur)} />
                  <TotalRow label={balance < 0 ? "Credit" : "Balance Due"} value={money(Math.abs(balance), cur)} bold />
                </tbody>
              </table>
            </div>

            <div className={clsx("mt-6", !draft.notes && "print:hidden")}>
              <p className="mb-1 text-xs font-bold text-ink-500">Notes</p>
              <AutoTextarea className="paper-input -mx-2 text-[13px] leading-relaxed" placeholder="Anything the client should know" aria-label="Notes" value={draft.notes} onChange={(v) => set("notes", v)} disabled={locked} />
            </div>

            {/* How to pay */}
            <div className="mt-8 h-[2px]" style={{ background: accent }} />
            <h2 className="mt-5 text-xl font-bold">How to pay</h2>
            {settings.payment_method_title && <p className="mt-4 text-[13px] font-bold">{settings.payment_method_title}</p>}
            <div className="mt-2 whitespace-pre-line text-[13px] leading-[1.7]">
              {settings.bank_details || <span className="text-ink-400 print:hidden">Add your bank details in Settings to show them here.</span>}
            </div>
            <p className="text-[13px] leading-[1.7]">Payment due: {fmtLongDate(draft.due_date)}</p>
            <p className="text-[13px] leading-[1.7]">Reference: {isNew ? numberPreview : draft.number}</p>

            {/* Footer */}
            <footer className="mt-10 flex items-end justify-between gap-6 border-t border-ink-200 pt-3 text-[11px] text-ink-500">
              <div className="w-3/5">
                <AutoTextarea className="paper-input -mx-2 text-[11px] leading-relaxed text-ink-500" placeholder="Payment terms" aria-label="Terms" value={draft.terms} onChange={(v) => set("terms", v)} disabled={locked} />
              </div>
              <div className="pb-1 text-right leading-relaxed">
                <p>{[settings.company_name, settings.company_licence].filter(Boolean).join(" | ")}</p>
                <p>Invoice {isNew ? numberPreview : draft.number}</p>
              </div>
            </footer>
          </article>
        </div>

        {/* ───────── Side panel ───────── */}
        <aside className="no-print space-y-4 xl:sticky xl:top-6">
          <Panel title="Client">
            <select className="input" aria-label="Client" value={draft.client_id ?? ""} onChange={(e) => set("client_id", e.target.value || null)} disabled={locked}>
              <option value="">Choose a client</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {quick ? (
              <div className="mt-3 space-y-2 rounded-lg bg-ink-50 p-3">
                <input className="input" placeholder="Client name" aria-label="New client name" value={quick.name} onChange={(e) => setQuick({ ...quick, name: e.target.value })} autoFocus
                  onKeyDown={(e) => e.key === "Enter" && addQuickClient()} />
                <input className="input" placeholder="Email, optional" aria-label="New client email" value={quick.email} onChange={(e) => setQuick({ ...quick, email: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && addQuickClient()} />
                <div className="flex gap-2"><button className="btn-primary flex-1" onClick={addQuickClient} disabled={!quick.name.trim()}>Add client</button><button className="btn-ghost" onClick={() => setQuick(null)}>Cancel</button></div>
              </div>
            ) : !locked && (
              <div className="mt-3 flex items-center justify-between text-sm">
                <button className="inline-flex items-center gap-1.5 font-semibold text-brand-700 hover:underline" onClick={() => setQuick({ name: "", email: "" })}><UserPlus size={15} /> Add a new client</button>
                {client && <Link href={`/clients/${client.id}`} className="text-ink-500 hover:text-ink-900 hover:underline">View client</Link>}
              </div>
            )}
          </Panel>

          <Panel title={`${draft.tax_label} and discount`}>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label" htmlFor="tax-label">Tax name</label><input id="tax-label" className="input" value={draft.tax_label} onChange={(e) => set("tax_label", e.target.value)} disabled={locked} /></div>
              <div><label className="label" htmlFor="tax-rate">Rate %</label><NumInput id="tax-rate" className="input num" value={draft.tax_rate} onChange={(n) => set("tax_rate", n)} disabled={locked} /></div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-1 rounded-lg bg-ink-100 p-1 text-[13px] font-medium" role="group" aria-label="How prices are entered">
              {[{ v: false, l: `Add ${draft.tax_label} on top` }, { v: true, l: `Prices include ${draft.tax_label}` }].map((o) => (
                <button key={String(o.v)} onClick={() => set("tax_inclusive", o.v)} disabled={locked} aria-pressed={draft.tax_inclusive === o.v}
                  className={clsx("rounded-md px-1 py-1.5 transition-colors", draft.tax_inclusive === o.v ? "bg-white text-ink-900 shadow-sm" : "text-ink-500")}>{o.l}</button>
              ))}
            </div>
            <div className="mt-3">
              <label className="label" htmlFor="discount">Discount</label>
              <div className="flex gap-2">
                <NumInput id="discount" className="input num" value={draft.discount_value} onChange={(n) => set("discount_value", n)} disabled={locked} />
                <select className="input w-24" aria-label="Discount type" value={draft.discount_type} onChange={(e) => set("discount_type", e.target.value as DiscountType)} disabled={locked}>
                  <option value="percent">%</option><option value="amount">{cur}</option>
                </select>
              </div>
            </div>
            <div className="mt-3">
              <label className="label" htmlFor="freight">Freight {draft.tax_inclusive ? `(inc ${draft.tax_label})` : `(ex ${draft.tax_label})`}</label>
              <NumInput id="freight" className="input num" value={draft.freight_amount} onChange={(n) => set("freight_amount", Math.max(n, 0))} disabled={locked} placeholder="0.00" />
              <label className="mt-2 flex items-center gap-2 text-sm text-ink-600">
                <input type="checkbox" className="h-4 w-4 accent-brand-700" checked={draft.freight_taxable} onChange={(e) => set("freight_taxable", e.target.checked)} disabled={locked} />
                Charge {draft.tax_label} on freight
              </label>
            </div>
          </Panel>

          <Panel title="Layout">
            <label className="flex items-start gap-2 text-sm text-ink-700">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand-700" checked={useQty} disabled={locked} onChange={(e) => toggleQty(e.target.checked)} />
              <span>Show quantity and unit price<span className="block text-[13px] text-ink-500">Off gives one amount per line, like a simple service invoice.</span></span>
            </label>
          </Panel>

          <Panel title="Payments">
            {isNew ? (
              <p className="text-sm text-ink-500">Save the invoice first, then record payments here.</p>
            ) : (
              <>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-ink-600">{balance < 0 ? "Overpaid by" : "Still to pay"}</span>
                  <span className={clsx("num text-lg font-semibold", balance < 0 && "text-brass-700")}>{money(Math.abs(balance), cur)}</span>
                </div>
                {payments.length > 0 && (
                  <ul className="mt-3 divide-y divide-ink-100 border-y border-ink-100 text-sm">
                    {payments.map((p) => (
                      <li key={p.id} className="group flex items-center gap-2 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="num font-medium">{money(p.amount, cur)}</p>
                          <p className="truncate text-[13px] text-ink-500">{fmtDate(p.paid_on)}, {p.method}{p.reference ? `, ${p.reference}` : ""}</p>
                        </div>
                        {!locked && <IconBtn label={`Remove payment of ${money(p.amount, cur)}`} onClick={() => removePayment(p)} danger><Trash2 size={14} /></IconBtn>}
                      </li>
                    ))}
                  </ul>
                )}
                {!locked && balance > 0 && (
                  <div className="mt-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="label" htmlFor="pay-amount">Amount</label>
                        <NumInput id="pay-amount" className="input num" value={pay.amount} onChange={(n) => setPay({ ...pay, amount: n })} placeholder="0.00" />
                      </div>
                      <div>
                        <label className="label" htmlFor="pay-date">Date received</label>
                        <input id="pay-date" type="date" className="input num" value={pay.paid_on} max={todayISO()} onChange={(e) => setPay({ ...pay, paid_on: e.target.value })} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <select className="input" aria-label="Payment method" value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>
                        {METHODS.map((m) => <option key={m}>{m}</option>)}
                      </select>
                      <input className="input" placeholder="Reference" aria-label="Payment reference" value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} />
                    </div>
                    <div className="flex gap-2">
                      <button className="btn-primary flex-1" onClick={recordPayment} disabled={!!busy || pay.amount <= 0}>
                        {busy === "pay" ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Record payment
                      </button>
                      <button className="btn-ghost" onClick={() => setPay({ ...pay, amount: balance })} title="Fill in the full balance">Full balance</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </Panel>

          {!isNew && (
            <Panel title="More actions">
              <div className="grid gap-2">
                <button className="btn-ghost justify-start" onClick={duplicate} disabled={!!busy}>{busy === "dup" ? <Loader2 size={15} className="animate-spin" /> : <Copy size={15} />} Duplicate as a new draft</button>
                {draft.status === "sent" && payments.length === 0 && <button className="btn-ghost justify-start" onClick={() => save({ status: "draft" }, "status", "Returned to draft")} disabled={!!busy}>Return to draft</button>}
                {draft.status !== "void" ? (
                  <button className="btn-ghost justify-start" disabled={!!busy} onClick={() => window.confirm("Void this invoice? It stays on file but no longer counts in any total.") && save({ status: "void" }, "status", "Invoice voided")}><Ban size={15} /> Void invoice</button>
                ) : (
                  <button className="btn-ghost justify-start" disabled={!!busy} onClick={() => save({ status: payments.length ? "sent" : "draft" }, "status", "Invoice restored")}>Restore invoice</button>
                )}
                <button className="btn-danger justify-start" onClick={remove} disabled={!!busy}><Trash2 size={15} /> Delete invoice</button>
              </div>
            </Panel>
          )}

          {!isNew && events.length > 0 && (
            <Panel title="History">
              <ol className="space-y-3 border-l border-ink-200 pl-4 text-sm">
                {events.map((e) => (
                  <li key={e.id} className="relative">
                    <span className={clsx("absolute -left-[21px] top-1.5 h-2 w-2 rounded-full ring-4 ring-white",
                      e.kind === "payment" ? "bg-brand-600" : e.kind === "payment_removed" ? "bg-late-500" : "bg-ink-300")} />
                    <p className="text-ink-800">{e.detail}</p>
                    <p className="text-[13px] text-ink-400">{fmtDateTime(e.created_at)}</p>
                  </li>
                ))}
              </ol>
            </Panel>
          )}
        </aside>
      </div>
    </div>
  );
}

function MetaRow({ label, hideInPrint, children }: { label: string; hideInPrint?: boolean; children: React.ReactNode }) {
  return (
    <tr className={hideInPrint ? "print:hidden" : undefined}>
      <th className={`${CELL} w-28 bg-[#F4F4F4] px-3 py-3 text-left font-bold`}>{label}</th>
      <td className={`${CELL} px-1`}>{children}</td>
    </tr>
  );
}
function TotalRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <tr className={bold ? "bg-[#F4F4F4] font-bold" : undefined}>
      <td className={`${CELL} px-4 py-2.5`}>{label}</td>
      <td className={`${CELL} num w-40 px-4 py-2.5 text-right`}>{value}</td>
    </tr>
  );
}
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="card p-4"><h2 className="section-title mb-3 text-base">{title}</h2>{children}</section>;
}
function IconBtn({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled}
      className={clsx("rounded p-1.5 text-ink-400 transition-colors disabled:opacity-30", danger ? "hover:bg-late-50 hover:text-late-600" : "hover:bg-ink-100 hover:text-ink-900")}>
      {children}
    </button>
  );
}
