-- Loan interest is now recognized as revenue only once a loan is fully
-- repaid (status = 'completed'), not proportionally as each repayment
-- comes in. Previously: every repayment contributed amount × (total_interest
-- / total_repayable) to revenue immediately, so a loan still being paid off
-- was already counted as partial revenue. Now: a loan contributes nothing
-- to revenue until its last repayment clears current_balance to zero (see
-- record_loan_repayment(), 0007_loan_rpcs.sql), at which point its full
-- total_interest is recognized in one shot.
--
-- This doesn't require any change to computeAccountSummary()'s Account
-- Balance formula (lib/finance/account-summary.ts): that formula already
-- subtracts whatever loanInterest contributed to Total Revenue back out of
-- loanRepayments before netting against loansDisbursed, specifically so
-- interest is never counted twice — that guard holds regardless of *when*
-- interest is recognized, only that the same figure is used on both sides.
create or replace function compute_collected_loan_interest()
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(l.total_interest), 0)
  from loans l
  where l.status = 'completed';
$$;
