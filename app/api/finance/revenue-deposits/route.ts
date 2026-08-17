import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeAccountSummary } from "@/lib/finance/account-summary";
import { getSettings } from "@/lib/settings/cache";
import type { Profile } from "@/lib/types";

const DEFAULT_REVENUE_COMPONENTS = {
  interest: true,
  commission: true,
  susu_fees: true,
  card_fees: true,
  sms_fees: true,
  processing_fees: true,
};

export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<Pick<Profile, "role">>();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Only an admin can record a deposit from revenue" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const amount = Number(body?.amount);
  const notes = typeof body?.notes === "string" ? body.notes.trim() || null : null;

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Amount must be greater than zero" }, { status: 400 });
  }

  // Don't let a deposit exceed Total Revenue — same defensive spirit as
  // record_withdrawal's insufficient-balance check, just computed here
  // instead of in SQL, since the "available revenue" figure already lives in
  // lib/finance/account-summary.ts and duplicating that formula in SQL would
  // risk the two drifting apart. (There's no more "Net Revenue" tracking
  // what's already been deposited — that concept was removed on request —
  // so this is a flat cap against everything ever earned, not a running
  // balance.)
  const settings = await getSettings();
  const rc = { ...DEFAULT_REVENUE_COMPONENTS, ...(settings.overview_kpi?.total_revenue?.components ?? {}) };
  const { totalRevenue } = await computeAccountSummary(supabase, rc);
  if (amount > totalRevenue) {
    return NextResponse.json(
      { error: `Cannot deposit more than the available Total Revenue of ${totalRevenue.toFixed(2)}` },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("revenue_deposits")
    .insert({ amount, notes, recorded_by: user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ deposit: data });
}
