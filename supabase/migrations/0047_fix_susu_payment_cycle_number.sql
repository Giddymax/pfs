-- Fix: record_susu_payment assumed "no in_progress cycle found" always meant
-- "this account has never had a cycle," so it hardcoded the new cycle's
-- number to 1. That's wrong whenever an account already has a closed cycle
-- but no active one — which happens after an emergency susu withdrawal
-- (both the instant app/api/susu/emergency-withdrawal route and the formal
-- pay_susu_claim path close the cycle without opening a replacement one).
-- The next daily contribution then tries to insert cycle_number = 1 again
-- and hits the unique constraint on (account_id, cycle_number).
--
-- reset_susu_account already gets this right by computing
-- coalesce(max(cycle_number), 0) + 1 — apply the same fix here.

create or replace function record_susu_payment(
  p_account_id uuid,
  p_amount numeric,
  p_payment_date date default current_date,
  p_recorded_by uuid default null
)
returns susu_payments
language plpgsql
security definer
as $$
declare
  v_account accounts%rowtype;
  v_cycle susu_cycles%rowtype;
  v_txn transactions%rowtype;
  v_day int;
  v_payment susu_payments%rowtype;
  v_next_number int;
begin
  if not is_staff_or_admin() then
    raise exception 'Only staff or admin can record susu payments';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  select * into v_account from accounts where id = p_account_id for update;
  if not found then
    raise exception 'Account not found';
  end if;
  if v_account.product_type <> 'susu' then
    raise exception 'Account is not a susu account';
  end if;

  select * into v_cycle from susu_cycles where account_id = p_account_id and status = 'in_progress'
    order by cycle_number desc limit 1 for update;
  if not found then
    select coalesce(max(cycle_number), 0) + 1 into v_next_number from susu_cycles where account_id = p_account_id;
    insert into susu_cycles (account_id, cycle_number, started_on)
    values (p_account_id, v_next_number, p_payment_date)
    returning * into v_cycle;
  end if;

  select coalesce(max(day_in_cycle), 0) + 1 into v_day from susu_payments where cycle_id = v_cycle.id;
  if v_day > 31 then
    raise exception 'Cycle % already has 31 contributions recorded', v_cycle.cycle_number;
  end if;

  -- post the cash movement through the shared ledger RPC — single writer for
  -- accounts.bal/dep and transactions, so the reconciliation formula balances
  select * into v_txn from record_deposit(p_account_id, p_amount, p_recorded_by, 'Susu day ' || v_day || ' contribution');

  insert into susu_payments (cycle_id, account_id, transaction_id, amount, day_in_cycle, payment_date, recorded_by)
  values (v_cycle.id, p_account_id, v_txn.id, p_amount, v_day, p_payment_date, p_recorded_by)
  returning * into v_payment;

  update susu_cycles
  set total_collected = total_collected + p_amount,
      completed_on = case when v_day = 31 then p_payment_date else completed_on end,
      status = case when v_day = 31 then 'complete' else status end,
      company_fee = case when v_day = 31 then p_amount else company_fee end
  where id = v_cycle.id;

  if v_day = 31 then
    insert into susu_cycles (account_id, cycle_number, started_on)
    values (p_account_id, v_cycle.cycle_number + 1, p_payment_date + 1);
  end if;

  return v_payment;
end;
$$;
