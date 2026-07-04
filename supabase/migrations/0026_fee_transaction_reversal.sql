-- Extend delete_transaction to also handle 'fee' type transactions.
-- Fee transactions reduce balance directly (no dep/wdr/comm change), so
-- reversing them simply adds the amount back to balance and recomputes
-- downstream bal_after snapshots.

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
set search_path = public
as $$
declare
  v_txn            transactions%rowtype;
  v_account        accounts%rowtype;
  v_running_balance numeric(12, 2);
  v_later          record;
  v_client         clients%rowtype;
  v_admin          profiles%rowtype;
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
  if v_txn.type not in ('deposit', 'withdrawal', 'fee') then
    raise exception 'Only deposits, withdrawals, and fee transactions can be reversed';
  end if;

  select * into v_account from accounts where id = v_txn.account_id for update;

  if v_txn.type = 'deposit' then
    update accounts set balance = balance - v_txn.amount, dep = dep - v_txn.amount where id = v_account.id;
    v_running_balance := v_account.balance - v_txn.amount;

  elsif v_txn.type = 'withdrawal' then
    update accounts
    set balance = balance + v_txn.amount + v_txn.fee,
        wdr = wdr - v_txn.amount,
        comm = comm - v_txn.fee
    where id = v_account.id;
    v_running_balance := v_account.balance + v_txn.amount + v_txn.fee;

  elsif v_txn.type = 'fee' then
    -- Fee transactions only affect balance directly; dep/wdr/comm are unchanged
    update accounts set balance = balance + v_txn.amount where id = v_account.id;
    v_running_balance := v_account.balance + v_txn.amount;
  end if;

  update transactions
  set reversed_at = now(),
      reversed_by = p_deleted_by
  where id = p_transaction_id;

  -- Recompute downstream bal_after snapshots
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

  select * into v_client from clients where id = v_txn.client_id;
  select * into v_admin from profiles where id = p_deleted_by;

  return query select v_txn.id, v_client.id, v_client.full_name, v_client.phone, v_admin.full_name;
end;
$$;
