-- Add an optional date range to staff_performance() so the Staff
-- Performance page can filter by Day/Week/Month/Custom (currently it only
-- ever showed all-time totals). Both params default to null, meaning "no
-- filter" — the original 0-arg call site (if anything still uses it) keeps
-- returning all-time totals unchanged; passing p_from/p_to narrows each
-- metric to that range:
--   clients_registered -> clients.created_at
--   savings_collected  -> transactions.created_at (savings deposits)
--   susu_collected     -> susu_payments.payment_date

drop function if exists staff_performance();

create or replace function staff_performance(p_from date default null, p_to date default null)
returns table (
  staff_id          uuid,
  full_name         text,
  email             text,
  role              text,
  is_active         boolean,
  clients_registered bigint,
  savings_collected  numeric,
  susu_collected     numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id                                                        as staff_id,
    p.full_name,
    p.email,
    p.role,
    p.is_active,
    count(distinct c.id)                                        as clients_registered,
    coalesce((
      select sum(t.amount)
      from transactions t
      join accounts a on a.id = t.account_id
      where t.recorded_by = p.id
        and t.type = 'deposit'
        and t.reversed_at is null
        and a.product_type = 'savings'
        and (p_from is null or t.created_at::date >= p_from)
        and (p_to   is null or t.created_at::date <= p_to)
    ), 0)                                                       as savings_collected,
    coalesce((
      select sum(sp.amount)
      from susu_payments sp
      where sp.recorded_by = p.id
        and (p_from is null or sp.payment_date >= p_from)
        and (p_to   is null or sp.payment_date <= p_to)
    ), 0)                                                       as susu_collected
  from profiles p
  left join clients c on c.created_by = p.id
    and (p_from is null or c.created_at::date >= p_from)
    and (p_to   is null or c.created_at::date <= p_to)
  group by p.id, p.full_name, p.email, p.role, p.is_active
  order by count(distinct c.id) desc, p.full_name;
$$;
