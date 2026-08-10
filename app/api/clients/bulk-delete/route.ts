import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { round2 } from "@/lib/loan";

// Executes a mass client delete. Re-verifies every id server-side against
// the *current* balance/active-loan state rather than trusting whatever the
// browser last saw in the preview — state can drift between preview and
// confirm (e.g. a deposit lands in that window), and this is irreversible.
export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<{ role: string }>();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((id: unknown) => typeof id === "string") : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "No client ids provided" }, { status: 400 });
  }

  const { data: clients, error: clientsError } = await supabase
    .from("clients")
    .select("id, client_code, full_name")
    .in("id", ids)
    .returns<{ id: string; client_code: string; full_name: string }[]>();
  if (clientsError) return NextResponse.json({ error: clientsError.message }, { status: 400 });

  const nameById = new Map((clients ?? []).map((c) => [c.id, `${c.client_code} — ${c.full_name}`]));
  const missingIds = ids.filter((id) => !nameById.has(id));

  const [{ data: accounts }, { data: activeLoans }] = await Promise.all([
    supabase.from("accounts").select("client_id, balance").in("client_id", ids),
    supabase.from("loans").select("client_id").in("client_id", ids).eq("status", "active"),
  ]);

  const balanceByClient = new Map<string, number>();
  for (const a of (accounts ?? []) as { client_id: string; balance: number }[]) {
    balanceByClient.set(a.client_id, round2((balanceByClient.get(a.client_id) ?? 0) + Number(a.balance ?? 0)));
  }
  const activeLoanClientIds = new Set(((activeLoans ?? []) as { client_id: string }[]).map((l) => l.client_id));

  const skipped: { id: string; name: string; reason: string }[] = [];
  const safeIds: string[] = [];

  for (const id of ids) {
    if (missingIds.includes(id)) continue; // already deleted/nonexistent — nothing to do
    const balance = balanceByClient.get(id) ?? 0;
    const hasActiveLoan = activeLoanClientIds.has(id);
    if (balance !== 0 || hasActiveLoan) {
      const reasons: string[] = [];
      if (hasActiveLoan) reasons.push("has an active loan");
      if (balance !== 0) reasons.push(`has a balance of GHS ${balance.toFixed(2)}`);
      skipped.push({ id, name: nameById.get(id) ?? id, reason: reasons.join(" and ") });
      continue;
    }
    safeIds.push(id);
  }

  let deletedCount = 0;
  if (safeIds.length > 0) {
    const { error: deleteError, count } = await supabase
      .from("clients")
      .delete({ count: "exact" })
      .in("id", safeIds);
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 });
    deletedCount = count ?? safeIds.length;
  }

  return NextResponse.json({ deletedCount, deletedIds: safeIds, skipped });
}
