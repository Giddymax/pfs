-- Powers the new Account Summary page (admin-only): one row per calendar
-- day in a chosen month, with that day's total deposits, total withdrawals,
-- and total commission (savings withdrawal commission + the susu day-31
-- company fee), so admins can see the daily shape of activity across a
-- month rather than only a single period-wide total.

create or replace function list_daily_account_summary(p_from date, p_to date)
returns table (
  summary_date date,
  total_deposits numeric,
  total_withdrawals numeric,
  total_commission numeric
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
    coalesce(comm.total, 0) + coalesce(susu_fee.total, 0) as total_commission
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
  order by d;
end;
$$;
