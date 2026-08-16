-- Deposits Taken From Revenue — an admin action that appropriates some
-- amount out of Total Revenue (e.g. sweeping it to an external bank
-- account not tracked in this app), replacing the deleted PFS Consolidated
-- Fund account as the mechanism for that same real-world action.
--
-- Deliberately NOT backed by an `accounts` row this time (no client-style
-- account, no `transactions` row, no balance/dep to maintain) — it's a
-- flat log, same shape as `card_fees`/`expenditures`. It never touches
-- Account Balance (see lib/finance/account-summary.ts's comment on
-- netRevenue): the cash never left the business, this only relabels
-- already-earned revenue as "swept," same as the Consolidated Fund did.
create table revenue_deposits (
  id           uuid primary key default gen_random_uuid(),
  amount       numeric(12, 2) not null check (amount > 0),
  notes        text,
  recorded_by  uuid references profiles(id),
  created_at   timestamptz not null default now()
);

create index revenue_deposits_created_at_idx on revenue_deposits (created_at);

alter table revenue_deposits enable row level security;

create policy "revenue_deposits_select" on revenue_deposits
  for select using (is_staff_or_admin());

create policy "revenue_deposits_insert" on revenue_deposits
  for insert with check (is_admin());

-- Time-window restriction (19:00–23:30 daily), enforced at the database
-- level via trigger rather than only in the API route — same reasoning as
-- 0060_consolidated_fund_deposit_window.sql: a check here can't be
-- bypassed by inserting directly against the table. Ghana runs on GMT
-- year-round (no daylight saving, same as UTC), so comparing now()'s UTC
-- wall-clock time directly against the window is correct with no timezone
-- conversion needed — revisit if the company's operating timezone changes.
create or replace function check_revenue_deposit_window()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (now() at time zone 'UTC')::time < time '19:00:00'
     or (now() at time zone 'UTC')::time > time '23:30:00' then
    raise exception 'Deposits taken from revenue can only be recorded between 19:00 and 23:30 each day';
  end if;
  return new;
end;
$$;

create trigger revenue_deposits_time_window
  before insert on revenue_deposits
  for each row execute function check_revenue_deposit_window();
