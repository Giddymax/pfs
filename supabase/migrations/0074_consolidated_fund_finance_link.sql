-- Reconnects the PFS Consolidated Fund to the Finance page, this time as a
-- real accounts row (the account was deleted entirely in 0069) rather than
-- the flat revenue_deposits log (0070) that replaced it. The admin has
-- already re-registered a "PFS CONSOLIDATED FUND" client and opened a
-- normal savings account for them by hand — this migration marks that
-- specific account as the one-and-only fund account and wires up its
-- special behavior:
--
--   1. Deposits into it are blocked everywhere EXCEPT through the new
--      record_revenue_deposit() RPC (the Finance page's Deposit Revenue
--      button) — enforced inside record_deposit() itself so it can't be
--      bypassed by calling the RPC directly, same reasoning 0060 used for
--      the original SAV-00079 time-window rule this replaces in spirit.
--   2. Any expenditure recorded on the Finance page is now, for real, a
--      withdrawal from this account (record_expenditure()) — and any OTHER
--      withdrawal from this account (recorded normally, from the account's
--      own page) is mirrored into an expenditures row automatically
--      (sync_fund_withdrawal_to_expenditure() trigger). The two stay in
--      lockstep regardless of which side an admin starts from.
--
-- Total Expenditure and Net Balance on the Finance page (app code, not
-- this migration) now read directly off this account's wdr/balance columns
-- instead of the expenditures table — with #1 and #2 above in place, the
-- two are the same number by construction going forward.

alter table accounts add column is_consolidated_fund boolean not null default false;

-- At most one row can ever be flagged — every function below that looks
-- this account up assumes exactly zero or one exists.
create unique index accounts_one_consolidated_fund_idx
  on accounts (is_consolidated_fund) where is_consolidated_fund;

update accounts a
set is_consolidated_fund = true
from clients c
where a.client_id = c.id
  and c.full_name = 'PFS CONSOLIDATED FUND'
  and a.product_type = 'savings';

create or replace function consolidated_fund_account_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from accounts where is_consolidated_fund limit 1;
$$;

-- expenditures <-> the fund withdrawal that backs it. Nullable: only
-- expenditures created after this migration (or ones a future backfill
-- chooses to link) have one.
alter table expenditures add column linked_transaction_id uuid references transactions (id);

-- ========================================
-- record_deposit — same signature as before (0069), so this replaces the
-- real function rather than adding an overload. Adds exactly one new
-- check: reject any deposit aimed at the Consolidated Fund account.
-- ========================================
create or replace function record_deposit(
  p_account_id  uuid,
  p_amount      numeric,
  p_recorded_by uuid,
  p_notes       text        default null,
  p_created_at  timestamptz default null
)
returns transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account     accounts%rowtype;
  v_new_balance numeric(12, 2);
  v_txn         transactions%rowtype;
  v_ts          timestamptz;
begin
  if not is_staff_or_admin() then
    raise exception 'Only staff or admin can record transactions';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  select * into v_account from accounts where id = p_account_id for update;
  if not found then
    raise exception 'Account not found';
  end if;

  if v_account.is_consolidated_fund then
    raise exception 'Deposits to the PFS Consolidated Fund can only be recorded through Deposit Revenue on the Finance page';
  end if;

  v_new_balance := v_account.balance + p_amount;
  v_ts          := coalesce(p_created_at, now());

  update accounts
  set balance = v_new_balance,
      dep     = dep + p_amount
  where id = p_account_id;

  insert into transactions (account_id, client_id, type, amount, fee, bal_after, notes, recorded_by, created_at)
  values (p_account_id, v_account.client_id, 'deposit', p_amount, 0, v_new_balance, p_notes, p_recorded_by, v_ts)
  returning * into v_txn;

  return v_txn;
end;
$$;

-- ========================================
-- record_revenue_deposit — the ONLY legitimate way money enters the
-- Consolidated Fund. Inlines its own balance mutation (doesn't call
-- record_deposit(), which would just reject it) — same pattern
-- activate_loan() already uses for its own direct transaction insert.
-- Keeps the 19:00-23:30 window revenue_deposits (0070) enforced, same
-- daily "close the books" ritual, now against a real account.
-- ========================================
create or replace function record_revenue_deposit(
  p_amount      numeric,
  p_notes       text,
  p_recorded_by uuid
)
returns transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fund_id     uuid;
  v_account     accounts%rowtype;
  v_new_balance numeric(12, 2);
  v_txn         transactions%rowtype;
begin
  if not is_admin() then
    raise exception 'Only an admin can deposit revenue into the PFS Consolidated Fund';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  if (now() at time zone 'UTC')::time < time '19:00:00'
     or (now() at time zone 'UTC')::time > time '23:30:00' then
    raise exception 'Revenue can only be deposited into the PFS Consolidated Fund between 19:00 and 23:30 each day';
  end if;

  v_fund_id := consolidated_fund_account_id();
  if v_fund_id is null then
    raise exception 'No PFS Consolidated Fund account is set up (accounts.is_consolidated_fund)';
  end if;

  select * into v_account from accounts where id = v_fund_id for update;

  v_new_balance := v_account.balance + p_amount;

  update accounts
  set balance = v_new_balance,
      dep     = dep + p_amount
  where id = v_fund_id;

  insert into transactions (account_id, client_id, type, amount, fee, bal_after, notes, recorded_by, created_at)
  values (v_fund_id, v_account.client_id, 'deposit', p_amount, 0, v_new_balance, p_notes, p_recorded_by, now())
  returning * into v_txn;

  return v_txn;
