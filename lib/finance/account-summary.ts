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
  // Combined Account Total = Total Savings + Total Daily Susu — gross
  // deposits across every savings/susu account, full stop. Deliberately
  // does NOT add Total Revenue anymore (it briefly did, on an earlier
  // request) — the PFS Consolidated Fund is a real savings account now
  // (0074_consolidated_fund_finance_link.sql), so revenue that's actually
  // been swept into it already counts once, correctly, via ordinary
  // savings-deposit accounting (its dep is part of Total Savings like any
  // other account's). Adding Total Revenue on top of that would double-
  // count whatever's already been swept. Revenue NOT yet swept simply
  // isn't counted here at all — see Account Balance below for the same
  // consequence carried through to that figure.
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
  // Sum of `current_balance` (principal + interest still owed, per
  // record_loan_repayment()'s own running balance — see 0007_loan_rpcs.sql)
  // across every loan that's been disbursed but hasn't finished repaying:
  // status 'active' or 'defaulted'. Excludes 'completed' (current_balance is
  // already 0 there) and 'pending'/'rejected' (current_balance is never set
  // — nothing's been disbursed yet). Not an input to accountBalance — purely
  // a reporting figure ("Repayment Remaining" on the Overview dashboard).
  repaymentRemaining: number;
  // Lifetime sum of the expenditures table. Every expenditure is now a
  // real withdrawal from the PFS Consolidated Fund
  // (0074_consolidated_fund_finance_link.sql), already counted via
  // totalWithdrawals — NOT an input to accountBalance below (would double-
  // count that same cash). Exposed purely for reporting.
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
  // Account Balance = Combined Account Total − Total Withdrawals
  //                    − Loans Disbursed + Loan Repayments
  //
  //   Combined Account Total is now purely gross Total Savings + Total
  //   Daily Susu (see that field's own comment) — no revenue mixed in.
  //   Total Withdrawals still nets out withdrawalPrincipal (cash that left
  //   the business) plus revenueWithdrawals (commission/susuFees/SMS/
  //   processing fees deducted from a client's balance). Because those fee
  //   components are no longer added anywhere in Combined Account Total,
  //   subtracting them here is a real, one-directional reduction — not a
  //   cancelling one — for exactly as long as that fee sits un-swept. The
  //   PFS Consolidated Fund is a real savings account
  //   (0074_consolidated_fund_finance_link.sql): the moment any revenue
  //   (those fees, Card Fees, or anything else) is actually deposited into
  //   it via Deposit Revenue, that same amount flows straight back into
  //   Account Balance through ordinary savings-deposit accounting (Total
  //   Savings → Combined Account Total), self-correcting the dip. On
  //   request: unswept revenue deliberately does NOT count as cash on hand
  //   here — it forces revenue to actually be swept before it "counts."
  //
  //   Loan Repayments is added back in FULL now (principal + interest
  //   together, no separate interest subtraction) — unlike Card Fees/
  //   commission/etc., loan interest was never added anywhere in Combined
  //   Account Total in the first place, so there's nothing to avoid
  //   double-counting against. Loans Disbursed/Loan Repayments sit outside
  //   the accounts ledger entirely (activate_loan()/record_loan_repayment()
  //   never touch any account balance), so, same as before this change,
  //   they're netted here directly regardless of what's been swept.
  //
  //   No separate Expenditures term anymore: every expenditure is now a
  //   real withdrawal from the Consolidated Fund (see totalExpenditures'
  //   own comment below), and withdrawalRows has no per-account scoping —
  //   it's every withdrawal ever, fund included — so that cash is already
  //   subtracted once via Total Withdrawals. Subtracting totalExpenditures
  //   again here would double-count it.
  //
  //   NOTE: this is only exactly correct when Combined Account Total's
  //   Total Savings/Total Daily Susu inputs stay GROSS (lifetime deposits,
  //   never reduced by a withdrawal) — using the net per-account `balance`
  //   column here instead would double-subtract withdrawal principal (once
  //   inside that net balance, again via Total Withdrawals).
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
 *   Combined Account Total = Total Savings + Total Daily Susu — gross,
 *                            no revenue mixed in — see the
 *                            AccountSummary.combinedTotal comment.
 *   Total Withdrawals      = Transactional Withdrawals (withdrawalPrincipal)
 *                            + Revenue Withdrawals (revenueWithdrawals) —
 *                            see those fields' own comments.
 *   Account Balance        = Combined Account Total − Total Withdrawals
 *                            − Loans Disbursed + Loan Repayments — see the
 *                            AccountSummary.accountBalance comment for why
 *                            un-swept revenue deliberately doesn't count
 *                            here until it's actually deposited into the
 *                            PFS Consolidated Fund.
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
    { data: outstandingLoanRows },
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
    // Repayment Remaining — see the AccountSummary.repaymentRemaining
    // comment. Only loans still being paid off; 'completed' is excluded
    // (current_balance already 0) and 'pending'/'rejected' never had a
    // current_balance seeded.
    supabase.from("loans").select("current_balance").in("status", ["active", "defaulted"]),
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
  // Deliberately excludes totalRevenue now — see that field's comment.
  const combinedTotal = round2(totalSavings + totalSusu);

  const loansDisbursed = sum(loanPrincipalRows, "principal");
  const loanRepayments = sum(repaymentRows, "amount");
  const repaymentRemaining = sum(outstandingLoanRows, "current_balance");
  // Exposed for reporting; NOT an input to accountBalance below — every
  // expenditure is now a real withdrawal from the PFS Consolidated Fund
  // (0074_consolidated_fund_finance_link.sql), already counted once via
  // totalWithdrawals (withdrawalRows has no per-account scoping — it's
  // every withdrawal, fund included). Subtracting this too would double-
  // count the exact same cash leaving the fund.
  const totalExpenditures = sum(expenditureRows, "amount");

  const accountBalance = round2(
    combinedTotal
    - totalWithdrawals
    - loansDisbursed
    + loanRepayments
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
    repaymentRemaining,
    totalExpenditures,
    susuFeesSwept,
    accountBalance,
    cashAtBank,
    cashAtHand,
  };
}
