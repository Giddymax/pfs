-- Add a separate "Total SMS Fees" column to the Account Summary daily
-- breakdown. SMS fees are charged as a real transactions row (type='fee')
-- that deducts from the client's balance and becomes company revenue — a
-- real transfer, not a wash, so it gets counted once here as its own column
-- rather than folded into commission or netted against anything. Attributed
-- to the actual day the fee transaction was recorded (when the admin ran
-- the monthly SMS charge), same as every other column in this report.

drop function if exists list_daily_account_summary(date, date);

create or replace function list_daily_account_summary(p_from date, p_to date)
returns table (
  summary_date date,
  total_deposits numeric,
  total_withdrawals numeric,
  total_commission numeric,
  total_sms_fees numeric
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
    coalesce(dep.total, 0) as total_deposits,
    coalesce(wdr.total, 0) as total_withdrawals,
    coalesce(comm.total, 0) + coalesce(susu_fee.total, 0) as total_commission,
    coalesce(sms.total, 0) as total_sms_fees
  from generate_series(p_from, p_to, interval '1 day') as d
  left join (
    select created_at::date as dt, sum(amount) as total
    from transactions
    where type = 'deposit' and reversed_at is null
    group by created_at::date
  ) dep on dep.dt = d::date
  left join (
    select created_at::date as dt, sum(amount) as total
    from transactions
    where type = 'withdrawal' and reversed_at is null
    group by created_at::date
  ) wdr on wdr.dt = d::date
  left join (
    select created_at::date as dt, sum(fee) as total
    from transactions
    where type = 'withdrawal' and reversed_at is null
    group by created_at::date
  ) comm on comm.dt = d::date
  left join (
    select payment_date as dt, sum(amount) as total
    from susu_payments
    where day_in_cycle = 31
    group by payment_date
  ) susu_fee on susu_fee.dt = d::date
  left join (
    select created_at::date as dt, sum(amount) as total
    from transactions
    where type = 'fee' and reversed_at is null
    group by created_at::date
  ) sms on sms.dt = d::date
  order by d;
end;
$$;
