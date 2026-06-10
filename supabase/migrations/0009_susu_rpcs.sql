-- Prime Financial Service — daily susu cycle/claim RPCs
-- Run after 0008_susu_cycles_claims.sql.
--
-- Susu cash movements always post through the Phase B ledger RPCs
-- (`record_deposit`/`record_withdrawal`) so `accounts.bal/dep/wdr/comm` and
-- the unified `transactions` table stay the single source of truth for the
-- dashboard reconciliation — these functions only layer cycle/claim
-- bookkeeping on top of that ledger write, inside the same transaction.

-- ========================================
-- record_susu_payment — finds/opens the active cycle, posts the deposit
-- through the ledger, logs the day, and rolls the cycle on day 31
-- ========================================
create or replace function record_susu_payment(
  p_account_id uuid,
  p_amount numeric,
  p_payment_date date default current_date,
  p_recorded_by uuid default null
)
returns susu_payments
language plpgsql
security definer
as $$
declare
  v_account accounts%rowtype;
  v_cycle susu_cycles%rowtype;
  v_txn transactions%rowtype;
  v_day int;
  v_payment susu_payments%rowtype;
begin
  if not is_staff_or_admin() then
    raise exception 'Only staff or admin can record susu payments';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  select * into v_account from accounts where id = p_account_id for update;
  if not found then
    raise exception 'Account not found';
  end if;
  if v_account.product_type <> 'susu' then
    raise exception 'Account is not a susu account';
  end if;

  select * into v_cycle from susu_cycles where account_id = p_account_id and status = 'in_progress'
    order by cycle_number desc limit 1 for update;
  if not found then
    insert into susu_cycles (account_id, cycle_number, started_on)
    values (p_account_id, 1, p_payment_date)
    returning * into v_cycle;
  end if;

  select coalesce(max(day_in_cycle), 0) + 1 into v_day from susu_payments where cycle_id = v_cycle.id;
  if v_day > 31 then
    raise exception 'Cycle % already has 31 contributions recorded', v_cycle.cycle_number;
  end if;

  -- post the cash movement through the shared ledger RPC — single writer for
  -- accounts.bal/dep and transactions, so the reconciliation formula balances
  select * into v_txn from record_deposit(p_account_id, p_amount, p_recorded_by, 'Susu day ' || v_day || ' contribution');

  insert into susu_payments (cycle_id, account_id, transaction_id, amount, day_in_cycle, payment_date, recorded_by)
  values (v_cycle.id, p_account_id, v_txn.id, p_amount, v_day, p_payment_date, p_recorded_by)
  returning * into v_payment;

  update susu_cycles
  set total_collected = total_collected + p_amount,
      completed_on = case when v_day = 31 then p_payment_date else completed_on end,
      status = case when v_day = 31 then 'complete' else status end,
      company_fee = case when v_day = 31 then p_amount else company_fee end
  where id = v_cycle.id;

  if v_day = 31 then
    insert into susu_cycles (account_id, cycle_number, started_on)
    values (p_account_id, v_cycle.cycle_number + 1, p_payment_date + 1);
  end if;

  return v_payment;
end;
$$;

-- ========================================
-- record_susu_batch — up to 93 day-entries (≤ 3 cycles) recorded
-- transactionally in one call, e.g. to catch up a lapsed collector book
-- ========================================
create or replace function record_susu_batch(
  p_account_id uuid,
  p_entries jsonb,
  p_recorded_by uuid default null
)
returns setof susu_payments
language plpgsql
security definer
as $$
declare
  v_entry jsonb;
  v_count int;
begin
  if not is_staff_or_admin() then
    raise exception 'Only staff or admin can record susu payments';
  end if;

  select jsonb_array_length(p_entries) into v_count;
  if v_count is null or v_count = 0 then
    raise exception 'At least one entry is required';
  end if;
  if v_count > 93 then
    raise exception 'A batch cannot contain more than 93 day-entries (3 cycles)';
  end if;

  for v_entry in select * from jsonb_array_elements(p_entries)
  loop
    return query select * from record_susu_payment(
      p_account_id,
      (v_entry->>'amount')::numeric,
      coalesce((v_entry->>'payment_date')::date, current_date),
      p_recorded_by
    );
  end loop;
end;
$$;

-- ========================================
-- request_normal_claim — claimable once the cycle is complete; auto-approved
-- per spec (no admin review step). Payout = lifetime collected for the
-- cycle minus the day-31 company fee.
-- ========================================
create or replace function request_normal_claim(
  p_account_id uuid,
  p_cycle_id uuid,
  p_requested_by uuid
)
returns susu_claims
language plpgsql
security definer
as $$
declare
  v_cycle susu_cycles%rowtype;
  v_claim susu_claims%rowtype;
begin
  if not is_staff_or_admin() then
    raise exception 'Only staff or admin can request a susu claim';
  end if;

  select * into v_cycle from susu_cycles where id = p_cycle_id and account_id = p_account_id for update;
  if not found then
    raise exception 'Cycle not found for this account';
  end if;
  if v_cycle.status <> 'complete' then
    raise exception 'A normal claim requires a completed cycle';
  end if;

  insert into susu_claims (account_id, cycle_id, claim_type, status, amount, penalty_amount, requested_by, approved_by, decided_at)
  values (
    p_account_id,
    p_cycle_id,
    'normal',
    'approved',
    greatest(v_cycle.total_collected - coalesce(v_cycle.company_fee, 0), 0),
    0,
    p_requested_by,
    p_requested_by,
    now()
  )
  returning * into v_claim;

  return v_claim;
