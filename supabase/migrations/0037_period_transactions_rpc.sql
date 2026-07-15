-- Itemised transaction log for the Summary report page — same date-range
-- predicate as compute_period_summary (created_at::date between p_from and
-- p_to) so the detail list always reconciles with the period totals above it.
-- Unlike the aggregate summary, this includes reversed/edited rows too since
-- it's meant as an audit trail, not a net-effect figure.

create or replace function list_period_transactions(p_from date, p_to date)
returns table (
  id uuid,
  created_at timestamptz,
  type text,
  amount numeric,
  fee numeric,
  bal_after numeric,
  notes text,
  client_id uuid,
  client_full_name text,
  client_code text,
  account_id uuid,
  account_number text,
  product_type text,
  recorded_by_name text,
  edited_by_name text,
  edited_at timestamptz,
  original_amount numeric,
  reversed_by_name text,
  reversed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_staff_or_admin() then
    raise exception 'Only staff or admin can view the summary report';
  end if;

  return query
  select
    t.id,
    t.created_at,
    t.type,
    t.amount,
    t.fee,
    t.bal_after,
    t.notes,
    t.client_id,
    c.full_name,
    c.client_code,
    t.account_id,
    a.account_number,
    a.product_type,
    rp.full_name,
    ep.full_name,
    t.edited_at,
    t.original_amount,
    vp.full_name,
    t.reversed_at
  from transactions t
  join clients c on c.id = t.client_id
  join accounts a on a.id = t.account_id
  left join profiles rp on rp.id = t.recorded_by
  left join profiles ep on ep.id = t.edited_by
  left join profiles vp on vp.id = t.reversed_by
  where t.created_at::date between p_from and p_to
  order by t.created_at desc;
end;
$$;
