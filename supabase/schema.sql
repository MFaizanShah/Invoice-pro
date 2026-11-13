-- Invoice Pro schema, version 2.
-- Run the whole file in the Supabase SQL editor. It is safe to run again:
-- it also upgrades a database created with version 1.

create extension if not exists "pgcrypto";

-- ───────────── settings (single row) ─────────────
create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  company_name text not null default 'Your Real Estate Co.',
  company_address text default '',
  company_email text default '',
  company_phone text default '',
  company_tax_number text default '',
  tax_label text not null default 'GST',
  tax_rate numeric(6,3) not null default 15 check (tax_rate >= 0 and tax_rate <= 100),
  prices_include_tax boolean not null default false,
  currency text not null default 'FJD',
  invoice_prefix text not null default 'INV-',
  next_number int not null default 1001 check (next_number > 0),
  payment_terms_days int not null default 14 check (payment_terms_days >= 0),
  bank_details text default '',
  default_notes text default '',
  default_terms text default 'Payment is due by the date shown above. Thank you for your business.',
  updated_at timestamptz not null default now()
);
alter table public.settings add column if not exists logo_data text default '';
alter table public.settings add column if not exists accent_color text not null default '#0F535B';
alter table public.settings add column if not exists company_legal_line text default '';
alter table public.settings add column if not exists company_licence text default '';
alter table public.settings add column if not exists tax_number_label text not null default 'GST number';
alter table public.settings add column if not exists document_title text not null default 'Tax invoice';
alter table public.settings add column if not exists document_subtitle text not null default 'Professional Service Invoice';
alter table public.settings add column if not exists payment_method_title text not null default 'By Direct Debit / Bank Transfer';
alter table public.settings add column if not exists number_padding int not null default 4 check (number_padding between 1 and 10);
alter table public.settings add column if not exists show_freight boolean not null default true;
insert into public.settings (id) values (1) on conflict do nothing;

-- ───────────── clients ─────────────
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text default '',
  phone text default '',
  address text default '',
  created_at timestamptz not null default now()
);
alter table public.clients add column if not exists notes text default '';

-- ───────────── service presets ─────────────
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit_price numeric(14,2) not null default 0,
  taxable boolean not null default true,
  created_at timestamptz not null default now()
);

-- ───────────── invoices ─────────────
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  client_id uuid references public.clients(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','sent','paid','void')),
  issue_date date not null default current_date,
  due_date date not null default current_date,
  reference text default '',
  property_address text default '',
  tax_label text not null default 'GST',
  tax_rate numeric(6,3) not null default 15,
  tax_inclusive boolean not null default false,
  discount_type text not null default 'percent' check (discount_type in ('percent','amount')),
  discount_value numeric(14,2) not null default 0 check (discount_value >= 0),
  subtotal numeric(14,2) not null default 0,
  discount_total numeric(14,2) not null default 0,
  tax_total numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  amount_paid numeric(14,2) not null default 0 check (amount_paid >= 0),
  notes text default '',
  terms text default '',
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists invoices_client_idx on public.invoices(client_id);
create index if not exists invoices_issue_idx on public.invoices(issue_date);
create index if not exists invoices_status_idx on public.invoices(status);
alter table public.invoices add column if not exists freight_amount numeric(14,2) not null default 0 check (freight_amount >= 0);
alter table public.invoices add column if not exists freight_taxable boolean not null default true;

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  position int not null default 0,
  description text not null default '',
  quantity numeric(14,3) not null default 1 check (quantity >= 0),
  unit_price numeric(14,2) not null default 0,
  taxable boolean not null default true
);
create index if not exists invoice_items_invoice_idx on public.invoice_items(invoice_id);

-- ───────────── payments ledger ─────────────
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  paid_on date not null default current_date,
  method text not null default 'Bank transfer',
  reference text default '',
  created_at timestamptz not null default now()
);
create index if not exists payments_invoice_idx on public.payments(invoice_id);
create index if not exists payments_paid_on_idx on public.payments(paid_on);

