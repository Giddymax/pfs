import { createClient } from "@/lib/supabase/server";
import { round2 } from "@/lib/loan";
import { MOMO_TYPES, type MomoTransactionType } from "@/lib/momo/types";

// Single source of truth for MoMo's own Overview stat cards. Deliberately a
// separate file from lib/finance/account-summary.ts, and must never import
// from (or be imported by) it — see momo-mini-app-brief.md §7. There's no
// wallet or balance to reconcile here, so this is nothing more than a
// sum(amount)/sum(charge) over momo_transactions, grouped by type. amount
// and charge are two distinct figures (0063_momo_transactions_amount.sql):
// amount is the principal that moved through the customer's MoMo wallet,
// charge is what PFS billed for facilitating it — totalCharge, not
// totalAmount, is MoMo's revenue figure.

export interface MomoTypeBreakdown {
  type: MomoTransactionType;
  label: string;
  count: number;
  amount: number;
  charge: number;
}

export interface MomoSummary {
  transactionCount: number;
  totalAmount: number;
  totalCharge: number;
  byType: MomoTypeBreakdown[];
}

export async function computeMomoSummary(
  supabase: Awaited<ReturnType<typeof createClient>>,
  range?: { from?: string; to?: string }
): Promise<MomoSummary> {
  let query = supabase
    .from("momo_transactions")
    .select("type, amount, charge, created_at")
    .is("reversed_at", null);

  if (range?.from) query = query.gte("created_at", `${range.from}T00:00:00`);
  if (range?.to) query = query.lte("created_at", `${range.to}T23:59:59.999`);

  const { data } = await query;
  const rows = (data ?? []) as { type: MomoTransactionType; amount: number; charge: number }[];

  const byType: MomoTypeBreakdown[] = MOMO_TYPES.map(({ value, label }) => {
    const forType = rows.filter((r) => r.type === value);
    return {
      type: value,
      label,
      count: forType.length,
      amount: round2(forType.reduce((s, r) => s + Number(r.amount ?? 0), 0)),
      charge: round2(forType.reduce((s, r) => s + Number(r.charge ?? 0), 0)),
    };
  });

  return {
    transactionCount: rows.length,
    totalAmount: round2(rows.reduce((s, r) => s + Number(r.amount ?? 0), 0)),
    totalCharge: round2(rows.reduce((s, r) => s + Number(r.charge ?? 0), 0)),
    byType,
  };
}
