-- Susu day-31 company fee: swept automatically the instant the cycle
-- completes, instead of waiting until the client's claim is eventually
-- paid (the old behaviour — see 0059_susu_fee_sweep.sql). Recorded as an
-- ordinary type='withdrawal' transaction (not type='fee') per spec, so it
-- shows up in the Withdrawals report and the account's own transaction
-- history immediately, on the exact day the cycle completed.
--
-- fee_swept_at marks a cycle whose fee has already been extracted from the
-- account balance — either by the new automatic day-31 sweep below, or by
-- pay_susu_claim's legacy sweep (for cycles that completed before this
-- migration, or emergency claims, which never go through the day-31 path).
-- pay_susu_claim checks this flag so a cycle's fee is never swept twice.
alter table susu_cycles add column fee_swept_at timestamptz;

-- ────────────────────────────────────────────────────────────────────────
-- record_susu_payment — return shape widened to carry everything the
-- calling route needs to send the new "fee taken" SMS without a second
-- round-trip: whether this payment completed the cycle, the fee amount,
-- what's left for the client to claim, and the client's contact details.
-- ────────────────────────────────────────────────────────────────────────
drop function if exists record_susu_payment(uuid, numeric, date, uuid);

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

  select * into v_cycle from susu_cycles where account_id = p_account_id and status = 'in_progress'
    order by cycle_number desc limit 1 for update;
  if not found then
    insert into susu_cycles (account_id, cycle_number, started_on)
    values (p_account_id, 1, p_payment_date)
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

-- ────────────────────────────────────────────────────────────────────────
-- record_susu_batch — return shape follows record_susu_payment's above.
-- ────────────────────────────────────────────────────────────────────────
drop function if exists record_susu_batch(uuid, jsonb, uuid);

