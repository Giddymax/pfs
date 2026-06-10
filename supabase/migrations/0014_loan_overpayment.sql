-- Extends record_loan_repayment to surface the overpayment amount so the
-- API layer can automatically credit the excess to the client's savings account.

drop function if exists record_loan_repayment(uuid, numeric, date, text, text, uuid);

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
  client_phone text,
  overpayment_amount numeric
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
  v_overpayment numeric(12, 2);
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

  v_overpayment   := greatest(0, p_amount - v_loan.current_balance);
  v_new_balance   := greatest(0, v_loan.current_balance - p_amount);
  v_new_status    := case when v_new_balance <= 0 then 'completed' else v_loan.status end;

  insert into loan_repayments (loan_id, amount, payment_date, method, notes, recorded_by)
  values (p_loan_id, p_amount, coalesce(p_payment_date, current_date), coalesce(p_method, 'cash'), p_notes, p_recorded_by)
  returning id into v_repayment_id;

  update loans
  set current_balance = v_new_balance,
      status          = v_new_status,
      updated_at      = now()
  where id = p_loan_id;

  select * into v_client from clients where id = v_loan.client_id;

  return query
    select v_repayment_id, v_new_balance, v_new_status,
           v_client.id, v_client.full_name, v_client.phone,
           v_overpayment;
end;
$$;
