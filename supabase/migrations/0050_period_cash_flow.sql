-- Corrects and completes the Transaction Summary period totals.
--
-- BUG FIXED: net_inflow previously subtracted commission_total as if it were
-- cash leaving the business. It isn't — commission is deducted directly from
-- a client's existing balance (see record_withdrawal), never paid out
-- anywhere. That cash was already counted once, in the original deposit.
-- Same reasoning applies to SMS fees, processing fees, and susu's day-31 fee
-- (all deducted from an existing balance, not separate cash events) — none
-- of these belong in a cash-flow total, only in a revenue/P&L one.
--
-- MISSING PRODUCTS ADDED: fixed deposits and investments/expenditures never
-- touch the `transactions` table at all, so the old formula silently
-- excluded them entirely. Added here, with one subtlety handled correctly:
-- a fixed deposit ROLLOVER must not be counted as new cash in either
-- direction — capitalised interest never moves, and even the principal on a
-- non-capitalised rollover simply carries into the new FD rather than
-- leaving the business, so it must not appear as an inflow when the new FD
-- opens.

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
  fd_principal_count   bigint,
  fd_principal_total   numeric,
  fd_payout_count      bigint,
  fd_payout_total      numeric,
  investment_returned_count bigint,
  investment_returned_total numeric,
  investment_placed_count   bigint,
  investment_placed_total   numeric,
  expenditure_count    bigint,
  expenditure_total    numeric,
  susu_fee_total       numeric,
  account_fee_total    numeric,
  total_inflows        numeric,
  total_outflows       numeric,
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
  v_repayment_count    bigint;
  v_repayment_total    numeric;
  v_new_client_count   bigint;
  v_loans_issued_count bigint;
  v_loans_issued_total numeric;
  v_card_fee_count     bigint;
  v_card_fee_total     numeric;
  v_sms_cost_total     numeric;
  v_fd_principal_count bigint;
  v_fd_principal_total numeric;
  v_fd_payout_count    bigint;
  v_fd_payout_total    numeric;
  v_inv_returned_count bigint;
  v_inv_returned_total numeric;
  v_inv_placed_count   bigint;
  v_inv_placed_total   numeric;
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

  select count(*), coalesce(sum(amount), 0), coalesce(sum(fee), 0), count(*) filter (where fee > 0)
    into v_withdrawal_count, v_withdrawal_total, v_commission_total, v_commission_count
    from transactions
   where type = 'withdrawal'
     and reversed_at is null
     and created_at::date between p_from and p_to;

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

  -- Susu day-31 company fee — same reasoning: already inside susu deposits.
  select coalesce(sum(amount), 0)
    into v_susu_fee_total
    from susu_payments
   where day_in_cycle = 31
     and payment_date between p_from and p_to;

  -- Fixed deposit principal received — excludes FDs created as the "new"
  -- side of a rollover, since that principal never actually left and
  -- re-entered the business as cash.
  select count(*), coalesce(sum(principal), 0)
    into v_fd_principal_count, v_fd_principal_total
    from fixed_deposits
   where rolled_from_fd_id is null
     and start_date between p_from and p_to;

  -- Fixed deposit payouts — three cases, unioned:
  --   1. Genuine maturity payout (status ended 'withdrawn'): principal + interest.
  --   2. Rollover without capitalising interest (status ended 'rolled_over'):
  --      only the interest was actually paid in cash; the principal rolled
  --      forward into the new FD and never left.
  --   3. Early withdrawal (status ended 'withdrawn', no matured_paid_out
  --      event was ever logged for it): principal only, interest forfeited.
  select count(*), coalesce(sum(payout_amount), 0)
    into v_fd_payout_count, v_fd_payout_total
    from (
      select fe.created_at::date as event_date, (fd.principal + fe.amount) as payout_amount
        from fd_events fe
        join fixed_deposits fd on fd.id = fe.fd_id
       where fe.event_type = 'matured_paid_out' and fd.status = 'withdrawn'
      union all
      select fe.created_at::date as event_date, fe.amount as payout_amount
        from fd_events fe
        join fixed_deposits fd on fd.id = fe.fd_id
       where fe.event_type = 'matured_paid_out' and fd.status = 'rolled_over'
      union all
      select fd.updated_at::date as event_date, fd.principal as payout_amount
        from fixed_deposits fd
       where fd.status = 'withdrawn'
         and not exists (
           select 1 from fd_events fe2 where fe2.fd_id = fd.id and fe2.event_type = 'matured_paid_out'
         )
    ) payouts
   where event_date between p_from and p_to;

  select count(*), coalesce(sum(revenue_made), 0)
    into v_inv_returned_count, v_inv_returned_total
    from investments
   where status = 'returned'
     and return_date between p_from and p_to;

  select count(*), coalesce(sum(amount_invested), 0)
    into v_inv_placed_count, v_inv_placed_total
    from investments
   where date between p_from and p_to;

  select count(*), coalesce(sum(amount), 0)
    into v_expenditure_count, v_expenditure_total
    from expenditures
   where date between p_from and p_to;

  v_total_inflows := v_deposit_total + v_fd_principal_total + v_repayment_total
                    + v_card_fee_total + v_inv_returned_total;
  v_total_outflows := v_withdrawal_total + v_loans_issued_total + v_fd_payout_total
                     + v_expenditure_total + v_inv_placed_total;

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
    v_fd_principal_count,
    v_fd_principal_total,
    v_fd_payout_count,
    v_fd_payout_total,
    v_inv_returned_count,
    v_inv_returned_total,
    v_inv_placed_count,
    v_inv_placed_total,
    v_expenditure_count,
    v_expenditure_total,
    v_susu_fee_total,
    v_account_fee_total,
    v_total_inflows,
    v_total_outflows,
    (v_total_inflows - v_total_outflows);
end;
$$;
