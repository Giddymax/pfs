-- Removes the daily time-window restriction on PFS Consolidated Fund
-- deposits entirely (previously 17:20-23:30, from 0081, itself a change
-- from the original 19:00-23:30 in 0074_consolidated_fund_finance_link.sql).
-- Revenue can now be deposited into the fund any time of day. Everything
-- else about record_revenue_deposit is unchanged — same signature as 0081,
-- so this replaces the real function rather than adding an overload.

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
