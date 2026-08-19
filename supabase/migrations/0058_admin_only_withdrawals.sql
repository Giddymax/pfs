-- Restrict every money-out (withdrawal) action to admins only; staff keep
-- deposit/contribution and claim-request access, but can no longer make
-- money actually leave an account.
--
-- Scope — the three RPCs that move money out of an account:
--   - record_withdrawal            (savings withdrawals + susu partial
--                                    withdrawals route through this)
--   - record_susu_partial_withdrawal
--   - pay_susu_claim                (the actual payout step for a susu
--                                    claim — normal or emergency)
--
-- Deliberately left as staff-or-admin (unchanged):
--   - request_normal_claim / request_emergency_claim — these only create a
--     susu_claims row (an intent/request), no money moves until
--     pay_susu_claim runs, which is now admin-only above. Letting staff log
--     a client's request while only an admin can release the cash is a
--     standard segregation-of-duties control, not a loophole — a normal
--     claim is inserted pre-approved (see request_normal_claim), but that
--     approval never lets it skip pay_susu_claim's admin gate.
--   - approve_emergency_claim / reject_emergency_claim — already admin-only.
--   - record_susu_payment / record_susu_batch — deposits, not withdrawals.
--
-- Note: app/api/susu/emergency-withdrawal/route.ts performs its own
-- transaction insert directly via the service-role client rather than
-- through record_withdrawal, so it isn't covered by this migration at all —
-- that route needs its own explicit admin check in application code
-- (added alongside this migration).

-- Signature (param order/types/defaults) must match 0044_manual_withdrawal_commission.sql
-- exactly, or this becomes a second overload instead of replacing the real
-- one — Postgres identifies a function by name + argument *types*, not by
-- parameter names or defaults.
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

  -- Commission is manually entered by admin for savings withdrawals; susu
  -- remains exempt no matter what the caller passes.
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

create or replace function record_susu_partial_withdrawal(
  p_account_id uuid,
  p_amount numeric,
  p_recorded_by uuid
)
returns transactions
language plpgsql
security definer
as $$
declare
  v_account accounts%rowtype;
  v_txn transactions%rowtype;
begin
  if not is_admin() then
    raise exception 'Only an admin can record a susu withdrawal';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  select * into v_account from accounts where id = p_account_id;
  if not found then
    raise exception 'Account not found';
  end if;
  if v_account.product_type <> 'susu' then
    raise exception 'Account is not a susu account';
  end if;
  if v_account.balance < p_amount then
    raise exception 'Insufficient balance: % exceeds available balance %', p_amount, v_account.balance;
  end if;

  select * into v_txn from record_withdrawal(p_account_id, p_amount, p_recorded_by, 'Partial susu withdrawal');
  return v_txn;
end;
$$;

create or replace function pay_susu_claim(
  p_claim_id uuid,
  p_paid_by uuid
)
returns table (
  claim_id uuid,
  account_id uuid,
  client_id uuid,
  client_full_name text,
  client_phone text,
  amount numeric
)
language plpgsql
security definer
as $$
declare
  v_claim susu_claims%rowtype;
  v_account accounts%rowtype;
  v_client clients%rowtype;
  v_txn transactions%rowtype;
begin
  if not is_admin() then
    raise exception 'Only an admin can pay a susu claim';
  end if;

  select * into v_claim from susu_claims where id = p_claim_id for update;
  if not found then
    raise exception 'Claim not found';
  end if;
  if v_claim.status <> 'approved' then
    raise exception 'Only an approved claim can be paid';
  end if;

  select * into v_account from accounts where id = v_claim.account_id for update;
  select * into v_client from clients where id = v_account.client_id;

  if v_claim.amount > 0 then
    select * into v_txn from record_withdrawal(
      v_claim.account_id,
      v_claim.amount,
      p_paid_by,
      case v_claim.claim_type when 'emergency' then 'Emergency susu claim payout' else 'Susu claim payout' end
    );
  end if;

  update susu_claims
  set status = 'paid', paid_by = p_paid_by, paid_at = now(), transaction_id = v_txn.id
  where id = p_claim_id;

  if v_claim.cycle_id is not null then
    update susu_cycles set status = 'closed' where id = v_claim.cycle_id;
  end if;

  return query select v_claim.id, v_account.id, v_client.id, v_client.full_name, v_client.phone, v_claim.amount;
end;
$$;
