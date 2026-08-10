import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { round2 } from "@/lib/loan";

const VALID_STATUSES = ["active", "inactive", "dormant", "suspended"];

function nextDayISO(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10) + "T00:00:00.000Z";
}

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
  const from = typeof body?.from === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.from) ? body.from : null;
  const to = typeof body?.to === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.to) ? body.to : null;
  const statuses: string[] = Array.isArray(body?.statuses)
    ? body.statuses.filter((s: unknown) => typeof s === "string" && VALID_STATUSES.includes(s))
    : [];
  const zeroBalanceOnly = body?.zero_balance_only === true;

  if (!from && !to && statuses.length === 0 && !zeroBalanceOnly) {
    return NextResponse.json({ error: "Set at least one filter before searching" }, { status: 400 });
  }

  let query = supabase
    .from("clients")
    .select("id, client_code, full_name, phone, status, created_at")
    .order("created_at", { ascending: false });

  if (from) query = query.gte("created_at", `${from}T00:00:00.000Z`);
  if (to) query = query.lt("created_at", nextDayISO(to));
  if (statuses.length > 0) query = query.in("status", statuses);

  const { data: clients, error } = await query.returns<
    { id: string; client_code: string; full_name: string; phone: string; status: string; created_at: string }[]
  >();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (!clients || clients.length === 0) {
    return NextResponse.json({ candidates: [] });
  }

  const ids = clients.map((c) => c.id);

  const [{ data: accounts }, { data: activeLoans }] = await Promise.all([
    supabase.from("accounts").select("client_id, balance").in("client_id", ids),
    supabase.from("loans").select("client_id").in("client_id", ids).eq("status", "active"),
  ]);

  const balanceByClient = new Map<string, number>();
  const accountCountByClient = new Map<string, number>();
  for (const a of (accounts ?? []) as { client_id: string; balance: number }[]) {
    balanceByClient.set(a.client_id, round2((balanceByClient.get(a.client_id) ?? 0) + Number(a.balance ?? 0)));
    accountCountByClient.set(a.client_id, (accountCountByClient.get(a.client_id) ?? 0) + 1);
  }
  const activeLoanClientIds = new Set(
    ((activeLoans ?? []) as { client_id: string }[]).map((l) => l.client_id)
  );

  let candidates = clients.map((c) => {
    const totalBalance = balanceByClient.get(c.id) ?? 0;
    const accountsCount = accountCountByClient.get(c.id) ?? 0;
    const hasActiveLoan = activeLoanClientIds.has(c.id);
    return {
      id: c.id,
      client_code: c.client_code,
      full_name: c.full_name,
      phone: c.phone,
      status: c.status,
      created_at: c.created_at,
      total_balance: totalBalance,
      accounts_count: accountsCount,
      has_active_loan: hasActiveLoan,
    };
  });

  if (zeroBalanceOnly) {
    candidates = candidates.filter((c) => c.total_balance === 0);
  }

  const result = candidates.map((c) => {
    const reasons: string[] = [];
    if (c.has_active_loan) reasons.push("has an active loan");
    if (c.total_balance !== 0) reasons.push(`has a balance of GHS ${c.total_balance.toFixed(2)}`);
    return {
      ...c,
      deletable: reasons.length === 0,
      block_reason: reasons.length > 0 ? reasons.join(" and ") : null,
    };
  });

  return NextResponse.json({ candidates: result });
}
