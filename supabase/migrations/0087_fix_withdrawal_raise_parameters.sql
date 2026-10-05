-- Recreate record_withdrawal with an explicit formatted message for the
-- insufficient-balance error. This avoids RAISE format-argument mismatches.

create or replace function record_withdrawal(
  p_account_id  uuid,
  p_amount      numeric,
  p_recorded_by uuid,
  p_notes       text        default null,
  p_created_at  timestamptz default null,
  p_fee         numeric     default 0
)
returns transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account     accounts%rowtype;
  v_commission  numeric(12, 2);
  v_new_balance numeric(12, 2);
  v_txn         transactions%rowtype;
  v_ts          timestamptz;
begin
  if not is_admin() then
    raise exception 'Only an admin can record a withdrawal';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  select * into v_account from accounts where id = p_account_id for update;
  if not found then
    raise exception 'Account not found';
  end if;

  if v_account.product_type = 'savings' then
    -- Savings commission is entered by staff or admin.
    v_commission := coalesce(p_fee, 0);
    if v_commission < 0 then
      raise exception 'Commission cannot be negative';
    end if;
  else
    -- Susu commission is always one daily contribution.
    v_commission := coalesce(v_account.daily_contribution_amount, 0);
  end if;

  if v_account.balance < (p_amount + v_commission) then
    raise exception using message = format(
      'Insufficient balance: %s + %s commission exceeds available balance %s',
      p_amount, v_commission, v_account.balance
    );
  end if;

  v_new_balance := v_account.balance - p_amount - v_commission;
  v_ts          := coalesce(p_created_at, now());

  update accounts
  set balance = v_new_balance,
      wdr = wdr + p_amount,
      comm = comm + v_commission
  where id = p_account_id;

  insert into transactions (account_id, client_id, type, amount, fee, bal_after, notes, recorded_by, created_at)
  values (p_account_id, v_account.client_id, 'withdrawal', p_amount, v_commission, v_new_balance, p_notes, p_recorded_by, v_ts)
  returning * into v_txn;

  return v_txn;
end;
$$;
