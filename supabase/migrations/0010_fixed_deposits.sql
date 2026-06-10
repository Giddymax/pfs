-- Prime Financial Service — dedicated Fixed Deposit lifecycle tables
-- Run after 0009_susu_rpcs.sql.
--
-- Fixed deposits are a lump-sum term product with a maturity / rollover /
-- early-withdrawal-approval state machine — not a running ledger — so they
-- get their own table rather than living in `accounts` alongside savings
-- and susu. This migration also one-time-copies any existing
-- `accounts` rows with product_type = 'fixed_deposit' into the new table;
-- those legacy `accounts` rows are intentionally left in place (their
-- FD-specific columns are dropped by a later cleanup migration once the
-- copy has been verified against production data).

create table fixed_deposits (
  id uuid primary key default gen_random_uuid(),
  fd_number text not null unique,
  client_id uuid not null references clients(id) on delete restrict,
  principal numeric(12, 2) not null check (principal > 0),
  annual_rate_percent numeric(5, 2) not null check (annual_rate_percent >= 0),
  term_months int not null check (term_months in (3, 6, 9, 12, 18, 24)),
  start_date date not null default current_date,
  maturity_date date not null,
  expected_interest numeric(12, 2) not null,
  expected_payout numeric(12, 2) not null,
  status text not null default 'active'
    check (status in ('active', 'matured', 'pending_early', 'approved_early', 'withdrawn', 'rolled_over')),
  rolled_into_fd_id uuid references fixed_deposits(id),
  rolled_from_fd_id uuid references fixed_deposits(id),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index fixed_deposits_client_idx on fixed_deposits (client_id);
create index fixed_deposits_status_idx on fixed_deposits (status);

create trigger fixed_deposits_set_updated_at before update on fixed_deposits
  for each row execute function set_updated_at();

create table fd_events (
  id uuid primary key default gen_random_uuid(),
  fd_id uuid not null references fixed_deposits(id) on delete cascade,
  event_type text not null check (event_type in (
    'early_withdrawal_requested', 'early_withdrawal_approved', 'early_withdrawal_rejected',
    'matured_paid_out', 'rollover_requested', 'rollover_completed'
  )),
  amount numeric(12, 2),
  actor_id uuid references profiles(id),
  notes text,
  created_at timestamptz not null default now()
);

create index fd_events_fd_idx on fd_events (fd_id);

alter table fixed_deposits enable row level security;
alter table fd_events enable row level security;

create policy fixed_deposits_select on fixed_deposits for select using (is_staff_or_admin());
create policy fixed_deposits_insert on fixed_deposits for insert with check (is_staff_or_admin());
create policy fd_events_select on fd_events for select using (is_staff_or_admin());

-- Lifecycle transitions (maturity sync, early-withdrawal approval, payouts,
-- rollover) flow through `security definer` RPCs in 0011_fd_rpcs.sql, which
-- bypass RLS and re-check roles internally — direct update/delete grants
-- stay minimal on purpose, matching the transactions/susu pattern.

-- ========================================
-- fd_number generator — shares the 'FXD' prefix with the legacy
-- accounts.account_number sequence; seeded past the highest existing FXD
-- number so copied legacy numbers and freshly generated ones never collide.
-- ========================================
create sequence fd_code_seq;

select setval(
  'fd_code_seq',
  greatest(1, coalesce((
    select max(substring(account_number from '^FXD-(\d+)$')::int)
    from accounts
    where product_type = 'fixed_deposit' and account_number ~ '^FXD-\d+$'
  ), 0))
);

create or replace function generate_fd_number()
returns trigger as $$
begin
  if new.fd_number is null or new.fd_number = '' then
    new.fd_number := 'FXD-' || lpad(nextval('fd_code_seq')::text, 5, '0');
  end if;
  return new;
end;
$$ language plpgsql;

create trigger fixed_deposits_generate_number before insert on fixed_deposits
  for each row execute function generate_fd_number();

-- ========================================
-- One-time copy of legacy FD accounts into the new table.
--
-- The legacy schema never captured an annual interest rate for fixed
-- deposits (accounts.interest_rate_annual is savings-only in the UI), so
-- annual_rate_percent defaults to 0 here and should be corrected manually
-- per client agreement after review. term_months is approximated from the
-- legacy tenor_days via nearest-bucket mapping onto the supported terms.
-- ========================================
insert into fixed_deposits (
  fd_number, client_id, principal, annual_rate_percent, term_months,
  start_date, maturity_date, expected_interest, expected_payout,
  status, created_by, created_at, updated_at
)
select
  a.account_number,
  a.client_id,
  a.principal_amount,
  coalesce(a.interest_rate_annual, 0),
  v.term_months,
  a.opening_date,
  (a.opening_date + (v.term_months || ' months')::interval)::date,
  round(a.principal_amount * (coalesce(a.interest_rate_annual, 0) / 100) * (v.term_months / 12.0), 2),
  a.principal_amount + round(a.principal_amount * (coalesce(a.interest_rate_annual, 0) / 100) * (v.term_months / 12.0), 2),
  case when a.status = 'matured' then 'matured' else 'active' end,
  a.created_by,
  a.created_at,
  a.updated_at
from accounts a
cross join lateral (
  select case
    when a.tenor_days is null or a.tenor_days <= 100 then 3
    when a.tenor_days <= 190 then 6
    when a.tenor_days <= 280 then 9
    when a.tenor_days <= 380 then 12
    when a.tenor_days <= 560 then 18
    else 24
  end as term_months
) v
where a.product_type = 'fixed_deposit' and a.principal_amount is not null
on conflict (fd_number) do nothing;
