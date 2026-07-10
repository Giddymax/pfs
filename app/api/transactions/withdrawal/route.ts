import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings/cache";
import { shouldSendAdminSms, shouldSendClientSms } from "@/lib/sms/gating";
import { sendSms } from "@/lib/sms/arkesel";
import { smsTemplates } from "@/lib/sms/templates";
import type { Account, Client, Transaction } from "@/lib/types";

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const accountId = body?.account_id;
  const amount = Number(body?.amount);
  const notes = typeof body?.notes === "string" ? body.notes.trim() || null : null;
  const proxyName = typeof body?.proxy_name === "string" ? body.proxy_name.trim() || null : null;
  const rawTs = typeof body?.created_at === "string" ? body.created_at.trim() : null;
  const customTs = rawTs && !isNaN(new Date(rawTs).getTime()) ? new Date(rawTs).toISOString() : null;

  if (!accountId || typeof accountId !== "string") {
    return NextResponse.json({ error: "account_id is required" }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Amount must be greater than zero" }, { status: 400 });
  }

  const { data, error } = await supabase
    .rpc("record_withdrawal", {
      p_account_id: accountId,
      p_amount: amount,
      p_recorded_by: user.id,
      p_notes: notes,
      p_created_at: customTs,
    })
    .single<Transaction>();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await notifyWithdrawal(supabase, data, proxyName);
  return NextResponse.json({ transaction: data });
}

async function notifyWithdrawal(supabase: Awaited<ReturnType<typeof createClient>>, txn: Transaction, proxyName: string | null) {
  const [{ data: client }, { data: account }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", txn.client_id).single<Client>(),
    supabase.from("accounts").select("*").eq("id", txn.account_id).single<Account>(),
  ]);
  if (!client || !account) return;

  const settings = await getSettings();
  const msg = smsTemplates.withdrawalRecorded(client.full_name, txn.amount, txn.fee, txn.bal_after, account.account_number, proxyName);

  if (shouldSendClientSms("withdrawal", client, settings)) {
    await sendSms({ to: client.phone, message: msg, event: "withdrawal_recorded", recipientType: "client", relatedClientId: client.id });
  }

  if (shouldSendAdminSms(settings)) {
    await sendSms({ to: settings.sms.company_tel!, message: msg, event: "withdrawal_recorded_admin", recipientType: "admin", relatedClientId: client.id });
  }
}
