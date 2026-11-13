// Fills an empty database with realistic sample data so you can see the
// dashboard and reports working. Run with: npm run seed:demo
// It refuses to run if invoices already exist. Remove the data later with
// npm run seed:demo -- --clear
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"); process.exit(1); }
const db = createClient(url, key, { auth: { persistSession: false } });
const DEMO = "[demo]";

if (process.argv.includes("--clear")) {
  const { data: cl } = await db.from("clients").select("id").like("notes", `${DEMO}%`);
  const ids = (cl ?? []).map((c) => c.id);
  if (ids.length) {
    await db.from("invoices").delete().in("client_id", ids);
    await db.from("clients").delete().in("id", ids);
  }
  console.log(`Removed ${ids.length} demo clients and their invoices.`);
  process.exit(0);
}

const { count } = await db.from("invoices").select("id", { count: "exact", head: true });
if (count) { console.error(`There are already ${count} invoices. Demo data is only added to an empty database.`); process.exit(1); }

const { data: s } = await db.from("settings").select("*").eq("id", 1).single();
const rate = Number(s?.tax_rate ?? 15);
const terms = Number(s?.payment_terms_days ?? 14);

let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = (a) => a[Math.floor(rand() * a.length)];
const round2 = (n) => Math.round(n * 100) / 100;
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);

const people = [
  ["Ravinesh Kumar", "ravinesh.k@example.com", "Lot 12 Rewa Street, Suva"],
  ["Mereani Tuisawau", "mereani.t@example.com", "45 Brown Street, Suva"],
  ["Pacific Harbour Holdings Ltd", "accounts@pacificharbour.example.com", "Queens Road, Pacific Harbour"],
  ["Anjali and Rohit Sharma", "sharma.family@example.com", "8 Princes Road, Tamavua"],
  ["Coral Coast Rentals", "admin@coralcoast.example.com", "Korotogo, Sigatoka"],
  ["Jone Vakarau", "jone.v@example.com", "22 Ratu Sukuna Road, Nadi"],
  ["Lautoka Commercial Trust", "trust@lautokacommercial.example.com", "Vitogo Parade, Lautoka"],
  ["Sarah Whitfield", "s.whitfield@example.com", "3 Bau Street, Suva"],
];
const streets = ["Waimanu Road", "Milverton Road", "Laucala Bay Road", "Fletcher Road", "Grantham Road", "Queens Road", "Martintar", "Namaka", "Denarau Island", "Votualevu"];

const { data: clients, error: cErr } = await db.from("clients")
  .insert(people.map(([name, email, address]) => ({ name, email, address, notes: `${DEMO} Sample client` }))).select("id,name");
if (cErr) { console.error(cErr.message); process.exit(1); }

const today = new Date();
let made = 0;
for (let m = 13; m >= 0; m--) {
  const perMonth = 3 + Math.floor(rand() * 4);
  for (let k = 0; k < perMonth; k++) {
    const issue = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - m, 1 + Math.floor(rand() * 27)));
    if (issue > today) continue;
    const due = addDays(issue, terms);
    const client = pick(clients);
    const property = `${10 + Math.floor(rand() * 180)} ${pick(streets)}`;
    const kind = rand();
    let items;
    if (kind < 0.35) {
      const price = Math.round((180000 + rand() * 900000) / 1000) * 1000;
      items = [{ description: `Sales commission, ${property}\n2.5% of $${price.toLocaleString("en")} sale price`, quantity: 1, unit_price: round2(price * 0.025), taxable: true },
               { description: "Listing and marketing", quantity: 1, unit_price: 850, taxable: true }];
    } else if (kind < 0.8) {
      const rent = Math.round((1200 + rand() * 3800) / 50) * 50;
      items = [{ description: `Property management fee, ${property}\n8% of $${rent.toLocaleString("en")} rent collected`, quantity: 1, unit_price: round2(rent * 0.08), taxable: true },
               ...(rand() < 0.4 ? [{ description: "Routine inspection", quantity: 1, unit_price: 120, taxable: true }] : [])];
    } else {
      items = [{ description: `Valuation report, ${property}`, quantity: 1, unit_price: 450 + Math.round(rand() * 6) * 50, taxable: true },
               { description: "Title search (disbursement)", quantity: 1, unit_price: 35, taxable: false }];
    }
    const taxable = items.filter((i) => i.taxable).reduce((a, i) => a + i.unit_price * i.quantity, 0);
    const net = round2(items.reduce((a, i) => a + i.unit_price * i.quantity, 0));
    const tax = round2(taxable * rate / 100);
    const isDraft = m === 0 && rand() < 0.25;

    const { data: id, error } = await db.rpc("save_invoice", {
      p_id: null,
      p_invoice: {
        client_id: client.id, status: isDraft ? "draft" : "sent", issue_date: iso(issue), due_date: iso(due),
        property_address: property, tax_label: s?.tax_label ?? "GST", tax_rate: rate, tax_inclusive: false,
        discount_type: "percent", discount_value: 0, subtotal: net, discount_total: 0, tax_total: tax, total: round2(net + tax),
        notes: "", terms: s?.default_terms ?? "",
      },
      p_items: items,
    });
    if (error) { console.error(error.message); process.exit(1); }
    made++;
    if (isDraft) continue;

    // Older invoices are mostly paid; recent ones are a mix.
    const total = round2(net + tax);
    const r = rand();
    const payChance = m >= 3 ? 0.9 : m >= 1 ? 0.65 : 0.3;
    if (r < payChance) {
      const paidOn = addDays(issue, 3 + Math.floor(rand() * (terms + 12)));
      if (paidOn <= today) {
        const split = rand() < 0.2;
        const first = split ? round2(total * 0.5) : total;
        await db.from("payments").insert({ invoice_id: id, amount: first, paid_on: iso(paidOn), method: pick(["Bank transfer", "Bank transfer", "M-PAiSA", "Cheque"]) });
        if (split && addDays(paidOn, 14) <= today) {
          await db.from("payments").insert({ invoice_id: id, amount: round2(total - first), paid_on: iso(addDays(paidOn, 14)), method: "Bank transfer" });
        }
      }
    }
  }
}
console.log(`Added ${clients.length} demo clients and ${made} invoices. Remove them with: npm run seed:demo -- --clear`);
