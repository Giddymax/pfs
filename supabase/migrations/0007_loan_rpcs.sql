-- Prime Financial Service — loan lifecycle RPCs
-- Run after 0006_loans_lifecycle.sql.
--
-- Mirrors the transaction-engine pattern in 0005: lifecycle transitions and
-- balance math are atomic `security definer` functions, row-locked with
-- `for update`, so the UI/audit trail/repair tooling can never drift.

-- ========================================
-- activate_loan — admin-only; pending -> active.
-- Sets the ACTUAL disbursement date (today), derives due_date from it, and
-- seeds current_balance from total_repayable — the loan only starts
-- counting down once money actually goes out the door.
-- ========================================
create or replace function activate_loan(
  p_loan_id uuid,
  p_activated_by uuid
)
returns loans
language plpgsql
security definer
as $$
declare
  v_loan loans%rowtype;
begin
  if not is_admin() then
    raise exception 'Only an admin can activate a loan';
  end if;

  select * into v_loan from loans where id = p_loan_id for update;
  if not found then
    raise exception 'Loan not found';
  end if;
  if v_loan.status <> 'pending' then
    raise exception 'Only a pending loan can be activated (current status: %)', v_loan.status;
  end if;

  update loans
  set status = 'active',
      disbursement_date = current_date,
      due_date = (current_date + (tenor_months || ' months')::interval)::date,
      current_balance = total_repayable,
      updated_at = now()
  where id = p_loan_id
  returning * into v_loan;

  return v_loan;
end;
$$;

-- ========================================
-- record_loan_repayment — staff/admin; inserts the repayment, decrements
-- current_balance, and auto-completes the loan once it reaches zero.
-- Returns enough client contact info for the dual client/company SMS.
-- ========================================
create or replace function record_loan_repayment(
  p_loan_id uuid,
  p_amount numeric,
  p_payment_date date,
  p_method text,
  p_notes text,
  p_recorded_by uuid
)
returns table (
  repayment_id uuid,
  remaining_balance numeric,
  loan_status text,
  client_id uuid,
  client_full_name text,
  client_phone text
)
language plpgsql
security definer
as $$
declare
  v_loan loans%rowtype;
  v_client clients%rowtype;
  v_repayment_id uuid;
  v_new_balance numeric(12, 2);
  v_new_status text;
begin
  if not is_staff_or_admin() then
    raise exception 'Only staff or admin can record a repayment';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  select * into v_loan from loans where id = p_loan_id for update;
  if not found then
    raise exception 'Loan not found';
  end if;
  if v_loan.status <> 'active' then
    raise exception 'Repayments can only be recorded against an active loan (current status: %)', v_loan.status;
  end if;

  v_new_balance := greatest(0, v_loan.current_balance - p_amount);
  v_new_status := case when v_new_balance <= 0 then 'completed' else v_loan.status end;

  insert into loan_repayments (loan_id, amount, payment_date, method, notes, recorded_by)
  values (p_loan_id, p_amount, coalesce(p_payment_date, current_date), coalesce(p_method, 'cash'), p_notes, p_recorded_by)
  returning id into v_repayment_id;

  update loans
  set current_balance = v_new_balance,
      status = v_new_status,
      updated_at = now()
  where id = p_loan_id;

  select * into v_client from clients where id = v_loan.client_id;

  return query select v_repayment_id, v_new_balance, v_new_status, v_client.id, v_client.full_name, v_client.phone;
end;
$$;

-- ========================================
-- loan_outstanding_principal — reporting helper implementing the spec's
-- out_principal = principal / (principal + principal*rate/100) * current_balance
-- (i.e. the principal's share of whatever is still outstanding, at the
-- same principal:interest ratio as the original schedule).
-- ========================================
create or replace function loan_outstanding_principal(p_loan_id uuid)
returns numeric
language plpgsql
security definer
as $$
declare
  v_loan loans%rowtype;
begin
  select * into v_loan from loans where id = p_loan_id;
  if not found then
    raise exception 'Loan not found';
  end if;

  if v_loan.current_balance is null or v_loan.principal + v_loan.principal * v_loan.flat_rate_percent / 100 = 0 then
    return 0;
  end if;

  return round(
    v_loan.principal / (v_loan.principal + v_loan.principal * v_loan.flat_rate_percent / 100) * v_loan.current_balance,
    2
  );
end;
$$;
