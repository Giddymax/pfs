-- Prime Financial Service — transaction engine RPCs
-- Run after 0004_transactions_and_settings.sql.
--
-- All balance-mutating ledger operations live here as `security definer`
-- functions so the read-modify-write + audit-snapshot sequence is atomic
-- (row-locked with `for update`) and the math can never drift between the
-- UI, the audit trail, and the repair tool. Each function re-checks the
-- caller's role internally — defense in depth alongside RLS, since
-- `security definer` functions execute with the owner's privileges and
-- bypass the caller's row-level policies.
--
-- Commission rule (regular savings withdrawals only — susu is exempt):
-- look up the tier with the highest `min` that is <= the amount ("nearest
-- lower tier's fee" — also correctly resolves an exact in-range match,
-- since a tier's own `min` is the highest qualifying `min` for amounts
-- inside its range). Amounts below every tier's `min` incur no commission.

-- ========================================
-- record_deposit — bal += amount, dep += amount, snapshot bal_after
-- ========================================
create or replace function record_deposit(
  p_account_id uuid,
  p_amount numeric,
  p_recorded_by uuid,
  p_notes text default null
)
returns transactions
language plpgsql
security definer
as $$
declare
  v_account accounts%rowtype;
  v_new_balance numeric(12, 2);
  v_txn transactions%rowtype;
begin
  if not is_staff_or_admin() then
    raise exception 'Only staff or admin can record transactions';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  select * into v_account from accounts where id = p_account_id for update;
  if not found then
    raise exception 'Account not found';
  end if;

  v_new_balance := v_account.balance + p_amount;

  update accounts
  set balance = v_new_balance,
      dep = dep + p_amount
  where id = p_account_id;

  insert into transactions (account_id, client_id, type, amount, fee, bal_after, notes, recorded_by)
  values (p_account_id, v_account.client_id, 'deposit', p_amount, 0, v_new_balance, p_notes, p_recorded_by)
  returning * into v_txn;

  return v_txn;
end;
$$;

-- ========================================
-- record_withdrawal — tiered commission for savings, exempt for susu;
-- bal -= (amount + fee), wdr += amount, comm += fee
-- ========================================
create or replace function record_withdrawal(
  p_account_id uuid,
  p_amount numeric,
  p_recorded_by uuid,
  p_notes text default null
)
returns transactions
language plpgsql
security definer
as $$
declare
  v_account accounts%rowtype;
  v_fee numeric(12, 2) := 0;
  v_tiers jsonb;
  v_tier jsonb;
  v_new_balance numeric(12, 2);
  v_txn transactions%rowtype;
begin
  if not is_staff_or_admin() then
    raise exception 'Only staff or admin can record transactions';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  select * into v_account from accounts where id = p_account_id for update;
  if not found then
    raise exception 'Account not found';
  end if;

  if v_account.product_type = 'savings' then
    select value into v_tiers from settings where key = 'commission_tiers';

    select t into v_tier
    from jsonb_array_elements(coalesce(v_tiers, '[]'::jsonb)) as t
    where (t->>'min')::numeric <= p_amount
    order by (t->>'min')::numeric desc
    limit 1;

    if v_tier is not null then
      v_fee := (v_tier->>'fee')::numeric;
    end if;
  end if;
  -- susu accounts: v_fee stays 0 — exempt from commission per spec

  if v_account.balance < (p_amount + v_fee) then
    raise exception 'Insufficient balance: % + % commission exceeds available balance %',
      p_amount, v_fee, v_account.balance;
  end if;

  v_new_balance := v_account.balance - (p_amount + v_fee);

  update accounts
  set balance = v_new_balance,
      wdr = wdr + p_amount,
      comm = comm + v_fee
  where id = p_account_id;

  insert into transactions (account_id, client_id, type, amount, fee, bal_after, notes, recorded_by)
  values (p_account_id, v_account.client_id, 'withdrawal', p_amount, v_fee, v_new_balance, p_notes, p_recorded_by)
  returning * into v_txn;

  return v_txn;
end;
$$;

-- ========================================
-- edit_transaction — admin-only; applies the delta to bal + the relevant
-- running total, then walks forward and recomputes every later bal_after
-- snapshot on the same account (an edit to an old row invalidates every
-- subsequent snapshot — this MUST be done or the audit trail desyncs).
-- ========================================
create or replace function edit_transaction(
  p_transaction_id uuid,
  p_new_amount numeric,
  p_edited_by uuid
)
returns transactions
language plpgsql
security definer
as $$
declare
  v_txn transactions%rowtype;
  v_account accounts%rowtype;
  v_delta numeric(12, 2);
  v_running_balance numeric(12, 2);
  v_later record;
