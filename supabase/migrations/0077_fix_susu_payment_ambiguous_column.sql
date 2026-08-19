-- Fixes a real, reproducible bug: recording a susu payment failed outright
-- with `column reference "account_id" is ambiguous` (Postgres error 42702).
--
-- record_susu_payment() declares RETURNS TABLE(..., account_id uuid,
-- cycle_id uuid, ..., day_in_cycle int, ...) — in PL/pgSQL, every column in
-- a RETURNS TABLE list becomes an implicitly-declared variable, in scope
-- for the WHOLE function body. Two queries inside the function then
-- referenced bare, unqualified columns that share those exact names:
--
--   select * into v_cycle from susu_cycles
--     where account_id = p_account_id ...              -- account_id
--
--   select coalesce(max(day_in_cycle), 0) + 1 into v_day
--     from susu_payments where cycle_id = v_cycle.id;   -- day_in_cycle, cycle_id
--
-- Postgres can't tell whether "account_id" means susu_cycles.account_id or
-- the PL/pgSQL variable of the same name — and by default (variable_conflict
-- = error) it refuses to guess, raising the exact error reported rather
-- than silently picking the wrong one. Confirmed live: this affected every
-- susu deposit, for every client and account — reproduced directly against
-- production. Fixed by qualifying each reference with its source table.
--
-- record_susu_batch() only calls record_susu_payment() in a loop (no raw
-- queries of its own with this shape), so it needed no separate fix.
-- pay_susu_claim()'s current version already qualifies every reference —
-- also unaffected.
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
  v_account            accounts%rowtype;
  v_cycle              susu_cycles%rowtype;
  v_txn                transactions%rowtype;
  v_day                int;
  v_payment            susu_payments%rowtype;
  v_client             clients%rowtype;
  v_balance_now        numeric(12, 2);
  v_fee_bal_after      numeric(12, 2);
  v_remaining_claimable numeric(12, 2) := 0;
  v_cycle_completed    boolean := false;
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
    insert into susu_cycles (account_id, cycle_number, started_on)
    values (p_account_id, 1, p_payment_date)
    returning * into v_cycle;
  end if;

  select coalesce(max(susu_payments.day_in_cycle), 0) + 1 into v_day from susu_payments where susu_payments.cycle_id = v_cycle.id;
  if v_day > 31 then
    raise exception 'Cycle % already has 31 contributions recorded', v_cycle.cycle_number;
  end if;

  -- post the cash movement through the shared ledger RPC — single writer for
  -- accounts.bal/dep and transactions, so the reconciliation formula balances
  select * into v_txn from record_deposit(p_account_id, p_amount, p_recorded_by, 'Susu day ' || v_day || ' contribution');

  insert into susu_payments (cycle_id, account_id, transaction_id, amount, day_in_cycle, payment_date, recorded_by)
  values (v_cycle.id, p_account_id, v_txn.id, p_amount, v_day, p_payment_date, p_recorded_by)
  returning * into v_payment;

  -- Pre-update total_collected = everything contributed on days 1..v_day-1 —
  -- exactly what's left for the client to claim once day 31's contribution
  -- becomes entirely the company's fee.
  v_remaining_claimable := v_cycle.total_collected;

  update susu_cycles
  set total_collected = total_collected + p_amount,
      completed_on = case when v_day = 31 then p_payment_date else completed_on end,
      status = case when v_day = 31 then 'complete' else status end,
      company_fee = case when v_day = 31 then p_amount else company_fee end
  where id = v_cycle.id;

  if v_day = 31 then
    v_cycle_completed := true;

    -- Automatically withdraw the day-31 company fee the instant the cycle
    -- completes. Done inline here (not via record_withdrawal(), which is
    -- admin-only since 0058_admin_only_withdrawals.sql) so a staff member
    -- recording an ordinary day-31 contribution isn't blocked by an
    -- admin-only gate for this automatic, non-discretionary consequence.
    -- The "swept to company funds" notes tag is what
    -- lib/finance/account-summary.ts uses to recognise this specific
    -- withdrawal as susu-fee revenue rather than cash paid to the client.
    select balance into v_balance_now from accounts where id = p_account_id;
    v_fee_bal_after := v_balance_now - p_amount;

    update accounts
    set balance = v_fee_bal_after,
        wdr = wdr + p_amount
    where id = p_account_id;

    insert into transactions (account_id, client_id, type, amount, fee, bal_after, notes, recorded_by)
    values (
      p_account_id,
      v_account.client_id,
      'withdrawal',
      p_amount,
      0,
      v_fee_bal_after,
      'Susu day-31 company fee swept to company funds (cycle ' || v_cycle.cycle_number || ')',
      p_recorded_by
    );

    update susu_cycles set fee_swept_at = now() where id = v_cycle.id;

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
