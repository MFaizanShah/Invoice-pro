// Pure reporting maths for the dashboard and reports. No I/O, fully unit tested.
import { effectiveStatus, round2, type InvoiceStatus } from "./calc.ts";
import { addDays, daysBetween } from "./format.ts";

export interface InvLite {
  id: string;
  client_id: string | null;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string;
  subtotal: number;
  tax_total: number;
  total: number;
  amount_paid: number;
  paid_at: string | null;
}
export interface PayLite { invoice_id: string; amount: number; paid_on: string }

export type PeriodKey = "month" | "quarter" | "year" | "12m" | "all";
export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "month", label: "This month" },
  { key: "quarter", label: "This quarter" },
  { key: "year", label: "This year" },
  { key: "12m", label: "Last 12 months" },
  { key: "all", label: "All time" },
];

export interface Range { from: string | null; to: string; prevFrom: string | null; prevTo: string | null; label: string }

const iso = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);

export function periodRange(key: PeriodKey, today: string): Range {
  const [y, m] = today.split("-").map(Number);
  const m0 = m - 1;
  switch (key) {
    case "month":
      return { from: iso(y, m0, 1), to: today, prevFrom: iso(y, m0 - 1, 1), prevTo: iso(y, m0, 0), label: "This month" };
    case "quarter": {
      const q = Math.floor(m0 / 3) * 3;
      return { from: iso(y, q, 1), to: today, prevFrom: iso(y, q - 3, 1), prevTo: iso(y, q, 0), label: "This quarter" };
    }
    case "year":
      return { from: iso(y, 0, 1), to: today, prevFrom: iso(y - 1, 0, 1), prevTo: iso(y - 1, 11, 31), label: "This year" };
    case "12m": {
      const from = iso(y, m0 - 11, 1);
      return { from, to: today, prevFrom: iso(y, m0 - 23, 1), prevTo: addDays(from, -1), label: "Last 12 months" };
    }
    default:
      return { from: null, to: today, prevFrom: null, prevTo: null, label: "All time" };
  }
}

const within = (d: string, from: string | null, to: string | null) => (!from || d >= from) && (!to || d <= to);
const sum = (xs: number[]) => round2(xs.reduce((a, b) => a + b, 0));
const billable = (i: InvLite) => i.status !== "draft" && i.status !== "void";
const balanceOf = (i: InvLite) => Math.max(round2(i.total - i.amount_paid), 0);

export interface Summary {
  billed: number; collected: number; tax: number; invoiceCount: number;
  prevBilled: number | null; prevCollected: number | null;
  outstanding: number; overdue: number; overdueCount: number; draftCount: number; draftValue: number;
  avgDaysToPay: number | null;
}

export function summarise(invoices: InvLite[], payments: PayLite[], range: Range, today: string): Summary {
  const live = invoices.filter(billable);
  const liveIds = new Set(live.map((i) => i.id));
  const pays = payments.filter((p) => liveIds.has(p.invoice_id));
  const inRange = live.filter((i) => within(i.issue_date, range.from, range.to));
  const hasPrev = range.prevFrom !== null;

  const overdueInv = live.filter((i) => effectiveStatus(i, today) === "overdue");
  const settled = inRange.filter((i) => i.paid_at && i.total > 0 && i.amount_paid >= i.total);
  const drafts = invoices.filter((i) => i.status === "draft");

  return {
    billed: sum(inRange.map((i) => i.total)),
    collected: sum(pays.filter((p) => within(p.paid_on, range.from, range.to)).map((p) => p.amount)),
    tax: sum(inRange.map((i) => i.tax_total)),
    invoiceCount: inRange.length,
    prevBilled: hasPrev ? sum(live.filter((i) => within(i.issue_date, range.prevFrom, range.prevTo)).map((i) => i.total)) : null,
    prevCollected: hasPrev ? sum(pays.filter((p) => within(p.paid_on, range.prevFrom, range.prevTo)).map((p) => p.amount)) : null,
    outstanding: sum(live.map(balanceOf)),
    overdue: sum(overdueInv.map(balanceOf)),
    overdueCount: overdueInv.length,
    draftCount: drafts.length,
    draftValue: sum(drafts.map((i) => i.total)),
    avgDaysToPay: settled.length
      ? Math.round(settled.reduce((a, i) => a + Math.max(daysBetween(i.issue_date, i.paid_at!), 0), 0) / settled.length)
      : null,
  };
}

