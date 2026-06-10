import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings/cache";
import { shouldSendClientSms } from "@/lib/sms/gating";
import { sendSms } from "@/lib/sms/arkesel";
import { smsTemplates } from "@/lib/sms/templates";
import type { Client, Profile, SusuClaim } from "@/lib/types";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Only an admin can reject an emergency claim" }, { status: 403 });
  }

  const { data, error } = await supabase
    .rpc("reject_emergency_claim", { p_claim_id: id, p_rejected_by: user.id })
    .single<SusuClaim>();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await notifyClaimRejected(supabase, data);
  return NextResponse.json({ claim: data });
}

async function notifyClaimRejected(supabase: Awaited<ReturnType<typeof createClient>>, claim: SusuClaim) {
  const { data: account } = await supabase.from("accounts").select("client_id").eq("id", claim.account_id).single<{ client_id: string }>();
  if (!account) return;
  const { data: client } = await supabase.from("clients").select("*").eq("id", account.client_id).single<Client>();
  if (!client) return;

  const settings = await getSettings();
  if (!shouldSendClientSms("susu", client, settings)) return;

  await sendSms({
    to: client.phone,
    message: smsTemplates.susuClaimRejected(client.full_name),
    event: "susu_claim_rejected",
    recipientType: "client",
    relatedClientId: client.id,
  });
}
