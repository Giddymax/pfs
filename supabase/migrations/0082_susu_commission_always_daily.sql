-- Susu is no longer commission-exempt. Every susu withdrawal — a simple
-- partial withdrawal, a normal claim payout, an emergency claim payout —
-- goes through record_withdrawal() as its single choke point, so this one
-- change makes the rule universal without touching any of those callers:
--
--   susu commission = always exactly one day's contribution
--   (accounts.daily_contribution_amount), regardless of what the caller
--   passes as p_fee, and regardless of how much is being withdrawn.
--
-- This is a SEPARATE charge from the day-31 cycle-completion fee (which
-- applies automatically via sweep_susu_cycle_fee() the moment a cycle
-- completes, whether or not the client ever withdraws — see
-- 0078_susu_fee_as_commission.sql). A client who completes a cycle and then
-- claims it now pays both: one day's contribution swept at cycle
-- completion, and another day's contribution charged as commission at
-- withdrawal time. An emergency (mid-cycle) claim already deducts a day's
-- contribution as its own penalty before ever calling record_withdrawal
-- (see request_emergency_claim, 0009_susu_rpcs.sql) — layering this
-- commission on top of that keeps every susu exit path costing exactly the
-- same two days' contribution in total, whichever door it went out of.
--
-- Same signature as 0058_admin_only_withdrawals.sql, so this replaces the
-- real function rather than adding an overload.

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
    -- Commission is manually entered by staff/admin for savings withdrawals.
    v_commission := coalesce(p_fee, 0);
    if v_commission < 0 then
      raise exception 'Commission cannot be negative';
    end if;
  else
    -- Susu: always exactly one day's contribution, never admin-entered,
    -- never zero (as long as a daily contribution amount is set).
    v_commission := coalesce(v_account.daily_contribution_amount, 0);
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
