-- Remove the commission-tier schedule entirely. Commission on a savings
-- withdrawal is now entered manually by admin/staff at the moment they
-- record the withdrawal (susu stays exempt, enforced server-side regardless
-- of what the caller passes). Drops the untracked `commission_tiers` table
-- that 0032_record_with_datetime.sql was reading from (it was never created
-- by any migration in this history — likely set up ad hoc directly against
-- the live database) so nothing stale is left behind.
--
-- While rewriting this function: restores the `wdr`/`comm` running-total
-- updates on the accounts row, which 0032 silently dropped (it only updated
-- `balance`) — a pre-existing bug unrelated to the tier removal, fixed here
-- since this function is being replaced anyway.

drop table if exists commission_tiers;

drop function if exists record_withdrawal(uuid, numeric, uuid, text, timestamptz);

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

  -- Commission is manually entered by staff/admin for savings withdrawals;
  -- susu remains exempt no matter what the caller passes.
  if v_account.product_type = 'savings' then
    v_commission := coalesce(p_fee, 0);
    if v_commission < 0 then
      raise exception 'Commission cannot be negative';
    end if;
  else
    v_commission := 0;
  end if;

  if v_account.balance < (p_amount + v_commission) then
    raise exception 'Insufficient balance: % + % commission exceeds available balance %',
      p_amount, v_commission, v_account.balance;
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
