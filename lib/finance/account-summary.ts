import { createClient } from "@/lib/supabase/server";
import { round2 } from "@/lib/loan";
import type { RevenueComponents } from "@/lib/types";

// PFS CONSOLIDATED FUND (client PFS/26/0133) — a company-owned savings
// account, not a real client's money. It exists to formally hold revenue
// the company has already earned, so its balance/deposits are excluded from
// Total Savings and Client Deposit Liability (counting it there would
// misrepresent company equity as money owed to a depositor), and its
// lifetime deposits are subtracted from Total Revenue (that revenue has
// been committed to the fund, not left idle). Account Balance is
// deliberately NOT adjusted for it — the money never left the business, so
// excluding it from Client Deposit Liability already keeps Account Balance
// correct without a second, redundant subtraction.
const CONSOLIDATED_FUND_ACCOUNT_NUMBER = "SAV-00079";

export interface AccountSummary {
  // Gross lifetime deposits — no withdrawals or deductions netted in. Total
  // Savings/Total Daily Susu are deliberately gross figures (see Combined
  // Account Total below). Also deliberately NOT the same value as
  // clientDepositLiability used inside accountBalance (see that field's
  // comment) — this is dep (lifetime contributions), not balance (net of
  // withdrawals/fees); Account Balance is where the netted, "what we
  // actually have" figure lives.
  totalSavings: number;
  totalSusu: number;
  // Lifetime deposits into PFS CONSOLIDATED FUND (SAV-00079) — already
  // excluded from totalSavings/Client Deposit Liability above and from
  // totalRevenue below; exposed here purely for the dedicated stat card.
  consolidatedFundDeposits: number;
  // Revenue components (each already gated by revenueComponents before it's
  // folded into totalRevenue below). This is a P&L/income view — how much
  // the company has earned — not a cash-reconciliation view.
  loanInterest: number;
  commission: number; // savings withdrawals only — susu is commission-exempt
  susuFees: number;    // ACCRUAL basis, for the P&L view — day-31 fee the
                        // moment it's contributed (whether or not the cycle
                        // has been claimed yet) + instant-route
                        // early-withdrawal penalties + paid emergency-claim
                        // penalties. See susuFeesSwept below for why this
                        // figure specifically is NOT what accountBalance uses.
  // Card Fees and SMS Fees are real cash the company receives, but — per the
  // owner's explicit classification — are NOT Company Income. Only loan
  // interest, withdrawal commission, susu fees, and loan processing fees are
  // revenue (see RevenueComponents in lib/types/index.ts). Card Fees and SMS
  // Fees are still tracked here (and still added back into accountBalance
  // below, since that's a cash-position fact, independent of P&L
  // classification) — they just don't feed totalRevenue. See
  // totalOtherReceipts for where they DO belong.
  cardFees: number;
  totalSmsFees: number;
  processingFees: number;
  // Cash received that is NOT company income — Card Fees + SMS Fees. A
  // legitimate receipt (it shows up in Account Balance same as revenue
  // does), just not profit/revenue on the P&L. Kept as its own figure so it
  // can be reported distinctly from totalRevenue rather than silently
  // folded into it.
  totalOtherReceipts: number;
  // Company Income only: loan interest + withdrawal commission + susu fees
  // + loan processing fees (each gated by revenueComponents), net of PFS
  // CONSOLIDATED FUND's lifetime deposits (see consolidatedFundDeposits and
  // CONSOLIDATED_FUND_ACCOUNT_NUMBER above) — income already committed to
  // the fund is no longer counted as available revenue. Card Fees and SMS
  // Fees are deliberately excluded — see totalOtherReceipts above.
  totalRevenue: number;
  // Combined Account Total = Total Savings + Total Daily Susu ONLY — a pure
  // client-liability figure (what's owed to depositors), deliberately not
  // mixed with Total Revenue (what the company has earned — a fundamentally
  // different pool of money; see Total Revenue above and Account Balance's
  // own comment for where revenue actually belongs).
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
  withdrawalPrincipal: number;
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
  // accountBalance can only add back money that's verifiably gone from the
  // liability figure, so it uses this, not susuFees.
  susuFeesSwept: number;
  // ─────────────────────────────────────────────────────────────────────
  // Account Balance — actual cash position, not a deposits-plus-revenue
  // figure. Built from a real balance-sheet identity:
  //
  //   Cash = Client Deposit Liability + Company Equity − Loans Receivable
  //
  //   Client Deposit Liability = Σ(accounts.balance) for savings + susu —
  //     already correctly net of that account's own withdrawals,
  //     commission, and fee deductions (recalculate_account() is the single
  //     writer for this column), so this is NOT the same as
  //     totalSavings + totalSusu (which are gross).
  //
  //   Company Equity added back = Card Fees + Commission + Processing Fees
  //     + SMS Fees. These aren't fresh income "on top of" the liability
  //     figure — Commission/Processing Fees/SMS Fees are deducted straight
  //     out of a client's account balance (verified in record_withdrawal
  //     and activate_loan), so Σ(balance) above is already lower by exactly
  //     these amounts. Adding them back here is what makes the identity
  //     balance to real, unmoved cash — omitting them would understate cash
  //     by the fee total even though no money actually left the business.
  //     Card Fees are the one genuine fresh inflow (paid in cash at
  //     registration, never netted against any account balance).
  //
  //   Loans Receivable (net) = Loans Disbursed − Loan Repayments (gross,
  //     principal + interest together). Loan Interest is deliberately NOT
  //     added a second time here — it's already part of "Loan Repayments"
  //     (a repayment is principal + interest in one cash receipt), so
  //     re-adding it would double-count the interest portion. It still
  //     shows up correctly in Total Revenue above, which is a separate,
  //     non-cash-additive P&L view.
  //
  //   Susu Fees Swept (NOT susuFees — see that field's own comment) IS added
  //     back, same reasoning as the other revenue components above —
  //     pay_susu_claim now sweeps the company's fee/penalty share out of the
  //     client's balance into a real `type='fee'` transaction at payout time
  //     (see 0059_susu_fee_sweep.sql), instead of silently leaving it
  //     sitting in Σ(balance) forever. Using the accrual figure here instead
  //     would double-count any completed-but-unclaimed cycle's fee, which is
  //     still sitting, uncollected, inside Σ(balance) above.
  //
  //   Expenditures are a real cash outflow, subtracted directly.
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
 *   Combined Account Total = Total Savings + Total Daily Susu (client
 *                            liability only — see the AccountSummary.combinedTotal
 *                            comment for why Total Revenue isn't mixed in)
 *   Account Balance        = see the AccountSummary.accountBalance comment —
 *                             a real cash-position reconciliation, not
 *                             "Combined Account Total minus Withdrawals"
 *                             (that formula had no way to account for money
 *                             out on loan, which understates nothing only
 *                             by coincidence once any loan is outstanding).
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
    { data: savingsBalanceRows },
    { data: susuBalanceRows },
    { data: loanPrincipalRows },
    { data: repaymentRows },
    { data: expenditureRows },
    { data: susuClaimPenaltyRows },
    { data: sweptFeeRows },
    { data: fundAccount },
  ] = await Promise.all([
    supabase.from("accounts").select("id, dep").eq("product_type", "savings"),
    supabase.from("accounts").select("id, dep").eq("product_type", "susu"),
    supabase.from("transactions").select("amount").eq("type", "withdrawal").is("reversed_at", null),
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
    supabase.from("accounts").select("id, balance").eq("product_type", "savings"),
    supabase.from("accounts").select("balance").eq("product_type", "susu"),
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
    // Cash actually swept out of a client's balance via pay_susu_claim's fee
    // sweep (0059_susu_fee_sweep.sql tags every sweep transaction's notes
    // this way, for both normal and emergency claims) — the cash-basis
    // figure accountBalance needs. Excludes SMS-fee `type='fee'` rows, which
    // use a different notes pattern and are already counted via smsFeeRows.
    supabase.from("transactions").select("amount").eq("type", "fee").ilike("notes", "%swept to company funds%"),
    supabase.from("accounts").select("id, dep").eq("account_number", CONSOLIDATED_FUND_ACCOUNT_NUMBER).maybeSingle(),
  ]);

