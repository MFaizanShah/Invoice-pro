import { aging, clientTotals, delta, monthlySeries, periodRange, summarise, taxReport, type InvLite, type PayLite } from "./analytics.ts";
import { toCSV, daysBetween, addDays } from "./format.ts";

let failed = 0;
function eq(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  got ${JSON.stringify(actual)} expected ${JSON.stringify(expected)}`}`);
}

const today = "2026-11-13";
const inv = (o: Partial<InvLite> & { id: string }): InvLite => ({
  client_id: "c1", status: "sent", issue_date: "2026-11-01", due_date: "2026-11-15",
  subtotal: 1000, tax_total: 150, total: 1150, amount_paid: 0, paid_at: null, ...o,
});

const invoices: InvLite[] = [
  inv({ id: "a" }),                                                                              // open, not due
  inv({ id: "b", issue_date: "2026-10-05", due_date: "2026-10-19", amount_paid: 400 }),          // 25 days late, part paid
  inv({ id: "c", issue_date: "2026-08-01", due_date: "2026-08-10", amount_paid: 1150, paid_at: "2026-08-21T00:00:00Z", client_id: "c2" }),
  inv({ id: "d", status: "draft", issue_date: "2026-11-10" }),
  inv({ id: "e", status: "void", issue_date: "2026-11-11" }),
  inv({ id: "f", issue_date: "2025-11-20", due_date: "2025-12-01", client_id: "c2" }),           // very late
];
const payments: PayLite[] = [
  { invoice_id: "b", amount: 400, paid_on: "2026-11-02" },
  { invoice_id: "c", amount: 1150, paid_on: "2026-08-21" },
  { invoice_id: "e", amount: 999, paid_on: "2026-11-11" }, // on a void invoice, must be ignored
];

// period ranges
eq("month range", periodRange("month", today), { from: "2026-11-01", to: today, prevFrom: "2026-10-01", prevTo: "2026-10-31", label: "This month" });
eq("quarter range", periodRange("quarter", today).from, "2026-10-01");
eq("quarter prev", [periodRange("quarter", today).prevFrom, periodRange("quarter", today).prevTo], ["2026-07-01", "2026-09-30"]);
eq("year prev", [periodRange("year", today).prevFrom, periodRange("year", today).prevTo], ["2025-01-01", "2025-12-31"]);
eq("12m from", periodRange("12m", today).from, "2025-12-01");
eq("january month prev", periodRange("month", "2026-01-15").prevFrom, "2025-12-01");

// summary for this month
const s = summarise(invoices, payments, periodRange("month", today), today);
eq("billed this month excludes draft and void", s.billed, 1150);
eq("collected this month by payment date", s.collected, 400);
eq("prev month billed", s.prevBilled, 1150);
eq("outstanding across all time", s.outstanding, 1150 + 750 + 1150);
eq("overdue amount and count", [s.overdue, s.overdueCount], [750 + 1150, 2]);
eq("drafts", [s.draftCount, s.draftValue], [1, 1150]);

const sy = summarise(invoices, payments, periodRange("year", today), today);
eq("year billed", sy.billed, 3450);
eq("year tax", sy.tax, 450);
eq("avg days to pay", sy.avgDaysToPay, 20);

eq("delta up", delta(150, 100), 50);
eq("delta no base", delta(150, 0), null);

// monthly series
const ms = monthlySeries(invoices, payments, today, 12);
eq("series length and last key", [ms.length, ms[11].key, ms[0].key], [12, "2026-11", "2025-12"]);
eq("nov billed and collected", [ms[11].billed, ms[11].collected], [1150, 400]);
eq("aug collected", ms[8].collected, 1150);

// aging
const ag = aging(invoices, today);
eq("aging amounts", ag.map((b) => b.amount), [1150, 750, 0, 0, 1150]);
eq("aging counts", ag.map((b) => b.count), [1, 1, 0, 0, 1]);

// clients
const ct = clientTotals(invoices);
eq("client totals sorted", ct.map((c) => [c.client_id, c.billed, c.outstanding]), [["c1", 2300, 1900], ["c2", 2300, 1150]]);

// tax report
const tr = taxReport(invoices, payments, 2026);
eq("tax november", [tr[10].count, tr[10].net, tr[10].tax, tr[10].gross], [1, 1000, 150, 1150]);
eq("tax year total", tr.reduce((a, r) => a + r.tax, 0), 450);

// helpers
eq("days between", daysBetween("2026-10-19", today), 25);
eq("add days across month", addDays("2026-01-31", 1), "2026-02-01");
eq("csv quoting and formula guard", toCSV(["a", "b"], [["x,y", 2], ["=SUM(A1)", 'say "hi"']]), 'a,b\r\n"x,y",2\r\n\'=SUM(A1),"say ""hi"""');

console.log(failed ? `\n${failed} test(s) failed` : "\nAll analytics tests passed");
process.exit(failed ? 1 : 0);
