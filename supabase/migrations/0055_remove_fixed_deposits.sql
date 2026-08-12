-- Remove the Fixed Deposit product entirely — schema, RPCs, and every
-- calculation that folded FD figures into a broader total.
--
-- Confirmed with the product owner that no real fixed-deposit money is held
-- (test data only), so this is a full destructive removal: the dedicated
-- fixed_deposits/fd_events tables are dropped outright, and the legacy
-- accounts.product_type = 'fixed_deposit' rows that 0010_fixed_deposits.sql
-- left in place (pending a "later cleanup migration" that was never written)
-- are purged here along with their dependent transactions/susu/sms rows.
--
-- Run after 0054_account_summary_susu_penalty_split.sql.

-- ========================================
-- 1. Purge legacy accounts.product_type = 'fixed_deposit' rows and anything
--    that references them, before we tighten the constraints below.
-- ========================================
delete from transactions
 where account_id in (select id from accounts where product_type = 'fixed_deposit');

delete from sms_fee_charges
 where account_id in (select id from accounts where product_type = 'fixed_deposit');

delete from susu_payments
 where account_id in (select id from accounts where product_type = 'fixed_deposit');

delete from susu_claims
 where account_id in (select id from accounts where product_type = 'fixed_deposit');

delete from susu_cycles
 where account_id in (select id from accounts where product_type = 'fixed_deposit');

delete from accounts where product_type = 'fixed_deposit';

-- ========================================
-- 2. Drop the dedicated Fixed Deposit tables and their support objects.
--    fd_events cascades away with fixed_deposits (fd_id references it with
--    on delete cascade), but is dropped explicitly for clarity.
-- ========================================
drop table if exists fd_events;
drop table if exists fixed_deposits;
drop sequence if exists fd_code_seq;
drop function if exists generate_fd_number();

-- ========================================
-- 3. Drop every FD lifecycle RPC (0011_fd_rpcs.sql).
-- ========================================
drop function if exists compute_fd_terms(numeric, numeric, int, date);
drop function if exists open_fixed_deposit(uuid, numeric, numeric, int, uuid, date);
drop function if exists sync_matured_fds();
drop function if exists request_early_withdrawal(uuid, uuid);
drop function if exists approve_early_withdrawal(uuid, uuid);
drop function if exists reject_early_withdrawal(uuid, uuid);
drop function if exists process_early_withdrawal_payout(uuid, uuid);
drop function if exists process_maturity_payout(uuid, uuid);
drop function if exists process_rollover(uuid, int, numeric, boolean, uuid);

-- ========================================
-- 4. Tighten the accounts table: only savings/susu can exist now, so drop
--    the FD-specific columns and simplify the product/status constraints.
--    'matured' was an FD-only status ("awaiting payout/rollover instruction")
--    — no savings/susu row ever used it — so it's dropped from the status
--    check too.
-- ========================================
alter table accounts drop constraint if exists accounts_product_fields_check;

alter table accounts
  drop column if exists principal_amount,
  drop column if exists tenor_days,
  drop column if exists maturity_date,
  drop column if exists maturity_instruction;

alter table accounts drop constraint if exists accounts_product_type_check;
alter table accounts add constraint accounts_product_type_check
  check (product_type in ('savings', 'susu'));

alter table accounts drop constraint if exists accounts_status_check;
alter table accounts add constraint accounts_status_check
  check (status in ('active', 'dormant', 'closed'));

alter table accounts add constraint accounts_product_fields_check check (
  (product_type = 'savings' and daily_contribution_amount is null)
  or (product_type = 'susu' and daily_contribution_amount is not null)
);

-- ========================================
-- 5. Account number generator — drop the 'FXD' branch.
-- ========================================
create or replace function generate_account_number()
returns trigger as $$
declare
  prefix text;
begin
  if new.account_number is null or new.account_number = '' then
    prefix := case new.product_type
      when 'savings' then 'SAV'
      when 'susu' then 'SUS'
    end;
    new.account_number := prefix || '-' || lpad(nextval('account_code_seq')::text, 4, '0');
  end if;
  return new;
end;
$$ language plpgsql;

-- ========================================
-- 6. compute_reconciliation() — drop the fixed_deposits/fd_interest_paid
--    line items (return signature changes, so drop + recreate).
-- ========================================
drop function if exists compute_reconciliation();

create or replace function compute_reconciliation()
returns table (
  savings numeric,
  susu_gross numeric,
  withdrawals numeric,
  commission numeric,
  sms_charges numeric,
  susu_company_fees numeric,
  loans_disbursed numeric,
  loan_repayments numeric,
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
  v_withdrawals numeric;
  v_commission numeric;
  v_sms_charges numeric;
  v_susu_company_fees numeric;
  v_loans_disbursed numeric;
  v_loan_repayments numeric;
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

  select coalesce(sum(amount), 0) into v_card_fees
    from card_fees;

  select coalesce(sum(processing_fee), 0) into v_loan_processing_fees
    from loans;

  return query select
    v_savings,
    v_susu_gross,
    v_withdrawals,
    v_commission,
    v_sms_charges,
    v_susu_company_fees,
    v_loans_disbursed,
    v_loan_repayments,
    v_card_fees,
    v_loan_processing_fees,
    v_savings + v_susu_gross
      - v_withdrawals - v_commission - v_sms_charges - v_susu_company_fees
      - v_loans_disbursed + v_loan_repayments
      + v_card_fees + v_loan_processing_fees;
end;
$$;

-- ========================================
-- 7. compute_period_summary() — drop fd_principal_*/fd_payout_* columns and
--    their contribution to total_inflows/total_outflows.
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
  investment_returned_count bigint,
  investment_returned_total numeric,
  investment_placed_count   bigint,
  investment_placed_total   numeric,
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
  v_repayment_count    bigint;
  v_repayment_total    numeric;
  v_new_client_count   bigint;
  v_loans_issued_count bigint;
  v_loans_issued_total numeric;
  v_card_fee_count     bigint;
  v_card_fee_total     numeric;
  v_sms_cost_total     numeric;
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

  -- Susu fees — day-31 company fee plus the early-withdrawal penalty above.
  select coalesce(sum(amount), 0)
    into v_susu_fee_total
    from susu_payments
   where day_in_cycle = 31
     and payment_date between p_from and p_to;
  v_susu_fee_total := v_susu_fee_total + v_susu_penalty_total;

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

  v_total_inflows := v_deposit_total + v_repayment_total
                    + v_card_fee_total + v_inv_returned_total;
  v_total_outflows := v_withdrawal_total + v_loans_issued_total
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

-- ========================================
-- 8. list_daily_account_summary() — drop the fixed_deposits left join.
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
    coalesce(susu_fee.total, 0) + coalesce(susu_penalty.total, 0) as total_susu_fees,
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
    select created_at::date as dt, count(*) as cnt
    from clients
    group by created_at::date
  ) nc on nc.dt = d::date
  order by d;
end;
$$;

-- ========================================
-- 9. Drop the fd_terms_months setting — nothing left to configure.
-- ========================================
delete from settings where key = 'fd_terms_months';
