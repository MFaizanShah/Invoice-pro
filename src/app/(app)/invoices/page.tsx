import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/data";
import { toRows } from "@/lib/rows";
import { normaliseInvoice, normaliseSettings } from "@/lib/types";
import InvoiceTable from "@/components/InvoiceTable";

export const metadata = { title: "Invoices" };

export default async function InvoicesPage() {
  const supabase = createClient();
  const [{ data: s }, inv, { data: clients }] = await Promise.all([
    supabase.from("settings").select("*").eq("id", 1).single(),
    fetchAll(() => supabase.from("invoices").select("*").order("created_at", { ascending: false })),
    supabase.from("clients").select("id,name").limit(5000),
  ]);
  const settings = normaliseSettings(s);
  const nameOf = new Map<string, string>((clients ?? []).map((c: any): [string, string] => [c.id, c.name]));
  const rows = toRows(inv.map(normaliseInvoice), nameOf);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Invoices</h1>
          <p className="mt-1 text-sm text-ink-500">{rows.length} in total</p>
        </div>
        <Link href="/invoices/new" className="btn-primary"><Plus size={16} /> New invoice</Link>
      </header>
      <InvoiceTable rows={rows} currency={settings.currency} taxLabel={settings.tax_label} />
    </div>
  );
}
