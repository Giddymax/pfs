-- Prime Financial Service — fixed deposit lifecycle RPCs
-- Run after 0010_fixed_deposits.sql.
--
-- FD cash movements (opening, maturity payout, early-withdrawal payout,
-- rollover) do NOT post through the unified `transactions` ledger — a fixed
-- deposit is a lump-sum term placement, not a running account. The
-- reconciliation formula instead sources its FD figures directly from
-- `fixed_deposits.principal`/`status` and `fd_events.amount`. Every
-- state-machine transition is gated and logged here so the audit trail
-- (fd_events) and the dashboard can never drift from the FD's actual status.

-- ========================================
-- compute_fd_terms — pure helper: simple (non-compounding) interest over
-- the term, maturity date, and total expected payout
-- ========================================
create or replace function compute_fd_terms(
  p_principal numeric,
  p_annual_rate numeric,
  p_term_months int,
  p_start_date date default current_date
)
returns table (maturity_date date, expected_interest numeric, expected_payout numeric)
language plpgsql
as $$
declare
  v_interest numeric(12, 2);
begin
  v_interest := round(p_principal * (p_annual_rate / 100) * (p_term_months / 12.0), 2);
  return query select
    (p_start_date + (p_term_months || ' months')::interval)::date,
    v_interest,
    p_principal + v_interest;
end;
$$;

-- ========================================
-- open_fixed_deposit — staff/admin; creates the FD row with terms computed
-- via compute_fd_terms (single source of truth for the maturity math)
-- ========================================
create or replace function open_fixed_deposit(
  p_client_id uuid,
  p_principal numeric,
  p_annual_rate numeric,
  p_term_months int,
  p_created_by uuid,
  p_start_date date default current_date
)
returns fixed_deposits
language plpgsql
security definer
as $$
declare
  v_terms record;
  v_fd fixed_deposits%rowtype;
begin
  if not is_staff_or_admin() then
    raise exception 'Only staff or admin can open a fixed deposit';
  end if;

  if p_principal is null or p_principal <= 0 then
    raise exception 'Principal must be greater than zero';
  end if;
  if p_annual_rate is null or p_annual_rate < 0 then
    raise exception 'Annual rate cannot be negative';
  end if;
  if p_term_months not in (3, 6, 9, 12, 18, 24) then
    raise exception 'Term must be one of 3, 6, 9, 12, 18, 24 months';
  end if;

  select * into v_terms from compute_fd_terms(p_principal, p_annual_rate, p_term_months, p_start_date);

  insert into fixed_deposits (
    client_id, principal, annual_rate_percent, term_months,
    start_date, maturity_date, expected_interest, expected_payout, created_by
  )
  values (
    p_client_id, p_principal, p_annual_rate, p_term_months,
    p_start_date, v_terms.maturity_date, v_terms.expected_interest, v_terms.expected_payout, p_created_by
  )
  returning * into v_fd;

  return v_fd;
end;
$$;

-- ========================================
-- sync_matured_fds — flips active FDs past their maturity date to 'matured'
-- so payout/rollover logic can query status = 'matured' directly. Persisting
-- the transition (rather than deriving it at read time) keeps the indexed
-- status filter cheap and consistent across every FD listing/detail query.
-- ========================================
create or replace function sync_matured_fds()
returns void
language sql
security definer
as $$
  update fixed_deposits
  set status = 'matured'
  where status = 'active' and maturity_date <= current_date;
$$;

-- ========================================
-- request_early_withdrawal — staff/admin; active -> pending_early
-- ========================================
create or replace function request_early_withdrawal(
  p_fd_id uuid,
  p_requested_by uuid
)
returns fixed_deposits
language plpgsql
security definer
as $$
declare
  v_fd fixed_deposits%rowtype;
begin
  if not is_staff_or_admin() then
    raise exception 'Only staff or admin can request an early withdrawal';
  end if;

  select * into v_fd from fixed_deposits where id = p_fd_id for update;
  if not found then
    raise exception 'Fixed deposit not found';
  end if;
  if v_fd.status <> 'active' then
    raise exception 'Only an active fixed deposit can have an early withdrawal requested';
  end if;

  update fixed_deposits set status = 'pending_early' where id = p_fd_id returning * into v_fd;

  insert into fd_events (fd_id, event_type, amount, actor_id)
  values (p_fd_id, 'early_withdrawal_requested', v_fd.principal, p_requested_by);

  return v_fd;
