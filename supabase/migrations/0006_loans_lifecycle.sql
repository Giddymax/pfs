-- Prime Financial Service — loan lifecycle columns
-- Run after 0005_transaction_rpcs.sql.
--
-- Adds the columns the spec's lifecycle and reporting needs that the
-- original `loans` table didn't carry:
--   - processing_fee: a one-off fee captured at issuance, feeds the
--     dashboard's "+ Loan Processing Fees" reconciliation line.
--   - current_balance: the RPC-maintained remaining-repayable balance.
--     Tracking it directly (rather than recomputing total_repayable minus
--     sum(repayments) on every read) is what makes `out_principal`
--     reporting and the active->completed auto-transition cheap.

alter table loans add column processing_fee numeric(12, 2) not null default 0 check (processing_fee >= 0);
alter table loans add column current_balance numeric(12, 2);

-- Backfill current_balance for any pre-existing rows: total_repayable minus
-- whatever has already been repaid (floored at zero so a previously
-- over-paid loan doesn't end up negative).
update loans l
set current_balance = greatest(
  0,
  l.total_repayable - coalesce((select sum(r.amount) from loan_repayments r where r.loan_id = l.id), 0)
)
where current_balance is null;

alter table loans alter column current_balance set not null;
