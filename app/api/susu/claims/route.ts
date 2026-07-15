import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings/cache";
import { shouldSendAdminSms } from "@/lib/sms/gating";
import { sendSms } from "@/lib/sms/arkesel";
import { smsTemplates } from "@/lib/sms/templates";
import type { Client, SusuClaim } from "@/lib/types";

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const accountId = body?.account_id;
  const cycleId = body?.cycle_id;
  const claimType = body?.claim_type;
  const reason = typeof body?.reason === "string" ? body.reason.trim() : undefined;

  if (!accountId || typeof accountId !== "string") {
    return NextResponse.json({ error: "account_id is required" }, { status: 400 });
  }
  if (!cycleId || typeof cycleId !== "string") {
    return NextResponse.json({ error: "cycle_id is required" }, { status: 400 });
  }
  if (claimType !== "normal" && claimType !== "emergency") {
    return NextResponse.json({ error: "claim_type must be 'normal' or 'emergency'" }, { status: 400 });
  }

  const rpcName = claimType === "normal" ? "request_normal_claim" : "request_emergency_claim";

  const { data, error } = await supabase
    .rpc(rpcName, {
      p_account_id: accountId,
      p_cycle_id: cycleId,
      p_requested_by: user.id,
    })
    .single<SusuClaim>();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (claimType === "emergency") await notifyEmergencyClaimAdmin(supabase, data, reason);
  return NextResponse.json({ claim: data });
}

async function notifyEmergencyClaimAdmin(supabase: Awaited<ReturnType<typeof createClient>>, claim: SusuClaim, reason?: string) {
  const settings = await getSettings();
  if (!shouldSendAdminSms(settings, "withdrawal")) return;

  const { data: account } = await supabase.from("accounts").select("client_id").eq("id", claim.account_id).single<{ client_id: string }>();
  if (!account) return;
  const { data: client } = await supabase.from("clients").select("*").eq("id", account.client_id).single<Client>();
  if (!client) return;

  await sendSms({
    to: settings.sms.company_tel!,
    message: smsTemplates.adminEmergencyClaimAlert(client.full_name, claim.amount, reason),
    event: "susu_emergency_claim_admin_alert",
    recipientType: "admin",
    relatedClientId: client.id,
  });
}