end;
$$;

-- ========================================
-- approve_early_withdrawal / reject_early_withdrawal — admin-only review
-- ========================================
create or replace function approve_early_withdrawal(
  p_fd_id uuid,
  p_approved_by uuid
)
returns fixed_deposits
language plpgsql
security definer
as $$
declare
  v_fd fixed_deposits%rowtype;
begin
  if not is_admin() then
    raise exception 'Only an admin can approve an early withdrawal';
  end if;

  select * into v_fd from fixed_deposits where id = p_fd_id for update;
  if not found then
    raise exception 'Fixed deposit not found';
  end if;
  if v_fd.status <> 'pending_early' then
    raise exception 'Only a pending early-withdrawal request can be approved';
  end if;

  update fixed_deposits set status = 'approved_early' where id = p_fd_id returning * into v_fd;

  insert into fd_events (fd_id, event_type, amount, actor_id)
  values (p_fd_id, 'early_withdrawal_approved', v_fd.principal, p_approved_by);

  return v_fd;
end;
$$;

create or replace function reject_early_withdrawal(
  p_fd_id uuid,
  p_rejected_by uuid
)
returns fixed_deposits
language plpgsql
security definer
as $$
declare
  v_fd fixed_deposits%rowtype;
begin
  if not is_admin() then
    raise exception 'Only an admin can reject an early withdrawal';
  end if;

  select * into v_fd from fixed_deposits where id = p_fd_id for update;
  if not found then
    raise exception 'Fixed deposit not found';
  end if;
  if v_fd.status <> 'pending_early' then
    raise exception 'Only a pending early-withdrawal request can be rejected';
  end if;

  update fixed_deposits set status = 'active' where id = p_fd_id returning * into v_fd;

  insert into fd_events (fd_id, event_type, actor_id)
  values (p_fd_id, 'early_withdrawal_rejected', p_rejected_by);

  return v_fd;
end;
$$;

-- ========================================
-- process_early_withdrawal_payout — requires approved_early; payout =
-- PRINCIPAL ONLY (forfeits all accrued interest per spec); -> withdrawn
-- ========================================
create or replace function process_early_withdrawal_payout(
  p_fd_id uuid,
  p_paid_by uuid
)
returns table (
  fd_id uuid,
  client_id uuid,
  client_full_name text,
  client_phone text,
  amount numeric
)
language plpgsql
security definer
as $$
declare
  v_fd fixed_deposits%rowtype;
  v_client clients%rowtype;
begin
  if not is_staff_or_admin() then
    raise exception 'Only staff or admin can pay out an early withdrawal';
  end if;

  select * into v_fd from fixed_deposits where id = p_fd_id for update;
  if not found then
    raise exception 'Fixed deposit not found';
  end if;
  if v_fd.status <> 'approved_early' then
    raise exception 'Only an approved early withdrawal can be paid out';
  end if;

  select * into v_client from clients where id = v_fd.client_id;

  update fixed_deposits set status = 'withdrawn' where id = p_fd_id;

  return query select v_fd.id, v_client.id, v_client.full_name, v_client.phone, v_fd.principal;
end;
$$;

-- ========================================
-- process_maturity_payout — payout = expected_payout (principal + interest);
-- -> withdrawn; logs the interest portion for the dashboard's "FD Interest
-- Paid" reconciliation line
-- ========================================
create or replace function process_maturity_payout(
  p_fd_id uuid,
  p_paid_by uuid
)
returns table (
  fd_id uuid,
  client_id uuid,
  client_full_name text,
  client_phone text,
  amount numeric
)
language plpgsql
security definer
as $$
declare
  v_fd fixed_deposits%rowtype;
  v_client clients%rowtype;
