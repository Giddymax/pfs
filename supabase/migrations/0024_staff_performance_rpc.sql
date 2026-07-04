-- Returns per-staff performance metrics:
--   clients_registered  = clients.created_by
--   savings_collected   = sum of savings deposit transactions recorded by this staff
--   susu_collected      = sum of susu_payments recorded by this staff
create or replace function staff_performance()
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
    ), 0)                                                       as savings_collected,
    coalesce((
      select sum(sp.amount)
      from susu_payments sp
      where sp.recorded_by = p.id
    ), 0)                                                       as susu_collected
  from profiles p
  left join clients c on c.created_by = p.id
  group by p.id, p.full_name, p.email, p.role, p.is_active
  order by count(distinct c.id) desc, p.full_name;
$$;
