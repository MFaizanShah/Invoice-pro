import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/data";
import { round2 } from "@/lib/calc";
import { aging, taxReport } from "@/lib/analytics";
import { daysBetween, todayISO } from "@/lib/format";
import { normaliseInvoice, normalisePayment, normaliseSettings } from "@/lib/types";
import ReportsView, { type AgingRow } from "@/components/ReportsView";

export const metadata = { title: "Reports" };

export default async function ReportsPage({ searchParams }: { searchParams: { year?: string } }) {
  const supabase = createClient();
  const [{ data: s }, inv, pays, { data: clients }] = await Promise.all([
    supabase.from("settings").select("*").eq("id", 1).single(),
    fetchAll(() => supabase.from("invoices").select("*").order("created_at")),
    fetchAll(() => supabase.from("payments").select("id,invoice_id,amount,paid_on,method,reference").order("paid_on")),
    supabase.from("clients").select("id,name").limit(5000),
  ]);
  const settings = normaliseSettings(s);
  const invoices = inv.map(normaliseInvoice);
  const payments = pays.map(normalisePayment);
  const nameOf = new Map<string, string>((clients ?? []).map((c: any): [string, string] => [c.id, c.name]));
  const today = todayISO();
  const thisYear = Number(today.slice(0, 4));

  const seen = new Set<number>([thisYear, ...invoices.map((i) => Number(i.issue_date.slice(0, 4)))]);
  const years = [...seen].filter((y) => y > 1990 && y <= thisYear + 1).sort((a, b) => b - a).slice(0, 6);
  const asked = Number(searchParams.year);
  const year = years.includes(asked) ? asked : thisYear;

  const agingRows: AgingRow[] = invoices
    .filter((i) => i.status !== "draft" && i.status !== "void" && round2(i.total - i.amount_paid) > 0)
    .map((i) => ({
      id: i.id, number: i.number, client: (i.client_id && nameOf.get(i.client_id)) || "",
      due_date: i.due_date, late: daysBetween(i.due_date, today), balance: round2(i.total - i.amount_paid),
    }))
    .sort((a, b) => b.late - a.late);

  return (
    <ReportsView
      year={year}
      years={years}
      currency={settings.currency}
      taxLabel={settings.tax_label}
      taxNumber={settings.company_tax_number}
      company={settings.company_name}
      months={taxReport(invoices, payments, year)}
      buckets={aging(invoices, today)}
      agingRows={agingRows}
    />
  );
}
