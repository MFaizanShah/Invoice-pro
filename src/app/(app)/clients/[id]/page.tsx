import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/data";
import { effectiveStatus, round2 } from "@/lib/calc";
import { money, todayISO } from "@/lib/format";
import { toRows } from "@/lib/rows";
import { normaliseInvoice, normaliseSettings, type Client } from "@/lib/types";
import ClientHeader from "@/components/ClientHeader";
import InvoiceTable from "@/components/InvoiceTable";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const metadata = { title: "Client" };

export default async function ClientPage({ params }: { params: { id: string } }) {
  if (!UUID.test(params.id)) notFound();
  const supabase = createClient();
  const { data: client } = await supabase.from("clients").select("*").eq("id", params.id).maybeSingle();
  if (!client) notFound();

  const [{ data: s }, inv] = await Promise.all([
    supabase.from("settings").select("*").eq("id", 1).single(),
    fetchAll(() => supabase.from("invoices").select("*").eq("client_id", params.id).order("created_at", { ascending: false })),
  ]);
  const settings = normaliseSettings(s);
  const cur = settings.currency;
  const today = todayISO();
  const invoices = inv.map(normaliseInvoice);
  const live = invoices.filter((i) => i.status !== "draft" && i.status !== "void");
  const billed = round2(live.reduce((a, i) => a + i.total, 0));
  const paid = round2(live.reduce((a, i) => a + i.amount_paid, 0));
  const owing = round2(live.reduce((a, i) => a + Math.max(i.total - i.amount_paid, 0), 0));
  const overdue = round2(live.filter((i) => effectiveStatus(i, today) === "overdue").reduce((a, i) => a + (i.total - i.amount_paid), 0));
  const rows = toRows(invoices, new Map([[client.id, client.name]]), today);

  const stats = [
    { label: "Billed", value: money(billed, cur) },
    { label: "Paid", value: money(paid, cur) },
    { label: "Owes", value: money(owing, cur) },
    { label: "Of which overdue", value: money(overdue, cur), late: overdue > 0 },
  ];

  return (
    <div className="space-y-6">
      <ClientHeader client={client as Client} />
      <dl className="card grid grid-cols-2 divide-ink-200 max-sm:divide-y sm:grid-cols-4 sm:divide-x">
        {stats.map((st) => (
          <div key={st.label} className="p-5">
            <dt className="text-sm font-medium text-ink-600">{st.label}</dt>
            <dd className={`num mt-1.5 font-display text-xl font-semibold tracking-tight ${st.late ? "text-late-600" : ""}`}>{st.value}</dd>
          </div>
        ))}
      </dl>
      <InvoiceTable rows={rows} currency={cur} taxLabel={settings.tax_label} />
    </div>
  );
}
