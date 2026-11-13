import { computeTotals, effectiveStatus } from "./calc.ts";

let failed = 0;
function eq(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  got ${JSON.stringify(actual)} expected ${JSON.stringify(expected)}`}`);
}

const base = { taxRate: 15, taxInclusive: false, discountType: "percent" as const, discountValue: 0 };

// Exclusive tax
let t = computeTotals([{ quantity: 1, unit_price: 1000, taxable: true }], base);
eq("exclusive 1000 @15%", [t.subtotal, t.tax, t.total], [1000, 150, 1150]);

// Inclusive tax: 1150 includes 150
t = computeTotals([{ quantity: 1, unit_price: 1150, taxable: true }], { ...base, taxInclusive: true });
eq("inclusive 1150 @15%", [t.subtotal, t.tax, t.total], [1000, 150, 1150]);

// Percent discount on exclusive
t = computeTotals([{ quantity: 2, unit_price: 500, taxable: true }], { ...base, discountValue: 10 });
eq("10% discount", [t.gross, t.discount, t.subtotal, t.tax, t.total], [1000, 100, 900, 135, 1035]);

// Fixed discount
t = computeTotals([{ quantity: 1, unit_price: 800, taxable: true }], { ...base, discountType: "amount", discountValue: 100 });
eq("fixed discount", [t.subtotal, t.tax, t.total], [700, 105, 805]);

// Non taxable line excluded from tax
t = computeTotals(
  [{ quantity: 1, unit_price: 1000, taxable: true }, { quantity: 1, unit_price: 500, taxable: false }],
  base
);
eq("mixed taxable", [t.subtotal, t.tax, t.total], [1500, 150, 1650]);

// Discount spread proportionally across taxable and non taxable
t = computeTotals(
  [{ quantity: 1, unit_price: 1000, taxable: true }, { quantity: 1, unit_price: 1000, taxable: false }],
  { ...base, discountValue: 50 }
);
eq("proportional discount", [t.subtotal, t.tax, t.total], [1000, 75, 1075]);

// Discount cannot exceed gross
t = computeTotals([{ quantity: 1, unit_price: 100, taxable: true }], { ...base, discountType: "amount", discountValue: 999 });
eq("discount capped", [t.discount, t.total], [100, 0]);

// Float safety: 3 x 0.1 style
t = computeTotals([{ quantity: 3, unit_price: 0.1, taxable: true }], { ...base, taxRate: 0 });
eq("float safe", t.total, 0.3);

// Zero rate and empty list
t = computeTotals([], base);
eq("empty", [t.total, t.tax], [0, 0]);

// Fractional quantity
t = computeTotals([{ quantity: 2.5, unit_price: 120, taxable: true }], base);
eq("fractional qty", [t.subtotal, t.total], [300, 345]);

// Freight: added after discount, taxable by default, no effect when zero
t = computeTotals([{ quantity: 1, unit_price: 900, taxable: true }], { ...base, taxRate: 10, freight: 100 });
eq("freight taxable, exclusive", [t.itemsSubtotal, t.freight, t.subtotal, t.tax, t.total], [900, 100, 1000, 100, 1100]);

t = computeTotals([{ quantity: 1, unit_price: 900, taxable: true }], { ...base, taxRate: 10, freight: 100, freightTaxable: false });
eq("freight not taxable", [t.subtotal, t.tax, t.total], [1000, 90, 1090]);

t = computeTotals([{ quantity: 1, unit_price: 1000, taxable: true }], { ...base, taxRate: 10, taxInclusive: true, freight: 110 });
eq("freight inclusive", [t.itemsSubtotal, t.freight, t.subtotal, t.tax, t.total], [909.09, 100, 1009.09, 100.91, 1110]);

t = computeTotals([{ quantity: 1, unit_price: 1000, taxable: true }], { ...base, taxRate: 10, discountValue: 50, freight: 100 });
eq("freight is not discounted", [t.discount, t.itemsSubtotal, t.freight, t.total], [500, 500, 100, 660]);

t = computeTotals([{ quantity: 1, unit_price: 900, taxable: true }], { ...base, taxRate: 10, freight: 0 });
eq("zero freight changes nothing", [t.freight, t.subtotal, t.tax, t.total], [0, 900, 90, 990]);

t = computeTotals([], { ...base, taxRate: 10, freight: 50 });
eq("freight only", [t.subtotal, t.tax, t.total], [50, 5, 55]);

// The Hause Realty template example: 900 ex GST, 10% GST, no freight
t = computeTotals([{ quantity: 1, unit_price: 900, taxable: true }], { ...base, taxRate: 10, freight: 0 });
eq("template example", [t.subtotal, t.freight, t.tax, t.total], [900, 0, 90, 990]);

// Status logic
eq("draft stays draft", effectiveStatus({ status: "draft", due_date: "2020-01-01", total: 100, amount_paid: 0 }, "2026-01-01"), "draft");
eq("overdue", effectiveStatus({ status: "sent", due_date: "2025-12-31", total: 100, amount_paid: 0 }, "2026-01-01"), "overdue");
eq("partial", effectiveStatus({ status: "sent", due_date: "2026-02-01", total: 100, amount_paid: 40 }, "2026-01-01"), "partial");
eq("paid by balance", effectiveStatus({ status: "sent", due_date: "2025-01-01", total: 100, amount_paid: 100 }, "2026-01-01"), "paid");

console.log(failed ? `\n${failed} test(s) failed` : "\nAll calculation tests passed");
process.exit(failed ? 1 : 0);
