-- Withdrawals from the PFS Consolidated Fund (i.e. expenditures — see
-- 0074_consolidated_fund_finance_link.sql) now go through the exact same
-- record_withdrawal() RPC any other savings withdrawal uses, instead of
-- record_expenditure() inlining its own balance mutation. That means a
-- commission fee can now be entered on an expenditure too, same as any
-- other savings withdrawal — "follow all withdrawal conventions" per
-- request. Nothing about the mirror-into-expenditure trigger
-- (sync_fund_withdrawal_to_expenditure, 0074) needed to change: it fires
-- on the transactions row regardless of which function inserted it, and
-- the '[expenditure:...]' notes tag record_expenditure() stamps still
-- stops it from double-booking its own withdrawal.
--
-- Also fixes a real bug in delete_expenditure(): it only reversed the
-- withdrawal's principal (amount), never its commission (fee) — harmless
-- before, since record_expenditure() could never charge a commission, but
-- now that it can, deleting a commissioned expenditure would have left
-- the fund's balance permanently short by the fee and comm overstated.

-- CREATE OR REPLACE can't add a parameter without leaving the old
-- signature as a stale, still-callable overload — same reasoning as
-- activate_loan() (0073) and record_deposit() (0069).
drop function if exists record_expenditure(text, numeric, text, date, text, uuid);

create or replace function record_expenditure(
  p_title       text,
  p_amount      numeric,
  p_category    text,
  p_date        date,
  p_notes       text,
  p_commission  numeric,
  p_recorded_by uuid
)
returns expenditures
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fund_id     uuid;
  v_txn         transactions%rowtype;
  v_expenditure expenditures%rowtype;
  v_txn_notes   text;
begin
  if not is_admin() then
    raise exception 'Only an admin can record an expenditure';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;
  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'Title is required';
  end if;

  v_fund_id := consolidated_fund_account_id();
  if v_fund_id is null then
    raise exception 'No PFS Consolidated Fund account is set up (accounts.is_consolidated_fund)';
  end if;

  v_txn_notes := '[expenditure:' || trim(p_title) || '] ' || coalesce(p_notes, '');

  -- record_withdrawal() does its own balance/insufficient-funds check
  -- (against amount + commission together), same as any other savings
  -- withdrawal — no need to duplicate that here anymore.
  v_txn := record_withdrawal(
    v_fund_id,
    p_amount,
    p_recorded_by,
    v_txn_notes,
    coalesce(p_date, current_date)::timestamptz,
    coalesce(p_commission, 0)
  );

  insert into expenditures (title, amount, category, date, notes, recorded_by, linked_transaction_id)
  values (
    trim(p_title),
    p_amount,
    coalesce(nullif(trim(p_category), ''), 'general'),
    coalesce(p_date, current_date),
    p_notes,
    p_recorded_by,
    v_txn.id
  )
  returning * into v_expenditure;

  return v_expenditure;
end;
$$;

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

  delete from expenditures where id = p_expenditure_id;

  if v_txn.id is not null then
    -- Reverses BOTH halves of what record_withdrawal() deducted — the
    -- principal (wdr) and the commission (comm) — not just the principal.
    update accounts
    set balance = balance + v_txn.amount + v_txn.fee,
        wdr     = wdr - v_txn.amount,
        comm    = comm - v_txn.fee
    where id = v_txn.account_id;

    delete from transactions where id = v_txn.id;
  end if;
end;
$$;
