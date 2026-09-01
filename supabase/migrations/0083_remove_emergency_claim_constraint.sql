-- Completely removes the constraint that blocked an emergency susu claim
-- unless its cycle was still 'in_progress'. An emergency claim can now be
-- requested against a cycle in any status — 'in_progress', 'complete', or
-- even 'closed' — as long as the cycle itself exists. Nothing else about
-- the function changes: the penalty is still exactly one day's contribution
-- (0009_susu_rpcs.sql's original formula), still requires admin approval
-- before payout (approve_emergency_claim/pay_susu_claim, untouched).
--
-- Same signature as 0009_susu_rpcs.sql, so this replaces the real function
-- rather than adding an overload.

create or replace function request_emergency_claim(
  p_account_id uuid,
  p_cycle_id uuid,
  p_requested_by uuid
)
returns susu_claims
language plpgsql
security definer
as $$
declare
  v_account accounts%rowtype;
  v_cycle susu_cycles%rowtype;
  v_penalty numeric(12, 2);
  v_claim susu_claims%rowtype;
begin
  if not is_staff_or_admin() then
    raise exception 'Only staff or admin can request a susu claim';
  end if;

  select * into v_account from accounts where id = p_account_id;
  if not found then
    raise exception 'Account not found';
  end if;

  select * into v_cycle from susu_cycles where id = p_cycle_id and account_id = p_account_id for update;
  if not found then
    raise exception 'Cycle not found for this account';
  end if;

  v_penalty := coalesce(v_account.daily_contribution_amount, 0);

  insert into susu_claims (account_id, cycle_id, claim_type, status, amount, penalty_amount, requested_by)
  values (
    p_account_id,
    p_cycle_id,
    'emergency',
    'pending_admin',
    greatest(v_cycle.total_collected - v_penalty, 0),
    v_penalty,
    p_requested_by
  )
  returning * into v_claim;

  return v_claim;
end;
$$;
