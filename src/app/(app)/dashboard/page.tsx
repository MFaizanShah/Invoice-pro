import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Plus } from "lucide-react";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/data";
import { effectiveStatus, round2 } from "@/lib/calc";
import { PERIODS, aging, clientTotals, delta, monthlySeries, periodRange, summarise, type PeriodKey } from "@/lib/analytics";
import { daysBetween, fmtDate, money, todayISO } from "@/lib/format";
import { normaliseInvoice, normalisePayment, normaliseSettings } from "@/lib/types";
import RevenueChart from "@/components/RevenueChart";
import StatusBadge from "@/components/StatusBadge";

export const metadata = { title: "Dashboard" };

const AGING_COLORS = ["#BAC3BC", "#F0B4A8", "#E48A78", "#C2412D", "#85291B"];

function Delta({ value, label }: { value: number | null; label: string }) {
  if (value === null) return <span className="text-[13px] text-ink-400">No earlier figure to compare</span>;
  const up = value >= 0;
  return (
    <span className="inline-flex items-center gap-1 text-[13px] text-ink-600">
      {up ? <ArrowUpRight size={14} className="text-brand-600" /> : <ArrowDownRight size={14} className="text-late-500" />}
      <span className="num font-semibold text-ink-900">{Math.abs(value)}%</span> {up ? "up" : "down"} on {label}
    </span>
  );
}

