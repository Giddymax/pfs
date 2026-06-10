import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings/cache";
import { shouldSendAdminSms, shouldSendClientSms } from "@/lib/sms/gating";
import { sendSms } from "@/lib/sms/arkesel";
import { smsTemplates } from "@/lib/sms/templates";
import type { Client, Transaction } from "@/lib/types";

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const accountId = body?.account_id;
  const amount = Number(body?.amount);

  if (!accountId || typeof accountId !== "string") {
    return NextResponse.json({ error: "account_id is required" }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Amount must be greater than zero" }, { status: 400 });
  }

  const { data, error } = await supabase
    .rpc("record_susu_partial_withdrawal", {
      p_account_id: accountId,
      p_amount: amount,
      p_recorded_by: user.id,
    })
    .single<Transaction>();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await notifySusuWithdrawal(supabase, data);
  return NextResponse.json({ transaction: data });
}

async function notifySusuWithdrawal(supabase: Awaited<ReturnType<typeof createClient>>, txn: Transaction) {
  const { data: client } = await supabase.from("clients").select("*").eq("id", txn.client_id).single<Client>();
  if (!client) return;

  const settings = await getSettings();
  const msg = smsTemplates.susuWithdrawalRecorded(client.full_name, txn.amount, txn.bal_after);

  if (shouldSendClientSms("withdrawal", client, settings)) {
    await sendSms({ to: client.phone, message: msg, event: "susu_withdrawal_recorded", recipientType: "client", relatedClientId: client.id });
  }

  if (shouldSendAdminSms(settings)) {
    await sendSms({ to: settings.sms.company_tel!, message: msg, event: "susu_withdrawal_recorded_admin", recipientType: "admin", relatedClientId: client.id });
  }
}
