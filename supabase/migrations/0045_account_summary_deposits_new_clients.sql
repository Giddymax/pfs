-- Two changes to the Account Summary daily breakdown:
--
-- 1. "Total Deposits" used to be sum(transactions.amount where type='deposit'),
--    which already captures savings + susu (both post through the shared
--    record_deposit RPC into transactions). It missed fixed deposits and card
--    fees entirely, since neither ever touches the transactions table. It now
--    means the total amount actually received from customers across every
--    product on that day: savings + susu deposits, plus fixed-deposit
--    principal opened that day, plus card fees collected that day.
--
-- 2. "Total SMS Fees" is replaced with "New Clients" — the count of clients
--    registered that day — which is more actionable for a daily summary than
--    an SMS-charge total that's really a once-a-month batch event.

drop function if exists list_daily_account_summary(date, date);

create or replace function list_daily_account_summary(p_from date, p_to date)
returns table (
  summary_date date,
  total_deposits numeric,
  total_withdrawals numeric,
  total_commission numeric,
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
    coalesce(dep.total, 0) + coalesce(fd.total, 0) + coalesce(card.total, 0) as total_deposits,
    coalesce(wdr.total, 0) as total_withdrawals,
    coalesce(comm.total, 0) + coalesce(susu_fee.total, 0) as total_commission,
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
    -- Fixed deposits never touch transactions — principal received on open
    select start_date as dt, sum(principal) as total
    from fixed_deposits
    group by start_date
  ) fd on fd.dt = d::date
  left join (
    -- Card fees never touch transactions either
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
    select created_at::date as dt, count(*) as cnt
    from clients
    group by created_at::date
  ) nc on nc.dt = d::date
  order by d;
end;
$$;