export default async function DashboardPage({ searchParams }: { searchParams: { period?: string } }) {
  const supabase = createClient();
  const period: PeriodKey = (PERIODS.find((p) => p.key === searchParams.period)?.key ?? "year") as PeriodKey;

  const [{ data: s }, invRows, payRows, { data: clients }] = await Promise.all([
    supabase.from("settings").select("*").eq("id", 1).single(),
    fetchAll(() => supabase.from("invoices").select("*").order("created_at", { ascending: false })),
    fetchAll(() => supabase.from("payments").select("id,invoice_id,amount,paid_on,method,reference").order("paid_on")),
    supabase.from("clients").select("id,name").limit(5000),
  ]);

  const settings = normaliseSettings(s);
  const cur = settings.currency;
  const invoices = invRows.map(normaliseInvoice);
  const payments = payRows.map(normalisePayment);
  const nameOf = new Map<string, string>((clients ?? []).map((c: any): [string, string] => [c.id, c.name]));
  const today = todayISO();
  const range = periodRange(period, today);
  const sum = summarise(invoices, payments, range, today);
  const series = monthlySeries(invoices, payments, today, 12);
  const buckets = aging(invoices, today);
  const agingTotal = round2(buckets.reduce((a, b) => a + b.amount, 0));
  const top = clientTotals(invoices, range).slice(0, 5);
  const topMax = top[0]?.billed || 1;
  const prevLabel = period === "month" ? "last month" : period === "quarter" ? "last quarter" : period === "year" ? "last year" : "the 12 months before";

  const chase = invoices
    .filter((i) => effectiveStatus(i, today) === "overdue")
    .map((i) => ({ i, late: daysBetween(i.due_date, today), bal: round2(i.total - i.amount_paid) }))
    .sort((a, b) => b.late - a.late)
    .slice(0, 5);
  const recent = invoices.slice(0, 6);
  const isEmpty = invoices.length === 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="mt-1 text-sm text-ink-500">{fmtDate(today)}</p>
        </div>
        <nav aria-label="Period" className="flex flex-wrap gap-1 rounded-lg border border-ink-200 bg-white p-1">
          {PERIODS.map((p) => (
            <Link key={p.key} href={`/dashboard?period=${p.key}`} scroll={false} aria-current={p.key === period ? "true" : undefined}
              className={clsx("rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors", p.key === period ? "bg-ink-900 text-white" : "text-ink-600 hover:bg-ink-100")}>
              {p.label}
            </Link>
          ))}
        </nav>
      </header>

      {isEmpty && (
        <section className="card flex flex-wrap items-center justify-between gap-4 border-brand-200 bg-brand-50 p-6">
          <div>
            <h2 className="section-title">Start with your first invoice</h2>
            <p className="mt-1 max-w-xl text-sm text-ink-600">Add your company details and {settings.tax_label} rate in Settings, then create an invoice. Figures appear here as soon as one is marked as sent.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/settings" className="btn-ghost">Open settings</Link>
            <Link href="/invoices/new" className="btn-primary"><Plus size={16} /> New invoice</Link>
          </div>
        </section>
      )}

      {/* Money position: one panel, the collected figure leads */}
      <section className="card grid divide-ink-200 max-lg:divide-y lg:grid-cols-[1.35fr_1fr_1fr_1fr] lg:divide-x">
        <div className="p-6">
          <p className="text-sm font-medium text-ink-600">Collected, {range.label.toLowerCase()}</p>
          <p className="num mt-2 font-display text-[2.6rem] font-semibold leading-none tracking-tight">{money(sum.collected, cur)}</p>
          <p className="mt-3"><Delta value={delta(sum.collected, sum.prevCollected)} label={prevLabel} /></p>
        </div>
        <div className="p-6">
          <p className="text-sm font-medium text-ink-600">Billed</p>
          <p className="num mt-2 font-display text-2xl font-semibold tracking-tight">{money(sum.billed, cur)}</p>
          <p className="mt-2 text-[13px] text-ink-500">{sum.invoiceCount} invoice{sum.invoiceCount === 1 ? "" : "s"}, {money(sum.tax, cur)} {settings.tax_label}</p>
          <p className="mt-1"><Delta value={delta(sum.billed, sum.prevBilled)} label={prevLabel} /></p>
        </div>
        <div className="p-6">
          <p className="text-sm font-medium text-ink-600">Owed to you</p>
          <p className="num mt-2 font-display text-2xl font-semibold tracking-tight">{money(sum.outstanding, cur)}</p>
          <p className="mt-2 text-[13px] text-ink-500">
            {sum.avgDaysToPay === null ? "Across all open invoices" : `Clients take ${sum.avgDaysToPay} day${sum.avgDaysToPay === 1 ? "" : "s"} to pay on average`}
          </p>
        </div>
        <div className={clsx("p-6", sum.overdue > 0 && "bg-late-50/60 max-lg:rounded-b-xl lg:rounded-r-xl")}>
          <p className="text-sm font-medium text-ink-600">Overdue</p>
          <p className={clsx("num mt-2 font-display text-2xl font-semibold tracking-tight", sum.overdue > 0 && "text-late-600")}>{money(sum.overdue, cur)}</p>
          <p className="mt-2 text-[13px] text-ink-500">
            {sum.overdueCount === 0 ? "Nothing is late" : `${sum.overdueCount} invoice${sum.overdueCount === 1 ? "" : "s"} past the due date`}
          </p>
          {sum.draftCount > 0 && <p className="mt-1 text-[13px] text-ink-500">{sum.draftCount} draft{sum.draftCount === 1 ? "" : "s"} worth {money(sum.draftValue, cur)} not yet sent</p>}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="card p-6 lg:col-span-2">
          <h2 className="section-title mb-4">Billed and collected, last 12 months</h2>
          <RevenueChart data={series} currency={cur} />
        </div>

        <div className="card p-6">
          <h2 className="section-title">Who owes what, by lateness</h2>
          {agingTotal === 0 ? (
            <p className="mt-4 text-sm text-ink-500">No open balances. Every sent invoice is paid.</p>
          ) : (
            <>
              <div className="mt-5 flex h-3 gap-[2px] overflow-hidden rounded" role="img" aria-label="Share of open balances by how late they are">
                {buckets.map((b, i) => b.amount > 0 && (
                  <div key={b.label} title={`${b.label}: ${money(b.amount, cur)}`}
                    style={{ width: `${Math.max((b.amount / agingTotal) * 100, 1.5)}%`, background: AGING_COLORS[i] }} />
                ))}
              </div>
              <dl className="mt-5 space-y-2.5 text-sm">
                {buckets.map((b, i) => (
                  <div key={b.label} className={clsx("flex items-center gap-2.5", b.amount === 0 && "text-ink-400")}>
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: AGING_COLORS[i] }} />
                    <dt className="flex-1">{b.label}{b.count > 0 && <span className="text-ink-400"> ({b.count})</span>}</dt>
                    <dd className="num font-medium">{money(b.amount, cur)}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="section-title">Chase these first</h2>
          {chase.length === 0 ? (
            <p className="mt-4 text-sm text-ink-500">No invoice is past its due date.</p>
          ) : (
            <ul className="mt-3 divide-y divide-ink-100">
              {chase.map(({ i, late, bal }) => (
                <li key={i.id}>
                  <Link href={`/invoices/${i.id}`} className="-mx-2 flex items-center gap-4 rounded-lg px-2 py-3 transition-colors hover:bg-ink-50">
                    <span className="num w-16 shrink-0 rounded bg-late-50 py-1 text-center text-xs font-semibold text-late-600">{late} day{late === 1 ? "" : "s"}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{(i.client_id && nameOf.get(i.client_id)) || "No client"}</span>
                      <span className="block truncate text-[13px] text-ink-500">{i.number}{i.property_address ? `, ${i.property_address}` : ""}</span>
                    </span>
                    <span className="num text-sm font-semibold">{money(bal, cur)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-6">
          <h2 className="section-title">Top clients, {range.label.toLowerCase()}</h2>
          {top.length === 0 ? (
            <p className="mt-4 text-sm text-ink-500">No billed invoices in this period.</p>
          ) : (
            <ul className="mt-4 space-y-4">
              {top.map((c) => (
                <li key={c.client_id}>
                  <Link href={`/clients/${c.client_id}`} className="group block">
                    <div className="mb-1.5 flex justify-between gap-3 text-sm">
                      <span className="truncate font-medium group-hover:underline">{nameOf.get(c.client_id) ?? "Unknown"}</span>
                      <span className="num text-ink-600">{money(c.billed, cur)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-ink-100"><div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.max((c.billed / topMax) * 100, 2)}%` }} /></div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4">
          <h2 className="section-title">Latest invoices</h2>
          <Link href="/invoices" className="text-sm font-semibold text-brand-700 hover:underline">See all invoices</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-y border-ink-200 bg-ink-50">
              <tr><th className="th">Number</th><th className="th">Client</th><th className="th">Due</th><th className="th">Status</th><th className="th text-right">Total</th></tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {recent.length === 0 && <tr><td colSpan={5} className="td py-10 text-center text-ink-500">No invoices yet.</td></tr>}
              {recent.map((i) => (
                <tr key={i.id} className="transition-colors hover:bg-ink-50">
                  <td className="td font-semibold"><Link href={`/invoices/${i.id}`} className="hover:underline">{i.number}</Link></td>
                  <td className="td text-ink-700">{(i.client_id && nameOf.get(i.client_id)) || "No client"}</td>
                  <td className="td text-ink-600">{fmtDate(i.due_date)}</td>
                  <td className="td"><StatusBadge status={effectiveStatus(i, today)} /></td>
                  <td className="td num text-right font-medium">{money(i.total, cur)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