create or replace function record_susu_batch(
  p_account_id uuid,
  p_entries jsonb,
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
  v_entry jsonb;
  v_count int;
begin
  if not is_staff_or_admin() then
    raise exception 'Only staff or admin can record susu payments';
  end if;

  select jsonb_array_length(p_entries) into v_count;
  if v_count is null or v_count = 0 then
    raise exception 'At least one entry is required';
  end if;
  if v_count > 93 then
    raise exception 'A batch cannot contain more than 93 day-entries (3 cycles)';
  end if;

  for v_entry in select * from jsonb_array_elements(p_entries)
  loop
    return query select * from record_susu_payment(
      p_account_id,
      (v_entry->>'amount')::numeric,
      coalesce((v_entry->>'payment_date')::date, current_date),
      p_recorded_by
    );
  end loop;
end;
$$;

-- ────────────────────────────────────────────────────────────────────────
-- pay_susu_claim — skip the fee sweep when the cycle's fee has already
-- been swept (fee_swept_at set, by the new automatic path above). Still
-- runs for: emergency claims (always against an in-progress cycle, which
-- never goes through the day-31 auto-sweep), and normal claims on cycles
-- that completed before this migration existed.
-- ────────────────────────────────────────────────────────────────────────
create or replace function pay_susu_claim(
  p_claim_id uuid,
  p_paid_by uuid
)
returns table (
  claim_id uuid,
  account_id uuid,
  client_id uuid,
  client_full_name text,
  client_phone text,
  amount numeric
)
language plpgsql
security definer
as $$
declare
  v_claim susu_claims%rowtype;
  v_account accounts%rowtype;
  v_client clients%rowtype;
  v_txn transactions%rowtype;
  v_cycle susu_cycles%rowtype;
  v_fee_amount numeric(12, 2) := 0;
  v_balance_now numeric(12, 2);
  v_fee_bal_after numeric(12, 2);
begin
  if not is_admin() then
    raise exception 'Only an admin can pay a susu claim';
  end if;

  select * into v_claim from susu_claims where id = p_claim_id for update;
  if not found then
    raise exception 'Claim not found';
  end if;
  if v_claim.status <> 'approved' then
    raise exception 'Only an approved claim can be paid';
  end if;

  select * into v_account from accounts where id = v_claim.account_id for update;
  select * into v_client from clients where id = v_account.client_id;

  if v_claim.amount > 0 then
    select * into v_txn from record_withdrawal(
      v_claim.account_id,
      v_claim.amount,
      p_paid_by,
      case v_claim.claim_type when 'emergency' then 'Emergency susu claim payout' else 'Susu claim payout' end
    );
  end if;

  if v_claim.cycle_id is not null then
    select * into v_cycle from susu_cycles where id = v_claim.cycle_id for update;
    if found and v_cycle.fee_swept_at is null then
      v_fee_amount := greatest(coalesce(v_cycle.total_collected, 0) - v_claim.amount, 0);
    end if;
  end if;

  if v_fee_amount > 0 then
    select balance into v_balance_now from accounts where id = v_claim.account_id;
    v_fee_bal_after := v_balance_now - v_fee_amount;

    update accounts set balance = v_fee_bal_after where id = v_claim.account_id;

    insert into transactions (account_id, client_id, type, amount, fee, bal_after, notes, recorded_by, created_at)
    values (
      v_claim.account_id,
      v_account.client_id,
      'fee',
      v_fee_amount,
      0,
      v_fee_bal_after,
      (case v_claim.claim_type
        when 'emergency' then 'Susu emergency claim penalty swept to company funds (claim '
        else 'Susu day-31 company fee swept to company funds (claim '
      end) || p_claim_id || ')',
      p_paid_by,
      clock_timestamp()
    );

    if v_claim.cycle_id is not null then
      update susu_cycles set fee_swept_at = now() where id = v_claim.cycle_id;
    end if;
  end if;

  update susu_claims
  set status = 'paid', paid_by = p_paid_by, paid_at = now(), transaction_id = v_txn.id
  where id = p_claim_id;

  if v_claim.cycle_id is not null then
    update susu_cycles set status = 'closed' where id = v_claim.cycle_id;
  end if;

  return query select v_claim.id, v_account.id, v_client.id, v_client.full_name, v_client.phone, v_claim.amount;
end;
$$;

-- ────────────────────────────────────────────────────────────────────────
-- compute_period_summary / list_daily_account_summary — both independently
-- sum type='withdrawal' transactions in SQL for the Summary/Account-Summary
-- report pages (separate from lib/finance/account-summary.ts's own
-- withdrawalPrincipal query, already fixed above). Same exclusion applied
-- here: the automatic susu day-31 fee sweep posts as type='withdrawal' but
-- is company revenue, not client cash-out, and is already counted via each
-- function's existing susu-fee sources (day-31 susu_payments rows,
-- accrual-basis, unaffected by sweep timing) — so it must be excluded here
-- to avoid double-counting it into withdrawal_total/total_withdrawals.
-- Return types unchanged, so plain create-or-replace is enough (no drop).
-- ────────────────────────────────────────────────────────────────────────
create or replace function compute_period_summary(p_from date, p_to date)
returns table (
  deposit_count        bigint,
  deposit_total        numeric,
  withdrawal_count     bigint,
  withdrawal_total     numeric,
  commission_total     numeric,
  commission_count     bigint,
  repayment_count      bigint,
  repayment_total      numeric,
  new_client_count     bigint,
  loans_issued_count   bigint,
  loans_issued_total   numeric,
  card_fee_count       bigint,
  card_fee_total       numeric,
  sms_cost_total       numeric,
  expenditure_count    bigint,
  expenditure_total    numeric,
  susu_fee_total       numeric,
  account_fee_total    numeric,
  total_inflows        numeric,
  total_outflows        numeric,
  net_inflow           numeric
)
language plpgsql
security definer
as $$
declare
  v_deposit_count      bigint;
  v_deposit_total      numeric;
  v_withdrawal_count   bigint;
  v_withdrawal_total   numeric;
  v_commission_total   numeric;
  v_commission_count   bigint;
  v_susu_penalty_total numeric;
  v_susu_claim_penalty_total numeric;
  v_repayment_count    bigint;
  v_repayment_total    numeric;
  v_new_client_count   bigint;
  v_loans_issued_count bigint;
  v_loans_issued_total numeric;
  v_card_fee_count     bigint;
  v_card_fee_total     numeric;
  v_sms_cost_total     numeric;
  v_expenditure_count  bigint;
  v_expenditure_total  numeric;
  v_susu_fee_total     numeric;
  v_account_fee_total  numeric;
  v_total_inflows      numeric;
  v_total_outflows     numeric;
