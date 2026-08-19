import { createClient } from "@/lib/supabase/server";
import type { SusuClaim, SusuCycle } from "@/lib/types";

export interface SusuQualification {
  cycles: SusuCycle[];
  claims: SusuClaim[];
  // The cycle currently in progress, if any.
  activeCycle: SusuCycle | null;
  // A completed, unclaimed cycle the client can draw a normal (commission-
  // exempt) withdrawal against.
  normalCycle: SusuCycle | null;
  // The in-progress cycle an emergency (early) withdrawal would apply to —
  // null once one has already been claimed/paid for that cycle.
  emergencyCycle: SusuCycle | null;
  // True only when a complete, unclaimed cycle exists and the account still
  // holds a positive balance.
  isQualified: boolean;
}

/**
 * Single source of truth for whether a susu account qualifies for a normal
 * withdrawal vs. only an emergency one — used by both the account detail
 * page and the account-picker withdrawal-context API route, so the
 * qualification rule can never drift between the two entry points.
 */
export async function computeSusuQualification(
  supabase: Awaited<ReturnType<typeof createClient>>,
  accountId: string,
  accountBalance: number
): Promise<SusuQualification> {
  const [{ data: cycleRows }, { data: claimRows }] = await Promise.all([
    supabase.from("susu_cycles").select("*").eq("account_id", accountId).order("cycle_number", { ascending: false }).returns<SusuCycle[]>(),
    supabase.from("susu_claims").select("*").eq("account_id", accountId).order("requested_at", { ascending: false }).returns<SusuClaim[]>(),
  ]);

  const cycles = cycleRows ?? [];
  const claims = claimRows ?? [];

  const activeCycle = cycles.find((c) => c.status === "in_progress") ?? null;
  const liveClaimStatuses: SusuClaim["status"][] = ["pending_admin", "approved"];
  const claimedCycleIds = new Set(
    claims.filter((c) => liveClaimStatuses.includes(c.status) || c.status === "paid").map((c) => c.cycle_id)
  );
  const normalCycle = cycles.find((c) => c.status === "complete" && !claimedCycleIds.has(c.id)) ?? null;
  const emergencyCycle =
    activeCycle && !claims.some((c) => c.cycle_id === activeCycle.id && c.claim_type === "emergency" && c.status !== "rejected")
      ? activeCycle
      : null;

  // Qualified only when a complete unclaimed cycle exists (full 31-day cycle finished)
  const isQualified = accountBalance > 0 && normalCycle !== null;

  return { cycles, claims, activeCycle, normalCycle, emergencyCycle, isQualified };
}
