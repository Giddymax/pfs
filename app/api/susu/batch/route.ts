import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings/cache";
import { shouldSendAdminSms, shouldSendClientSms } from "@/lib/sms/gating";
import { sendSms } from "@/lib/sms/arkesel";
import { smsTemplates } from "@/lib/sms/templates";
import type { Client, SusuPaymentResult } from "@/lib/types";

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
  const isMultiDayPayment: boolean = body?.multi_day_payment === true;

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

  const payments = data as SusuPaymentResult[];
  await notifyBatch(supabase, accountId, payments, isMultiDayPayment);
  return NextResponse.json({ payments });
}

async function notifyBatch(
  supabase: Awaited<ReturnType<typeof createClient>>,
  accountId: string,
  payments: SusuPaymentResult[],
  isMultiDayPayment: boolean,
) {
  if (payments.length === 0) return;

  const { data: account } = await supabase.from("accounts").select("client_id, balance").eq("id", accountId).single<{ client_id: string; balance: number }>();
  if (!account) return;

  const { data: client } = await supabase.from("clients").select("*").eq("id", account.client_id).single<Client>();
  if (!client) return;

  const settings = await getSettings();
  const total = payments.reduce((sum, p) => sum + p.amount, 0);

  // Multi-day single payments get a more descriptive message than manual batch catch-ups
  const msg = isMultiDayPayment
    ? smsTemplates.susuMultiDayPayment(client.full_name, payments.length, payments[0].amount, total, account.balance)
    : smsTemplates.susuBatchRecorded(client.full_name, payments.length, total, account.balance);

  const event = isMultiDayPayment ? "susu_multi_day_payment" : "susu_batch_recorded";

  if (shouldSendClientSms("susu", client, settings)) {
    await sendSms({ to: client.phone, message: msg, event, recipientType: "client", relatedClientId: client.id });
  }

  if (shouldSendAdminSms(settings)) {
    await sendSms({ to: settings.sms.company_tel!, message: msg, event: `${event}_admin`, recipientType: "admin", relatedClientId: client.id });
  }

  // Any cycle(s) that completed during this batch — a catch-up batch can
  // span more than one 31-day cycle. Same day-31 fee-taken SMS as the
  // single-payment route, once per completed cycle.
  for (const completion of payments.filter((p) => p.cycle_completed)) {
    const feeMsg = smsTemplates.susuDay31FeeTaken(client.full_name, completion.fee_amount, completion.remaining_claimable);

    if (shouldSendClientSms("susu", client, settings)) {
      await sendSms({ to: client.phone, message: feeMsg, event: "susu_day31_fee_taken", recipientType: "client", relatedClientId: client.id });
    }
    if (shouldSendAdminSms(settings, "withdrawal")) {
      await sendSms({ to: settings.sms.company_tel!, message: feeMsg, event: "susu_day31_fee_taken_admin", recipientType: "admin", relatedClientId: client.id });
    }
  }
}