begin
  if not is_staff_or_admin() then
    raise exception 'Only staff or admin can view the summary report';
  end if;

  select count(*), coalesce(sum(amount), 0)
    into v_deposit_count, v_deposit_total
    from transactions
   where type = 'deposit'
     and reversed_at is null
     and created_at::date between p_from and p_to;

  select count(*), coalesce(sum(amount), 0)
    into v_withdrawal_count, v_withdrawal_total
    from transactions
   where type = 'withdrawal'
     and reversed_at is null
     and notes not ilike '%swept to company funds%'
     and created_at::date between p_from and p_to;

  -- Commission — savings withdrawals only.
  select coalesce(sum(t.fee), 0), count(*) filter (where t.fee > 0)
    into v_commission_total, v_commission_count
    from transactions t
    join accounts a on a.id = t.account_id
   where t.type = 'withdrawal'
     and t.reversed_at is null
     and a.product_type = 'savings'
     and t.created_at::date between p_from and p_to;

  -- Susu early-withdrawal penalty — the only way a susu withdrawal ever
  -- carries a nonzero fee; folded into susu_fee_total below, not commission.
  select coalesce(sum(t.fee), 0)
    into v_susu_penalty_total
    from transactions t
    join accounts a on a.id = t.account_id
   where t.type = 'withdrawal'
     and t.reversed_at is null
     and a.product_type = 'susu'
     and t.created_at::date between p_from and p_to;

  -- Emergency susu claims paid out via pay_susu_claim — the penalty swept
  -- into company funds at payout time (see 0059_susu_fee_sweep.sql).
  select coalesce(sum(penalty_amount), 0)
    into v_susu_claim_penalty_total
    from susu_claims
   where claim_type = 'emergency'
     and status = 'paid'
     and paid_at::date between p_from and p_to;

  select count(*), coalesce(sum(amount), 0)
    into v_repayment_count, v_repayment_total
    from loan_repayments
   where payment_date between p_from and p_to;

  select count(*)
    into v_new_client_count
    from clients
   where created_at::date between p_from and p_to;

  select count(*), coalesce(sum(principal), 0)
    into v_loans_issued_count, v_loans_issued_total
    from loans
   where disbursement_date between p_from and p_to;

  select count(*), coalesce(sum(amount), 0)
    into v_card_fee_count, v_card_fee_total
    from card_fees
   where created_at::date between p_from and p_to;

  select coalesce(sum(cost), 0)
    into v_sms_cost_total
    from sms_log
   where created_at::date between p_from and p_to;

  -- Account fees actually charged against a client balance (SMS + loan
  -- processing fees) — informational only, not cash flow: this money never
  -- moves, it's a reclassification of cash already counted in a deposit.
  select coalesce(sum(amount), 0)
    into v_account_fee_total
    from transactions
   where type = 'fee'
     and created_at::date between p_from and p_to;

  -- Susu fees — day-31 company fee, the instant-route early-withdrawal
  -- penalty, and paid emergency-claim penalties.
  select coalesce(sum(amount), 0)
    into v_susu_fee_total
    from susu_payments
   where day_in_cycle = 31
     and payment_date between p_from and p_to;
  v_susu_fee_total := v_susu_fee_total + v_susu_penalty_total + v_susu_claim_penalty_total;

  select count(*), coalesce(sum(amount), 0)
    into v_expenditure_count, v_expenditure_total
    from expenditures
   where date between p_from and p_to;

  v_total_inflows := v_deposit_total + v_repayment_total + v_card_fee_total;
  v_total_outflows := v_withdrawal_total + v_loans_issued_total + v_expenditure_total;

  return query select
    v_deposit_count,
    v_deposit_total,
    v_withdrawal_count,
    v_withdrawal_total,
    v_commission_total,
    v_commission_count,
    v_repayment_count,
    v_repayment_total,
    v_new_client_count,
    v_loans_issued_count,
    v_loans_issued_total,
    v_card_fee_count,
    v_card_fee_total,
    v_sms_cost_total,
    v_expenditure_count,
    v_expenditure_total,
    v_susu_fee_total,
    v_account_fee_total,
    v_total_inflows,
    v_total_outflows,
    (v_total_inflows - v_total_outflows);
