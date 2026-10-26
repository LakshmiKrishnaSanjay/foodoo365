-- Foodoo365 investor portal.
-- Facts live in these tables. Profit, charity and inventory totals are calculated
-- by the server-side finance engine, not by the browser.
-- Amounts are integer paise (1 INR = 100 paise). Column names keep the _fils suffix.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  preferred_name text not null,
  email text not null unique,
  phone text not null,
  city text not null,
  pan text not null default '',
  joined_on date not null,
  email_alerts boolean not null default true,
  payout_alerts boolean not null default true,
  statement_alerts boolean not null default true
);

create table public.trucks (
  id text primary key,
  code text not null unique,
  name text not null,
  location text not null,
  district text not null,
  latitude double precision not null default 0,
  longitude double precision not null default 0,
  fssai text not null default '',
  gstin text not null default '',
  status text not null check (status in ('active', 'maintenance', 'inactive')),
  status_note text not null,
  reserve_bps integer not null check (reserve_bps >= 0 and reserve_bps <= 10000),
  base_meals integer not null
);

create table public.products (
  id text primary key,
  name text not null,
  category text not null,
  unit_price_fils bigint not null check (unit_price_fils >= 0),
  unit_cost_fils bigint not null check (unit_cost_fils >= 0)
);

create table public.investments (
  id text primary key,
  investor_id uuid not null references public.profiles (id) on delete cascade,
  truck_id text not null references public.trucks (id),
  invested_on date not null,
  amount_fils bigint not null check (amount_fils >= 0),
  ownership_bps integer check (ownership_bps is null or (ownership_bps >= 0 and ownership_bps <= 10000)),
  entitlement_bps integer not null check (entitlement_bps >= 0 and entitlement_bps <= 10000),
  status text not null check (status in ('active', 'closed', 'pending')),
  agreement_ref text not null,
  loss_carryforward boolean not null default false,
  notes text not null
);

create table public.sales (
  id text primary key,
  truck_id text not null references public.trucks (id),
  sale_date date not null,
  product_id text not null references public.products (id),
  quantity integer not null check (quantity > 0),
  unit_price_fils bigint not null,
  gross_fils bigint not null,
  discount_fils bigint not null default 0,
  refund_fils bigint not null default 0,
  tax_fils bigint not null default 0,
  eligible_fils bigint not null,
  charity_fils bigint not null,
  reference text not null
);

create table public.expenses (
  id text primary key,
  truck_id text not null references public.trucks (id),
  expense_date date not null,
  category text not null,
  classification text not null check (classification in ('operating', 'other_cost')),
  description text not null,
  amount_fils bigint not null check (amount_fils >= 0),
  reference text not null
);

create table public.cogs (
  id bigint generated always as identity primary key,
  truck_id text not null references public.trucks (id),
  cogs_date date not null,
  product_id text not null references public.products (id),
  quantity integer not null check (quantity >= 0),
  unit_cost_fils bigint not null,
  amount_fils bigint not null
);

create table public.inventory_movements (
  id text primary key,
  truck_id text not null references public.trucks (id),
  product_id text not null references public.products (id),
  movement_date date not null,
  movement_type text not null check (movement_type in ('opening', 'received', 'sold', 'donated', 'wasted', 'returned', 'transferred_out', 'transferred_in')),
  quantity integer not null check (quantity >= 0),
  reference text not null,
  note text not null
);

create table public.accounting_periods (
  id text primary key,
  truck_id text not null references public.trucks (id),
  label text not null,
  period_start date not null,
  period_end date not null,
  status text not null check (status in ('open', 'finalized')),
  finalized_on date
);

create table public.period_adjustments (
  id text primary key,
  truck_id text not null references public.trucks (id),
  period_id text not null references public.accounting_periods (id),
  adjustment_date date not null,
  reason text not null,
  distributable_delta_fils bigint not null,
  reference text not null
);

create table public.profit_snapshots (
  period_id text primary key references public.accounting_periods (id),
  truck_id text not null references public.trucks (id),
  before_adjustment_fils bigint not null,
  distributable_fils bigint not null,
  stored_on date not null,
  note text not null
);

create table public.payouts (
  id text primary key,
  investor_id uuid not null references public.profiles (id) on delete cascade,
  investment_id text not null references public.investments (id),
  truck_id text not null references public.trucks (id),
  period_id text not null references public.accounting_periods (id),
  amount_fils bigint not null check (amount_fils >= 0),
  payout_date date not null,
  status text not null check (status in ('paid', 'approved')),
  reference text not null,
  note text not null
);

