-- Bank ledger: tracks deposits into and withdrawals from the company's
-- own bank account. Combined with the reconciliation total, this lets the
-- admin see how total company funds are split between cash at hand and
-- cash at bank.
--   cash_at_bank = sum(deposits) - sum(withdrawals)
--   cash_at_hand = reconciliation_total - cash_at_bank

create table bank_transactions (
  id          uuid primary key default gen_random_uuid(),
  type        text not null check (type in ('deposit', 'withdrawal')),
  amount      numeric(12, 2) not null check (amount > 0),
  description text,
  recorded_by uuid references profiles (id),
  created_at  timestamptz not null default now()
);

create index bank_transactions_created_at_idx on bank_transactions (created_at);

alter table bank_transactions enable row level security;

create policy "bank_select" on bank_transactions
  for select using (is_staff_or_admin());

create policy "bank_insert" on bank_transactions
  for insert with check (is_admin());
