-- Automated monthly loan repayment collection.
--
-- 1. A loan now has a pinned repayment_account_id (the client's savings or
--    susu account chosen at activation time — see activate_loan() below),
--    a next_due_date (the next monthly installment date), and an arrears
--    balance (shortfall carried forward from a month the account couldn't
--    cover in full).
-- 2. process_due_loan_repayments() is the admin-triggered batch: for every
--    active loan whose next_due_date has arrived, it deducts whatever the
--    account can cover (up to that month's due amount) as a REAL, normal
--    withdrawal — same record_withdrawal() RPC a manually-recorded
--    withdrawal goes through, so it's indistinguishable from one in every
--    report — then applies that amount to the loan via the same
--    record_loan_repayment() RPC manual repayments already use. Whatever
--    isn't collected this cycle rolls into arrears, added on top of next
--    month's due amount; the due date always advances by one month
--    regardless of whether the month was fully covered.
-- 3. set_loan_repayment_account() lets an admin attach a repayment account
--    to a loan that was activated before this feature existed (or change
--    it later) — bootstraps next_due_date the first time it's set.
--
-- No change to lib/finance/account-summary.ts: every deduction here is a
-- genuine transactions/loan_repayments row through the existing RPCs, so
-- it's already counted correctly everywhere (Total Withdrawals, Loan
-- Repayments, Account Balance, ...) with zero special-casing needed.

alter table loans add column repayment_account_id uuid references accounts (id);
alter table loans add column next_due_date date;
alter table loans add column arrears numeric(12, 2) not null default 0 check (arrears >= 0);

comment on column loans.repayment_account_id is 'Client''s savings/susu account the monthly installment is auto-deducted from. Set at activation, or later via set_loan_repayment_account() for loans that predate this feature.';
comment on column loans.next_due_date is 'Next date process_due_loan_repayments() will attempt a deduction. Null = not enrolled in auto-deduction.';
comment on column loans.arrears is 'Shortfall carried forward from a month the repayment account couldn''t fully cover — added on top of the following month''s due amount.';

-- 'account_deduction' joins the existing manual methods so an
-- auto-collected repayment is labeled honestly, not misfiled as 'cash'.
alter table loan_repayments drop constraint if exists loan_repayments_method_check;
alter table loan_repayments add constraint loan_repayments_method_check
  check (method in ('cash', 'mobile_money', 'bank_transfer', 'account_deduction'));

-- ========================================
-- activate_loan — now requires the repayment account up front, per the
-- "pin it at activation" decision. Everything else (processing-fee
-- deduction from whichever eligible account has the balance) is unchanged.
--
-- CREATE OR REPLACE can't change a function's argument list — a different
-- signature creates a coexisting overload, not a replacement, which would
-- leave the old 2-argument version callable (and silently skip the new
-- repayment-account requirement). Drop it explicitly first.
-- ========================================
drop function if exists activate_loan(uuid, uuid);

create or replace function activate_loan(
  p_loan_id             uuid,
  p_activated_by        uuid,
  p_repayment_account_id uuid
)
returns loans
language plpgsql
security definer
set search_path = public
as $$
declare
  v_loan    loans%rowtype;
  v_account accounts%rowtype;
  v_repay_account accounts%rowtype;
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

  if p_repayment_account_id is null then
    raise exception 'A repayment account is required to activate a loan';
  end if;

  select * into v_repay_account from accounts where id = p_repayment_account_id;
  if not found or v_repay_account.client_id <> v_loan.client_id then
    raise exception 'Repayment account must belong to this loan''s client';
  end if;
  if v_repay_account.product_type not in ('savings', 'susu') then
    raise exception 'Repayment account must be a savings or susu account';
  end if;
  if v_repay_account.status <> 'active' then
    raise exception 'Repayment account must be active';
  end if;

  update loans
  set status               = 'active',
      disbursement_date    = current_date,
      due_date             = (current_date + (tenor_months || ' months')::interval)::date,
      current_balance      = total_repayable,
      repayment_account_id = p_repayment_account_id,
      next_due_date         = (current_date + interval '1 month')::date,
      updated_at            = now()
  where id = p_loan_id
  returning * into v_loan;

  -- Deduct processing fee if one is set (unchanged: picks whichever
  -- eligible account has the balance — separate concern from the
  -- repayment account chosen above).
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

