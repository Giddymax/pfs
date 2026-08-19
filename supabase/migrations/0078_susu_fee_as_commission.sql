-- 1. The susu day-31 company fee now shows up as commission (accounts.comm,
--    transactions.fee) instead of withdrawal principal (accounts.wdr,
--    transactions.amount) — no cash is ever paid to the client for this
--    entry, so "withdrawal principal" was never the right category; it's a
--    fee the company keeps, same shape as a savings withdrawal's commission.
--
-- 2. The sweep itself is now centralized in sweep_susu_cycle_fee(), fired
--    automatically by a trigger the instant susu_cycles.status flips to
--    'complete' — not just inlined in record_susu_payment()'s day-31
--    branch. This closes a real gap: two cycles (Shadrach Asiedu's,
--    Ibrahim Hawa's) completed before the day-31 auto-sweep (0071) was
--    live, so they only ever got the "marker set" treatment (company_fee
--    recorded for accrual reporting) — the cash was never actually pulled
--    from their balance, and nothing would ever have swept it since
--    neither has claimed. Confirmed live: exactly these two cycles,
--    system-wide, have status = 'complete' and fee_swept_at is null.
--    Backfilled at the bottom of this migration.
--
-- transactions.amount's check (> 0) is relaxed to (>= 0): this sweep
-- legitimately has zero principal (nothing paid to the client) and the
-- full amount as fee — the constraint was assuming every transaction has
-- a positive principal, which stops being true for a pure-fee entry.

alter table transactions drop constraint if exists transactions_amount_check;
alter table transactions add constraint transactions_amount_check check (amount >= 0);

-- ========================================
-- sweep_susu_cycle_fee — internal helper, not a public RPC (see the
-- revoke below). Idempotent: does nothing if the cycle isn't complete yet
-- or has already been swept, so it's safe to call from both the trigger
-- and a one-off backfill without double-sweeping.
-- ========================================
create or replace function sweep_susu_cycle_fee(p_cycle_id uuid, p_recorded_by uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cycle       susu_cycles%rowtype;
  v_account     accounts%rowtype;
  v_fee         numeric(12, 2);
  v_new_balance numeric(12, 2);
begin
  select * into v_cycle from susu_cycles where id = p_cycle_id for update;
  if not found or v_cycle.status <> 'complete' or v_cycle.fee_swept_at is not null then
    return;
  end if;

  v_fee := coalesce(v_cycle.company_fee, 0);
  if v_fee <= 0 then
    update susu_cycles set fee_swept_at = now() where id = p_cycle_id;
    return;
  end if;

  select * into v_account from accounts where id = v_cycle.account_id for update;
  if not found then
    return;
  end if;

  v_new_balance := v_account.balance - v_fee;

  update accounts
  set balance = v_new_balance,
      comm    = comm + v_fee
  where id = v_account.id;

  insert into transactions (account_id, client_id, type, amount, fee, bal_after, notes, recorded_by)
  values (
    v_account.id,
    v_account.client_id,
    'withdrawal',
    0,
    v_fee,
    v_new_balance,
    'Susu day-31 company fee swept to company funds (cycle ' || v_cycle.cycle_number || ')',
    p_recorded_by
  );

  update susu_cycles set fee_swept_at = now() where id = p_cycle_id;
end;
$$;

revoke execute on function sweep_susu_cycle_fee(uuid, uuid) from public, anon, authenticated;

-- ========================================
-- Fires the instant a cycle completes, from ANY code path that flips
-- status to 'complete' — not just record_susu_payment()'s day-31 branch.
-- ========================================
create or replace function trigger_sweep_susu_cycle_fee()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'complete' and (old.status is distinct from 'complete') and new.fee_swept_at is null then
    perform sweep_susu_cycle_fee(new.id, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists susu_cycles_auto_sweep on susu_cycles;
create trigger susu_cycles_auto_sweep
  after update on susu_cycles
  for each row
  execute function trigger_sweep_susu_cycle_fee();

-- ========================================
-- record_susu_payment — same signature as 0077 (unchanged), so this
-- replaces the real function. The day-31 branch no longer sweeps inline;
-- the status update just above it (unconditional, but only actually sets
-- 'complete' when v_day = 31) is what the trigger above reacts to.
-- ========================================
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

  -- This is the statement susu_cycles_auto_sweep reacts to: the instant
  -- status actually flips to 'complete' (v_day = 31), the trigger sweeps
  -- the fee — see sweep_susu_cycle_fee() above.
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

-- ========================================
-- Backfill — sweep every cycle that's ALREADY complete but never got
-- swept (confirmed live: exactly Shadrach Asiedu's and Ibrahim Hawa's,
-- but written generally in case others exist by the time this runs).
-- Doesn't touch `status`, so it does not re-trigger the trigger above.
-- ========================================
do $$
declare
  v_cycle_id uuid;
begin
  for v_cycle_id in select id from susu_cycles where status = 'complete' and fee_swept_at is null
  loop
    perform sweep_susu_cycle_fee(v_cycle_id, null);
  end loop;
end;
$$;