  const fund = fundAccount as { id: string; dep: number } | null;
  const consolidatedFundDeposits = round2(Number(fund?.dep ?? 0));

  // Total Savings excludes PFS CONSOLIDATED FUND — see the constant's
  // comment above. Every other savings account counts normally.
  const totalSavings = round2(
    (savingsRows ?? [])
      .filter((r: { id: string }) => r.id !== fund?.id)
      .reduce((s: number, r: { dep: number }) => s + Number(r.dep ?? 0), 0)
  );
  const totalSusu = sum(susuRows, "dep");
  // Raw withdrawal principal — what clients actually walked away with in
  // hand. Kept as its own value below (not the totalWithdrawals field
  // anymore, see that field's comment) since commission/susuFees/etc. need
  // it as a building block.
  const withdrawalPrincipal = sum(withdrawalRows, "amount");

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
  const totalWithdrawals = round2(withdrawalPrincipal + commission + susuFees + totalSmsFees + processingFees);

  // Company Income only — Card Fees and SMS Fees are real receipts but not
  // revenue (see totalOtherReceipts below and the owner's classification
  // noted on RevenueComponents in lib/types/index.ts).
  const totalRevenue = round2(
    (revenueComponents.interest ? loanInterest : 0) +
    (revenueComponents.commission ? commission : 0) +
    (revenueComponents.susu_fees ? susuFees : 0) +
    (revenueComponents.processing_fees ? processingFees : 0) -
    consolidatedFundDeposits
  );
  const totalOtherReceipts = round2(cardFees + totalSmsFees);

  const combinedTotal = round2(totalSavings + totalSusu);

  const loansDisbursed = sum(loanPrincipalRows, "principal");
  const loanRepayments = sum(repaymentRows, "amount");
  const totalExpenditures = sum(expenditureRows, "amount");

  // Client Deposit Liability excludes PFS CONSOLIDATED FUND for the same
  // reason totalSavings does — it isn't money owed to a depositor.
  const savingsBalanceExclFund = round2(
    (savingsBalanceRows ?? [])
      .filter((r: { id: string }) => r.id !== fund?.id)
      .reduce((s: number, r: { balance: number }) => s + Number(r.balance ?? 0), 0)
  );
  const clientDepositLiability = round2(savingsBalanceExclFund + sum(susuBalanceRows, "balance"));
  const accountBalance = round2(
    clientDepositLiability
    + cardFees
    + commission
    + processingFees
    + totalSmsFees
    + susuFeesSwept
    - loansDisbursed
    + loanRepayments
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
    consolidatedFundDeposits,
    loanInterest,
    commission,
    susuFees,
    cardFees,
    totalSmsFees,
    processingFees,
    totalOtherReceipts,
    totalRevenue,
    combinedTotal,
    totalWithdrawals,
    withdrawalPrincipal,
    loansDisbursed,
    loanRepayments,
    totalExpenditures,
    susuFeesSwept,
    accountBalance,
    cashAtBank,
    cashAtHand,
  };
}
