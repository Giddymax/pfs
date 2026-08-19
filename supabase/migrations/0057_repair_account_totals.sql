-- Data repair: recompute every account's cached dep/wdr/comm/balance (and
-- every transaction's bal_after) directly from the transactions ledger.
--
-- Root cause (fixed in application code alongside this migration):
-- recalculate_account() is gated by is_admin(), which reads auth.uid(). Two
-- routes called it through the Supabase service-role admin client instead of
-- the session-authenticated client:
--   - app/api/susu/emergency-withdrawal/route.ts — the RPC's error was never
--     checked, so the call failed *silently* on every single emergency
--     withdrawal. That route also hand-set `wdr = <balance before the
--     withdrawal>` as a stopgap before the (failing) recalc — an overwrite,
--     not an increment, which discarded any withdrawals already reflected in
--     wdr from earlier on the same account. This is the exact bug behind
--     "withdrew 520 total but the account shows 280": an emergency
--     withdrawal's hand-set wdr value replaced, rather than added to, the
--     wdr already accrued from an earlier withdrawal on the account.
--   - app/api/transactions/[id]/delete/route.ts — the RPC's error *was*
--     checked and surfaced to the caller, but only after the underlying
--     `delete from transactions` had already committed, so every hard-deleted
--     transaction also left its account's cached totals stale even though
--     the API response looked like a failure.
--
-- Because auth.uid() is null for the service-role client, every account that
-- ever went through either path has been carrying stale dep/wdr/comm/balance
-- ever since — which is what's been feeding "Total Savings"/"Total Daily
-- Susu"/"Account Balance" and everything downstream of them app-wide (those
-- figures are summed from accounts.dep/accounts.balance, not recomputed live
-- from transactions). This script is the one-time company-wide fix; the code
-- fix stops it from recurring.
--
-- Run directly as a database owner/superuser (e.g. the Supabase SQL editor),
-- not through the recalculate_account() RPC — a raw SQL session has no
-- auth.uid() either, so the RPC's is_admin() guard would reject it too. This
-- script performs the RPC's exact same logic (see 0029_fix_fee_in_balance_rpcs.sql)
-- set-based, for every account in one pass, without going through that gate.

-- ========================================
-- 1. Rebuild every non-reversed transaction's bal_after, chronologically per
--    account — same running-balance formula recalculate_account() uses.
-- ========================================
with running as (
  select
    id,
    sum(
      case type
        when 'deposit' then amount
        when 'withdrawal' then -(amount + fee)
        when 'fee' then -amount
        else 0
      end
    ) over (partition by account_id order by created_at, id rows unbounded preceding) as new_bal_after
  from transactions
  where reversed_at is null
)
update transactions t
set bal_after = r.new_bal_after
from running r
where t.id = r.id
  and t.bal_after is distinct from r.new_bal_after;

-- ========================================
-- 2. Recompute accounts.dep/wdr/comm/balance from the (now-correct) ledger.
--    Accounts with no transactions at all are left untouched (nothing to
--    repair — a freshly opened account is already 0/0/0/0 or holds only its
--    opening deposit, which the join below would zero out incorrectly if not
--    guarded).
-- ========================================
with totals as (
  select
    account_id,
    coalesce(sum(amount) filter (where type = 'deposit'), 0)    as dep,
    coalesce(sum(amount) filter (where type = 'withdrawal'), 0) as wdr,
    coalesce(sum(fee)    filter (where type = 'withdrawal'), 0) as comm,
    coalesce(sum(amount) filter (where type = 'fee'), 0)        as fees
  from transactions
  where reversed_at is null
  group by account_id
)
update accounts a
set
  dep     = t.dep,
  wdr     = t.wdr,
  comm    = t.comm,
  balance = t.dep - t.wdr - t.comm - t.fees
from totals t
where a.id = t.account_id
  and (a.dep, a.wdr, a.comm, a.balance) is distinct from (t.dep, t.wdr, t.comm, t.dep - t.wdr - t.comm - t.fees);
