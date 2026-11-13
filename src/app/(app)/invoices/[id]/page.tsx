import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normaliseInvoice, normalisePayment, normaliseSettings, num, uidKey, type Client, type InvoiceEvent, type InvoiceItem, type Service } from "@/lib/types";
import InvoiceEditor from "@/components/InvoiceEditor";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: { params: { id: string } }) {
  if (!UUID.test(params.id)) return { title: "Invoice" };
  const { data } = await createClient().from("invoices").select("number").eq("id", params.id).maybeSingle();
  return { title: data?.number ?? "Invoice" };
}

export default async function InvoicePage({ params }: { params: { id: string } }) {
  if (!UUID.test(params.id)) notFound();
  const supabase = createClient();
  const { data: inv } = await supabase.from("invoices").select("*").eq("id", params.id).maybeSingle();
  if (!inv) notFound();

  const [{ data: s }, { data: clients }, { data: services }, { data: rows }, { data: pays }, { data: events }] = await Promise.all([
    supabase.from("settings").select("*").eq("id", 1).single(),
    supabase.from("clients").select("*").order("name").limit(5000),
    supabase.from("services").select("*").order("name"),
    supabase.from("invoice_items").select("*").eq("invoice_id", params.id).order("position"),
    supabase.from("payments").select("*").eq("invoice_id", params.id).order("paid_on"),
    supabase.from("invoice_events").select("id,kind,detail,created_at").eq("invoice_id", params.id).order("created_at", { ascending: false }).limit(12),
  ]);

  const items: InvoiceItem[] = (rows ?? []).map((r: any) => ({
    id: r.id, key: uidKey(r.id), description: r.description ?? "",
    quantity: num(r.quantity), unit_price: num(r.unit_price), taxable: !!r.taxable,
  }));

  return (
    <InvoiceEditor
      key={inv.id}
      settings={normaliseSettings(s)}
      clients={(clients ?? []) as Client[]}
      services={(services ?? []) as Service[]}
      invoice={normaliseInvoice(inv)}
      items={items}
      payments={(pays ?? []).map(normalisePayment)}
      events={(events ?? []) as InvoiceEvent[]}
    />
  );
}