-- ───────────── activity log ─────────────
create table if not exists public.invoice_events (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  kind text not null,
  detail text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists invoice_events_invoice_idx on public.invoice_events(invoice_id, created_at desc);

-- Upgrade from version 1: turn any single recorded amount into a ledger entry.
insert into public.payments (invoice_id, amount, paid_on, method, reference)
select i.id, i.amount_paid, coalesce(i.paid_at::date, i.issue_date), 'Bank transfer', 'Carried over'
  from public.invoices i
 where i.amount_paid > 0
   and not exists (select 1 from public.payments p where p.invoice_id = i.id);

-- ───────────── atomic invoice numbering ─────────────
create or replace function public.next_invoice_number()
returns text
language plpgsql
security invoker
as $$
declare
  s public.settings;
begin
  update public.settings
     set next_number = next_number + 1
   where id = 1
   returning * into s;
  return s.invoice_prefix || lpad((s.next_number - 1)::text, s.number_padding, '0');
end;
$$;

-- ───────────── transactional save ─────────────
-- Creates or updates an invoice together with its line items in one transaction.
-- Pass p_id as null to create. Returns the invoice id.
create or replace function public.save_invoice(p_id uuid, p_invoice jsonb, p_items jsonb)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_id uuid := p_id;
  v_number text;
  v_old_status text;
  v_new_status text := coalesce(p_invoice->>'status', 'draft');
begin
  if v_id is null then
    v_number := public.next_invoice_number();
    insert into public.invoices (number, status) values (v_number, v_new_status) returning id into v_id;
    insert into public.invoice_events (invoice_id, kind, detail)
    values (v_id, 'created', 'Invoice ' || v_number || ' created');
    v_old_status := v_new_status;
  else
    select status, number into v_old_status, v_number from public.invoices where id = v_id for update;
    if not found then
      raise exception 'Invoice not found';
    end if;
    v_number := coalesce(nullif(trim(p_invoice->>'number'), ''), v_number);
  end if;

  update public.invoices set
    number           = v_number,
    client_id        = nullif(p_invoice->>'client_id', '')::uuid,
    status           = v_new_status,
    issue_date       = (p_invoice->>'issue_date')::date,
    due_date         = (p_invoice->>'due_date')::date,
    reference        = coalesce(p_invoice->>'reference', ''),
    property_address = coalesce(p_invoice->>'property_address', ''),
    tax_label        = coalesce(p_invoice->>'tax_label', 'GST'),
    tax_rate         = coalesce((p_invoice->>'tax_rate')::numeric, 0),
    tax_inclusive    = coalesce((p_invoice->>'tax_inclusive')::boolean, false),
    discount_type    = coalesce(p_invoice->>'discount_type', 'percent'),
    discount_value   = coalesce((p_invoice->>'discount_value')::numeric, 0),
    freight_amount   = coalesce((p_invoice->>'freight_amount')::numeric, 0),
    freight_taxable  = coalesce((p_invoice->>'freight_taxable')::boolean, true),
    subtotal         = coalesce((p_invoice->>'subtotal')::numeric, 0),
    discount_total   = coalesce((p_invoice->>'discount_total')::numeric, 0),
    tax_total        = coalesce((p_invoice->>'tax_total')::numeric, 0),
    total            = coalesce((p_invoice->>'total')::numeric, 0),
    notes            = coalesce(p_invoice->>'notes', ''),
    terms            = coalesce(p_invoice->>'terms', '')
  where id = v_id;

  -- The total may have changed, so settle the paid date again.
  update public.invoices set
    paid_at = case when total > 0 and amount_paid >= total then coalesce(paid_at, now()) else null end
  where id = v_id;

  delete from public.invoice_items where invoice_id = v_id;
  insert into public.invoice_items (invoice_id, position, description, quantity, unit_price, taxable)
  select v_id,
         (t.ord - 1)::int,
         coalesce(t.x->>'description', ''),
         coalesce((t.x->>'quantity')::numeric, 1),
         coalesce((t.x->>'unit_price')::numeric, 0),
         coalesce((t.x->>'taxable')::boolean, true)
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) with ordinality as t(x, ord);

  if p_id is not null then
    if v_old_status is distinct from v_new_status then
      insert into public.invoice_events (invoice_id, kind, detail)
      values (v_id, 'status', case v_new_status
        when 'sent' then 'Marked as sent'
        when 'void' then 'Voided'
        when 'draft' then 'Returned to draft'
        else 'Status changed to ' || v_new_status end);
    else
      insert into public.invoice_events (invoice_id, kind, detail) values (v_id, 'updated', 'Details edited');
    end if;
  elsif v_new_status = 'sent' then
    insert into public.invoice_events (invoice_id, kind, detail) values (v_id, 'status', 'Marked as sent');
  end if;

  return v_id;
