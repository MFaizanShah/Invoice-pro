"use client";

import Link from "next/link";
import { Download, Printer } from "lucide-react";
import clsx from "clsx";
import { downloadText, money, toCSV } from "@/lib/format";
import type { AgingBucket, TaxMonth } from "@/lib/analytics";

export interface AgingRow { id: string; number: string; client: string; due_date: string; late: number; balance: number }

interface Props {
  year: number;
  years: number[];
  currency: string;
  taxLabel: string;
  taxNumber: string;
  company: string;
  months: TaxMonth[];
  buckets: AgingBucket[];
  agingRows: AgingRow[];
}

export default function ReportsView({ year, years, currency: cur, taxLabel, taxNumber, company, months, buckets, agingRows }: Props) {
  const tot = months.reduce((a, m) => ({ count: a.count + m.count, net: a.net + m.net, tax: a.tax + m.tax, gross: a.gross + m.gross, collected: a.collected + m.collected }),
    { count: 0, net: 0, tax: 0, gross: 0, collected: 0 });
  const quarters = [0, 1, 2, 3].map((q) => {
    const ms = months.slice(q * 3, q * 3 + 3);
    return { label: `Q${q + 1}`, net: ms.reduce((a, m) => a + m.net, 0), tax: ms.reduce((a, m) => a + m.tax, 0), gross: ms.reduce((a, m) => a + m.gross, 0) };
  });
  const agingTotal = buckets.reduce((a, b) => a + b.amount, 0);

  function exportTax() {
    downloadText(`${taxLabel.toLowerCase()}-report-${year}.csv`, toCSV(
      ["Month", "Invoices", `Net (excl. ${taxLabel})`, taxLabel, "Gross", "Payments received"],
      [...months.map((m) => [m.label, m.count, m.net, m.tax, m.gross, m.collected]), ["Total", tot.count, round(tot.net), round(tot.tax), round(tot.gross), round(tot.collected)]]
    ));
  }
  function exportAging() {
    downloadText(`aged-receivables-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(
      ["Invoice", "Client", "Due date", "Days late", "Balance"],
      agingRows.map((r) => [r.number, r.client, r.due_date, Math.max(r.late, 0), r.balance])
    ));
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="mt-1 text-sm text-ink-500">{company}{taxNumber ? `, ${taxLabel} number ${taxNumber}` : ""}</p>
        </div>
        <div className="no-print flex flex-wrap items-center gap-2">
          <nav aria-label="Year" className="flex gap-1 rounded-lg border border-ink-200 bg-white p-1">
            {years.map((y) => (
              <Link key={y} href={`/reports?year=${y}`} scroll={false} aria-current={y === year ? "true" : undefined}
                className={clsx("num rounded-md px-3 py-1.5 text-[13px] font-medium", y === year ? "bg-ink-900 text-white" : "text-ink-600 hover:bg-ink-100")}>{y}</Link>
            ))}
          </nav>
          <button className="btn-ghost" onClick={() => window.print()}><Printer size={15} /> Print</button>
        </div>
      </header>

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div>
            <h2 className="section-title">{taxLabel} summary, {year}</h2>
            <p className="mt-0.5 text-[13px] text-ink-500">Invoice basis: {taxLabel} counts in the month an invoice was issued. Drafts and void invoices are left out.</p>
          </div>
          <button className="btn-ghost no-print" onClick={exportTax}><Download size={15} /> Export CSV</button>
        </div>

        <div className="grid grid-cols-2 border-y border-ink-200 sm:grid-cols-4">
          {quarters.map((q, i) => (
            <div key={q.label} className={clsx("p-4", i > 0 && "sm:border-l", i % 2 === 1 && "max-sm:border-l", i > 1 && "max-sm:border-t", "border-ink-200")}>
              <p className="text-sm font-medium text-ink-600">{q.label} {taxLabel}</p>
              <p className="num mt-1 font-display text-xl font-semibold">{money(q.tax, cur)}</p>
              <p className="num mt-0.5 text-[13px] text-ink-500">on {money(q.net, cur)} net</p>
            </div>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-ink-200 bg-ink-50">
              <tr><th className="th">Month</th><th className="th text-right">Invoices</th><th className="th text-right">Net</th><th className="th text-right">{taxLabel}</th><th className="th text-right">Gross</th><th className="th text-right">Payments received</th></tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {months.map((m) => (
                <tr key={m.key} className={m.count === 0 && m.collected === 0 ? "text-ink-400" : ""}>
                  <td className="td">{m.label}</td>
                  <td className="td num text-right">{m.count}</td>
                  <td className="td num text-right">{money(m.net, cur)}</td>
                  <td className="td num text-right font-medium">{money(m.tax, cur)}</td>
                  <td className="td num text-right">{money(m.gross, cur)}</td>
                  <td className="td num text-right">{money(m.collected, cur)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-ink-300 bg-ink-50 font-semibold">
              <tr>
                <td className="td">Total</td><td className="td num text-right">{tot.count}</td><td className="td num text-right">{money(tot.net, cur)}</td>
                <td className="td num text-right">{money(tot.tax, cur)}</td><td className="td num text-right">{money(tot.gross, cur)}</td><td className="td num text-right">{money(tot.collected, cur)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div>
            <h2 className="section-title">Aged receivables, as of today</h2>
            <p className="mt-0.5 text-[13px] text-ink-500">Every unpaid balance, grouped by how far past due it is. {money(agingTotal, cur)} open in total.</p>
          </div>
          <button className="btn-ghost no-print" onClick={exportAging} disabled={agingRows.length === 0}><Download size={15} /> Export CSV</button>
        </div>
        <dl className="grid grid-cols-2 border-y border-ink-200 sm:grid-cols-5">
          {buckets.map((b, i) => (
            <div key={b.label} className={clsx("p-4 border-ink-200", i > 0 && "sm:border-l", i % 2 === 1 && "max-sm:border-l", i > 1 && "max-sm:border-t")}>
              <dt className="text-[13px] font-medium text-ink-600">{b.label}</dt>
              <dd className={clsx("num mt-1 font-display text-lg font-semibold", i >= 3 && b.amount > 0 && "text-late-600")}>{money(b.amount, cur)}</dd>
              <dd className="text-[13px] text-ink-500">{b.count} invoice{b.count === 1 ? "" : "s"}</dd>
            </div>
          ))}
        </dl>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-ink-200 bg-ink-50">
              <tr><th className="th">Invoice</th><th className="th">Client</th><th className="th text-right">Days late</th><th className="th text-right">Balance</th></tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {agingRows.length === 0 && <tr><td colSpan={4} className="td py-10 text-center text-ink-500">Nothing is owed. Every sent invoice is paid.</td></tr>}
              {agingRows.map((r) => (
                <tr key={r.id} className="hover:bg-ink-50">
                  <td className="td font-semibold"><Link href={`/invoices/${r.id}`} className="hover:underline">{r.number}</Link></td>
                  <td className="td text-ink-700">{r.client || "No client"}</td>
                  <td className={clsx("td num text-right", r.late > 60 ? "font-semibold text-late-600" : r.late > 0 ? "text-ink-900" : "text-ink-400")}>{r.late > 0 ? r.late : "Not due"}</td>
                  <td className="td num text-right font-medium">{money(r.balance, cur)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

const round = (n: number) => Math.round(n * 100) / 100;
