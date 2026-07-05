-- Track investment lifecycle so revenue is only recognized when an investment is returned.

alter table investments
  add column status text not null default 'active',
  add column return_date date,
  add column returned_by uuid references profiles(id) on delete set null,
  add column returned_at timestamptz;

update investments
set
  status = 'returned',
  return_date = coalesce(return_date, date),
  returned_by = coalesce(returned_by, recorded_by),
  returned_at = coalesce(returned_at, created_at)
where revenue_made > 0;

alter table investments
  add constraint investments_status_check
    check (status in ('active', 'returned')),
  add constraint investments_return_state_check
    check (
      (
        status = 'active'
        and revenue_made = 0
        and return_date is null
        and returned_by is null
        and returned_at is null
      )
      or
      (
        status = 'returned'
        and revenue_made >= 0
        and return_date is not null
        and returned_at is not null
      )
    );