end;
$$;

-- ───────────── keep invoice balances in step with the ledger ─────────────
create or replace function public.sync_invoice_payments()
returns trigger
language plpgsql
as $$
declare
  v_inv uuid;
  v_paid numeric;
  v_last date;
begin
  if tg_op = 'DELETE' then v_inv := old.invoice_id; else v_inv := new.invoice_id; end if;

  -- Nothing to do when the invoice itself is being deleted.
  if not exists (select 1 from public.invoices where id = v_inv) then
    return null;
  end if;

  select coalesce(sum(amount), 0), max(paid_on) into v_paid, v_last
    from public.payments where invoice_id = v_inv;

  update public.invoices set
    amount_paid = v_paid,
    paid_at = case when total > 0 and v_paid >= total then v_last::timestamptz else null end,
    status = case when status = 'draft' and v_paid > 0 then 'sent' else status end
  where id = v_inv;

  if tg_op = 'INSERT' then
    insert into public.invoice_events (invoice_id, kind, detail)
    values (v_inv, 'payment', 'Payment of ' || to_char(new.amount, 'FM999,999,999,990.00') || ' recorded (' || new.method || ')');
  elsif tg_op = 'DELETE' then
    insert into public.invoice_events (invoice_id, kind, detail)
    values (v_inv, 'payment_removed', 'Payment of ' || to_char(old.amount, 'FM999,999,999,990.00') || ' removed');
  end if;
  return null;
end;
$$;

drop trigger if exists payments_sync on public.payments;
create trigger payments_sync after insert or update or delete on public.payments
  for each row execute function public.sync_invoice_payments();

-- keep updated_at fresh
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists invoices_touch on public.invoices;
create trigger invoices_touch before update on public.invoices
  for each row execute function public.touch_updated_at();

-- ───────────── Row Level Security ─────────────
alter table public.settings enable row level security;
alter table public.clients enable row level security;
alter table public.services enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;
alter table public.invoice_events enable row level security;

do $$
declare t text;
begin
  foreach t in array array['settings','clients','services','invoices','invoice_items','payments','invoice_events'] loop
    execute format('drop policy if exists "auth_all" on public.%I', t);
    execute format(
      'create policy "auth_all" on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- Only signed in users may call the functions.
revoke execute on function public.next_invoice_number() from public;
revoke execute on function public.save_invoice(uuid, jsonb, jsonb) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke execute on function public.next_invoice_number() from anon';
    execute 'revoke execute on function public.save_invoice(uuid, jsonb, jsonb) from anon';
  end if;
end $$;
grant execute on function public.next_invoice_number() to authenticated;
grant execute on function public.save_invoice(uuid, jsonb, jsonb) to authenticated;

-- starter service presets for a real estate business
insert into public.services (name, unit_price, taxable)
select * from (values
  ('Sales commission', 0::numeric, true),
  ('Property management fee (monthly)', 0::numeric, true),
  ('Listing and marketing fee', 0::numeric, true),
  ('Rental placement fee', 0::numeric, true),
  ('Property inspection', 0::numeric, true),
  ('Valuation report', 0::numeric, true)
) as v(name, unit_price, taxable)
where not exists (select 1 from public.services);
