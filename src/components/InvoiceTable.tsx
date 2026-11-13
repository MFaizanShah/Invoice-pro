"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Download, Search } from "lucide-react";
import clsx from "clsx";
import StatusBadge, { statusLabels } from "./StatusBadge";
import { downloadText, fmtDate, money, toCSV } from "@/lib/format";
import type { EffectiveStatus } from "@/lib/calc";

export interface Row {
  id: string;
  number: string;
  client: string;
  property: string;
  issue_date: string;
  due_date: string;
  status: EffectiveStatus;
  subtotal: number;
  tax: number;
  total: number;
  paid: number;
  balance: number;
}

type TabKey = "all" | EffectiveStatus;
const tabs: { key: TabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "sent", label: "Awaiting payment" },
  { key: "partial", label: "Part paid" },
  { key: "overdue", label: "Overdue" },
  { key: "paid", label: "Paid" },
];

type SortKey = "number" | "client" | "issue_date" | "due_date" | "total" | "balance";

export default function InvoiceTable({ rows, currency, taxLabel = "Tax", compact = false }: { rows: Row[]; currency: string; taxLabel?: string; compact?: boolean }) {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<TabKey>("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "issue_date", dir: -1 });

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    rows.forEach((r) => (c[r.status] = (c[r.status] ?? 0) + 1));
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = rows.filter((r) => (tab === "all" || r.status === tab) &&
      (!term || [r.number, r.client, r.property].some((v) => v.toLowerCase().includes(term))));
    return [...list].sort((a, b) => {
      const x = a[sort.key], y = b[sort.key];
      const cmp = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true });
      return cmp * sort.dir || b.number.localeCompare(a.number, undefined, { numeric: true });
    });
  }, [rows, q, tab, sort]);

  const live = filtered.filter((r) => r.status !== "void" && r.status !== "draft");
  const totalSum = live.reduce((a, r) => a + r.total, 0);
  const balanceSum = live.reduce((a, r) => a + Math.max(r.balance, 0), 0);

  function exportCSV() {
    const csv = toCSV(
      ["Number", "Client", "Property", "Issued", "Due", "Status", "Net", taxLabel, "Total", "Paid", "Balance"],
      filtered.map((r) => [r.number, r.client, r.property, r.issue_date, r.due_date, statusLabels[r.status], r.subtotal, r.tax, r.total, r.paid, r.balance])
    );
    downloadText(`invoices-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

  const Th = ({ k, label, right }: { k: SortKey; label: string; right?: boolean }) => (
    <th className={clsx("th", right && "text-right")} aria-sort={sort.key === k ? (sort.dir === 1 ? "ascending" : "descending") : undefined}>
      <button onClick={() => setSort((s) => ({ key: k, dir: s.key === k ? (s.dir === 1 ? -1 : 1) : (k === "client" || k === "number" ? 1 : -1) }))}
        className={clsx("inline-flex items-center gap-1 hover:text-ink-900", sort.key === k && "text-ink-900")}>
        {label}{sort.key === k && (sort.dir === 1 ? <ArrowUp size={13} /> : <ArrowDown size={13} />)}
      </button>
    </th>
  );

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-200 p-3">
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Filter by status">
          {tabs.map((t) => (
            <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
              className={clsx("rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors", tab === t.key ? "bg-ink-900 text-white" : "text-ink-600 hover:bg-ink-100")}>
              {t.label} <span className={clsx("num ml-0.5", tab === t.key ? "text-ink-300" : "text-ink-400")}>{counts[t.key] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <div className="relative flex-1 sm:w-60">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input className="input pl-9" placeholder="Number, client or property" aria-label="Search invoices" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {!compact && <button className="btn-ghost" onClick={exportCSV} disabled={filtered.length === 0}><Download size={15} /> Export CSV</button>}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-ink-200 bg-ink-50">
            <tr>
              <Th k="number" label="Number" /><Th k="client" label="Client" /><Th k="issue_date" label="Issued" /><Th k="due_date" label="Due" />
              <th className="th">Status</th><Th k="total" label="Total" right /><Th k="balance" label="Balance" right />
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="td py-14 text-center text-ink-500">
                {rows.length === 0 ? <>No invoices yet. <Link href="/invoices/new" className="font-semibold text-brand-700 hover:underline">Create the first one</Link></> : "No invoice matches this filter."}
              </td></tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id} className="transition-colors hover:bg-ink-50">
                <td className="td font-semibold"><Link href={`/invoices/${r.id}`} className="hover:underline">{r.number}</Link></td>
                <td className="td"><p className="text-ink-800">{r.client || <span className="text-ink-400">No client</span>}</p>{r.property && <p className="text-[13px] text-ink-500">{r.property}</p>}</td>
                <td className="td whitespace-nowrap text-ink-600">{fmtDate(r.issue_date)}</td>
                <td className="td whitespace-nowrap text-ink-600">{fmtDate(r.due_date)}</td>
                <td className="td"><StatusBadge status={r.status} /></td>
                <td className="td num text-right">{money(r.total, currency)}</td>
                <td className={clsx("td num text-right font-semibold", r.balance > 0 && r.status !== "draft" && r.status !== "void" ? "text-ink-900" : "text-ink-300")}>{money(r.balance, currency)}</td>
              </tr>
            ))}
          </tbody>
          {live.length > 1 && (
            <tfoot className="border-t border-ink-200 bg-ink-50">
              <tr>
                <td className="td text-[13px] text-ink-500" colSpan={5}>{live.length} sent invoices shown</td>
                <td className="td num text-right font-semibold">{money(totalSum, currency)}</td>
                <td className="td num text-right font-semibold">{money(balanceSum, currency)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
