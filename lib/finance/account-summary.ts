import { createClient } from "@/lib/supabase/server";
import { round2 } from "@/lib/loan";
import type { RevenueComponents } from "@/lib/types";

export interface AccountSummary {
  // Gross lifetime deposits — no withdrawals or deductions netted in. Total
  // Savings/Total Daily Susu are deliberately gross figures, NOT the net
  // per-account `balance` column (dep, not dep − wdr − comm − fees) — see
  // Combined Account Total and Account Balance below for why staying gross
  // here matters.
  totalSavings: number;
  totalSusu: number;
  // Revenue components (each already gated by revenueComponents before it's
  // folded into totalRevenue below). This is a P&L/income view — how much
  // the company has earned — not a cash-reconciliation view.
  //
  // loanInterest specifically: recognized only once a loan is FULLY repaid
  // (status = 'completed'), not proportionally as each repayment comes in.
  // compute_collected_loan_interest() (0072_loan_interest_on_completion.sql)
  // sums total_interest across completed loans only — a loan still being
  // paid off contributes nothing here yet, even if it's 99% repaid.
  loanInterest: number;
  commission: number; // savings withdrawals only — susu is commission-exempt
  susuFees: number;    // ACCRUAL basis, for the P&L view — day-31 fee the
                        // moment it's contributed (whether or not the cycle
                        // has been claimed yet) + instant-route
                        // early-withdrawal penalties + paid emergency-claim
                        // penalties. See susuFeesSwept below for why this
                        // figure specifically is NOT what accountBalance uses.
  cardFees: number;
  totalSmsFees: number;
  processingFees: number;
  // Sum of every enabled revenue component (interest + commission + susu
  // fees + card fees + SMS fees + processing fees) — what the company has
  // earned, full stop. Shown on the Overview dashboard and the Finance page.
  // Equivalently: Revenue Withdrawals (commission + susuFees + totalSmsFees
  // + processingFees — the fee-type revenue taken directly out of a client
  // balance, see revenueWithdrawals below) + cardFees + loanInterest (the
  // two revenue sources that never touch a client balance) — same total,
  // grouped by where the money came from instead of by fee type.
  totalRevenue: number;
  // Combined Account Total = Total Savings + Total Daily Susu + Total
  // Revenue — every pool of money the business is holding or has earned,
  // client-owed and company-owned combined. (Earlier versions of this figure
  // deliberately excluded Total Revenue; that changed on request — see
  // Account Balance below for how this combines with Total Withdrawals to
  // stay arithmetically consistent despite the mix.)
  combinedTotal: number;
  // Every amount deducted from a client's account balance, all time,
  // excluding reversed txns — not just what the client withdrew themselves.
  // recalculate_account()'s own balance formula treats withdrawal principal,
  // commission, and every type='fee' charge as three independently-
  // subtracted amounts (balance = dep − wdr − comm − fees), so all of them
  // are real, separate deductions from the same pool, and belong in this
  // total together:
  //   + withdrawal principal (what the client actually walked away with)
  //   + commission (savings withdrawals) + susuFees (day-31 fee,
  //     early-withdrawal penalty, paid emergency-claim penalties — susu's
  //     equivalent of commission)
  //   + totalSmsFees + processingFees (company charges deducted straight
  //     out of a client's balance, same as commission)
  // Card Fees are the one deliberate exception — they're a fresh cash
  // inflow at registration, never netted against any client account
  // balance (see cardFees' own comment below), so they're not a
  // "withdrawal" in any sense and stay out of this total.
  totalWithdrawals: number;
  // The subset of totalWithdrawals that's just the raw withdrawal
  // principal — what a client actually walked away with in hand, before
  // any commission/fee is netted out. Exposed separately since
  // totalWithdrawals itself no longer means "cash paid to clients" alone.
  // This is "Transactional Withdrawals" on the Overview dashboard — the two
  // names refer to the exact same figure.
  withdrawalPrincipal: number;
  // The other subset of totalWithdrawals — every fee-type deduction bundled
  // into it (commission + susuFees + totalSmsFees + processingFees), i.e.
  // totalWithdrawals minus withdrawalPrincipal. This is "Revenue
  // Withdrawals" on the Overview dashboard: money taken out of a client's
  // balance as company revenue rather than handed to the client in cash.
  // totalWithdrawals = withdrawalPrincipal + revenueWithdrawals, always.
  revenueWithdrawals: number;
  // Total loan principal actually disbursed (cash out) and total repayments
  // actually received (cash in, principal + interest combined — see
  // accountBalance's comment for why interest isn't added a second time).
  loansDisbursed: number;
  loanRepayments: number;
  totalExpenditures: number;
  // CASH basis — only the susu fee/penalty money that has actually been
  // swept out of a client's balance via a real transaction (instant-route
  // early-withdrawal penalties, plus pay_susu_claim's fee sweep for paid
  // claims). Deliberately narrower than susuFees above: a completed cycle's
  // day-31 fee is recognized as revenue (in susuFees) the moment it's
  // contributed, but the cash doesn't actually leave the client's balance
  // until their claim is paid — which can be immediate, delayed, or never.
  // Exposed for reporting; not currently an input to accountBalance below
  // (that formula works off Total Withdrawals/Total Revenue, both of which
  // use the accrual-basis susuFees, not this cash-basis figure).
  susuFeesSwept: number;
  // ─────────────────────────────────────────────────────────────────────
  // Account Balance — on request, now a direct arithmetic identity rather
  // than the balance-sheet reconstruction this used to be:
  //
  //   Account Balance = Combined Account Total − Total Withdrawals
  //                      − Loans Disbursed + (Loan Repayments − Loan
  //                      Interest already counted in Total Revenue)
  //                      − Expenditures
  //
  //   Combined Account Total (= Total Savings + Total Daily Susu + Total
  //     Revenue, all GROSS/lifetime figures — see that field's own comment)
  //     is deliberately mixed: client-owed money and company-owned revenue
  //     both count as cash the business is holding. Total Withdrawals is
  //     symmetric with it: withdrawalPrincipal is cash that left the
  //     business entirely, while the rest of Total Withdrawals
  //     (commission/susuFees/SMS/processing fees — see revenueWithdrawals)
  //     is money that moved from the client-owed pool into the
  //     company-revenue pool WITHOUT leaving the business — since that same
  //     amount was just added once via Total Revenue inside Combined
  //     Account Total, subtracting it again here nets to exactly zero
  //     effect on Account Balance, which is correct: an internal transfer
  //     shouldn't change how much cash the business has. Card Fees are the
  //     one Total Revenue component with no Total Withdrawals counterpart
  //     (never deducted from any client balance — a genuine fresh inflow),
  //     so they pass straight through as a net gain, correctly.
  //
  //   Loan Interest needs the same treatment but can't rely on the same
  //     cancellation: it's counted once via Total Revenue (inside Combined
  //     Account Total) AND is also embedded inside Loan Repayments (a
  //     repayment is principal + interest in one cash receipt), so adding
  //     raw Loan Repayments here on top of Combined Account Total would
  //     double-count the interest portion. Subtracting it back out of Loan
  //     Repayments here (only when the interest revenue component is
  //     actually enabled — otherwise it was never added via Total Revenue
  //     in the first place) leaves exactly the principal-repaid portion,
  //     netted against Loans Disbursed (principal-only) as a clean
  //     loans-receivable movement, with the interest already accounted for
  //     via Combined Account Total.
  //
  //   Expenditures are a real cash outflow, subtracted directly.
  //
  //   NOTE: unlike the previous formula, this one is only exactly correct
  //   when Combined Account Total's Total Savings/Total Daily Susu inputs
  //   stay GROSS (lifetime deposits, never reduced by a withdrawal) — using
  //   the net per-account `balance` column here instead would double-
  //   subtract withdrawal principal (once inside that net balance, again
  //   via Total Withdrawals) and understate Account Balance by that amount.
  // ─────────────────────────────────────────────────────────────────────
  accountBalance: number;
  // Cash at Bank + Cash at Hand = Account Balance (split by the company's
  // recorded bank ledger; neither side ever shows negative).
  cashAtBank: number;
  cashAtHand: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sum(rows: any[] | null, key: string) {
  return round2((rows ?? []).reduce((s: number, r: Record<string, unknown>) => s + Number(r[key] ?? 0), 0));
}

/**
 * Single source of truth for the company-wide account totals shown on the
 * Overview dashboard, the Bank page, the Finance page, and the
 * Deposits/Withdrawals reports — every page that shows "Total Savings",
 * "Total Daily Susu", "Total Revenue", "Combined Account Total", "Account
 * Balance", "Total Withdrawals", "Cash at Bank", or "Cash at Hand" calls
 * this same function, so those figures can never drift between screens.
 *
 *   Combined Account Total = Total Savings + Total Daily Susu + Total
 *                            Revenue — see the AccountSummary.combinedTotal
 *                            comment.
 *   Total Withdrawals      = Transactional Withdrawals (withdrawalPrincipal)
 *                            + Revenue Withdrawals (revenueWithdrawals) —
 *                            see those fields' own comments.
 *   Account Balance        = Combined Account Total − Total Withdrawals,
 *                            with Loans Disbursed/Repaid and Expenditures
 *                            still netted in — see the
 *                            AccountSummary.accountBalance comment for the
 *                            full formula and the loan-interest
 *                            double-count it deliberately guards against.
 *   Cash at Hand + Cash at Bank = Account Balance
 */
export async function computeAccountSummary(
  supabase: Awaited<ReturnType<typeof createClient>>,
  revenueComponents: RevenueComponents
): Promise<AccountSummary> {
  const [
    { data: savingsRows },
    { data: susuRows },
    { data: withdrawalRows },
    { data: commissionRows },
    { data: susuFeeRows },
    { data: cardFeeRows },
    { data: smsFeeRows },
    { data: processingFeeRows },
    { data: collectedInterest },
    { data: bankTxnRows },
    { data: loanPrincipalRows },
    { data: repaymentRows },
    { data: expenditureRows },
    { data: susuClaimPenaltyRows },
    { data: sweptFeeRows },
  ] = await Promise.all([
    supabase.from("accounts").select("id, dep").eq("product_type", "savings"),
    supabase.from("accounts").select("id, dep").eq("product_type", "susu"),
    // Every withdrawal (savings + susu combined — there's no third account
    // product_type). The automatic susu day-31 fee sweep (0071_susu_day31_
    // auto_sweep.sql) is excluded below, in JS, not here in the query:
    // Postgres's `notes NOT ILIKE 'pattern'` evaluates to NULL — not TRUE —
    // for any row where notes IS NULL, so a `.not("notes","ilike",...)`
    // filter at the SQL/PostgREST level silently drops every withdrawal
    // that simply has no notes at all, which is most of them. (This is
    // exactly what was undercounting withdrawalPrincipal for months — see
    // withdrawalPrincipal below.) Filtering in JS after the fetch, the same
    // way the Withdrawals report's cashPaidToClients already does it,
    // avoids the trap entirely.
    supabase.from("transactions").select("amount, notes").eq("type", "withdrawal").is("reversed_at", null),
    supabase.from("transactions").select("fee, account_id").eq("type", "withdrawal").is("reversed_at", null),
    supabase.from("susu_payments").select("amount").eq("day_in_cycle", 31),
    supabase.from("card_fees").select("amount"),
    supabase.from("sms_fee_charges").select("amount"),
    // Only loans actually activated — processing_fee is charged inside
    // activate_loan() and nowhere else, so a pending/rejected loan's
    // processing_fee was never really deducted from anyone's balance.
    // Matches the exact same status filter loanPrincipalRows uses below,
    // since both are tied to the same activation event.
    supabase.from("loans").select("processing_fee").in("status", ["active", "completed", "defaulted"]),
    supabase.rpc("compute_collected_loan_interest"),
    supabase.from("bank_transactions").select("type, amount"),
    supabase.from("loans").select("principal").in("status", ["active", "completed", "defaulted"]),
    supabase.from("loan_repayments").select("amount"),
    supabase.from("expenditures").select("amount"),
    // Emergency susu claims paid via pay_susu_claim — the penalty swept into
    // company funds at payout time (0059_susu_fee_sweep.sql). Normal-claim
    // fees are already counted via susuFeeRows (the original day-31
    // contribution); the instant emergency-withdrawal route's penalty is
    // already counted via commissionRows below — this is the one susu-fee
    // source that had no revenue tracking anywhere before the sweep fix.
    supabase.from("susu_claims").select("penalty_amount").eq("claim_type", "emergency").eq("status", "paid"),
    // Cash actually swept out of a client's balance — the cash-basis figure
    // accountBalance needs. Two sources share the same "swept to company
    // funds" notes tag: pay_susu_claim's legacy fee sweep (type='fee',
    // 0059_susu_fee_sweep.sql — still used for emergency claims and any
    // cycle that completed before 0071) and the automatic susu day-31 sweep
    // (type='withdrawal', 0071_susu_day31_auto_sweep.sql). Excludes SMS-fee
    // `type='fee'` rows, which use a different notes pattern and are
    // already counted via smsFeeRows.
    supabase.from("transactions").select("amount").in("type", ["fee", "withdrawal"]).is("reversed_at", null).ilike("notes", "%swept to company funds%"),
  ]);

  const totalSavings = sum(savingsRows, "dep");
  const totalSusu = sum(susuRows, "dep");
  // Raw withdrawal principal — what clients actually walked away with in
  // hand, across every savings and susu withdrawal. Kept as its own value
  // below (not the totalWithdrawals field anymore, see that field's
  // comment) since commission/susuFees/etc. need it as a building block.
  // The "swept to company funds" auto-sweep exclusion happens here in JS,
  // not as a query filter — see withdrawalRows' own comment for why.
  const withdrawalPrincipal = round2(
    (withdrawalRows ?? [])
      .filter((r: { notes: string | null }) => !(r.notes ?? "").toLowerCase().includes("swept to company funds"))
      .reduce((s: number, r: { amount: number }) => s + Number(r.amount ?? 0), 0)
  );

  // Split withdrawal fees by product. Susu withdrawals are commission-exempt
  // under record_withdrawal (the shared RPC every normal susu withdrawal
  // goes through hard-codes fee=0 for susu). The one path that bypasses this
  // is the instant emergency susu withdrawal route, which charges a
  // "company fee" (early-withdrawal penalty) directly — so any nonzero fee
  // on a susu withdrawal is, by construction, that penalty, not a
  // commission, and belongs with the other susu-cycle fees.
  const savingsAccountIds = new Set((savingsRows ?? []).map((r: { id: string }) => r.id));
  const susuAccountIds = new Set((susuRows ?? []).map((r: { id: string }) => r.id));
  const feeRows = (commissionRows ?? []) as { fee: number; account_id: string }[];
  const commission = round2(
    feeRows.filter((r) => savingsAccountIds.has(r.account_id)).reduce((s, r) => s + Number(r.fee ?? 0), 0)
  );
  const susuEarlyWithdrawalFee = round2(
    feeRows.filter((r) => susuAccountIds.has(r.account_id)).reduce((s, r) => s + Number(r.fee ?? 0), 0)
  );
  const susuClaimPenalties = sum(susuClaimPenaltyRows, "penalty_amount");
  const susuFees = round2(sum(susuFeeRows, "amount") + susuEarlyWithdrawalFee + susuClaimPenalties);
  const susuFeesSwept = round2(susuEarlyWithdrawalFee + sum(sweptFeeRows, "amount"));
  const cardFees = sum(cardFeeRows, "amount");
  const totalSmsFees = sum(smsFeeRows, "amount");
  const processingFees = sum(processingFeeRows, "processing_fee");
  const loanInterest = round2(Number(collectedInterest ?? 0));

  // Total Withdrawals — see the AccountSummary field's own comment for the
  // full reasoning. susuFees already contains susuEarlyWithdrawalFee, so it
  // isn't added twice; cardFees is deliberately excluded.
  // revenueWithdrawals is the fee-only half of this split out as its own
  // figure ("Revenue Withdrawals" on the Overview dashboard);
  // withdrawalPrincipal (computed above) is the other half ("Transactional
  // Withdrawals") — the two always sum back to totalWithdrawals.
  const revenueWithdrawals = round2(commission + susuFees + totalSmsFees + processingFees);
  const totalWithdrawals = round2(withdrawalPrincipal + revenueWithdrawals);

  const totalRevenue = round2(
    (revenueComponents.interest ? loanInterest : 0) +
    (revenueComponents.commission ? commission : 0) +
    (revenueComponents.susu_fees ? susuFees : 0) +
    (revenueComponents.card_fees ? cardFees : 0) +
    (revenueComponents.sms_fees ? totalSmsFees : 0) +
    (revenueComponents.processing_fees ? processingFees : 0)
  );
  // Combined Account Total — see the AccountSummary field's own comment.
  // totalSavings/totalSusu are the GROSS lifetime-deposit figures (not the
  // net accounts.balance) — required for Account Balance below to net out
  // correctly against Total Withdrawals without double-subtracting.
  const combinedTotal = round2(totalSavings + totalSusu + totalRevenue);

  const loansDisbursed = sum(loanPrincipalRows, "principal");
  const loanRepayments = sum(repaymentRows, "amount");
  const totalExpenditures = sum(expenditureRows, "amount");

  // Only subtract Loan Interest back out of Loan Repayments if it was
  // actually folded into Total Revenue (and therefore into Combined Account
  // Total) above — see the AccountSummary.accountBalance comment for why.
  const loanInterestInRevenue = revenueComponents.interest ? loanInterest : 0;
  const accountBalance = round2(
    combinedTotal
    - totalWithdrawals
    - loansDisbursed
    + (loanRepayments - loanInterestInRevenue)
    - totalExpenditures
  );

  const rawCashAtBank = round2(
    (bankTxnRows ?? []).reduce((s, t) => {
      const row = t as { type: string; amount: number };
      return row.type === "deposit" ? s + Number(row.amount ?? 0) : s - Number(row.amount ?? 0);
    }, 0)
  );
  // Neither figure is ever allowed to show negative — cashAtBank + cashAtHand
  // always equals accountBalance exactly when accountBalance is non-negative.
  const cashAtBank = Math.max(0, Math.min(rawCashAtBank, accountBalance));
  const cashAtHand = Math.max(0, round2(accountBalance - cashAtBank));

  return {
    totalSavings,
    totalSusu,
    loanInterest,
    commission,
    susuFees,
    cardFees,
    totalSmsFees,
    processingFees,
    totalRevenue,
    combinedTotal,
    totalWithdrawals,
    withdrawalPrincipal,
    revenueWithdrawals,
    loansDisbursed,
    loanRepayments,
    totalExpenditures,
    susuFeesSwept,
    accountBalance,
    cashAtBank,
    cashAtHand,
  };
}
