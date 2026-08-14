import { createClient } from "@/lib/supabase/server";
import { round2 } from "@/lib/loan";
import { MOMO_TYPES, type MomoTransactionType } from "@/lib/momo/types";

// Single source of truth for MoMo's own Overview stat cards. Deliberately a
// separate file from lib/finance/account-summary.ts, and must never import
// from (or be imported by) it — see momo-mini-app-brief.md §7. There's no
// wallet or balance to reconcile here, so this is nothing more than a
// sum(charge) over momo_transactions, grouped by type.

export interface MomoTypeBreakdown {
  type: MomoTransactionType;
  label: string;
  count: number;
  charge: number;
}

export interface MomoSummary {
  transactionCount: number;
  totalCharge: number;
  byType: MomoTypeBreakdown[];
}

export async function computeMomoSummary(
  supabase: Awaited<ReturnType<typeof createClient>>,
  range?: { from?: string; to?: string }
): Promise<MomoSummary> {
  let query = supabase
    .from("momo_transactions")
    .select("type, charge, created_at")
    .is("reversed_at", null);

  if (range?.from) query = query.gte("created_at", `${range.from}T00:00:00`);
  if (range?.to) query = query.lte("created_at", `${range.to}T23:59:59.999`);

  const { data } = await query;
  const rows = (data ?? []) as { type: MomoTransactionType; charge: number }[];

  const byType: MomoTypeBreakdown[] = MOMO_TYPES.map(({ value, label }) => {
    const forType = rows.filter((r) => r.type === value);
    return {
      type: value,
      label,
      count: forType.length,
      charge: round2(forType.reduce((s, r) => s + Number(r.charge ?? 0), 0)),
    };
  });

  return {
    transactionCount: rows.length,
    totalCharge: round2(rows.reduce((s, r) => s + Number(r.charge ?? 0), 0)),
    byType,
  };
}