begin
  if not is_staff_or_admin() then
    raise exception 'Only staff or admin can pay out a matured fixed deposit';
  end if;

  select * into v_fd from fixed_deposits where id = p_fd_id for update;
  if not found then
    raise exception 'Fixed deposit not found';
  end if;
  if v_fd.status = 'active' and v_fd.maturity_date <= current_date then
    update fixed_deposits set status = 'matured' where id = p_fd_id;
    v_fd.status := 'matured';
  end if;
  if v_fd.status <> 'matured' then
    raise exception 'Only a matured fixed deposit can be paid out';
  end if;

  select * into v_client from clients where id = v_fd.client_id;

  update fixed_deposits set status = 'withdrawn' where id = p_fd_id;

  insert into fd_events (fd_id, event_type, amount, actor_id)
  values (p_fd_id, 'matured_paid_out', v_fd.expected_interest, p_paid_by);

  return query select v_fd.id, v_client.id, v_client.full_name, v_client.phone, v_fd.expected_payout;
end;
$$;

-- ========================================
-- process_rollover — links a matured FD into a freshly opened one; if
-- capitalising, the new principal includes the accrued interest (no cash
-- moves); otherwise the interest is paid out in cash and logged separately
-- so the reconciliation can still account for it as FD interest paid
-- ========================================
create or replace function process_rollover(
  p_fd_id uuid,
  p_new_term_months int,
  p_new_rate numeric,
  p_capitalise_interest boolean,
  p_paid_by uuid
)
returns table (
  old_fd_id uuid,
  new_fd_id uuid,
  client_id uuid,
  client_full_name text,
  client_phone text,
  cash_interest_paid numeric
)
language plpgsql
security definer
as $$
declare
  v_fd fixed_deposits%rowtype;
  v_new_principal numeric(12, 2);
  v_terms record;
  v_new_fd fixed_deposits%rowtype;
  v_client clients%rowtype;
  v_cash_interest numeric(12, 2) := 0;
begin
  if not is_staff_or_admin() then
    raise exception 'Only staff or admin can process a rollover';
  end if;

  if p_new_term_months not in (3, 6, 9, 12, 18, 24) then
    raise exception 'Term must be one of 3, 6, 9, 12, 18, 24 months';
  end if;
  if p_new_rate is null or p_new_rate < 0 then
    raise exception 'Annual rate cannot be negative';
  end if;

  select * into v_fd from fixed_deposits where id = p_fd_id for update;
  if not found then
    raise exception 'Fixed deposit not found';
  end if;
  if v_fd.status = 'active' and v_fd.maturity_date <= current_date then
    update fixed_deposits set status = 'matured' where id = p_fd_id;
    v_fd.status := 'matured';
  end if;
  if v_fd.status <> 'matured' then
    raise exception 'Only a matured fixed deposit can be rolled over';
  end if;

  insert into fd_events (fd_id, event_type, amount, actor_id)
  values (p_fd_id, 'rollover_requested', v_fd.expected_interest, p_paid_by);

  if p_capitalise_interest then
    v_new_principal := v_fd.principal + v_fd.expected_interest;
  else
    v_new_principal := v_fd.principal;
    v_cash_interest := v_fd.expected_interest;
  end if;

  select * into v_terms from compute_fd_terms(v_new_principal, p_new_rate, p_new_term_months, current_date);

  insert into fixed_deposits (
    client_id, principal, annual_rate_percent, term_months,
    start_date, maturity_date, expected_interest, expected_payout,
    rolled_from_fd_id, created_by
  )
  values (
    v_fd.client_id, v_new_principal, p_new_rate, p_new_term_months,
    current_date, v_terms.maturity_date, v_terms.expected_interest, v_terms.expected_payout,
    p_fd_id, p_paid_by
  )
  returning * into v_new_fd;

  update fixed_deposits set status = 'rolled_over', rolled_into_fd_id = v_new_fd.id where id = p_fd_id;

  if not p_capitalise_interest and v_cash_interest > 0 then
    insert into fd_events (fd_id, event_type, amount, actor_id, notes)
    values (p_fd_id, 'matured_paid_out', v_cash_interest, p_paid_by, 'Interest paid in cash at rollover (principal renewed)');
  end if;

  insert into fd_events (fd_id, event_type, amount, actor_id)
  values (p_fd_id, 'rollover_completed', v_new_principal, p_paid_by);

  select * into v_client from clients where id = v_fd.client_id;

  return query select v_fd.id, v_new_fd.id, v_client.id, v_client.full_name, v_client.phone, v_cash_interest;
end;
$$;
