-- Prime Financial Service — daily susu cycles, payments & claims
-- Run after 0007_loan_rpcs.sql.
--
-- A susu account accumulates daily contributions over a 31-day cycle; day 31
-- is retained by the company as its fee and the next cycle opens immediately.
-- Cash movements still flow through the unified `transactions` ledger (via
-- the Phase B deposit/withdrawal RPCs) so the dashboard reconciliation
-- formula balances — these tables only add cycle/claim *tracking* on top.

create table susu_cycles (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  cycle_number int not null check (cycle_number > 0),
  started_on date not null default current_date,
  completed_on date,
  status text not null default 'in_progress' check (status in ('in_progress', 'complete', 'closed')),
  total_collected numeric(12, 2) not null default 0,
  company_fee numeric(12, 2),
  created_at timestamptz not null default now(),
  unique (account_id, cycle_number)
);

create index susu_cycles_account_idx on susu_cycles (account_id);
create index susu_cycles_active_idx on susu_cycles (account_id) where status = 'in_progress';

create table susu_payments (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references susu_cycles(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete restrict,
  transaction_id uuid references transactions(id),
  amount numeric(12, 2) not null check (amount > 0),
  day_in_cycle int not null check (day_in_cycle between 1 and 31),
  payment_date date not null default current_date,
  recorded_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (cycle_id, day_in_cycle)
);

create index susu_payments_cycle_idx on susu_payments (cycle_id);
create index susu_payments_account_idx on susu_payments (account_id);

create table susu_claims (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete restrict,
  cycle_id uuid references susu_cycles(id),
  transaction_id uuid references transactions(id),
  claim_type text not null check (claim_type in ('normal', 'emergency')),
  status text not null default 'pending_admin' check (status in ('pending_admin', 'approved', 'paid', 'rejected')),
  amount numeric(12, 2) not null check (amount > 0),
  penalty_amount numeric(12, 2) not null default 0,
  requested_by uuid references profiles(id),
  approved_by uuid references profiles(id),
  paid_by uuid references profiles(id),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  paid_at timestamptz
);

create index susu_claims_account_idx on susu_claims (account_id);
create index susu_claims_status_idx on susu_claims (status);

alter table susu_cycles enable row level security;
alter table susu_payments enable row level security;
alter table susu_claims enable row level security;

create policy susu_cycles_select on susu_cycles for select using (is_staff_or_admin());
create policy susu_payments_select on susu_payments for select using (is_staff_or_admin());
create policy susu_claims_select on susu_claims for select using (is_staff_or_admin());
create policy susu_claims_insert on susu_claims for insert with check (is_staff_or_admin());

-- All mutations beyond the initial claim request flow through `security
-- definer` RPCs (0009_susu_rpcs.sql), which bypass these policies and
-- re-check roles internally — keeping direct grants minimal on purpose.
