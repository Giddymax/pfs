import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeAccountSummary } from "@/lib/finance/account-summary";
import { adminClient, TEST_ADMIN_ID, createFixtureClient, deleteAllFixtures } from "../helpers/supabase";

// Every revenue component enabled — matches every page's DEFAULT_REVENUE_COMPONENTS.
const RC = { interest: true, commission: true, susu_fees: true, card_fees: true, sms_fees: true, processing_fees: true };

/**
 * BASELINE — captures computeAccountSummary()'s current, pre-fix behaviour
 * against a small, fixed, real-Postgres dataset. Every later FIX's tests
 * assert against a fresh baseline of their own; this file's job is only to
 * prove the harness itself works end-to-end (real sign-in, real RPCs, real
 * summary calc) and to give something concrete to diff against once FIX 2
 * (interest) and FIX 3 (write-off) land.
 *
 * Runs entirely on real Postgres, against the actual prime-financial-service
 * project — see .env.test's header for why there's no separate project.
 * Every row it touches is ZZTEST-tagged and deleted in afterAll.
 */
describe("computeAccountSummary — baseline (pre-fix)", () => {
  let admin: SupabaseClient;
  let savingsAccountId: string;

  beforeAll(async () => {
    admin = await adminClient();
    await deleteAllFixtures(admin); // clean slate — defensive, in case a prior run was interrupted
  });

  afterAll(async () => {
    await deleteAllFixtures(admin);
  });

  it("a plain deposit increases totalSavings, combinedTotal and accountBalance by exactly the deposit amount, and touches nothing else", async () => {
    const { savingsAccount } = await createFixtureClient(admin, { label: "deposit" });
    savingsAccountId = savingsAccount.id;

    const before = await computeAccountSummary(admin, RC);

    const { error } = await admin.rpc("record_deposit", {
      p_account_id: savingsAccountId,
      p_amount: 1000,
      p_recorded_by: TEST_ADMIN_ID,
      p_notes: "ZZTEST baseline deposit",
    });
    expect(error).toBeNull();

    const after = await computeAccountSummary(admin, RC);

    expect(round(after.totalSavings - before.totalSavings)).toBe(1000);
    expect(round(after.combinedTotal - before.combinedTotal)).toBe(1000);
    expect(round(after.accountBalance - before.accountBalance)).toBe(1000);
    // A deposit is not revenue and not a withdrawal — must move nothing else.
    expect(round(after.totalRevenue - before.totalRevenue)).toBe(0);
    expect(round(after.totalWithdrawals - before.totalWithdrawals)).toBe(0);
    expect(round(after.cashAtBank + after.cashAtHand - (before.cashAtBank + before.cashAtHand))).toBe(1000);
  });

  it("a commissioned withdrawal reduces accountBalance by principal+commission, and commission becomes revenue with zero net cash-formula effect from the fee itself (Combined Account Total moves by the commission, Total Withdrawals cancels it back out)", async () => {
    const before = await computeAccountSummary(admin, RC);

    // Withdraw 200, commission 10 — matches record_withdrawal's current
    // manually-entered-fee signature (0058_admin_only_withdrawals.sql).
    const { error } = await admin.rpc("record_withdrawal", {
      p_account_id: savingsAccountId,
      p_amount: 200,
      p_recorded_by: TEST_ADMIN_ID,
      p_notes: "ZZTEST baseline withdrawal",
      p_created_at: null,
      p_fee: 10,
    });
    expect(error).toBeNull();

    const after = await computeAccountSummary(admin, RC);

    // Combined Account Total = Total Savings + Total Susu + Total Revenue —
    // Total Savings/Susu are gross (untouched by a withdrawal), so the only
    // move is Total Revenue's +10 commission.
    expect(round(after.combinedTotal - before.combinedTotal)).toBe(10);
    expect(round(after.totalSavings - before.totalSavings)).toBe(0); // totalSavings = dep, unaffected by withdrawals
    expect(round(after.commission - before.commission)).toBe(10);
    expect(round(after.totalRevenue - before.totalRevenue)).toBe(10);
    expect(round(after.withdrawalPrincipal - before.withdrawalPrincipal)).toBe(200);
    expect(round(after.revenueWithdrawals - before.revenueWithdrawals)).toBe(10);
    expect(round(after.totalWithdrawals - before.totalWithdrawals)).toBe(210);
    // Account Balance = Combined Account Total − Total Withdrawals (net of
    // loans/expenditures, both untouched here): +10 (revenue) − 210
    // (withdrawal principal + the same commission counted again) = -200 —
    // the commission's +10/-10 cancels, leaving exactly the cash paid out.
    expect(round(after.accountBalance - before.accountBalance)).toBe(-200);
  });

  it("a withdrawal recorded with no notes (the common case — admins usually leave notes blank) still counts toward withdrawalPrincipal/totalWithdrawals/accountBalance", async () => {
    // Regression test for a real bug: withdrawalPrincipal used to be built
    // from a `.not("notes", "ilike", "%swept to company funds%")` filter
    // applied at the query level. In Postgres, `NULL NOT ILIKE 'pattern'`
    // evaluates to NULL — not TRUE — so PostgREST silently dropped every
    // withdrawal row with notes IS NULL from the result set entirely. In
    // production this was undercounting withdrawalPrincipal by tens of
    // thousands of cedis (33 of 39 real withdrawal rows had no notes) and,
    // once Account Balance started deriving from Total Withdrawals, was
    // overstating Account Balance by the same amount. The fix moved the
    // "swept to company funds" exclusion into JS, after the fetch.
    const before = await computeAccountSummary(admin, RC);

    const { error } = await admin.rpc("record_withdrawal", {
      p_account_id: savingsAccountId,
      p_amount: 150,
      p_recorded_by: TEST_ADMIN_ID,
      p_notes: null,
      p_created_at: null,
      p_fee: 0,
    });
    expect(error).toBeNull();

    const after = await computeAccountSummary(admin, RC);

    expect(round(after.withdrawalPrincipal - before.withdrawalPrincipal)).toBe(150);
    expect(round(after.totalWithdrawals - before.totalWithdrawals)).toBe(150);
    expect(round(after.accountBalance - before.accountBalance)).toBe(-150);
  });
});

function round(n: number) {
  return Math.round(n * 100) / 100;
}
