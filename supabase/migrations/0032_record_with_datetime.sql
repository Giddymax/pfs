-- Allow an optional transaction timestamp to be supplied at record time.
-- When p_created_at is provided (non-null) it is used as the row's created_at
-- instead of the database default (now()). This lets staff record a transaction
-- that happened at a specific time earlier in the day.
--
-- Both record_deposit and record_withdrawal are updated.

-- ============================================================
-- record_deposit
-- ============================================================
create or replace function record_deposit(
  p_account_id  uuid,
  p_amount      numeric,
  p_recorded_by uuid,
  p_notes       text        default null,
  p_created_at  timestamptz default null
)
returns transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account     accounts%rowtype;
  v_new_balance numeric(12, 2);
  v_txn         transactions%rowtype;
  v_ts          timestamptz;
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
  v_ts          := coalesce(p_created_at, now());

  update accounts
  set balance = v_new_balance,
      dep     = dep + p_amount
  where id = p_account_id;

  insert into transactions (account_id, client_id, type, amount, fee, bal_after, notes, recorded_by, created_at)
  values (p_account_id, v_account.client_id, 'deposit', p_amount, 0, v_new_balance, p_notes, p_recorded_by, v_ts)
  returning * into v_txn;

  return v_txn;
end;
$$;

-- ============================================================
-- record_withdrawal
-- ============================================================
create or replace function record_withdrawal(
  p_account_id  uuid,
  p_amount      numeric,
  p_recorded_by uuid,
  p_notes       text        default null,
  p_created_at  timestamptz default null
)
returns transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account     accounts%rowtype;
  v_commission  numeric(12, 2) := 0;
  v_tier        record;
  v_new_balance numeric(12, 2);
  v_txn         transactions%rowtype;
  v_ts          timestamptz;
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

  -- Commission tier lookup (savings only; susu is exempt)
  if v_account.product_type = 'savings' then
    select fee into v_commission
    from   commission_tiers
    where  min <= p_amount
    order  by min desc
    limit  1;
    v_commission := coalesce(v_commission, 0);
  end if;

  v_new_balance := v_account.balance - p_amount - v_commission;
  v_ts          := coalesce(p_created_at, now());

  update accounts
  set balance = v_new_balance
  where id = p_account_id;

  insert into transactions (account_id, client_id, type, amount, fee, bal_after, notes, recorded_by, created_at)
  values (p_account_id, v_account.client_id, 'withdrawal', p_amount, v_commission, v_new_balance, p_notes, p_recorded_by, v_ts)
  returning * into v_txn;

  return v_txn;
end;
$$;
