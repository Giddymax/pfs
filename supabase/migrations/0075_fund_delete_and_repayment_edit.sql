-- 1. Deleting a withdrawal or expenditure linked to the PFS Consolidated
--    Fund was failing on a foreign key violation: expenditures.
--    linked_transaction_id (0074) referenced transactions(id) with the
--    default ON DELETE NO ACTION, so deleting either side while the other
--    still pointed at it was rejected outright. Dropped, per instruction —
--    delete_expenditure() below also now removes the expenditures row
--    BEFORE the transaction row (was the other order), so the dangling-
--    reference window that made the FK matter doesn't exist in the first
--    place, FK or not.
--
-- 2. Admins can now edit or delete a loan repayment. Both recompute
--    loans.current_balance/status from scratch (total_repayable minus
--    every remaining repayment, clamped at zero) rather than trying to
--    undo the single old amount in place — the same "rebuild from the
--    ledger" approach recalculate_account() already uses for accounts,
--    now applied to loans. Does NOT reverse any overpayment credit an
--    edited/deleted repayment may have originally triggered (record-
--    repayment's own overpayment-to-savings deposit) — a real but rare
--    edge case, flagged rather than silently handled.

alter table expenditures drop constraint if exists expenditures_linked_transaction_id_fkey;

create or replace function delete_expenditure(p_expenditure_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expenditure expenditures%rowtype;
  v_txn         transactions%rowtype;
begin
  if not is_admin() then
    raise exception 'Only an admin can delete an expenditure';
  end if;

  select * into v_expenditure from expenditures where id = p_expenditure_id;
  if not found then
    raise exception 'Expenditure not found';
  end if;

  if v_expenditure.linked_transaction_id is not null then
    select * into v_txn from transactions where id = v_expenditure.linked_transaction_id for update;
  end if;

  -- Remove the expenditure row first — nothing references it, so this can
  -- never fail. Only then touch the transaction/account side.
  delete from expenditures where id = p_expenditure_id;

  if v_txn.id is not null then
    update accounts
    set balance = balance + v_txn.amount,
        wdr     = wdr - v_txn.amount
    where id = v_txn.account_id;

    delete from transactions where id = v_txn.id;
  end if;
end;
$$;

-- ========================================
-- edit_loan_repayment / delete_loan_repayment
-- ========================================
create or replace function edit_loan_repayment(
  p_repayment_id uuid,
  p_amount       numeric,
  p_payment_date date,
  p_method       text,
  p_notes        text
)
returns loan_repayments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_repayment   loan_repayments%rowtype;
  v_loan        loans%rowtype;
  v_sum         numeric(12, 2);
  v_new_balance numeric(12, 2);
  v_new_status  text;
begin
  if not is_admin() then
    raise exception 'Only an admin can edit a loan repayment';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  select * into v_repayment from loan_repayments where id = p_repayment_id for update;
  if not found then
    raise exception 'Repayment not found';
  end if;

  select * into v_loan from loans where id = v_repayment.loan_id for update;
  if not found then
    raise exception 'Loan not found';
  end if;

  update loan_repayments
  set amount       = p_amount,
      payment_date = coalesce(p_payment_date, payment_date),
      method       = coalesce(p_method, method),
      notes        = p_notes
  where id = p_repayment_id
  returning * into v_repayment;

  select coalesce(sum(amount), 0) into v_sum from loan_repayments where loan_id = v_loan.id;
  v_new_balance := greatest(0, v_loan.total_repayable - v_sum);
  v_new_status  := case
    when v_new_balance <= 0 then 'completed'
    when v_loan.status = 'completed' then 'active' -- no longer fully paid
    else v_loan.status
  end;

  update loans
  set current_balance = v_new_balance,
      status           = v_new_status,
      updated_at        = now()
  where id = v_loan.id;

  return v_repayment;
end;
$$;

create or replace function delete_loan_repayment(p_repayment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_repayment   loan_repayments%rowtype;
  v_loan        loans%rowtype;
  v_sum         numeric(12, 2);
  v_new_balance numeric(12, 2);
  v_new_status  text;
begin
  if not is_admin() then
    raise exception 'Only an admin can delete a loan repayment';
  end if;

  select * into v_repayment from loan_repayments where id = p_repayment_id for update;
  if not found then
    raise exception 'Repayment not found';
  end if;

  select * into v_loan from loans where id = v_repayment.loan_id for update;
  if not found then
    raise exception 'Loan not found';
  end if;

  delete from loan_repayments where id = p_repayment_id;

  select coalesce(sum(amount), 0) into v_sum from loan_repayments where loan_id = v_loan.id;
  v_new_balance := greatest(0, v_loan.total_repayable - v_sum);
  v_new_status  := case
    when v_new_balance <= 0 then 'completed'
    when v_loan.status = 'completed' then 'active'
    else v_loan.status
  end;

  update loans
  set current_balance = v_new_balance,
      status           = v_new_status,
      updated_at        = now()
  where id = v_loan.id;
end;
$$;