end;
$$;

create or replace function list_daily_account_summary(p_from date, p_to date)
returns table (
  summary_date date,
  total_deposits numeric,
  total_withdrawals numeric,
  total_withdrawal_commission numeric,
  total_susu_fees numeric,
  new_clients bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Only an admin can view the account summary';
  end if;

  return query
  select
    d::date as summary_date,
    coalesce(dep.total, 0) + coalesce(card.total, 0) as total_deposits,
    coalesce(wdr.total, 0) as total_withdrawals,
    coalesce(comm.total, 0) as total_withdrawal_commission,
    coalesce(susu_fee.total, 0) + coalesce(susu_penalty.total, 0) + coalesce(susu_claim_penalty.total, 0) as total_susu_fees,
    coalesce(nc.cnt, 0) as new_clients
  from generate_series(p_from, p_to, interval '1 day') as d
  left join (
    -- Savings + susu deposits — both post through record_deposit into transactions
    select created_at::date as dt, sum(amount) as total
    from transactions
    where type = 'deposit' and reversed_at is null
    group by created_at::date
  ) dep on dep.dt = d::date
  left join (
    -- Card fees never touch transactions
    select created_at::date as dt, sum(amount) as total
    from card_fees
    group by created_at::date
  ) card on card.dt = d::date
  left join (
    select created_at::date as dt, sum(amount) as total
    from transactions
    where type = 'withdrawal' and reversed_at is null
      and notes not ilike '%swept to company funds%'
    group by created_at::date
  ) wdr on wdr.dt = d::date
  left join (
    -- Commission — savings withdrawals only
    select t.created_at::date as dt, sum(t.fee) as total
    from transactions t
    join accounts a on a.id = t.account_id
    where t.type = 'withdrawal' and t.reversed_at is null and a.product_type = 'savings'
    group by t.created_at::date
  ) comm on comm.dt = d::date
  left join (
    select payment_date as dt, sum(amount) as total
    from susu_payments
    where day_in_cycle = 31
    group by payment_date
  ) susu_fee on susu_fee.dt = d::date
  left join (
    -- Susu early-withdrawal penalty — the only way a susu withdrawal ever
    -- carries a nonzero fee; grouped into total_susu_fees, not commission.
    select t.created_at::date as dt, sum(t.fee) as total
    from transactions t
    join accounts a on a.id = t.account_id
    where t.type = 'withdrawal' and t.reversed_at is null and a.product_type = 'susu'
    group by t.created_at::date
  ) susu_penalty on susu_penalty.dt = d::date
  left join (
    -- Emergency susu claims paid via pay_susu_claim — swept at payout time.
    select paid_at::date as dt, sum(penalty_amount) as total
    from susu_claims
    where claim_type = 'emergency' and status = 'paid'
    group by paid_at::date
  ) susu_claim_penalty on susu_claim_penalty.dt = d::date
  left join (
    select created_at::date as dt, count(*) as cnt
    from clients
    group by created_at::date
  ) nc on nc.dt = d::date
  order by d;
end;
$$;
