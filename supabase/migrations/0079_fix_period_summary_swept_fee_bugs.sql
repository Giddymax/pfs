<<<<<<< HEAD
=======
-- Two bugs found while compiling the calculation-logic reference doc, both
-- in compute_period_summary() (Transaction Summary page) and
-- list_daily_account_summary() (Account Summary page) — neither has been
-- touched since 0071_susu_day31_auto_sweep.sql.
--
-- Bug 1 — NULL-notes withdrawals silently dropped.
--   Both functions filter withdrawals with `notes not ilike '%swept to
--   company funds%'` to exclude the automatic susu day-31 fee sweep from
--   withdrawal_total/total_withdrawals (it's company revenue, not cash paid
--   to a client). In Postgres, `NULL not ilike 'pattern'` evaluates to NULL,
--   not TRUE — so any withdrawal whose notes column is simply empty (most
--   plain manual withdrawals) was silently excluded from the WHERE clause
--   entirely, undercounting both figures. This is the exact NULL-ILIKE trap
--   already fixed on the Overview/Finance/Bank side by filtering in
--   JavaScript after the fetch instead of at the query level (see
--   lib/finance/account-summary.ts's withdrawalRows comment) — these two
--   report-only RPCs never got the same fix since they compute their own
--   totals independently, in SQL. Fixed by wrapping in coalesce(notes, '')
--   first, so a NULL notes column reads as '' (which correctly does NOT
--   match the pattern, so the row survives the filter as it always should
--   have).
--
-- Bug 2 — day-31 sweep double-counted as an early-withdrawal penalty.
--   0078_susu_fee_as_commission.sql moved the day-31 company fee from
--   withdrawal principal (amount) to commission (fee) on the same
--   type='withdrawal' row. Both functions separately sum `fee` on every
--   susu withdrawal to capture the *actual* early-withdrawal penalty (the
--   only other way a susu withdrawal ever carries a nonzero fee) — that
--   subquery never excluded the day-31 sweep's notes tag, so as of 0078 it
--   started picking up the swept day-31 fee too, double-counting it into
--   susu_fee_total/total_susu_fees on top of the figure's original source
--   (susu_payments where day_in_cycle = 31). Fixed the same way: excluded
--   via the "swept to company funds" notes tag, matching how
--   lib/finance/account-summary.ts's susuEarlyWithdrawalFee already excludes
--   it (see that file's notSweptFeeRows).
--
-- Return signatures are unchanged from 0071, so plain create-or-replace is
-- enough — no drop needed.
>>>>>>> 26d6817046175dac73ce0bf6a2914940e53a4afa

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

  -- Bug 1 fix: coalesce(notes, '') so a NULL-notes withdrawal isn't
  -- silently dropped by the NOT ILIKE filter.
  select count(*), coalesce(sum(amount), 0)
    into v_withdrawal_count, v_withdrawal_total
    from transactions
   where type = 'withdrawal'
     and reversed_at is null
     and coalesce(notes, '') not ilike '%swept to company funds%'
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
  -- Bug 2 fix: exclude the day-31 auto-sweep (also a susu withdrawal with a
  -- nonzero fee since 0078) — it's already counted via the susu_payments
  -- query below; without this exclusion it was being counted twice.
  select coalesce(sum(t.fee), 0)
    into v_susu_penalty_total
    from transactions t
    join accounts a on a.id = t.account_id
   where t.type = 'withdrawal'
     and t.reversed_at is null
     and a.product_type = 'susu'
     and coalesce(t.notes, '') not ilike '%swept to company funds%'
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
    -- Bug 1 fix: coalesce(notes, '') so a NULL-notes withdrawal isn't
    -- silently dropped by the NOT ILIKE filter.
    select created_at::date as dt, sum(amount) as total
    from transactions
    where type = 'withdrawal' and reversed_at is null
      and coalesce(notes, '') not ilike '%swept to company funds%'
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
    -- Bug 2 fix: exclude the day-31 auto-sweep (also a susu withdrawal with
    -- a nonzero fee since 0078) — already counted via susu_fee above.
    select t.created_at::date as dt, sum(t.fee) as total
    from transactions t
    join accounts a on a.id = t.account_id
    where t.type = 'withdrawal' and t.reversed_at is null and a.product_type = 'susu'
      and coalesce(t.notes, '') not ilike '%swept to company funds%'
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
