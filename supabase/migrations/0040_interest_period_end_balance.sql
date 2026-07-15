-- Interest eligibility and the interest calculation itself must both be
-- pinned to the account's balance as of the END of the qualifying window
-- (e.g. 31 Oct 2026), not whatever the live balance happens to be whenever
-- an admin gets around to clicking "Disburse interest" — a client who later
-- withdrew below the threshold, or topped up further, shouldn't change what
-- they're owed for having held the balance through the window.

-- balance_as_of — reconstructs an account's balance at the end of a given
-- date from its bal_after snapshots. Falls back to reconstructing the
-- account's opening balance (undoing every recorded transaction from the
-- current balance) when no transaction exists on/before that date — this
-- covers accounts whose opening deposit was set directly on the accounts
-- row rather than as a transaction row.
create or replace function balance_as_of(p_account_id uuid, p_date date)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_bal numeric(12, 2);
begin
  select bal_after into v_bal
  from transactions
  where account_id = p_account_id
    and reversed_at is null
    and created_at::date <= p_date
  order by created_at desc, id desc
  limit 1;

  if v_bal is not null then
    return v_bal;
  end if;

  select a.balance
       - coalesce(sum(t.amount) filter (where t.type = 'deposit' and t.reversed_at is null), 0)
       + coalesce(sum(t.amount) filter (where t.type = 'withdrawal' and t.reversed_at is null), 0)
       + coalesce(sum(t.fee)    filter (where t.type = 'withdrawal' and t.reversed_at is null), 0)
    into v_bal
  from accounts a
  left join transactions t on t.account_id = a.id
  where a.id = p_account_id
  group by a.balance;

  return coalesce(v_bal, 0);
end;
$$;

-- list_interest_eligible_accounts — savings/susu accounts whose balance as
-- of p_period_end exceeded p_min_balance, excluding ones already paid
-- interest for this exact period.
create or replace function list_interest_eligible_accounts(
  p_min_balance numeric,
  p_period_start date,
  p_period_end date
)
returns table (
  account_id uuid,
  client_id uuid,
  client_full_name text,
  client_code text,
  account_number text,
  product_type text,
  reference_balance numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_staff_or_admin() then
    raise exception 'Only staff or admin can view interest-eligible accounts';
  end if;

  return query
  select
    a.id,
    c.id,
    c.full_name,
    c.client_code,
    a.account_number,
    a.product_type,
    balance_as_of(a.id, p_period_end)
  from accounts a
  join clients c on c.id = a.client_id
  where a.product_type in ('savings', 'susu')
    and balance_as_of(a.id, p_period_end) > p_min_balance
    and not exists (
      select 1 from interest_disbursements d
      where d.account_id = a.id
        and d.period_start = p_period_start
        and d.period_end = p_period_end
    );
end;
$$;

-- disburse_interest — the rate is now applied to the account's balance as
-- of p_period_end (not its live balance) to determine the amount; the
-- credit itself still lands on the live balance since it's real money being
-- added to the account today.
drop function if exists disburse_interest(uuid, numeric, date, date, uuid);

create or replace function disburse_interest(
  p_account_id uuid,
  p_rate_percent numeric,
  p_period_start date,
  p_period_end date,
  p_disbursed_by uuid
)
returns transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account accounts%rowtype;
  v_reference_balance numeric(12, 2);
  v_amount numeric(12, 2);
  v_new_balance numeric(12, 2);
  v_txn transactions%rowtype;
  v_notes text;
begin
  if not is_staff_or_admin() then
    raise exception 'Only staff or admin can disburse interest';
  end if;

  if p_rate_percent is null or p_rate_percent <= 0 then
    raise exception 'Rate must be greater than zero';
  end if;

  select * into v_account from accounts where id = p_account_id for update;
  if not found then
    raise exception 'Account not found';
  end if;

  v_reference_balance := balance_as_of(p_account_id, p_period_end);
  v_amount := round(v_reference_balance * p_rate_percent / 100, 2);
  if v_amount <= 0 then
    raise exception 'Calculated interest amount must be greater than zero';
  end if;

  v_new_balance := v_account.balance + v_amount;
  v_notes := 'Interest disbursement at ' || p_rate_percent || '% of balance as of '
    || to_char(p_period_end, 'DD Mon YYYY') || ' (' || to_char(p_period_start, 'DD Mon YYYY')
    || ' - ' || to_char(p_period_end, 'DD Mon YYYY') || ')';

  update accounts
  set balance = v_new_balance,
      dep = dep + v_amount
  where id = p_account_id;

  insert into transactions (account_id, client_id, type, amount, fee, bal_after, notes, recorded_by)
  values (p_account_id, v_account.client_id, 'deposit', v_amount, 0, v_new_balance, v_notes, p_disbursed_by)
  returning * into v_txn;

  insert into interest_disbursements (account_id, client_id, transaction_id, amount, rate_percent, period_start, period_end, disbursed_by)
  values (p_account_id, v_account.client_id, v_txn.id, v_amount, p_rate_percent, p_period_start, p_period_end, p_disbursed_by);

  return v_txn;
end;
$$;
