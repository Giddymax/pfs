-- Renames the MoMo mini-app to Telecom, at the database layer. Table,
-- indexes, RLS policies, and the FK constraint on recorded_by are all
-- renamed in place (ALTER ... RENAME preserves every existing row and
-- foreign-key relationship — this is not a drop/recreate).
--
-- Two things beyond the simple renames need updating too, since neither
-- follows automatically from renaming the table:
--   1. cleanup_staff_ledger_before_delete() (0068) hard-codes the table
--      name inside its body ("delete from momo_transactions ..."), so it
--      must be recreated with the new name or staff deletion breaks
--      outright the moment this migration runs.
--   2. profiles.restricted_pages is a text[] that can already contain the
--      literal string 'momo_performance' (0066, applied to
--      manager@pfs.com) — application code moves to 'telecom_performance',
--      so any existing stored value is rewritten to match, or that
--      admin's page restriction silently stops applying.

alter table momo_transactions rename to telecom_transactions;

alter index momo_transactions_created_at_idx rename to telecom_transactions_created_at_idx;
alter index momo_transactions_phone_number_idx rename to telecom_transactions_phone_number_idx;
alter index momo_transactions_type_idx rename to telecom_transactions_type_idx;

alter table telecom_transactions rename constraint momo_transactions_recorded_by_fkey to telecom_transactions_recorded_by_fkey;

alter policy "momo_transactions_staff_read_write" on telecom_transactions rename to "telecom_transactions_staff_read_write";
alter policy "momo_transactions_staff_insert" on telecom_transactions rename to "telecom_transactions_staff_insert";
alter policy "momo_transactions_admin_update" on telecom_transactions rename to "telecom_transactions_admin_update";
alter policy "momo_transactions_admin_delete" on telecom_transactions rename to "telecom_transactions_admin_delete";

-- Recreate cleanup_staff_ledger_before_delete() — identical to 0068's body
-- except the final delete now targets telecom_transactions.
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

  -- Telecom transactions — flat log, no derived state, nothing to recalculate.
  delete from telecom_transactions where recorded_by = old.id;

  return old;
end;
$$;

-- Data fix: any profile that already restricted 'momo_performance' keeps
-- the same restriction under its new name.
update profiles
set restricted_pages = array_replace(restricted_pages, 'momo_performance', 'telecom_performance')
where 'momo_performance' = any(restricted_pages);