// Percentage change against the previous period. Null when there is no fair comparison.
export function delta(now: number, prev: number | null): number | null {
  if (prev === null || prev === 0) return null;
  return Math.round(((now - prev) / prev) * 1000) / 10;
}

export interface MonthPoint { key: string; label: string; billed: number; collected: number }

export function monthlySeries(invoices: InvLite[], payments: PayLite[], today: string, months = 12): MonthPoint[] {
  const live = invoices.filter(billable);
  const liveIds = new Set(live.map((i) => i.id));
  const [y, m] = today.split("-").map(Number);
  const out: MonthPoint[] = [];
  for (let k = months - 1; k >= 0; k--) {
    const d = new Date(Date.UTC(y, m - 1 - k, 1));
    const key = d.toISOString().slice(0, 7);
    out.push({
      key,
      label: d.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" }),
      billed: sum(live.filter((i) => i.issue_date.slice(0, 7) === key).map((i) => i.total)),
      collected: sum(payments.filter((p) => liveIds.has(p.invoice_id) && p.paid_on.slice(0, 7) === key).map((p) => p.amount)),
    });
  }
  return out;
}

export interface AgingBucket { label: string; amount: number; count: number }

export function aging(invoices: InvLite[], today: string): AgingBucket[] {
  const buckets: AgingBucket[] = [
    { label: "Not yet due", amount: 0, count: 0 },
    { label: "1 to 30 days late", amount: 0, count: 0 },
    { label: "31 to 60 days late", amount: 0, count: 0 },
    { label: "61 to 90 days late", amount: 0, count: 0 },
    { label: "Over 90 days late", amount: 0, count: 0 },
  ];
  for (const i of invoices.filter(billable)) {
    const bal = balanceOf(i);
    if (bal <= 0) continue;
    const late = daysBetween(i.due_date, today);
    const b = late <= 0 ? 0 : late <= 30 ? 1 : late <= 60 ? 2 : late <= 90 ? 3 : 4;
    buckets[b].amount = round2(buckets[b].amount + bal);
    buckets[b].count++;
  }
  return buckets;
}

export interface ClientTotal { client_id: string; billed: number; outstanding: number; count: number }

export function clientTotals(invoices: InvLite[], range?: Range): ClientTotal[] {
  const map = new Map<string, ClientTotal>();
  for (const i of invoices.filter(billable)) {
    if (!i.client_id) continue;
    if (range && !within(i.issue_date, range.from, range.to)) continue;
    const row = map.get(i.client_id) ?? { client_id: i.client_id, billed: 0, outstanding: 0, count: 0 };
    row.billed = round2(row.billed + i.total);
    row.outstanding = round2(row.outstanding + balanceOf(i));
    row.count++;
    map.set(i.client_id, row);
  }
  return [...map.values()].sort((a, b) => b.billed - a.billed);
}

export interface TaxMonth { key: string; label: string; count: number; net: number; tax: number; gross: number; collected: number }

// Tax report on an invoice basis: tax is counted in the month the invoice was issued.
export function taxReport(invoices: InvLite[], payments: PayLite[], year: number): TaxMonth[] {
  const live = invoices.filter(billable);
  const liveIds = new Set(live.map((i) => i.id));
  return Array.from({ length: 12 }, (_, m) => {
    const key = `${year}-${String(m + 1).padStart(2, "0")}`;
    const rows = live.filter((i) => i.issue_date.slice(0, 7) === key);
    return {
      key,
      label: new Date(Date.UTC(year, m, 1)).toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" }),
      count: rows.length,
      net: sum(rows.map((i) => i.subtotal)),
      tax: sum(rows.map((i) => i.tax_total)),
      gross: sum(rows.map((i) => i.total)),
      collected: sum(payments.filter((p) => liveIds.has(p.invoice_id) && p.paid_on.slice(0, 7) === key).map((p) => p.amount)),
    };
  });
}
