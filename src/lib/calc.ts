// Pure calculation engine. All maths is done in integer cents to avoid float drift.
import { todayISO } from "./format.ts";

export type DiscountType = "percent" | "amount";

export interface CalcItem {
  quantity: number;
  unit_price: number;
  taxable: boolean;
}

export interface CalcOptions {
  taxRate: number; // percent, e.g. 15
  taxInclusive: boolean; // true when line prices already include tax
  discountType: DiscountType;
  discountValue: number;
  freight?: number; // entered the same way as prices: without tax, or with it when taxInclusive
  freightTaxable?: boolean; // defaults to true
}

export interface Totals {
  gross: number; // sum of line amounts as entered
  discount: number;
  itemsSubtotal: number; // lines after discount, net of tax, freight not included
  freight: number; // freight net of tax
  subtotal: number; // itemsSubtotal + freight, net of tax
  tax: number; // tax on lines and freight
  total: number;
  lines: number[]; // each line amount as entered
}

const toCents = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100);
const fromCents = (c: number) => c / 100;

export function lineAmount(item: Pick<CalcItem, "quantity" | "unit_price">): number {
  const q = Number.isFinite(item.quantity) ? item.quantity : 0;
  return fromCents(Math.round(q * toCents(item.unit_price)));
}

export function computeTotals(items: CalcItem[], opts: CalcOptions): Totals {
  const rate = Math.min(Math.max(opts.taxRate || 0, 0), 100);
  const lineCents = items.map((i) => Math.round((Number.isFinite(i.quantity) ? i.quantity : 0) * toCents(i.unit_price)));
  const grossC = lineCents.reduce((a, b) => a + b, 0);
  const taxableGrossC = items.reduce((a, it, i) => a + (it.taxable ? lineCents[i] : 0), 0);

  let discountC =
    opts.discountType === "percent"
      ? Math.round((grossC * Math.min(Math.max(opts.discountValue || 0, 0), 100)) / 100)
      : toCents(opts.discountValue);
  discountC = Math.min(Math.max(discountC, 0), Math.max(grossC, 0));

  // Discount is spread proportionally, so non taxable lines do not reduce tax.
  const ratio = grossC > 0 ? (grossC - discountC) / grossC : 1;
  const taxableAfterC = taxableGrossC * ratio;

  let taxC: number;
  let itemsNetC: number;
  let itemsTotalC: number;

  if (opts.taxInclusive) {
    itemsTotalC = grossC - discountC;
    taxC = Math.round((taxableAfterC * rate) / (100 + rate));
    itemsNetC = itemsTotalC - taxC;
  } else {
    itemsNetC = grossC - discountC;
    taxC = Math.round((taxableAfterC * rate) / 100);
    itemsTotalC = itemsNetC + taxC;
  }

  // Freight is never discounted. It carries tax unless it is switched off.
  const freightC = Math.max(toCents(opts.freight ?? 0), 0);
  const freightTaxable = opts.freightTaxable ?? true;
  let freightNetC = freightC;
  let freightTaxC = 0;
  if (freightTaxable && freightC > 0) {
    freightTaxC = opts.taxInclusive ? Math.round((freightC * rate) / (100 + rate)) : Math.round((freightC * rate) / 100);
    if (opts.taxInclusive) freightNetC = freightC - freightTaxC;
  }
  const freightGrossC = opts.taxInclusive ? freightC : freightC + freightTaxC;

  return {
    gross: fromCents(grossC),
    discount: fromCents(discountC),
    itemsSubtotal: fromCents(itemsNetC),
    freight: fromCents(freightNetC),
    subtotal: fromCents(itemsNetC + freightNetC),
    tax: fromCents(taxC + freightTaxC),
    total: fromCents(itemsTotalC + freightGrossC),
    lines: lineCents.map(fromCents),
  };
}

export type InvoiceStatus = "draft" | "sent" | "paid" | "void";
export type EffectiveStatus = InvoiceStatus | "overdue" | "partial";

export function effectiveStatus(
  inv: { status: InvoiceStatus; due_date: string; total: number; amount_paid: number },
  today: string = todayISO()
): EffectiveStatus {
  if (inv.status === "void" || inv.status === "draft") return inv.status;
  const balance = round2(inv.total - inv.amount_paid);
  if (balance <= 0 && inv.total > 0) return "paid";
  if (inv.status === "paid") return "paid";
  if (inv.due_date < today) return "overdue";
  if (inv.amount_paid > 0) return "partial";
  return "sent";
}

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
