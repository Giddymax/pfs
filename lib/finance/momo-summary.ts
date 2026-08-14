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

// ─────────────────────────────────────────────────────────────────────────
// Staff performance — a MoMo-scoped page, deliberately separate from PFS's
// own staff_performance() RPC (see momo-mini-app-brief.md §7: "if MoMo ever
// needs its own staff-performance view, that's a MoMo-scoped page built
// later, not an extra column bolted onto the existing one"). Every active
// profile is included even with zero transactions in the period, same as
// the PFS RPC's left-join-everyone approach; a transaction whose recorder
// has since been deleted (recorded_by null, 0064_staff_delete_set_null.sql)
// is folded into a separate "Unattributed" row rather than dropped.
//
// byType holds the sum of `amount` per type (the real GHS that moved
// through customers' MoMo wallets), not a transaction count — a staff
// member who did five GHS 20 airtime top-ups and one who did a single
// GHS 500 cash-out both show as "1 transaction" if counted, which hides
// which one actually moved more money.
// ─────────────────────────────────────────────────────────────────────────

export interface MomoStaffPerformanceRow {
  staffId: string | null;
  fullName: string;
  role: "admin" | "staff" | null;
  isActive: boolean;
  byType: Record<MomoTransactionType, number>;
  transactionCount: number;
  totalAmount: number;
  totalCharge: number;
}

const UNATTRIBUTED_ID = "unattributed";

export async function computeMomoStaffPerformance(
  supabase: Awaited<ReturnType<typeof createClient>>,
  range?: { from?: string; to?: string }
): Promise<MomoStaffPerformanceRow[]> {
  let txnQuery = supabase
    .from("momo_transactions")
    .select("recorded_by, type, amount, charge")
    .is("reversed_at", null);

  if (range?.from) txnQuery = txnQuery.gte("created_at", `${range.from}T00:00:00`);
  if (range?.to) txnQuery = txnQuery.lte("created_at", `${range.to}T23:59:59.999`);

  const [{ data: txnRows }, { data: profileRows }] = await Promise.all([
    txnQuery,
    supabase.from("profiles").select("id, full_name, role, is_active").order("full_name"),
  ]);

  const emptyByType = () => Object.fromEntries(MOMO_TYPES.map((t) => [t.value, 0])) as Record<MomoTransactionType, number>;

  const buckets = new Map<string, { byType: Record<MomoTransactionType, number>; count: number; amount: number; charge: number }>();
  for (const t of (txnRows ?? []) as { recorded_by: string | null; type: MomoTransactionType; amount: number; charge: number }[]) {
    const key = t.recorded_by ?? UNATTRIBUTED_ID;
    if (!buckets.has(key)) buckets.set(key, { byType: emptyByType(), count: 0, amount: 0, charge: 0 });
    const bucket = buckets.get(key)!;
    bucket.byType[t.type] += Number(t.amount ?? 0);
    bucket.count += 1;
    bucket.amount += Number(t.amount ?? 0);
    bucket.charge += Number(t.charge ?? 0);
  }

  const profiles = (profileRows ?? []) as { id: string; full_name: string; role: "admin" | "staff"; is_active: boolean }[];

  const rows: MomoStaffPerformanceRow[] = profiles.map((p) => {
    const bucket = buckets.get(p.id) ?? { byType: emptyByType(), count: 0, amount: 0, charge: 0 };
    return {
      staffId: p.id,
      fullName: p.full_name,
      role: p.role,
      isActive: p.is_active,
      byType: bucket.byType,
      transactionCount: bucket.count,
      totalAmount: round2(bucket.amount),
      totalCharge: round2(bucket.charge),
    };
  });

  const unattributed = buckets.get(UNATTRIBUTED_ID);
  if (unattributed && unattributed.count > 0) {
    rows.push({
      staffId: null,
      fullName: "Unattributed (deleted account)",
      role: null,
      isActive: false,
      byType: unattributed.byType,
      transactionCount: unattributed.count,
      totalAmount: round2(unattributed.amount),
      totalCharge: round2(unattributed.charge),
    });
  }

  return rows.sort((a, b) => b.totalAmount - a.totalAmount || a.fullName.localeCompare(b.fullName));
}
