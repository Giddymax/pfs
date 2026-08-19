-- Explicit, confirmed decision (not the default): deleting a staff/admin
-- account now also permanently deletes every transaction-ledger row they
-- personally recorded — momo_transactions, transactions (PFS
-- savings/susu), susu_payments, and bank_transactions — instead of the
-- 0064_staff_delete_set_null.sql behaviour of keeping the row with the
-- attribution blanked out. This is a genuine, deliberate data-loss
-- decision: real deposits/withdrawals/contributions disappear from client
-- account history and totals recalculate without them.
--
-- Scope, drawn deliberately narrow: only rows that ARE the recorded
-- money-movement event this staff member personally created. NOT included
-- — these stay ON DELETE SET NULL (unattributed, but preserved), because
-- deleting them would mean deleting core business records that belong to
-- a CLIENT, not to the staff member:
--   clients.created_by, loans.issued_by, accounts.agent_id/created_by,
--   susu_claims.requested_by/approved_by/paid_by, card_fees.charged_by,
--   sms_fee_charges.charged_by, interest_disbursements.disbursed_by,
--   cash_reconciliations.recorded_by, client_deletion_log.deleted_by,
--   settings.updated_by
-- If a susu_claims row's *payout transaction* is one of the transactions
-- being deleted, the claim record itself is kept — only its transaction_id
-- link is cleared, same principle: the claim belongs to the client.
--
-- Runs as a BEFORE DELETE trigger on profiles rather than plain FK
-- ON DELETE CASCADE, because deleting transactions/susu_payments isn't a
-- context-free operation — accounts.balance/dep/wdr and
-- susu_cycles.total_collected are cached/derived totals that must be
-- recalculated afterward, exactly mirroring the existing single-row logic
-- in app/api/transactions/[id]/delete/route.ts, generalized to every
-- matching row instead of just one.
--
-- bank_transactions deletion is still guarded by
-- check_bank_balance_non_negative() (0041, made security definer in
-- 0067) — if removing this staff member's bank deposits would retroactively
-- take cash-at-bank negative at any historical point, that trigger raises
-- and the ENTIRE staff deletion is aborted. That is correct, not a bug:
-- this invariant must never be silently violated, and the admin needs to
-- resolve it manually (e.g. record an offsetting adjustment first) before
-- the deletion can proceed.

-- ────────────────────────────────────────────────────────────────────────
-- 1. recalculate_account_internal — same body as recalculate_account()
--    (0029_fix_fee_in_balance_rpcs.sql), minus the is_admin() check. That
--    check reads auth.uid(), which is null in the internal
--    supabase_auth_admin context this trigger runs under (see
--    0067_bank_balance_trigger_security_definer.sql's header comment for
--    the same class of gotcha) — recalculate_account() itself is left
--    untouched, since weakening its public-facing check would be a much
--    bigger blast radius than adding a narrowly-scoped internal twin.
--    EXECUTE is revoked from anon/authenticated so it's not reachable as a
--    public RPC; only reachable from within another security definer
--    function (like the trigger below), which runs as this function's
--    owner regardless of grants.
-- ────────────────────────────────────────────────────────────────────────

create or replace function recalculate_account_internal(p_account_id uuid)
returns accounts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account accounts%rowtype;
  v_dep     numeric(12, 2);
  v_wdr     numeric(12, 2);
  v_comm    numeric(12, 2);
  v_fees    numeric(12, 2);
  v_running numeric(12, 2) := 0;
  v_row     record;
begin
  select * into v_account from accounts where id = p_account_id for update;
  if not found then
    return null;
  end if;

  select
    coalesce(sum(amount) filter (where type = 'deposit'),    0),
    coalesce(sum(amount) filter (where type = 'withdrawal'), 0),
    coalesce(sum(fee)    filter (where type = 'withdrawal'), 0),
    coalesce(sum(amount) filter (where type = 'fee'),        0)
  into v_dep, v_wdr, v_comm, v_fees
  from transactions
  where account_id = p_account_id and reversed_at is null;

  for v_row in
    select id, type, amount, fee
    from transactions
    where account_id = p_account_id and reversed_at is null
    order by created_at, id
  loop
    if v_row.type = 'deposit' then
      v_running := v_running + v_row.amount;
    elsif v_row.type = 'withdrawal' then
      v_running := v_running - v_row.amount - v_row.fee;
    elsif v_row.type = 'fee' then
      v_running := v_running - v_row.amount;
    end if;
    update transactions set bal_after = v_running where id = v_row.id;
  end loop;

  update accounts
  set dep     = v_dep,
      wdr     = v_wdr,
      comm    = v_comm,
      balance = v_dep - v_wdr - v_comm - v_fees
  where id = p_account_id
  returning * into v_account;

  return v_account;
