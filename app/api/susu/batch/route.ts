import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings/cache";
import { shouldSendAdminSms, shouldSendClientSms } from "@/lib/sms/gating";
import { sendSms } from "@/lib/sms/arkesel";
import { smsTemplates } from "@/lib/sms/templates";
import type { Client, SusuPayment } from "@/lib/types";

interface BatchEntry {
  amount: number;
  payment_date: string | null;
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const accountId = body?.account_id;
  const rawEntries = Array.isArray(body?.entries) ? body.entries : null;

  if (!accountId || typeof accountId !== "string") {
    return NextResponse.json({ error: "account_id is required" }, { status: 400 });
  }
  if (!rawEntries || rawEntries.length === 0) {
    return NextResponse.json({ error: "At least one entry is required" }, { status: 400 });
  }
  if (rawEntries.length > 93) {
    return NextResponse.json({ error: "A batch cannot contain more than 93 day-entries (3 cycles)" }, { status: 400 });
  }

  const entries: BatchEntry[] = [];
  for (const raw of rawEntries) {
    const amount = Number(raw?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Every entry must have an amount greater than zero" }, { status: 400 });
    }
    entries.push({
      amount,
      payment_date: typeof raw?.payment_date === "string" ? raw.payment_date : null,
    });
  }

  const { data, error } = await supabase.rpc("record_susu_batch", {
    p_account_id: accountId,
    p_entries: entries,
    p_recorded_by: user.id,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const payments = data as SusuPayment[];
  await notifyBatch(supabase, accountId, payments);
  return NextResponse.json({ payments });
}

async function notifyBatch(supabase: Awaited<ReturnType<typeof createClient>>, accountId: string, payments: SusuPayment[]) {
  if (payments.length === 0) return;

  const { data: account } = await supabase.from("accounts").select("client_id").eq("id", accountId).single<{ client_id: string }>();
  if (!account) return;

  const { data: client } = await supabase.from("clients").select("*").eq("id", account.client_id).single<Client>();
  if (!client) return;

  const settings = await getSettings();
  const total = payments.reduce((sum, p) => sum + p.amount, 0);
  const msg = smsTemplates.susuBatchRecorded(client.full_name, payments.length, total);

  if (shouldSendClientSms("susu", client, settings)) {
    await sendSms({ to: client.phone, message: msg, event: "susu_batch_recorded", recipientType: "client", relatedClientId: client.id });
  }

  if (shouldSendAdminSms(settings)) {
    await sendSms({ to: settings.sms.company_tel!, message: msg, event: "susu_batch_recorded_admin", recipientType: "admin", relatedClientId: client.id });
  }
}
