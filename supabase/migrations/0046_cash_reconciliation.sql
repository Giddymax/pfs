-- Daily cash reconciliation ledger (admin-only). One row per calendar day:
-- the opening cash-at-hand balance carried over from the previous day, what
-- was issued to a field agent to pay out withdrawals, what actually got
-- spent/deposited, and the bank balance as manually verified that day.
-- "Balance after issue", "unspent issued balance", "closing cash at hand",
-- and "total cash" are all derived from these inputs, so they are computed
-- in the app layer rather than stored.

create table cash_reconciliations (
  id                     uuid primary key default gen_random_uuid(),
  entry_date             date not null unique,
  opening_cash_at_hand   numeric(12, 2) not null default 0,
  deposit_received       numeric(12, 2) not null default 0,
  withdrawal_paid        numeric(12, 2) not null default 0,
  cash_issued_out        numeric(12, 2) not null default 0,
  cash_at_bank           numeric(12, 2) not null default 0,
  debt_owed              numeric(12, 2),
  recorded_by            uuid references profiles (id),
  created_at             timestamptz not null default now()
);

create index cash_reconciliations_entry_date_idx on cash_reconciliations (entry_date);

alter table cash_reconciliations enable row level security;

create policy "cash_reconciliations_select" on cash_reconciliations
  for select using (is_admin());

create policy "cash_reconciliations_insert" on cash_reconciliations
  for insert with check (is_admin());

create policy "cash_reconciliations_update" on cash_reconciliations
  for update using (is_admin()) with check (is_admin());

create policy "cash_reconciliations_delete" on cash_reconciliations
  for delete using (is_admin());