end;
$$;

revoke execute on function recalculate_account_internal(uuid) from public, anon, authenticated;

-- ────────────────────────────────────────────────────────────────────────
-- 2. recompute_susu_cycle_internal — mirrors the "recalculate the cycle
--    from remaining payments" block in
--    app/api/transactions/[id]/delete/route.ts exactly: if no payments are
--    left, the cycle (and any claim against it) is removed entirely since
--    an empty cycle isn't a meaningful record; otherwise total_collected
--    is rebuilt from what remains, and status/completed_on/company_fee are
--    reset back to in_progress if the day-31 payment was the one removed.
-- ────────────────────────────────────────────────────────────────────────

create or replace function recompute_susu_cycle_internal(p_cycle_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count    int;
  v_total    numeric(12, 2);
  v_max_day  int;
begin
  select count(*), coalesce(sum(amount), 0), coalesce(max(day_in_cycle), 0)
  into v_count, v_total, v_max_day
  from susu_payments
  where cycle_id = p_cycle_id;

  if v_count = 0 then
    delete from susu_claims where cycle_id = p_cycle_id;
    delete from susu_cycles where id = p_cycle_id;
  elsif v_max_day >= 31 then
    update susu_cycles set total_collected = v_total where id = p_cycle_id;
  else
    update susu_cycles
    set total_collected = v_total, status = 'in_progress', completed_on = null, company_fee = null
    where id = p_cycle_id;
  end if;
end;
$$;

revoke execute on function recompute_susu_cycle_internal(uuid) from public, anon, authenticated;

-- ────────────────────────────────────────────────────────────────────────
-- 3. The trigger itself
-- ────────────────────────────────────────────────────────────────────────

create or replace function cleanup_staff_ledger_before_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_txn              record;
  v_payment          record;
  v_affected_account uuid;
  v_affected_accounts uuid[] := '{}';
begin
  -- PFS transactions (savings + susu deposits/withdrawals/fees) this staff
  -- member personally recorded.
  for v_txn in
    select id, account_id from transactions where recorded_by = old.id
  loop
    -- A susu claim's payout can point at this transaction — detach it
    -- (don't delete the claim: it's the client's record, not the staff's).
    update susu_claims set transaction_id = null where transaction_id = v_txn.id;

    -- Linked susu contribution row, if this was a susu payment.
    select id, cycle_id into v_payment from susu_payments where transaction_id = v_txn.id;
    if found then
      delete from susu_payments where id = v_payment.id;
      perform recompute_susu_cycle_internal(v_payment.cycle_id);
    end if;

    if not (v_txn.account_id = any(v_affected_accounts)) then
      v_affected_accounts := array_append(v_affected_accounts, v_txn.account_id);
    end if;

    delete from transactions where id = v_txn.id;
  end loop;

  -- Susu payments recorded by this staff with no linked transaction row
  -- (shouldn't normally happen — every contribution flow inserts both
  -- together — but handled defensively so nothing is left half-cleaned).
  for v_payment in
    select id, cycle_id, account_id from susu_payments where recorded_by = old.id
  loop
    delete from susu_payments where id = v_payment.id;
    perform recompute_susu_cycle_internal(v_payment.cycle_id);
    if not (v_payment.account_id = any(v_affected_accounts)) then
      v_affected_accounts := array_append(v_affected_accounts, v_payment.account_id);
    end if;
  end loop;

  -- Recalculate every account touched above, now that its transaction
  -- history has changed.
  foreach v_affected_account in array v_affected_accounts loop
    perform recalculate_account_internal(v_affected_account);
  end loop;

  -- Company bank ledger — self-validated by check_bank_balance_non_negative()
  -- (security definer since 0067); raises and aborts this whole deletion if
  -- removing these rows would retroactively take cash-at-bank negative.
  delete from bank_transactions where recorded_by = old.id;

  -- MoMo transactions — flat log, no derived state, nothing to recalculate.
  delete from momo_transactions where recorded_by = old.id;

  return old;
end;
$$;

drop trigger if exists profiles_cleanup_staff_ledger on profiles;
create trigger profiles_cleanup_staff_ledger
  before delete on profiles
  for each row execute function cleanup_staff_ledger_before_delete();
