-- Fix three RPCs that omit 'fee' type transactions from balance math.
--
-- Root cause: the original code treated 'deposit' and 'withdrawal' as the
-- only transaction types that affect the running balance.  'fee' rows
-- (SMS monthly fees, loan processing fees) also reduce the balance, so
-- every forward-walk loop and the recalculate formula must account for them.
--
-- 1. recalculate_account
--    - Was: balance = dep - wdr - comm  (ignores fee deductions)
--    - Fix: balance = dep - wdr - comm - total_fees
--    - Was: bal_after snapshots left untouched ("audit record")
--    - Fix: recompute every bal_after in chronological order so the on-screen
--      transaction history stays internally consistent after any repair.
--
-- 2. edit_transaction
--    - The downstream recompute loop silently skipped 'fee' rows, so editing
--      a deposit/withdrawal that preceded a fee transaction left that fee
--      row's bal_after at the wrong (pre-edit) value.
--    - Fix: add the elsif fee branch in the loop.
--
-- 3. edit_transaction_datetime (0025)
--    - Same missing branch in its full-account recompute loop.
--    - Fix: add the elsif fee branch.

-- ────────────────────────────────────────────────────────────────────────────
-- 1. recalculate_account
-- ────────────────────────────────────────────────────────────────────────────
create or replace function recalculate_account(p_account_id uuid)
returns accounts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account        accounts%rowtype;
  v_dep            numeric(12, 2);
  v_wdr            numeric(12, 2);
  v_comm           numeric(12, 2);
  v_fees           numeric(12, 2);
  v_running        numeric(12, 2) := 0;
  v_row            record;
begin
  if not is_admin() then
    raise exception 'Only an admin can recalculate an account';
  end if;

  select * into v_account from accounts where id = p_account_id for update;
  if not found then
    raise exception 'Account not found';
  end if;

  -- Aggregate totals from non-reversed transactions
  select
    coalesce(sum(amount) filter (where type = 'deposit'),    0),
    coalesce(sum(amount) filter (where type = 'withdrawal'), 0),
    coalesce(sum(fee)    filter (where type = 'withdrawal'), 0),
    coalesce(sum(amount) filter (where type = 'fee'),        0)
  into v_dep, v_wdr, v_comm, v_fees
  from transactions
  where account_id = p_account_id and reversed_at is null;

  -- Rebuild every bal_after snapshot in chronological order
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

  -- Persist corrected account totals (balance includes fee deductions)
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

-- ────────────────────────────────────────────────────────────────────────────
-- 2. edit_transaction — fix downstream recompute loop
-- ────────────────────────────────────────────────────────────────────────────
create or replace function edit_transaction(
  p_transaction_id uuid,
  p_new_amount     numeric,
  p_edited_by      uuid
)
returns transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_txn            transactions%rowtype;
  v_account        accounts%rowtype;
  v_delta          numeric(12, 2);
  v_running_balance numeric(12, 2);
  v_later          record;
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
      amount          = p_new_amount,
      edited_by       = p_edited_by,
      edited_at       = now()
  where id = p_transaction_id
  returning * into v_txn;

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
    elsif v_later.type = 'fee' then
      v_running_balance := v_running_balance - v_later.amount;
    end if;

    update transactions set bal_after = v_running_balance where id = v_later.id;
  end loop;

  return v_txn;
end;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. edit_transaction_datetime — fix full-account recompute loop
-- ────────────────────────────────────────────────────────────────────────────
create or replace function edit_transaction_datetime(
  p_transaction_id uuid,
  p_new_created_at timestamptz,
  p_edited_by      uuid
)
returns transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_txn            transactions%rowtype;
  v_running_balance numeric(12, 2) := 0;
  v_row            record;
begin
  if not is_admin() then
    raise exception 'Only an admin can edit a transaction datetime';
  end if;

  select * into v_txn from transactions where id = p_transaction_id for update;
  if not found then
    raise exception 'Transaction not found';
  end if;
  if v_txn.reversed_at is not null then
    raise exception 'Cannot edit the datetime of a reversed transaction';
  end if;

  update transactions
  set created_at      = p_new_created_at,
      time_edited_by  = p_edited_by,
      time_edited_at  = now()
  where id = p_transaction_id
  returning * into v_txn;

  -- Lock the account row before the full recompute
  perform 1 from accounts where id = v_txn.account_id for update;

  for v_row in
    select id, type, amount, fee
    from transactions
    where account_id = v_txn.account_id and reversed_at is null
    order by created_at, id
  loop
    if v_row.type = 'deposit' then
      v_running_balance := v_running_balance + v_row.amount;
    elsif v_row.type = 'withdrawal' then
      v_running_balance := v_running_balance - v_row.amount - v_row.fee;
    elsif v_row.type = 'fee' then
      v_running_balance := v_running_balance - v_row.amount;
    end if;
    update transactions set bal_after = v_running_balance where id = v_row.id;
  end loop;

  return v_txn;
end;
$$;
