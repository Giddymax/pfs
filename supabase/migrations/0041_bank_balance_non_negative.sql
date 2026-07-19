-- Enforce "cash at bank can never go negative" at the database level, since
-- bank_transactions has three write paths (the create API route, and the
-- edit/delete buttons which write directly from the browser via the
-- Supabase client) — a client-side check on the create modal alone is easy
-- to bypass via the other two. Recomputes the running balance in
-- chronological order after every insert/update/delete and rejects the
-- whole statement if the balance would have dipped below zero at any point.
-- Existing error-handling UI (all three bank_transactions write paths
-- already display `error.message`/`updateError.message` inline) surfaces
-- this exception to the user automatically — no UI changes needed for the
-- "alert" itself.

create or replace function check_bank_balance_non_negative()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_running numeric(12, 2) := 0;
  v_row record;
begin
  for v_row in select type, amount from bank_transactions order by created_at, id
  loop
    v_running := v_running + case when v_row.type = 'deposit' then v_row.amount else -v_row.amount end;
    if v_running < 0 then
      raise exception 'This change would make cash at bank negative. Cash at bank cannot go below GHS 0.';
    end if;
  end loop;
  return null;
end;
$$;

create trigger bank_transactions_non_negative
  after insert or update or delete on bank_transactions
  for each statement execute function check_bank_balance_non_negative();
