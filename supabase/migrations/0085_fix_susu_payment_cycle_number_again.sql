-- The exact bug fixed once already in 0047_fix_susu_payment_cycle_number.sql
-- has resurfaced: record_susu_payment() was rewritten twice since then (for
-- the day-31 auto-sweep feature — 0071, then 0077, then 0078), and each
-- rewrite appears to have branched from the original pre-0047 body rather
-- than the patched one, silently reintroducing the bug. When no
-- 'in_progress' cycle is found for the account, it hard-codes the new
-- cycle's number to 1 instead of computing the next free number — so any
-- account that already has a closed/completed cycle (but nothing active
-- right now — confirmed live on SUS-0112, whose single cycle is
-- 'complete') collides with "duplicate key value violates unique
-- constraint susu_cycles_account_id_cycle_number_key" the moment a new
-- payment tries to open a fresh cycle for it.
--
-- Same fix as 0047: coalesce(max(cycle_number), 0) + 1, same pattern
-- reset_susu_account already uses correctly. Everything else in this
-- function is carried over unchanged from 0078_susu_fee_as_commission.sql
-- (the RETURNS TABLE shape, the trigger-driven day-31 sweep, the ambiguous-
-- column qualifiers from 0077) — same signature, so this replaces the real
-- function rather than adding an overload.

create or replace function record_susu_payment(
  p_account_id uuid,
  p_amount numeric,
  p_payment_date date default current_date,
  p_recorded_by uuid default null
)
returns table (
  payment_id uuid,
  cycle_id uuid,
  account_id uuid,
  transaction_id uuid,
  amount numeric,
  day_in_cycle int,
  payment_date date,
  cycle_completed boolean,
  fee_amount numeric,
  remaining_claimable numeric,
  client_id uuid,
  client_full_name text,
  client_phone text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account             accounts%rowtype;
  v_cycle               susu_cycles%rowtype;
  v_txn                 transactions%rowtype;
  v_day                 int;
  v_payment             susu_payments%rowtype;
  v_client              clients%rowtype;
  v_remaining_claimable numeric(12, 2) := 0;
  v_cycle_completed     boolean := false;
  v_next_number         int;
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

  select * into v_cycle from susu_cycles where susu_cycles.account_id = p_account_id and status = 'in_progress'
    order by cycle_number desc limit 1 for update;
  if not found then
    select coalesce(max(cycle_number), 0) + 1 into v_next_number
      from susu_cycles where susu_cycles.account_id = p_account_id;
    insert into susu_cycles (account_id, cycle_number, started_on)
    values (p_account_id, v_next_number, p_payment_date)
    returning * into v_cycle;
  end if;

  select coalesce(max(susu_payments.day_in_cycle), 0) + 1 into v_day
    from susu_payments where susu_payments.cycle_id = v_cycle.id;
  if v_day > 31 then
    raise exception 'Cycle % already has 31 contributions recorded', v_cycle.cycle_number;
  end if;

  -- post the cash movement through the shared ledger RPC — single writer for
  -- accounts.bal/dep and transactions, so the reconciliation formula balances
  select * into v_txn from record_deposit(p_account_id, p_amount, p_recorded_by, 'Susu day ' || v_day || ' contribution');

  insert into susu_payments (cycle_id, account_id, transaction_id, amount, day_in_cycle, payment_date, recorded_by)
  values (v_cycle.id, p_account_id, v_txn.id, p_amount, v_day, p_payment_date, p_recorded_by)
  returning * into v_payment;

  v_remaining_claimable := v_cycle.total_collected;

  -- This is the statement susu_cycles_auto_sweep reacts to: the instant
  -- status flips to 'complete', sweep_susu_cycle_fee() fires (0078).
  update susu_cycles
  set total_collected = total_collected + p_amount,
      completed_on = case when v_day = 31 then p_payment_date else completed_on end,
      status = case when v_day = 31 then 'complete' else status end,
      company_fee = case when v_day = 31 then p_amount else company_fee end
  where id = v_cycle.id;

  if v_day = 31 then
    v_cycle_completed := true;
    insert into susu_cycles (account_id, cycle_number, started_on)
    values (p_account_id, v_cycle.cycle_number + 1, p_payment_date + 1);
  end if;

  select * into v_client from clients where id = v_account.client_id;

  return query select
    v_payment.id,
    v_payment.cycle_id,
    v_payment.account_id,
    v_payment.transaction_id,
    v_payment.amount,
    v_payment.day_in_cycle,
    v_payment.payment_date,
    v_cycle_completed,
    case when v_cycle_completed then p_amount else 0 end,
    v_remaining_claimable,
    v_account.client_id,
    v_client.full_name,
    v_client.phone;
end;
$$;