-- ========================================
-- set_loan_repayment_account — attach/change the auto-deduction account on
-- an already-active loan. Bootstraps next_due_date only the first time
-- (never resets an established schedule/arrears just because the account
-- changed).
-- ========================================
create or replace function set_loan_repayment_account(
  p_loan_id    uuid,
  p_account_id uuid
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
    raise exception 'Only an admin can set a loan''s repayment account';
  end if;

  select * into v_loan from loans where id = p_loan_id for update;
  if not found then
    raise exception 'Loan not found';
  end if;
  if v_loan.status <> 'active' then
    raise exception 'Only an active loan can have a repayment account set (current status: %)', v_loan.status;
  end if;

  select * into v_account from accounts where id = p_account_id;
  if not found or v_account.client_id <> v_loan.client_id then
    raise exception 'Repayment account must belong to this loan''s client';
  end if;
  if v_account.product_type not in ('savings', 'susu') then
    raise exception 'Repayment account must be a savings or susu account';
  end if;
  if v_account.status <> 'active' then
    raise exception 'Repayment account must be active';
  end if;

  update loans
  set repayment_account_id = p_account_id,
      next_due_date = coalesce(next_due_date, (current_date + interval '1 month')::date),
      updated_at = now()
  where id = p_loan_id
  returning * into v_loan;

  return v_loan;
end;
$$;

-- ========================================
-- process_due_loan_repayments — the admin-triggered batch. One cycle per
-- eligible loan per call (a loan several months overdue needs the batch
-- run again to catch up further, same as clicking "next" once).
-- ========================================
create or replace function process_due_loan_repayments(
  p_processed_by uuid
)
returns table (
  loan_id         uuid,
  loan_code       text,
  client_full_name text,
  account_number  text,
  due_amount      numeric,
  collected       numeric,
  new_arrears     numeric,
  new_status      text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_loan        loans%rowtype;
  v_account     accounts%rowtype;
  v_client      clients%rowtype;
  v_due         numeric(12, 2);
  v_available   numeric(12, 2);
  v_will_complete boolean;
begin
  if not is_admin() then
    raise exception 'Only an admin can process due loan repayments';
  end if;

  for v_loan in
    select * from loans
    where status = 'active'
      and repayment_account_id is not null
      and next_due_date is not null
      and next_due_date <= current_date
    order by next_due_date
    for update
  loop
    select * into v_account from accounts where id = v_loan.repayment_account_id for update;
    -- Account gone/closed since activation: skip this loan entirely rather
    -- than fail the whole batch: nothing to collect against, no state
    -- moves for it, it'll surface again next run until fixed.
    if not found or v_account.status <> 'active' then
      continue;
    end if;

    v_due       := least(v_loan.monthly_installment + v_loan.arrears, v_loan.current_balance);
    v_available := least(coalesce(v_account.balance, 0), v_due);

    if v_available > 0 then
      perform record_withdrawal(
        v_loan.repayment_account_id,
        v_available,
        p_processed_by,
        'Loan ' || v_loan.loan_code || ' monthly repayment (auto)',
        null,
        0
      );

      -- record_loan_repayment() is the single source of truth for whether
      -- this closes the loan out (v_loan.current_balance is our
      -- pre-repayment snapshot, so mirror its own greatest(0, balance -
      -- amount) <= 0 check here rather than trust two separate
      -- computations to agree).
      perform record_loan_repayment(
        v_loan.id,
        v_available,
        current_date,
        'account_deduction',
        'Monthly auto-deduction – ' || v_loan.loan_code,
        p_processed_by
      );
    end if;

    v_will_complete := (v_loan.current_balance - v_available) <= 0;

    if v_will_complete then
      -- record_loan_repayment already flipped the loan to 'completed'.
      -- Nothing left to schedule.
      update loans
      set arrears = 0,
          next_due_date = null,
          updated_at = now()
      where id = v_loan.id;
    else
      update loans
      set arrears = v_due - v_available,
          next_due_date = (v_loan.next_due_date + interval '1 month')::date,
          updated_at = now()
      where id = v_loan.id;
    end if;

    select * into v_client from clients where id = v_loan.client_id;

    loan_id := v_loan.id;
    loan_code := v_loan.loan_code;
    client_full_name := v_client.full_name;
    account_number := v_account.account_number;
    due_amount := v_due;
    collected := v_available;
    new_arrears := case when v_will_complete then 0 else v_due - v_available end;
    new_status := case when v_will_complete then 'completed' else v_loan.status end;
    return next;
  end loop;
end;
$$;
