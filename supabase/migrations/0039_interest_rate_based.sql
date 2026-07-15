-- Switch interest disbursement from a manually-entered flat amount to a
-- manually-entered flat RATE — the amount is now computed server-side as
-- balance * rate/100 (rounded to 2dp), so the credited amount can never
-- drift from the rate an admin actually typed in.

alter table interest_disbursements add column rate_percent numeric(6, 3);

drop function if exists disburse_interest(uuid, numeric, date, date, uuid);

create or replace function disburse_interest(
  p_account_id uuid,
  p_rate_percent numeric,
  p_period_start date,
  p_period_end date,
  p_disbursed_by uuid
)
returns transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account accounts%rowtype;
  v_amount numeric(12, 2);
  v_new_balance numeric(12, 2);
  v_txn transactions%rowtype;
  v_notes text;
begin
  if not is_staff_or_admin() then
    raise exception 'Only staff or admin can disburse interest';
  end if;

  if p_rate_percent is null or p_rate_percent <= 0 then
    raise exception 'Rate must be greater than zero';
  end if;

  select * into v_account from accounts where id = p_account_id for update;
  if not found then
    raise exception 'Account not found';
  end if;

  v_amount := round(v_account.balance * p_rate_percent / 100, 2);
  if v_amount <= 0 then
    raise exception 'Calculated interest amount must be greater than zero';
  end if;

  v_new_balance := v_account.balance + v_amount;
  v_notes := 'Interest disbursement at ' || p_rate_percent || '% (' || to_char(p_period_start, 'DD Mon YYYY') || ' - ' || to_char(p_period_end, 'DD Mon YYYY') || ')';

  update accounts
  set balance = v_new_balance,
      dep = dep + v_amount
  where id = p_account_id;

  insert into transactions (account_id, client_id, type, amount, fee, bal_after, notes, recorded_by)
  values (p_account_id, v_account.client_id, 'deposit', v_amount, 0, v_new_balance, v_notes, p_disbursed_by)
  returning * into v_txn;

  insert into interest_disbursements (account_id, client_id, transaction_id, amount, rate_percent, period_start, period_end, disbursed_by)
  values (p_account_id, v_account.client_id, v_txn.id, v_amount, p_rate_percent, p_period_start, p_period_end, p_disbursed_by);

  return v_txn;
end;
$$;
