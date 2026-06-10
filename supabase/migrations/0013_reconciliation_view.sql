-- Prime Financial Service — master dashboard reconciliation
-- Run after 0012_sms_log_insert_policy.sql.
--
-- Implements the spec's reconciliation formula as a single admin-only RPC
-- returning one row of named line items (rather than a view) so the report
-- page can render a labelled breakdown without re-deriving the mapping from
-- raw tables. Each line item is sourced exactly as resolved during planning:
--   * Susu (gross) = lifetime contributions (accounts.dep), not live balance —
--     `− Withdrawals` is its own line, so using `bal` would double-count.
--   * Susu company fees = sum of day-31 payments (the spec's literal definition).
--   * FD interest paid = fd_events.amount on interest-bearing payout/rollover
--     events (matured payouts and cash-settled rollovers).

create or replace function compute_reconciliation()
returns table (
  savings numeric,
  susu_gross numeric,
  fixed_deposits numeric,
  withdrawals numeric,
  commission numeric,
  sms_charges numeric,
  susu_company_fees numeric,
  loans_disbursed numeric,
  loan_repayments numeric,
  fd_interest_paid numeric,
  card_fees numeric,
  loan_processing_fees numeric,
  total numeric
)
language plpgsql
security definer
as $$
declare
  v_savings numeric;
  v_susu_gross numeric;
  v_fixed_deposits numeric;
  v_withdrawals numeric;
  v_commission numeric;
  v_sms_charges numeric;
  v_susu_company_fees numeric;
  v_loans_disbursed numeric;
  v_loan_repayments numeric;
  v_fd_interest_paid numeric;
  v_card_fees numeric;
  v_loan_processing_fees numeric;
begin
  if not is_staff_or_admin() then
    raise exception 'Only staff or admin can view the reconciliation report';
  end if;

  select coalesce(sum(balance), 0) into v_savings
    from accounts where product_type = 'savings';

  select coalesce(sum(dep), 0) into v_susu_gross
    from accounts where product_type = 'susu';

  select coalesce(sum(principal), 0) into v_fixed_deposits
    from fixed_deposits where status not in ('withdrawn', 'rolled_over');

  select coalesce(sum(amount), 0) into v_withdrawals
    from transactions where type = 'withdrawal' and reversed_at is null;

  select coalesce(sum(fee), 0) into v_commission
    from transactions where type = 'withdrawal' and reversed_at is null;

  select coalesce(sum(cost), 0) into v_sms_charges
    from sms_log;

  select coalesce(sum(amount), 0) into v_susu_company_fees
    from susu_payments where day_in_cycle = 31;

  select coalesce(sum(principal), 0) into v_loans_disbursed
    from loans where status in ('active', 'completed', 'defaulted');

  select coalesce(sum(amount), 0) into v_loan_repayments
    from loan_repayments;

  -- 'matured_paid_out' covers both maturity payouts (principal + interest is
  -- recorded with this event_type) and cash interest paid out at rollover
  -- (process_rollover logs the cash portion under the same event_type).
  select coalesce(sum(amount), 0) into v_fd_interest_paid
    from fd_events where event_type = 'matured_paid_out';

  select coalesce(sum(amount), 0) into v_card_fees
    from card_fees;

  select coalesce(sum(processing_fee), 0) into v_loan_processing_fees
    from loans;

  return query select
    v_savings,
    v_susu_gross,
    v_fixed_deposits,
    v_withdrawals,
    v_commission,
    v_sms_charges,
    v_susu_company_fees,
    v_loans_disbursed,
    v_loan_repayments,
    v_fd_interest_paid,
    v_card_fees,
    v_loan_processing_fees,
    v_savings + v_susu_gross + v_fixed_deposits
      - v_withdrawals - v_commission - v_sms_charges - v_susu_company_fees
      - v_loans_disbursed + v_loan_repayments - v_fd_interest_paid
      + v_card_fees + v_loan_processing_fees;
end;
$$;
