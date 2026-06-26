import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { invalidateSettingsCache } from "@/lib/settings/cache";
import type { CommissionTier, Profile, SmsSettings } from "@/lib/types";

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Only an admin can change settings" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const commissionTiers = body?.commission_tiers as CommissionTier[] | undefined;
  const sms = body?.sms as SmsSettings | undefined;
  const cardFeeAmount = Number(body?.card_fee_amount);
  const fdTermsMonths = body?.fd_terms_months as number[] | undefined;
  const smsMonthlyFee = Number(body?.sms_monthly_fee);

  if (!Array.isArray(commissionTiers)) {
    return NextResponse.json({ error: "commission_tiers must be an array" }, { status: 400 });
  }
  if (!sms || typeof sms !== "object") {
    return NextResponse.json({ error: "sms settings are required" }, { status: 400 });
  }
  if (!Number.isFinite(cardFeeAmount) || cardFeeAmount < 0) {
    return NextResponse.json({ error: "card_fee_amount cannot be negative" }, { status: 400 });
  }
  if (!Array.isArray(fdTermsMonths)) {
    return NextResponse.json({ error: "fd_terms_months must be an array" }, { status: 400 });
  }
  if (!Number.isFinite(smsMonthlyFee) || smsMonthlyFee < 0) {
    return NextResponse.json({ error: "sms_monthly_fee cannot be negative" }, { status: 400 });
  }

  const updates = [
    { key: "commission_tiers", value: commissionTiers },
    { key: "sms", value: sms },
    { key: "card_fee_amount", value: cardFeeAmount },
    { key: "fd_terms_months", value: fdTermsMonths },
    { key: "sms_monthly_fee", value: smsMonthlyFee },
  ];

  for (const update of updates) {
    const { error } = await supabase
      .from("settings")
      .upsert({ ...update, updated_by: user.id, updated_at: new Date().toISOString() });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  invalidateSettingsCache();
  return NextResponse.json({ ok: true });
}
