import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings/cache";
import { shouldSendClientSms } from "@/lib/sms/gating";
import { sendSms } from "@/lib/sms/arkesel";
import { smsTemplates } from "@/lib/sms/templates";

interface PayoutResult {
  claim_id: string;
  account_id: string;
  client_id: string;
  client_full_name: string;
  client_phone: string;
  amount: number;
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data, error } = await supabase
    .rpc("pay_susu_claim", { p_claim_id: id, p_paid_by: user.id })
    .single<PayoutResult>();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await notifyClaimPaid(supabase, data);
  return NextResponse.json({ payout: data });
}

async function notifyClaimPaid(supabase: Awaited<ReturnType<typeof createClient>>, payout: PayoutResult) {
  const { data: client } = await supabase
    .from("clients")
    .select("sms_opt_in")
    .eq("id", payout.client_id)
    .maybeSingle<{ sms_opt_in: boolean }>();
  if (!client) return;

  const settings = await getSettings();
  if (!shouldSendClientSms("susu", client, settings)) return;

  await sendSms({
    to: payout.client_phone,
    message: smsTemplates.susuClaimPaid(payout.client_full_name, payout.amount),
    event: "susu_claim_paid",
    recipientType: "client",
    relatedClientId: payout.client_id,
  });
}
