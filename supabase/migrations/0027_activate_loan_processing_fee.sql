-- Extend activate_loan to automatically deduct the processing fee from the
-- client's first active savings or susu account when processing_fee > 0.
-- The deduction is atomic with the activation: either both succeed or neither does.
-- If no account with sufficient balance exists, activation fails with a clear error.

create or replace function activate_loan(
  p_loan_id    uuid,
  p_activated_by uuid
)
returns loans
language plpgsql
security definer
set search_path = public
as $$
declare
  v_loan    loans%rowtype;
  v_account accounts%rowtype;
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
  set status           = 'active',
      disbursement_date = current_date,
      due_date         = (current_date + (tenor_months || ' months')::interval)::date,
      current_balance  = total_repayable,
      updated_at       = now()
  where id = p_loan_id
  returning * into v_loan;

  -- Deduct processing fee if one is set
  if v_loan.processing_fee > 0 then
    select * into v_account
    from accounts
    where client_id   = v_loan.client_id
      and status      = 'active'
      and product_type in ('savings', 'susu')
      and balance     >= v_loan.processing_fee
    order by created_at
    limit 1
    for update;

    if not found then
      raise exception
        'Cannot deduct processing fee of GHS %.2f: client has no active savings or susu account with sufficient balance',
        v_loan.processing_fee;
    end if;

    insert into transactions (account_id, client_id, type, amount, fee, bal_after, notes, recorded_by)
    values (
      v_account.id,
      v_loan.client_id,
      'fee',
      v_loan.processing_fee,
      0,
      v_account.balance - v_loan.processing_fee,
      'Loan processing fee – ' || v_loan.loan_code,
      p_activated_by
    );

    update accounts
    set balance = balance - v_loan.processing_fee
    where id = v_account.id;
  end if;

  return v_loan;
end;
$$;