end;
$$;

-- ========================================
-- request_emergency_claim — claimable mid-cycle; goes to admin review.
-- Penalty = the account's daily_contribution_amount (the resolved rule for
-- the in-progress-cycle case, since no day-31 fee exists yet to deduct).
-- ========================================
create or replace function request_emergency_claim(
  p_account_id uuid,
  p_cycle_id uuid,
  p_requested_by uuid
)
returns susu_claims
language plpgsql
security definer
as $$
declare
  v_account accounts%rowtype;
  v_cycle susu_cycles%rowtype;
  v_penalty numeric(12, 2);
  v_claim susu_claims%rowtype;
begin
  if not is_staff_or_admin() then
    raise exception 'Only staff or admin can request a susu claim';
  end if;

  select * into v_account from accounts where id = p_account_id;
  if not found then
    raise exception 'Account not found';
  end if;

  select * into v_cycle from susu_cycles where id = p_cycle_id and account_id = p_account_id for update;
  if not found then
    raise exception 'Cycle not found for this account';
  end if;
  if v_cycle.status <> 'in_progress' then
    raise exception 'An emergency claim requires a cycle that is still in progress';
  end if;

  v_penalty := coalesce(v_account.daily_contribution_amount, 0);

  insert into susu_claims (account_id, cycle_id, claim_type, status, amount, penalty_amount, requested_by)
  values (
    p_account_id,
    p_cycle_id,
    'emergency',
    'pending_admin',
    greatest(v_cycle.total_collected - v_penalty, 0),
    v_penalty,
    p_requested_by
  )
  returning * into v_claim;

  return v_claim;
end;
$$;

-- ========================================
-- approve_emergency_claim / reject_emergency_claim — admin-only review step
-- ========================================
create or replace function approve_emergency_claim(
  p_claim_id uuid,
  p_approved_by uuid
)
returns susu_claims
language plpgsql
security definer
as $$
declare
  v_claim susu_claims%rowtype;
begin
  if not is_admin() then
    raise exception 'Only an admin can approve an emergency claim';
  end if;

  select * into v_claim from susu_claims where id = p_claim_id for update;
  if not found then
    raise exception 'Claim not found';
  end if;
  if v_claim.claim_type <> 'emergency' or v_claim.status <> 'pending_admin' then
    raise exception 'Only a pending emergency claim can be approved';
  end if;

  update susu_claims
  set status = 'approved', approved_by = p_approved_by, decided_at = now()
  where id = p_claim_id
  returning * into v_claim;

  return v_claim;
end;
$$;

create or replace function reject_emergency_claim(
  p_claim_id uuid,
  p_rejected_by uuid
)
returns susu_claims
language plpgsql
security definer
as $$
declare
  v_claim susu_claims%rowtype;
begin
  if not is_admin() then
    raise exception 'Only an admin can reject an emergency claim';
  end if;

  select * into v_claim from susu_claims where id = p_claim_id for update;
  if not found then
    raise exception 'Claim not found';
  end if;
  if v_claim.claim_type <> 'emergency' or v_claim.status <> 'pending_admin' then
    raise exception 'Only a pending emergency claim can be rejected';
  end if;

  update susu_claims
  set status = 'rejected', approved_by = p_rejected_by, decided_at = now()
  where id = p_claim_id
  returning * into v_claim;

  return v_claim;
end;
$$;

-- ========================================
-- pay_susu_claim — staff/admin; pays out an approved claim as a
-- commission-exempt withdrawal (susu is exempt by product_type), closes
-- the cycle, returns client contact details for the payout SMS
-- ========================================
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
  if not is_staff_or_admin() then
    raise exception 'Only staff or admin can pay a susu claim';
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

-- ========================================
-- record_susu_partial_withdrawal — claim-independent withdrawal against the
-- account's available balance; routed through the shared (commission-exempt
-- for susu) withdrawal RPC
-- ========================================
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
  if not is_staff_or_admin() then
    raise exception 'Only staff or admin can record a susu withdrawal';
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

-- ========================================
-- reset_susu_account — admin-only "clear/reset" (Roles & Permissions list);
-- closes the current cycle without payout and opens a fresh one, e.g. when
-- a client wants to abandon and restart a cycle
-- ========================================
create or replace function reset_susu_account(
  p_account_id uuid,
  p_reset_by uuid
)
returns susu_cycles
language plpgsql
security definer
as $$
declare
  v_account accounts%rowtype;
  v_cycle susu_cycles%rowtype;
  v_next_number int;
  v_new_cycle susu_cycles%rowtype;
begin
  if not is_admin() then
    raise exception 'Only an admin can reset a susu account';
  end if;

  select * into v_account from accounts where id = p_account_id for update;
  if not found then
    raise exception 'Account not found';
  end if;
  if v_account.product_type <> 'susu' then
    raise exception 'Account is not a susu account';
  end if;

  select * into v_cycle from susu_cycles where account_id = p_account_id and status = 'in_progress'
    order by cycle_number desc limit 1 for update;
  if found then
    update susu_cycles set status = 'closed', completed_on = current_date where id = v_cycle.id;
  end if;

  select coalesce(max(cycle_number), 0) + 1 into v_next_number from susu_cycles where account_id = p_account_id;

  insert into susu_cycles (account_id, cycle_number, started_on)
  values (p_account_id, v_next_number, current_date)
  returning * into v_new_cycle;

  return v_new_cycle;
end;
$$;
