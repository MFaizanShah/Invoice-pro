import type { InvoiceStatus, DiscountType } from "./calc.ts";

export interface Settings {
  id: number;
  company_name: string;
  company_address: string;
  company_email: string;
  company_phone: string;
  company_tax_number: string;
  tax_label: string;
  tax_rate: number;
  prices_include_tax: boolean;
  currency: string;
  invoice_prefix: string;
  next_number: number;
  payment_terms_days: number;
  bank_details: string;
  default_notes: string;
  default_terms: string;
  logo_data: string;
  accent_color: string;
  company_legal_line: string;
  company_licence: string;
  tax_number_label: string;
  document_title: string;
  document_subtitle: string;
  payment_method_title: string;
  number_padding: number;
  show_freight: boolean;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  notes?: string;
  created_at?: string;
}

export interface Service {
  id: string;
  name: string;
  unit_price: number;
  taxable: boolean;
}

export interface Invoice {
  id: string;
  number: string;
  client_id: string | null;
  status: InvoiceStatus;
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
  subtotal: number;
  discount_total: number;
  tax_total: number;
  total: number;
  amount_paid: number;
  notes: string;
  terms: string;
  paid_at: string | null;
  created_at: string;
}

export interface InvoiceItem {
  id?: string;
  key: string; // client side only
  description: string;
  quantity: number;
  unit_price: number;
  taxable: boolean;
}

export interface Payment {
  id: string;
  invoice_id: string;
  amount: number;
  paid_on: string;
  method: string;
  reference: string;
}

export interface InvoiceEvent {
  id: string;
  kind: string;
  detail: string;
  created_at: string;
}

// Postgres numeric columns arrive as strings or numbers depending on driver, normalise here.
export const num = (v: unknown): number => {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
};

export function normaliseInvoice(r: any): Invoice {
  return {
    ...r,
    reference: r.reference ?? "",
    property_address: r.property_address ?? "",
    notes: r.notes ?? "",
    terms: r.terms ?? "",
    tax_rate: num(r.tax_rate),
    discount_value: num(r.discount_value),
    freight_amount: num(r.freight_amount),
    freight_taxable: r.freight_taxable ?? true,
    subtotal: num(r.subtotal),
    discount_total: num(r.discount_total),
    tax_total: num(r.tax_total),
    total: num(r.total),
    amount_paid: num(r.amount_paid),
  };
}

export function normalisePayment(r: any): Payment {
  return { id: r.id, invoice_id: r.invoice_id, amount: num(r.amount), paid_on: r.paid_on, method: r.method ?? "", reference: r.reference ?? "" };
}

export const uidKey = (id: string) => `k-${id}`;

export const DEFAULT_ACCENT = "#0F535B";

export function normaliseSettings(r: any): Settings {
  return {
    ...r,
    tax_rate: num(r?.tax_rate),
    next_number: num(r?.next_number),
    payment_terms_days: num(r?.payment_terms_days),
    logo_data: r?.logo_data ?? "",
    company_legal_line: r?.company_legal_line ?? "",
    company_licence: r?.company_licence ?? "",
    tax_number_label: r?.tax_number_label || "GST number",
    document_title: r?.document_title ?? "Tax invoice",
    document_subtitle: r?.document_subtitle ?? "",
    payment_method_title: r?.payment_method_title ?? "",
    number_padding: num(r?.number_padding) || 4,
    show_freight: r?.show_freight ?? true,
    accent_color: /^#[0-9a-fA-F]{6}$/.test(r?.accent_color ?? "") ? r.accent_color : DEFAULT_ACCENT,
  };
}
