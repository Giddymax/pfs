-- Lets an admin permanently delete a staff/admin account.
--
-- The DELETE /api/staff/[id] route already exists and calls
-- admin.auth.admin.deleteUser(id). profiles.id references auth.users(id)
-- on delete cascade (0001_init.sql), so deleting the auth user cascades
-- into deleting the profiles row too — but every other table that records
-- WHO did something (recorded_by, created_by, issued_by, agent_id,
-- charged_by, requested_by/approved_by/paid_by, disbursed_by, deleted_by,
-- updated_by, time_edited_by) references profiles(id) with NO delete
-- action specified, which defaults to RESTRICT. In practice that means
-- deleting any staff member who has ever recorded a transaction,
-- registered a client, issued a loan, been assigned as a susu agent, etc.
-- fails outright with a foreign-key violation — which, for a
-- currently-working admin or staff account, is effectively every one of
-- them.
--
-- Fix: every one of those columns becomes ON DELETE SET NULL instead of
-- the RESTRICT default. Deleting a staff account preserves every
-- transaction, client, loan, and log entry they ever touched — only the
-- "who did this" attribution on that historical data becomes null (reads
-- as "—" / unattributed in the UI going forward). This is the exact same
-- pattern expenditures.recorded_by (and the now-removed investments table)
-- already used (0028/0030/0031) — this migration just extends it to every
-- other table that was missed.
--
-- momo_transactions.recorded_by is the one column that's NOT NULL
-- (0062_momo_transactions.sql) — dropped to nullable first, since a
-- deleted staff member's MoMo entries need somewhere to fall to as well.
--
-- Constraint names are looked up from pg_constraint rather than assumed
-- (instead of guessing Postgres's default <table>_<column>_fkey naming),
-- so this is safe even if any of these ended up named differently than
-- the convention for any reason.

alter table momo_transactions alter column recorded_by drop not null;

do $$
declare
  fk record;
  found_name text;
begin
  for fk in
    select * from (values
      ('clients',               'created_by'),
      ('loans',                 'issued_by'),
      ('loan_repayments',       'recorded_by'),
      ('accounts',              'agent_id'),
      ('accounts',              'created_by'),
      ('transactions',          'recorded_by'),
      ('transactions',          'edited_by'),
      ('transactions',          'reversed_by'),
      ('transactions',          'time_edited_by'),
      ('card_fees',             'charged_by'),
      ('settings',              'updated_by'),
      ('susu_payments',         'recorded_by'),
      ('susu_claims',           'requested_by'),
      ('susu_claims',           'approved_by'),
      ('susu_claims',           'paid_by'),
      ('bank_transactions',     'recorded_by'),
      ('sms_fee_charges',       'charged_by'),
      ('interest_disbursements','disbursed_by'),
      ('cash_reconciliations',  'recorded_by'),
      ('client_deletion_log',   'deleted_by'),
      ('momo_transactions',     'recorded_by')
    ) as t(table_name, column_name)
  loop
    -- Find the actual FK constraint name for this (table, column) pair
    -- that targets profiles, rather than assuming a naming convention.
    select con.conname into found_name
    from pg_constraint con
    join pg_class src_tbl   on src_tbl.oid = con.conrelid
    join pg_class tgt_tbl   on tgt_tbl.oid = con.confrelid
    join pg_attribute att   on att.attrelid = con.conrelid and att.attnum = con.conkey[1]
    where con.contype = 'f'
      and src_tbl.relname = fk.table_name
      and tgt_tbl.relname = 'profiles'
      and att.attname = fk.column_name
      and array_length(con.conkey, 1) = 1;

    if found_name is not null then
      execute format('alter table %I drop constraint %I', fk.table_name, found_name);
    end if;

    execute format(
      'alter table %I add constraint %I foreign key (%I) references profiles(id) on delete set null',
      fk.table_name, fk.table_name || '_' || fk.column_name || '_fkey', fk.column_name
    );
  end loop;
end $$;
