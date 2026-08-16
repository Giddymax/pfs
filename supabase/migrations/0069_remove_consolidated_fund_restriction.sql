-- PFS Consolidated Fund (SAV-00079) has been deleted from the accounts
-- table — the company no longer uses that account, and every application-
-- layer reference to it (Overview cards, account detail/picker banners,
-- lib/finance/account-summary.ts's fund-exclusion logic) has been removed
-- alongside this migration.
--
-- The one remaining piece was DB-level: record_deposit() (0060) hard-coded
-- a check that any deposit to account_number = 'SAV-00079' could only be
-- recorded at or after 20:30. With the account gone that branch can never
-- fire again — harmless, but dead weight referencing a feature that no
-- longer exists. This migration removes it, restoring record_deposit() to
-- the same shape it had before 0060 (still matching 0032/0058's signature
-- exactly, so this replaces the real function rather than adding an
-- overload).

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
