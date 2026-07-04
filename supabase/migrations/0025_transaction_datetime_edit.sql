-- Admin-only edit of a transaction's created_at timestamp.
-- The amount-edit trail (original_amount, edited_by, edited_at) is kept intact.
-- Separate columns track who/when a datetime edit was made.

alter table transactions
  add column if not exists time_edited_by uuid references profiles (id),
  add column if not exists time_edited_at timestamptz;

-- edit_transaction_datetime
-- Changes only created_at (and the time_edited_* audit columns).
-- Because created_at drives the chronological ordering used by bal_after
-- snapshots, ALL non-reversed snapshots on this account are recomputed
-- from scratch after the update.
create or replace function edit_transaction_datetime(
  p_transaction_id uuid,
  p_new_created_at  timestamptz,
  p_edited_by       uuid
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

  if p_new_created_at is null then
    raise exception 'New datetime cannot be null';
  end if;

  select * into v_txn from transactions where id = p_transaction_id for update;
  if not found then
    raise exception 'Transaction not found';
  end if;
  if v_txn.reversed_at is not null then
    raise exception 'Cannot edit the datetime of a reversed transaction';
  end if;

  update transactions
  set created_at     = p_new_created_at,
      time_edited_by = p_edited_by,
      time_edited_at = now()
  where id = p_transaction_id
  returning * into v_txn;

  -- Lock the account row before walking through its transactions
  perform 1 from accounts where id = v_txn.account_id for update;

  -- Rebuild all bal_after snapshots on this account in new chronological order
  for v_row in
    select id, type, amount, fee
    from   transactions
    where  account_id  = v_txn.account_id
      and  reversed_at is null
    order  by created_at, id
  loop
    if    v_row.type = 'deposit'    then
      v_running_balance := v_running_balance + v_row.amount;
    elsif v_row.type = 'withdrawal' then
      v_running_balance := v_running_balance - v_row.amount - v_row.fee;
    end if;
    update transactions set bal_after = v_running_balance where id = v_row.id;
  end loop;

  return v_txn;
end;
$$;
