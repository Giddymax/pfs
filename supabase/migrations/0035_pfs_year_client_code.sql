-- Change client code format from PFS-XXXX to PFS/YY/XXXX (per-year sequential)
-- e.g. PFS-0001 → PFS/26/0001 for new registrations.
-- Existing clients keep their old codes; only new inserts use the new format.

create table if not exists client_code_counters (
  year  char(2)  primary key,
  last_val integer not null default 0
);

create or replace function generate_client_code()
returns trigger as $$
declare
  yr  char(2);
  seq integer;
begin
  if new.client_code is null or new.client_code = '' then
    yr := to_char(now(), 'YY');

    insert into client_code_counters (year, last_val)
    values (yr, 1)
    on conflict (year) do update
      set last_val = client_code_counters.last_val + 1
    returning last_val into seq;

    new.client_code := 'PFS/' || yr || '/' || lpad(seq::text, 4, '0');
  end if;
  return new;
end;
$$ language plpgsql;
