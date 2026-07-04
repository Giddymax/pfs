import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSettings } from "@/lib/settings/cache";
import type { Profile } from "@/lib/types";

interface OptedInAccount {
  id: string;
  client_id: string;
  balance: number;
  account_number: string;
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Only an admin can run SMS deductions" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const month = body?.month as string | undefined;
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "month is required (YYYY-MM)" }, { status: 400 });
  }

  // End-of-month constraint
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  if (month > thisMonth) {
    return NextResponse.json({ error: "Cannot charge SMS fees for a future month" }, { status: 400 });
  }
  if (month === thisMonth) {
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const cutoff = lastDay - 6; // last 7 days
    if (now.getDate() < cutoff) {
      return NextResponse.json(
        { error: `SMS fees for the current month can only be charged from the ${cutoff}th onwards` },
        { status: 400 }
      );
    }
  }

  const settings = await getSettings();
  const fee = settings.sms_monthly_fee;
  if (!fee || fee <= 0) {
    return NextResponse.json({ error: "SMS monthly fee is not configured" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { count: existing } = await admin
    .from("sms_fee_charges")
    .select("*", { count: "exact", head: true })
    .eq("month", month);

  if (existing && existing > 0) {
    return NextResponse.json({ error: `SMS fees for ${month} have already been charged` }, { status: 409 });
  }

  const { data: clients } = await admin
    .from("clients")
    .select("id")
    .eq("sms_opt_in", true)
    .eq("status", "active");

  if (!clients || clients.length === 0) {
    return NextResponse.json({ ok: true, charged: 0, skipped: 0 });
  }

  const clientIds = clients.map((c) => c.id);

  const { data: accounts } = await admin
    .from("accounts")
    .select("id, client_id, balance, account_number")
    .in("client_id", clientIds)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .returns<OptedInAccount[]>();

  if (!accounts || accounts.length === 0) {
    return NextResponse.json({ ok: true, charged: 0, skipped: 0 });
  }

  const seen = new Set<string>();
  let charged = 0;
  let skipped = 0;

  for (const acct of accounts) {
    if (seen.has(acct.client_id)) continue;
    seen.add(acct.client_id);

    if (acct.balance < fee) {
      skipped++;
      continue;
    }

    const { error: txnErr } = await admin.from("transactions").insert({
      account_id: acct.id,
      client_id: acct.client_id,
      type: "fee",
      amount: fee,
      fee: 0,
      bal_after: acct.balance - fee,
      notes: `Monthly SMS fee for ${month}`,
      recorded_by: user.id,
    });

    if (txnErr) {
      skipped++;
      continue;
    }

    await admin
      .from("accounts")
      .update({ balance: acct.balance - fee })
      .eq("id", acct.id);

    await admin.from("sms_fee_charges").insert({
      client_id: acct.client_id,
      account_id: acct.id,
      month,
      amount: fee,
      charged_by: user.id,
    });

    charged++;
  }

  return NextResponse.json({ ok: true, charged, skipped, fee });
}
