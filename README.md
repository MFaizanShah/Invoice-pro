# Invoice Pro 2

Invoicing, payments and revenue reporting for a real estate agency.
Next.js 14 (App Router), TypeScript, Tailwind CSS, Supabase.

## What it does

**Invoices**
- The invoice is its own editor. Every field on the A4 paper can be edited in place, and totals update as you type.
- Line descriptions grow to fit long text. Lines can be reordered, and any line can be switched off for GST.
- The commission calculator turns a sale price or rent amount and a percentage into a ready-made line.
- Prices can include GST or have it added on top. Discounts can be a percentage or a fixed amount, and they are spread across lines so untaxed lines never reduce the GST.
- Saving is transactional: the invoice and its lines are written in one database call, so a failure never leaves half an invoice.
- Ctrl S saves. The page warns you before you leave with unsaved changes.
- The paper shows a Paid, Overdue, Draft or Void stamp. It prints as a tax invoice when your GST number is set.
- Duplicate, void, restore, delete, and Print or save as PDF.
- Email client opens your email app with a summary and the bank details.

**Payments**
- A real payment ledger records the amount, date, method (bank transfer, cash, cheque, card, M-PAiSA) and reference.
- Part payments are supported. Status moves between Draft, Awaiting payment, Part paid, Paid and Overdue on its own.
- Every invoice keeps a history: created, sent, edited, payments recorded or removed.

**Dashboard**
- Choose a period: this month, quarter or year, the last 12 months, or all time.
- Collected and billed amounts, compared with the previous period.
- What you are owed, how much is overdue, and how many days clients take to pay on average.
- A 12 month chart of billed against collected. Hover over a month for exact figures.
- Open balances grouped by how late they are, a "chase these first" list of the most overdue invoices, and top clients.

**Reports**
- A GST summary by month and quarter for any year, with CSV export.
- Aged receivables, with CSV export.
- The invoice list sorts, filters and exports to CSV.

**Clients and setup**
- Each client has a page with billed, paid, owed and overdue totals and their full invoice list. Private notes never print.
- Settings cover the GST name and rate, prices including or excluding tax, currency, numbering, payment terms, bank details, logo, brand colour and a service price list.
- Ctrl K opens a search across every page, invoice and client.

**Security**
- Username and password admin login through Supabase Auth, with every route protected.
- Row Level Security is on every table. Database functions cannot be called by anyone who is not signed in.
- Security headers are set, and search engines are told not to index the app.

## Run locally

1. Create a project at supabase.com.
2. In the SQL editor, run all of `supabase/schema.sql`. Running it again is safe, and it upgrades a version 1 database. Any amounts already paid move into the new payment ledger.
3. Copy `.env.local.example` to `.env.local`. Fill in the URL, anon key and service role key from Project Settings, API.
4. In Supabase, open Authentication, Providers, Email and turn off "Allow new users to sign up".
5. Install and start:

```bash
npm install
npm run seed:admin      # creates the admin login from .env.local
npm run seed:demo       # optional: sample clients, invoices and payments
npm run dev
```

Open http://localhost:3000 and sign in.

To remove the sample data later, run `npm run seed:demo -- --clear`.

## Useful commands

| Command | What it does |
|---|---|
| `npm test` | Runs the calculation and reporting tests (Node 22.6 or newer) |
| `npm run build` | Production build |
| `npm run seed:admin` | Creates the admin, or resets the password after you change `ADMIN_PASSWORD` |

## Before you host it

- Change `ADMIN_PASSWORD` and run `npm run seed:admin` again.
- On your host (Vercel, for example), set every variable except `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_USERNAME` and `ADMIN_PASSWORD`. Those are only for the seed scripts.
- `NEXT_PUBLIC_TIMEZONE` decides when an invoice counts as overdue. It defaults to Pacific/Fiji.

## Project layout

```
supabase/schema.sql        tables, ledger triggers, save_invoice, security
scripts/                   admin and demo seed scripts
src/lib/calc.ts            GST, discount and status maths (tested)
src/lib/analytics.ts       dashboard and report maths (tested)
src/components/            invoice editor, chart, tables, settings, search
src/app/(app)/             dashboard, invoices, clients, reports, settings
```

## Invoice template

The invoice paper follows a professional-services layout: logo or company name top left, document title top right, company block, grey Bill To box beside a bordered Invoice #/Date/Due/Reference table, a fixed-height Details table, attached totals, a "How to pay" block and a footer.
Everything is driven from **Settings**: company legal line, tax number and its label (ABN, GST no., VAT...), licence, document title and subtitle, payment heading, number prefix and length, and the optional freight row.
Upload your logo in Settings. Use the Layout panel on an invoice to switch on Qty and Unit price columns.
If you are upgrading, re-run `supabase/schema.sql` first. `supabase/hause-realty-settings.sql` is an optional preset for that one company.
