-- Same fix as 0053, applied to the Account Summary daily report. Susu
-- withdrawals only ever carry a nonzero fee through the instant emergency
-- withdrawal route's early-withdrawal penalty (record_withdrawal hard-codes
-- fee=0 for every normal susu withdrawal) — that penalty was being summed
-- into total_withdrawal_commission alongside real savings commission. Move
-- it into total_susu_fees, where it belongs.

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
    coalesce(dep.total, 0) + coalesce(fd.total, 0) + coalesce(card.total, 0) as total_deposits,
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