end;
$$;

-- ========================================
-- record_expenditure — the "Add expenditure" flow, rewritten to actually
-- draw the money out of the Consolidated Fund in the same breath as
-- logging it. One function, one transaction: no separate trigger needed
-- on this side, since both rows are inserted here directly. The
-- '[expenditure:...]' prefix stamped into the withdrawal's own notes is
-- what tells sync_fund_withdrawal_to_expenditure() below not to create a
-- SECOND expenditures row mirroring this same withdrawal.
-- ========================================
create or replace function record_expenditure(
  p_title       text,
  p_amount      numeric,
  p_category    text,
  p_date        date,
  p_notes       text,
  p_recorded_by uuid
)
returns expenditures
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fund_id     uuid;
  v_account     accounts%rowtype;
  v_new_balance numeric(12, 2);
  v_txn         transactions%rowtype;
  v_expenditure expenditures%rowtype;
  v_txn_notes   text;
begin
  if not is_admin() then
    raise exception 'Only an admin can record an expenditure';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;
  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'Title is required';
  end if;

  v_fund_id := consolidated_fund_account_id();
  if v_fund_id is null then
    raise exception 'No PFS Consolidated Fund account is set up (accounts.is_consolidated_fund)';
  end if;

  select * into v_account from accounts where id = v_fund_id for update;

  if v_account.balance < p_amount then
    raise exception 'Insufficient PFS Consolidated Fund balance: % exceeds available balance %', p_amount, v_account.balance;
  end if;

  v_new_balance := v_account.balance - p_amount;
  v_txn_notes   := '[expenditure:' || trim(p_title) || '] ' || coalesce(p_notes, '');

  update accounts
  set balance = v_new_balance,
      wdr     = wdr + p_amount
  where id = v_fund_id;

  insert into transactions (account_id, client_id, type, amount, fee, bal_after, notes, recorded_by, created_at)
  values (v_fund_id, v_account.client_id, 'withdrawal', p_amount, 0, v_new_balance, v_txn_notes, p_recorded_by, coalesce(p_date, current_date)::timestamptz)
  returning * into v_txn;

  insert into expenditures (title, amount, category, date, notes, recorded_by, linked_transaction_id)
  values (
    trim(p_title),
    p_amount,
    coalesce(nullif(trim(p_category), ''), 'general'),
    coalesce(p_date, current_date),
    p_notes,
    p_recorded_by,
    v_txn.id
  )
  returning * into v_expenditure;

  return v_expenditure;
end;
$$;

-- ========================================
-- delete_expenditure — reverses the linked fund withdrawal (credits the
-- amount back, decrements wdr) before removing the expenditure row, so
-- deleting a mistaken entry doesn't leave a phantom permanent deduction
-- sitting in the fund's balance forever.
-- ========================================
create or replace function delete_expenditure(p_expenditure_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expenditure expenditures%rowtype;
  v_txn         transactions%rowtype;
begin
  if not is_admin() then
    raise exception 'Only an admin can delete an expenditure';
  end if;

  select * into v_expenditure from expenditures where id = p_expenditure_id;
  if not found then
    raise exception 'Expenditure not found';
  end if;

  if v_expenditure.linked_transaction_id is not null then
    select * into v_txn from transactions where id = v_expenditure.linked_transaction_id for update;

    if found then
      update accounts
      set balance = balance + v_txn.amount,
          wdr     = wdr - v_txn.amount
      where id = v_txn.account_id;

      delete from transactions where id = v_txn.id;
    end if;
  end if;

  delete from expenditures where id = p_expenditure_id;
end;
$$;

-- ========================================
-- sync_fund_withdrawal_to_expenditure — the "vice versa" half. Any
-- withdrawal recorded against the Consolidated Fund account through ANY
-- OTHER path (the account's own page, the Withdrawals report's account
-- picker, ...) gets mirrored into a generic expenditures row automatically,
-- so Total Expenditure never misses money that actually left the fund.
-- Skips withdrawals record_expenditure() itself created (tagged via the
-- notes prefix above) — otherwise every "Add expenditure" would double-
-- book itself the moment its own withdrawal transaction landed.
-- ========================================
create or replace function sync_fund_withdrawal_to_expenditure()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from accounts where id = new.account_id and is_consolidated_fund) then
    return new;
  end if;

  if new.notes ilike '[expenditure:%' then
    return new;
  end if;

  insert into expenditures (title, amount, category, date, notes, recorded_by, linked_transaction_id)
  values (
    coalesce(nullif(trim(new.notes), ''), 'Withdrawal from PFS Consolidated Fund'),
    new.amount,
    'general',
    (new.created_at at time zone 'UTC')::date,
    new.notes,
    new.recorded_by,
    new.id
  );

  return new;
end;
$$;

drop trigger if exists transactions_sync_fund_withdrawal on transactions;
create trigger transactions_sync_fund_withdrawal
  after insert on transactions
  for each row
  when (new.type = 'withdrawal')
  execute function sync_fund_withdrawal_to_expenditure();
