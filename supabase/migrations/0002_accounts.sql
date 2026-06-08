-- Prime Financial Service — deposit accounts (Savings, Daily Susu, Fixed Deposit)
-- Run after 0001_init.sql.
-- See BUSINESS_LOGIC.md for the product rules these tables support.

-- ========================================
-- ACCOUNTS
-- One row per account a client holds. product_type selects which of the
-- product-specific columns below apply (enforced by accounts_product_fields_check).
--
-- status: 'active'  -> normal transactions allowed
--         'dormant' -> no activity for N months, needs reactivation
--         'closed'  -> balance withdrawn, archived
--         'matured' -> fixed deposit only, awaiting payout/rollover instruction
-- ========================================
create table accounts (
  id uuid primary key default gen_random_uuid(),
  account_number text not null unique,               -- e.g. SAV-00001 / SUS-00001 / FXD-00001, generated on opening
  client_id uuid not null references clients (id) on delete restrict,
  product_type text not null check (product_type in ('savings', 'susu', 'fixed_deposit')),
  status text not null default 'active'
    check (status in ('active', 'dormant', 'closed', 'matured')),
  branch text,
  agent_id uuid references profiles (id),            -- assigned collector/agent (susu) or relationship officer
  opening_date date not null default current_date,
  balance numeric(12, 2) not null default 0 check (balance >= 0),

  -- Savings-specific
  minimum_opening_deposit numeric(12, 2) check (minimum_opening_deposit >= 0),
  minimum_operating_balance numeric(12, 2) check (minimum_operating_balance >= 0),
  interest_rate_annual numeric(5, 2) check (interest_rate_annual >= 0),

  -- Daily Susu-specific
  daily_contribution_amount numeric(12, 2) check (daily_contribution_amount > 0),
  cycle_length_days integer check (cycle_length_days > 0),

  -- Fixed Deposit-specific
  principal_amount numeric(12, 2) check (principal_amount > 0),
  tenor_days integer check (tenor_days > 0),
  maturity_date date,
  maturity_instruction text
    check (maturity_instruction in ('payout_full', 'rollover_principal', 'rollover_principal_and_interest')),

  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint accounts_product_fields_check check (
    (product_type = 'savings' and daily_contribution_amount is null and principal_amount is null and tenor_days is null)
    or (product_type = 'susu' and daily_contribution_amount is not null and principal_amount is null and tenor_days is null)
    or (product_type = 'fixed_deposit' and principal_amount is not null and tenor_days is not null and daily_contribution_amount is null)
  )
);

create index accounts_client_id_idx on accounts (client_id);
create index accounts_product_type_idx on accounts (product_type);
create index accounts_status_idx on accounts (status);

create trigger accounts_set_updated_at before update on accounts
  for each row execute function set_updated_at();

-- ========================================
-- Account number generator — prefix by product type, shared sequence
-- ========================================
create sequence account_code_seq start 1;

create or replace function generate_account_number()
returns trigger as $$
declare
  prefix text;
begin
  if new.account_number is null or new.account_number = '' then
    prefix := case new.product_type
      when 'savings' then 'SAV'
      when 'susu' then 'SUS'
      when 'fixed_deposit' then 'FXD'
    end;
    new.account_number := prefix || '-' || lpad(nextval('account_code_seq')::text, 5, '0');
  end if;
  return new;
end;
$$ language plpgsql;

create trigger accounts_generate_number before insert on accounts
  for each row execute function generate_account_number();

-- ========================================
-- ROW LEVEL SECURITY
-- Same shape as clients/loans: staff & admin can read and open accounts;
-- only admins can update (e.g. change status, correct details) or delete.
-- ========================================
alter table accounts enable row level security;

create policy "accounts_select" on accounts
  for select using (is_staff_or_admin());

create policy "accounts_insert" on accounts
  for insert with check (is_staff_or_admin());

create policy "accounts_update_admin_only" on accounts
  for update using (is_admin()) with check (is_admin());

create policy "accounts_delete_admin_only" on accounts
  for delete using (is_admin());