create table public.charity_utilization (
  id text primary key,
  truck_id text not null references public.trucks (id),
  use_date date not null,
  status text not null check (status in ('sponsored', 'prepared', 'distributed')),
  meals integer not null check (meals >= 0),
  amount_fils bigint not null check (amount_fils >= 0),
  reference text not null,
  note text not null
);

create table public.notifications (
  id text primary key,
  investor_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text not null,
  category text not null check (category in ('payout', 'statement', 'operations', 'charity')),
  created_on date not null,
  href text not null,
  unread boolean not null default true
);

create index sales_truck_date_idx on public.sales (truck_id, sale_date);
create index expenses_truck_date_idx on public.expenses (truck_id, expense_date);
create index movements_truck_product_idx on public.inventory_movements (truck_id, product_id, movement_date);
create index investments_investor_idx on public.investments (investor_id);
create index payouts_investor_idx on public.payouts (investor_id);
create index notifications_investor_idx on public.notifications (investor_id, unread);

create or replace function public.my_truck_ids()
returns setof text
language sql
stable
security invoker
set search_path = public
as $$
  select truck_id from public.investments where investor_id = auth.uid()
$$;

-- Returns only the summed entitlement for trucks the caller can see.
-- It does not return other investors' identities, amounts or agreements.
create or replace function public.truck_entitlement_totals()
returns table (truck_id text, entitlement_bps integer)
language sql
stable
security definer
set search_path = public
as $$
  select i.truck_id, sum(i.entitlement_bps)::integer
  from public.investments i
  where i.status = 'active'
    and i.truck_id in (select public.my_truck_ids())
  group by i.truck_id
$$;

revoke all on function public.truck_entitlement_totals() from public;
grant execute on function public.truck_entitlement_totals() to authenticated;

alter table public.profiles enable row level security;
alter table public.trucks enable row level security;
alter table public.products enable row level security;
alter table public.investments enable row level security;
alter table public.sales enable row level security;
alter table public.expenses enable row level security;
alter table public.cogs enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.accounting_periods enable row level security;
alter table public.period_adjustments enable row level security;
alter table public.profit_snapshots enable row level security;
alter table public.payouts enable row level security;
alter table public.charity_utilization enable row level security;
alter table public.notifications enable row level security;

create policy profiles_select_own on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_update_own on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy trucks_select_invested on public.trucks for select to authenticated using (id in (select public.my_truck_ids()));
create policy products_select_authenticated on public.products for select to authenticated using (true);
create policy investments_select_own on public.investments for select to authenticated using (investor_id = auth.uid());
create policy sales_select_own_trucks on public.sales for select to authenticated using (truck_id in (select public.my_truck_ids()));
create policy expenses_select_own_trucks on public.expenses for select to authenticated using (truck_id in (select public.my_truck_ids()));
create policy cogs_select_own_trucks on public.cogs for select to authenticated using (truck_id in (select public.my_truck_ids()));
create policy movements_select_own_trucks on public.inventory_movements for select to authenticated using (truck_id in (select public.my_truck_ids()));
create policy periods_select_own_trucks on public.accounting_periods for select to authenticated using (truck_id in (select public.my_truck_ids()));
create policy adjustments_select_own_trucks on public.period_adjustments for select to authenticated using (truck_id in (select public.my_truck_ids()));
create policy snapshots_select_own_trucks on public.profit_snapshots for select to authenticated using (truck_id in (select public.my_truck_ids()));
create policy payouts_select_own on public.payouts for select to authenticated using (investor_id = auth.uid());
create policy charity_select_own_trucks on public.charity_utilization for select to authenticated using (truck_id in (select public.my_truck_ids()));
create policy notifications_select_own on public.notifications for select to authenticated using (investor_id = auth.uid());
create policy notifications_update_own on public.notifications for update to authenticated using (investor_id = auth.uid()) with check (investor_id = auth.uid());

grant select on public.profiles, public.trucks, public.products, public.investments, public.sales, public.expenses, public.cogs, public.inventory_movements, public.accounting_periods, public.period_adjustments, public.profit_snapshots, public.payouts, public.charity_utilization, public.notifications to authenticated;
grant update (full_name, preferred_name, phone, city, email_alerts, payout_alerts, statement_alerts) on public.profiles to authenticated;
grant update (unread) on public.notifications to authenticated;
