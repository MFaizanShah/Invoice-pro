import { effectiveStatus, round2 } from "./calc.ts";
import type { Invoice } from "./types.ts";
import type { Row } from "@/components/InvoiceTable";

export function toRows(invoices: Invoice[], nameOf: Map<string, string>, today?: string): Row[] {
  return invoices.map((i) => ({
    id: i.id,
    number: i.number,
    client: (i.client_id && nameOf.get(i.client_id)) || "",
    property: i.property_address,
    issue_date: i.issue_date,
    due_date: i.due_date,
    status: effectiveStatus(i, today),
    subtotal: i.subtotal,
    tax: i.tax_total,
    total: i.total,
    paid: i.amount_paid,
    balance: round2(i.total - i.amount_paid),
  }));
}
