-- Deposits into PFS CONSOLIDATED FUND (SAV-00079 — see the constant of the
-- same name in lib/finance/account-summary.ts) are only allowed at or after
-- 20:30 each day. Ghana runs on GMT year-round (no daylight saving), which
-- is the same as UTC, so comparing the wall-clock time of `now()` in the
-- 'UTC' zone directly against 20:30 is correct with no timezone conversion
-- needed — if the company's operating timezone ever changes, this needs
-- revisiting.
--
-- Enforced inside record_deposit() itself (not just in the UI) so it can't
-- be bypassed by calling the RPC directly — this is the only account the
-- restriction applies to; every other savings/susu deposit is unaffected.
-- Based on the actual current time the deposit is being recorded, not the
-- (possibly backdated) p_created_at parameter — the rule is about when the
-- action itself may happen, not what timestamp ends up on the row.
--
-- Signature must match 0032_record_with_datetime.sql exactly (param
-- order/types/defaults), or this becomes a second overload instead of
-- replacing the real function.

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

  if v_account.account_number = 'SAV-00079' and (now() at time zone 'UTC')::time < time '20:30:00' then
    raise exception 'Deposits to PFS Consolidated Fund can only be recorded at or after 20:30 each day';
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
