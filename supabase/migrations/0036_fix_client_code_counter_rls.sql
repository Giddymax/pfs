-- client_code_counters has RLS enabled with no policies, so the implicit
-- insert/update inside generate_client_code() (fired as the logged-in staff
-- user, not an elevated role) is rejected: "new row violates row-level
-- security policy for table client_code_counters".
-- Make the trigger function security definer (matching other internal-write
-- RPCs in this project) so the counter bump bypasses RLS regardless of the
-- calling user's role.

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
$$ language plpgsql
security definer
set search_path = public;
