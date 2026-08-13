-- Fix: pay_susu_claim never actually swept the company's fee/penalty share
-- out of the client's account balance — it only withdrew the client's
-- portion (total_collected - fee) to the client, leaving the fee amount
-- sitting in accounts.balance/dep forever, uncollected.
--
--   - Normal claims: the day-31 fee was at least *reported* as revenue (via
--     the original susu_payments row for day 31), but the actual cash was
--     never extracted from the account.
--   - Emergency claims paid via this flow (as opposed to the separate
--     instant emergency-withdrawal route, which already handles this
--     correctly by recording its fee on the withdrawal transaction itself):
--     the penalty wasn't swept OR reported anywhere. It just vanished from
--     tracking while staying in the client's balance.
--
-- This is exactly why lib/finance/account-summary.ts's Account Balance
-- formula couldn't safely add susu fees back in — some of that "revenue"
-- was still sitting, uncollected, inside the client-liability figure it was
-- being added on top of, which would have double-counted it.
--
-- Fix: pay_susu_claim now inserts a separate `type = 'fee'` transaction for
-- the swept amount (not `type = 'withdrawal'`, so it never touches wdr/comm
-- or susu's commission-exemption path — it's not a withdrawal, it's the
-- company's share settling out) and reduces the account balance for real.
-- The notes tag each sweep with the claim id, so this migration's own data
-- repair (and any future re-run) can tell which claims were already swept.

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

  -- Sweep the company's share (day-31 fee for a normal claim, or the
  -- penalty for an emergency claim) out of the client's balance. Derived as
  -- cycle.total_collected - claim.amount rather than reading company_fee/
  -- penalty_amount directly, so it's correct for both claim types uniformly
  -- and handles the degenerate case where total_collected < the fee (the
  -- claim amount would already be clamped to 0, so this sweeps whatever's
  -- actually left).
  if v_claim.cycle_id is not null then
    select * into v_cycle from susu_cycles where id = v_claim.cycle_id;
    if found then
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

-- ========================================
-- Data repair: sweep every already-paid claim that predates this fix.
-- Idempotent — skips any claim that already has a matching fee-sweep
-- transaction (matched by the claim id embedded in its notes), so this is
-- safe to re-run.
-- ========================================
do $$
declare
  v_claim susu_claims%rowtype;
  v_cycle susu_cycles%rowtype;
  v_fee_amount numeric(12, 2);
  v_balance_now numeric(12, 2);
  v_fee_bal_after numeric(12, 2);
  v_client_id uuid;
begin
  for v_claim in select * from susu_claims where status = 'paid' and cycle_id is not null loop
    if exists (
      select 1 from transactions
       where account_id = v_claim.account_id
         and type = 'fee'
         and notes like '%(claim ' || v_claim.id || ')%'
    ) then
      continue;
    end if;

    select * into v_cycle from susu_cycles where id = v_claim.cycle_id;
    if not found then
      continue;
    end if;

    v_fee_amount := greatest(coalesce(v_cycle.total_collected, 0) - v_claim.amount, 0);
    if v_fee_amount <= 0 then
      continue;
    end if;

    select client_id, balance into v_client_id, v_balance_now from accounts where id = v_claim.account_id;
    if v_client_id is null then
      continue;
    end if;

    v_fee_bal_after := v_balance_now - v_fee_amount;

    update accounts set balance = v_fee_bal_after where id = v_claim.account_id;

    insert into transactions (account_id, client_id, type, amount, fee, bal_after, notes, recorded_by, created_at)
    values (
      v_claim.account_id,
      v_client_id,
      'fee',
      v_fee_amount,
      0,
      v_fee_bal_after,
      (case v_claim.claim_type
        when 'emergency' then 'Susu emergency claim penalty swept to company funds (claim '
        else 'Susu day-31 company fee swept to company funds (claim '
      end) || v_claim.id || ') [backdated repair]',
      v_claim.paid_by,
      coalesce(v_claim.paid_at, v_claim.decided_at, v_claim.requested_at)
    );
  end loop;
end;
$$;

-- ========================================
-- compute_period_summary() — add paid emergency-claim penalties to
-- susu_fee_total (the one susu-fee source that was never counted anywhere:
-- normal-claim fees are already counted via susu_payments day 31, and the
-- instant emergency-withdrawal route already reports its fee via the
-- withdrawal transaction's fee column).
-- ========================================
drop function if exists compute_period_summary(date, date);

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
  -- penalty, and now paid emergency-claim penalties.
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

-- ========================================
-- list_daily_account_summary() — same addition, bucketed by the date the
-- claim was actually paid (cash-basis, matching every other line here).
-- ========================================
drop function if exists list_daily_account_summary(date, date);

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
