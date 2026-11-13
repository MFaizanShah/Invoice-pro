import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/data";
import { clientTotals } from "@/lib/analytics";
import { normaliseInvoice, normaliseSettings, type Client } from "@/lib/types";
import ClientsManager, { type ClientRow } from "@/components/ClientsManager";

export const metadata = { title: "Clients" };

export default async function ClientsPage() {
  const supabase = createClient();
  const [{ data: s }, clients, inv] = await Promise.all([
    supabase.from("settings").select("*").eq("id", 1).single(),
    fetchAll<Client>(() => supabase.from("clients").select("*").order("name")),
    fetchAll(() => supabase.from("invoices").select("*").order("created_at")),
  ]);
  const invoices = inv.map(normaliseInvoice);
  const totals = new Map(clientTotals(invoices).map((t) => [t.client_id, t]));

  const rows: ClientRow[] = clients.map((c) => ({
    ...c,
    invoices: invoices.filter((i) => i.client_id === c.id && i.status !== "void").length,
    billed: totals.get(c.id)?.billed ?? 0,
    outstanding: totals.get(c.id)?.outstanding ?? 0,
  }));

  return <ClientsManager clients={rows} currency={normaliseSettings(s).currency} />;
}