begin
  if not is_admin() then
    raise exception 'Only an admin can edit a transaction';
  end if;

  if p_new_amount is null or p_new_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  select * into v_txn from transactions where id = p_transaction_id for update;
  if not found then
    raise exception 'Transaction not found';
  end if;
  if v_txn.reversed_at is not null then
    raise exception 'Cannot edit a reversed transaction';
  end if;
  if v_txn.type not in ('deposit', 'withdrawal') then
    raise exception 'Only deposits and withdrawals can be edited';
  end if;

  select * into v_account from accounts where id = v_txn.account_id for update;

  v_delta := p_new_amount - v_txn.amount;

  if v_txn.type = 'deposit' then
    update accounts set balance = balance + v_delta, dep = dep + v_delta where id = v_account.id;
  else
    update accounts set balance = balance - v_delta, wdr = wdr + v_delta where id = v_account.id;
  end if;

  update transactions
  set original_amount = coalesce(original_amount, amount),
      amount = p_new_amount,
      edited_by = p_edited_by,
      edited_at = now()
  where id = p_transaction_id
  returning * into v_txn;

  -- v_txn.bal_after still holds the OLD snapshot (the row update above only
  -- touched amount/original_amount/edited_*). Shift it by the same signed
  -- delta just applied to the account balance, then walk forward and
  -- recompute every later, non-reversed snapshot on the account from there.
  v_running_balance := v_txn.bal_after + (case when v_txn.type = 'deposit' then v_delta else -v_delta end);

  update transactions set bal_after = v_running_balance where id = v_txn.id;

  for v_later in
    select * from transactions
    where account_id = v_txn.account_id
      and reversed_at is null
      and (created_at, id) > (v_txn.created_at, v_txn.id)
    order by created_at, id
  loop
    if v_later.type = 'deposit' then
      v_running_balance := v_running_balance + v_later.amount;
    elsif v_later.type = 'withdrawal' then
      v_running_balance := v_running_balance - v_later.amount - v_later.fee;
    end if;

    update transactions set bal_after = v_running_balance where id = v_later.id;
  end loop;

  return v_txn;
end;
$$;

-- ========================================
-- delete_transaction — admin-only soft-delete reversal; reverses the
-- balance/running-total impact, flags the row as reversed (preserving the
-- audit trail rather than physically deleting), and recomputes downstream
-- bal_after snapshots. Returns client contact info for the "transaction
-- reversed" SMS the caller sends after this commits.
-- ========================================
create or replace function delete_transaction(
  p_transaction_id uuid,
  p_deleted_by uuid
)
returns table (
  transaction_id uuid,
  client_id uuid,
  client_full_name text,
  client_phone text,
  admin_name text
)
language plpgsql
security definer
as $$
declare
  v_txn transactions%rowtype;
  v_account accounts%rowtype;
  v_running_balance numeric(12, 2);
  v_later record;
  v_client clients%rowtype;
  v_admin profiles%rowtype;
begin
  if not is_admin() then
    raise exception 'Only an admin can delete a transaction';
  end if;

  select * into v_txn from transactions where id = p_transaction_id for update;
  if not found then
    raise exception 'Transaction not found';
  end if;
  if v_txn.reversed_at is not null then
    raise exception 'Transaction has already been reversed';
  end if;
  if v_txn.type not in ('deposit', 'withdrawal') then
    raise exception 'Only deposits and withdrawals can be reversed';
  end if;

  select * into v_account from accounts where id = v_txn.account_id for update;

  if v_txn.type = 'deposit' then
    update accounts set balance = balance - v_txn.amount, dep = dep - v_txn.amount where id = v_account.id;
    v_running_balance := v_account.balance - v_txn.amount;
  else
    update accounts
    set balance = balance + v_txn.amount + v_txn.fee,
        wdr = wdr - v_txn.amount,
        comm = comm - v_txn.fee
    where id = v_account.id;
    v_running_balance := v_account.balance + v_txn.amount + v_txn.fee;
  end if;

  update transactions
  set reversed_at = now(),
      reversed_by = p_deleted_by
  where id = p_transaction_id;

  -- Recompute downstream snapshots so the chain stays internally consistent.
  for v_later in
    select * from transactions
    where account_id = v_txn.account_id
      and reversed_at is null
      and (created_at, id) > (v_txn.created_at, v_txn.id)
    order by created_at, id
  loop
    if v_later.type = 'deposit' then
      v_running_balance := v_running_balance + v_later.amount;
    elsif v_later.type = 'withdrawal' then
      v_running_balance := v_running_balance - v_later.amount - v_later.fee;
    end if;

    update transactions set bal_after = v_running_balance where id = v_later.id;
  end loop;

  select * into v_client from clients where id = v_txn.client_id;
  select * into v_admin from profiles where id = p_deleted_by;

  return query select v_txn.id, v_client.id, v_client.full_name, v_client.phone, v_admin.full_name;
end;
$$;

-- ========================================
-- recalculate_account — admin-only repair tool. Recomputes bal/dep/wdr/comm
-- directly from non-reversed transactions (sum of deposits, withdrawals,
-- fees), overwriting the account row. Historical bal_after snapshots are
-- left untouched — they remain a point-in-time audit record.
-- ========================================
create or replace function recalculate_account(p_account_id uuid)
returns accounts
language plpgsql
security definer
as $$
declare
  v_account accounts%rowtype;
  v_dep numeric(12, 2);
  v_wdr numeric(12, 2);
  v_comm numeric(12, 2);
begin
  if not is_admin() then
    raise exception 'Only an admin can recalculate an account';
  end if;

  select * into v_account from accounts where id = p_account_id for update;
  if not found then
    raise exception 'Account not found';
  end if;

  select
    coalesce(sum(amount) filter (where type = 'deposit'), 0),
    coalesce(sum(amount) filter (where type = 'withdrawal'), 0),
    coalesce(sum(fee) filter (where type = 'withdrawal'), 0)
  into v_dep, v_wdr, v_comm
  from transactions
  where account_id = p_account_id and reversed_at is null;

  update accounts
  set dep = v_dep,
      wdr = v_wdr,
      comm = v_comm,
      balance = v_dep - v_wdr - v_comm
  where id = p_account_id
  returning * into v_account;

  return v_account;
end;
$$;
