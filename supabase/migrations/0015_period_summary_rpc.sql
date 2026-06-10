-- Returns a one-row activity summary for an arbitrary date range so the
-- Summary report page can render period-scoped metrics without pulling raw rows.

create or replace function compute_period_summary(p_from date, p_to date)
returns table (
  deposit_count      bigint,
  deposit_total      numeric,
  withdrawal_count   bigint,
  withdrawal_total   numeric,
  commission_total   numeric,
  repayment_count    bigint,
  repayment_total    numeric,
  new_client_count   bigint,
  loans_issued_count bigint,
  loans_issued_total numeric,
  card_fee_count     bigint,
  card_fee_total     numeric,
  sms_cost_total     numeric,
  net_inflow         numeric
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
  v_repayment_count    bigint;
  v_repayment_total    numeric;
  v_new_client_count   bigint;
  v_loans_issued_count bigint;
  v_loans_issued_total numeric;
  v_card_fee_count     bigint;
  v_card_fee_total     numeric;
  v_sms_cost_total     numeric;
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

  select count(*), coalesce(sum(amount), 0), coalesce(sum(fee), 0)
    into v_withdrawal_count, v_withdrawal_total, v_commission_total
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

  return query select
    v_deposit_count,
    v_deposit_total,
    v_withdrawal_count,
    v_withdrawal_total,
    v_commission_total,
    v_repayment_count,
    v_repayment_total,
    v_new_client_count,
    v_loans_issued_count,
    v_loans_issued_total,
    v_card_fee_count,
    v_card_fee_total,
    v_sms_cost_total,
    -- net inflow = money received − money paid out
    (v_deposit_total + v_repayment_total + v_card_fee_total)
      - (v_withdrawal_total + v_commission_total + v_loans_issued_total);
end;
$$;
