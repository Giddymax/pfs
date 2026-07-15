-- Interest disbursement for high-balance clients. Admin manually credits a
-- flat interest amount to a client's savings/susu account; the disbursement
-- is recorded here so we know a client has already been paid for a given
-- qualifying period (used to build the "eligible for interest" list on the
-- Upcoming page from balance + this history). Interest is recorded as an
-- ordinary 'deposit' transaction — not a new transaction type — so every
-- existing balance-repair/edit/reversal/period-summary RPC keeps working
-- unmodified.

create table interest_disbursements (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  transaction_id uuid references transactions(id) on delete set null,
  amount numeric(12, 2) not null check (amount > 0),
  period_start date not null,
  period_end date not null,
  disbursed_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index interest_disbursements_account_period_idx
  on interest_disbursements (account_id, period_start, period_end);

alter table interest_disbursements enable row level security;

create policy "interest_disbursements_select" on interest_disbursements
  for select using (is_staff_or_admin());

create policy "interest_disbursements_insert" on interest_disbursements
  for insert with check (is_staff_or_admin());

-- disburse_interest — flat, manually-entered interest credit. Behaves like
-- record_deposit (bal += amount, dep += amount, snapshot bal_after) plus
-- writes the interest_disbursements marker row in the same transaction so
-- the two can never desync.
create or replace function disburse_interest(
  p_account_id uuid,
  p_amount numeric,
  p_period_start date,
  p_period_end date,
  p_disbursed_by uuid
)
returns transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account accounts%rowtype;
  v_new_balance numeric(12, 2);
  v_txn transactions%rowtype;
  v_notes text;
begin
  if not is_staff_or_admin() then
    raise exception 'Only staff or admin can disburse interest';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  select * into v_account from accounts where id = p_account_id for update;
  if not found then
    raise exception 'Account not found';
  end if;

  v_new_balance := v_account.balance + p_amount;
  v_notes := 'Interest disbursement (' || to_char(p_period_start, 'DD Mon YYYY') || ' - ' || to_char(p_period_end, 'DD Mon YYYY') || ')';

  update accounts
  set balance = v_new_balance,
      dep = dep + p_amount
  where id = p_account_id;

  insert into transactions (account_id, client_id, type, amount, fee, bal_after, notes, recorded_by)
  values (p_account_id, v_account.client_id, 'deposit', p_amount, 0, v_new_balance, v_notes, p_disbursed_by)
  returning * into v_txn;

  insert into interest_disbursements (account_id, client_id, transaction_id, amount, period_start, period_end, disbursed_by)
  values (p_account_id, v_account.client_id, v_txn.id, p_amount, p_period_start, p_period_end, p_disbursed_by);

  return v_txn;
end;
$$;
