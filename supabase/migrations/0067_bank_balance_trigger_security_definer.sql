-- Fixes: deleting a staff account whose momo/transactions activity
-- includes any bank_transactions.recorded_by row fails with "permission
-- denied for table bank_transactions" (Postgres 42501).
--
-- Root cause: 0064_staff_delete_set_null.sql made
-- bank_transactions.recorded_by ON DELETE SET NULL, so deleting the auth
-- user cascades into an UPDATE on bank_transactions. That UPDATE fires
-- check_bank_balance_non_negative() (0041_bank_balance_non_negative.sql),
-- which re-reads the whole table to recheck the running balance — but that
-- function was never `security definer`, so it runs with the privileges of
-- whoever triggered the UPDATE. For every normal app write path that's the
-- session-authenticated `authenticated` role (which has the standard
-- Supabase grants), but a cascading SET NULL from auth.admin.deleteUser()
-- runs as `supabase_auth_admin` — an internal role scoped to the `auth`
-- schema, with no grants on public tables at all. Hence the permission
-- error, not a foreign-key violation.
--
-- Fix: same pattern already used everywhere else in this schema for
-- functions that must read/write regardless of the caller's own table
-- grants (is_admin(), is_staff_or_admin(), recalculate_account(), etc.) —
-- mark it `security definer` so it runs as the function's owner instead.
-- Signature (name + arg types) is unchanged, so `create or replace`
-- correctly replaces the existing trigger function rather than creating a
-- stray second one.

create or replace function check_bank_balance_non_negative()
returns trigger
language plpgsql
security definer
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
