-- MoMo mini-app — phase 1 (see momo-mini-app-brief.md at the repo root).
--
-- A flat, walk-in transaction log, deliberately NOT a wallet/ledger: every
-- row stands alone, for a phone number that isn't necessarily an existing
-- PFS client. There is no balance to keep in sync, so — unlike
-- accounts/transactions — this needs no balance_after snapshot and no
-- recalculate_* RPC.
--
-- Admin-only for now, at every layer (not just the UI): the sidebar hides
-- the MoMo pill from staff, app/(dashboard)/momo/layout.tsx redirects any
-- staff member who navigates there directly, and this migration's RLS
-- policies below enforce the same restriction at the database, so a staff
-- session can't reach momo_transactions even by calling the API directly.
--
-- Financially and structurally independent from every other table in this
-- schema — no foreign key to clients, accounts, or transactions. See
-- momo-mini-app-brief.md §7 for why that separation is a firm decision.

create table momo_transactions (
  id             uuid primary key default gen_random_uuid(),
  phone_number   text not null,
  type           text not null check (type in ('cash_in','cash_out','deposit','airtime','data_bundle','mashup')),
  charge         numeric(10,2) not null check (charge >= 0),
  note           text,
  recorded_by    uuid not null references profiles(id),
  reversed_at    timestamptz,
  created_at     timestamptz not null default now()
);

create index momo_transactions_created_at_idx on momo_transactions (created_at desc);
create index momo_transactions_phone_number_idx on momo_transactions (phone_number);
create index momo_transactions_type_idx on momo_transactions (type);

alter table momo_transactions enable row level security;

-- Admin-only, full stop — see the header comment above. Reuses is_admin(),
-- the same identity/permission primitive every other PFS admin-only table
-- already relies on (0001_init.sql); this is shared plumbing, not a shared
-- business rule (see momo-mini-app-brief.md §1).
create policy "momo_transactions_admin_all" on momo_transactions
  for all using (is_admin()) with check (is_admin());
