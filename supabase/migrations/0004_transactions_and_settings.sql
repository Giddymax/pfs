-- Prime Financial Service — transactions ledger, card fees, settings, SMS log
-- Run after 0001_init.sql, 0002_accounts.sql, 0003_clients_town.sql.
-- Lays the schema foundation for the business-logic redesign — no behaviour
-- change to existing flows yet (RPC engines land in later migrations).

-- ========================================
-- CLIENTS — widen status, enforce unique phone, SMS opt-in
-- ========================================
alter table clients drop constraint clients_status_check;
alter table clients add constraint clients_status_check
  check (status in ('active', 'inactive', 'dormant', 'suspended'));

-- NOTE: if this fails with a unique-violation, dedupe existing duplicate phone
-- numbers manually before re-running (see plan's "Open follow-ups").
alter table clients add constraint clients_phone_unique unique (phone);

alter table clients add column sms_opt_in boolean not null default true;

-- ========================================
-- ACCOUNTS — add the lifetime running totals (dep/wdr/comm).
-- `balance` already plays the role of the spec's `bal` (current balance) —
-- it is NOT renamed, to avoid touching every existing read site; think of
-- `balance` as `bal` going forward.
-- ========================================
alter table accounts add column dep numeric(12, 2) not null default 0 check (dep >= 0);
alter table accounts add column wdr numeric(12, 2) not null default 0 check (wdr >= 0);
alter table accounts add column comm numeric(12, 2) not null default 0 check (comm >= 0);

-- ========================================
-- TRANSACTIONS
-- The unified ledger for savings & susu deposits/withdrawals. Every row
-- snapshots the resulting balance (bal_after) for audit trail and instant
-- reversal. Edits/deletes are admin-only and handled by RPCs (0006) that
-- keep this snapshot chain consistent — never written to directly by the app.
-- ========================================
create table transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts (id) on delete restrict,
  client_id uuid not null references clients (id) on delete restrict,
  type text not null check (type in ('deposit', 'withdrawal', 'fee', 'reversal')),
  amount numeric(12, 2) not null check (amount > 0),
  fee numeric(12, 2) not null default 0 check (fee >= 0),
  bal_after numeric(12, 2) not null,

  notes text,
  recorded_by uuid references profiles (id),

  -- Edit trail (admin-only, via edit_transaction RPC)
  original_amount numeric(12, 2),
  edited_by uuid references profiles (id),
  edited_at timestamptz,

  -- Reversal trail (admin-only, via delete_transaction RPC — soft delete so
  -- the audit trail is never destroyed)
  reversed_by uuid references profiles (id),
  reversed_at timestamptz,

  created_at timestamptz not null default now()
);

create index transactions_account_id_idx on transactions (account_id);
create index transactions_client_id_idx on transactions (client_id);
create index transactions_type_idx on transactions (type);
create index transactions_created_at_idx on transactions (created_at);

-- ========================================
-- CARD FEES
-- One row per GHS 20 registration/card fee charged at client onboarding.
-- Charging is non-blocking — a failed insert here must never prevent
-- registering the client (handled at the application layer).
-- ========================================
create table card_fees (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id) on delete cascade,
  amount numeric(12, 2) not null default 20 check (amount >= 0),
  charged_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

create index card_fees_client_id_idx on card_fees (client_id);

-- ========================================
-- SETTINGS
-- Key/value store (jsonb) so individual configuration values can change
-- without a migration. Seeded with the spec's defaults below.
-- ========================================
create table settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references profiles (id),
  updated_at timestamptz not null default now()
);

create trigger settings_set_updated_at before update on settings
  for each row execute function set_updated_at();

insert into settings (key, value) values
  ('commission_tiers', '[
    {"min": 50,   "max": 200,  "fee": 5},
    {"min": 300,  "max": 500,  "fee": 10},
    {"min": 600,  "max": 1000, "fee": 15},
    {"min": 1000, "max": 1500, "fee": 20},
    {"min": 2000, "max": null, "fee": 40}
  ]'::jsonb),
  ('sms', '{
    "sms_enabled": false,
    "sms_client_enabled": true,
    "sms_admin_enabled": true,
    "sms_deposit": true,
    "sms_withdrawal": true,
    "sms_payment": true,
    "company_tel": null
  }'::jsonb),
  ('card_fee_amount', '20'::jsonb),
  ('fd_terms_months', '[3, 6, 9, 12, 18, 24]'::jsonb),
  ('emergency_claim_penalty_basis', '"daily_contribution_amount"'::jsonb);

-- ========================================
-- SMS LOG
-- One row per send attempt (success or failure) — feeds the "SMS Charges"
-- line of the dashboard reconciliation formula via sum(cost).
-- ========================================
create table sms_log (
  id uuid primary key default gen_random_uuid(),
  recipient_phone text not null,
  recipient_type text not null check (recipient_type in ('client', 'admin')),
  event text not null,
  message text not null,
  status text not null check (status in ('sent', 'failed')),
  cost numeric(12, 2),
  related_client_id uuid references clients (id),
  created_at timestamptz not null default now()
);

create index sms_log_related_client_id_idx on sms_log (related_client_id);
create index sms_log_created_at_idx on sms_log (created_at);

-- ========================================
-- ROW LEVEL SECURITY
-- Mutations on the ledger/fee tables flow through security-definer RPCs
-- (which bypass RLS), so direct insert/update/delete grants stay minimal —
-- the RPC path is the only practical way to mutate balances.
-- ========================================
alter table transactions enable row level security;
alter table card_fees enable row level security;
alter table settings enable row level security;
alter table sms_log enable row level security;

create policy "transactions_select" on transactions
  for select using (is_staff_or_admin());

create policy "card_fees_select" on card_fees
  for select using (is_staff_or_admin());

create policy "card_fees_insert" on card_fees
  for insert with check (is_staff_or_admin());

create policy "settings_select" on settings
  for select using (is_staff_or_admin());

create policy "settings_admin_write" on settings
  for all using (is_admin()) with check (is_admin());

create policy "sms_log_select" on sms_log
  for select using (is_staff_or_admin());
