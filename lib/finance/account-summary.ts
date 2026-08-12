import { createClient } from "@/lib/supabase/server";
import { round2 } from "@/lib/loan";
import type { RevenueComponents } from "@/lib/types";

export interface AccountSummary {
  // Gross lifetime deposits — no withdrawals or deductions netted in. This
  // is deliberate, not an oversight: Combined Account Total (below) is a
  // GROSS figure, and Withdrawals nets it down exactly once to produce
  // Account Balance. If these used current per-account balance instead
  // (already net of that account's own withdrawals/commission), Account
  // Balance would subtract total withdrawals a second time. Do not swap
  // this for `balance` without also removing the withdrawals subtraction.
  totalSavings: number;
  totalSusu: number;
  // Revenue components (each already gated by revenueComponents before it's
  // folded into totalRevenue below).
  loanInterest: number;
  commission: number; // savings withdrawals only — susu is commission-exempt
  susuFees: number;    // day-31 company fee + susu early-withdrawal penalties
  cardFees: number;
  totalSmsFees: number;
  processingFees: number;
  totalRevenue: number;
  // Combined Account Total = Total Savings + Total Daily Susu + Total Revenue
  combinedTotal: number;
  // Total withdrawn across all accounts, all time, excluding reversed txns.
  totalWithdrawals: number;
  // Account Balance = Combined Account Total - Withdrawals
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
 * Overview dashboard, the Bank page, and the Finance page — every page that
 * shows "Total Savings", "Total Daily Susu", "Total Revenue", "Combined
 * Account Total", "Account Balance", "Total Withdrawals", "Cash at Bank", or
 * "Cash at Hand" calls this same function, so those figures can never drift
 * between screens.
 *
 *   Combined Account Total      = Total Savings + Total Daily Susu + Total Revenue
 *   Account Balance             = Combined Account Total - Withdrawals
 *   Cash at Hand + Cash at Bank = Account Balance
 *
 * Total Savings/Total Daily Susu are gross deposits (accounts.dep), not
 * current balance — see the AccountSummary field comment for why: it keeps
 * "Withdrawals" from being subtracted twice (once implicitly inside a
 * balance figure, once explicitly here).
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
  ] = await Promise.all([
    supabase.from("accounts").select("id, dep").eq("product_type", "savings"),
    supabase.from("accounts").select("id, dep").eq("product_type", "susu"),
    supabase.from("transactions").select("amount").eq("type", "withdrawal").is("reversed_at", null),
    supabase.from("transactions").select("fee, account_id").eq("type", "withdrawal").is("reversed_at", null),
    supabase.from("susu_payments").select("amount").eq("day_in_cycle", 31),
    supabase.from("card_fees").select("amount"),
    supabase.from("sms_fee_charges").select("amount"),
    supabase.from("loans").select("processing_fee"),
    supabase.rpc("compute_collected_loan_interest"),
    supabase.from("bank_transactions").select("type, amount"),
  ]);

  const totalSavings = sum(savingsRows, "dep");
  const totalSusu = sum(susuRows, "dep");
  const totalWithdrawals = sum(withdrawalRows, "amount");

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
  const susuFees = round2(sum(susuFeeRows, "amount") + susuEarlyWithdrawalFee);
  const cardFees = sum(cardFeeRows, "amount");
  const totalSmsFees = sum(smsFeeRows, "amount");
  const processingFees = sum(processingFeeRows, "processing_fee");
  const loanInterest = round2(Number(collectedInterest ?? 0));

  const totalRevenue = round2(
    (revenueComponents.interest ? loanInterest : 0) +
    (revenueComponents.commission ? commission : 0) +
    (revenueComponents.susu_fees ? susuFees : 0) +
    (revenueComponents.card_fees ? cardFees : 0) +
    (revenueComponents.sms_fees ? totalSmsFees : 0) +
    (revenueComponents.processing_fees ? processingFees : 0)
  );

  const combinedTotal = round2(totalSavings + totalSusu + totalRevenue);
  const accountBalance = round2(combinedTotal - totalWithdrawals);

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
    accountBalance,
    cashAtBank,
    cashAtHand,
  };
}
