import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings/cache";
import { shouldSendAdminSms, shouldSendClientSms } from "@/lib/sms/gating";
import { sendSms } from "@/lib/sms/arkesel";
import { smsTemplates } from "@/lib/sms/templates";
import type { Client, SusuCycle, SusuPaymentResult } from "@/lib/types";

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const accountId = body?.account_id;
  const amount = Number(body?.amount);
  const paymentDate = typeof body?.payment_date === "string" ? body.payment_date : null;

  if (!accountId || typeof accountId !== "string") {
    return NextResponse.json({ error: "account_id is required" }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Amount must be greater than zero" }, { status: 400 });
  }

  const { data, error } = await supabase
    .rpc("record_susu_payment", {
      p_account_id: accountId,
      p_amount: amount,
      p_payment_date: paymentDate ?? undefined,
      p_recorded_by: user.id,
    })
    .single<SusuPaymentResult>();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await notifySusuPayment(supabase, data);
  return NextResponse.json({ payment: data });
}

async function notifySusuPayment(supabase: Awaited<ReturnType<typeof createClient>>, payment: SusuPaymentResult) {
  const { data: account } = await supabase.from("accounts").select("balance").eq("id", payment.account_id).single<{ balance: number }>();
  if (!account) return;

  const [{ data: client }, { data: cycle }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", payment.client_id).single<Client>(),
    payment.cycle_id
      ? supabase.from("susu_cycles").select("*").eq("id", payment.cycle_id).maybeSingle<SusuCycle>()
      : Promise.resolve({ data: null }),
  ]);
  if (!client) return;

  const settings = await getSettings();
  const msg = smsTemplates.susuContributionRecorded(client.full_name, payment.amount, payment.day_in_cycle, cycle?.total_collected ?? payment.amount, account.balance);

  if (shouldSendClientSms("susu", client, settings)) {
    await sendSms({ to: client.phone, message: msg, event: "susu_contribution_recorded", recipientType: "client", relatedClientId: client.id });
  }

  if (shouldSendAdminSms(settings)) {
    await sendSms({ to: settings.sms.company_tel!, message: msg, event: "susu_contribution_recorded_admin", recipientType: "admin", relatedClientId: client.id });
  }

  // Cycle just completed on this exact contribution — the day-31 company
  // fee was already swept automatically (0071_susu_day31_auto_sweep.sql).
  // Tell the client what was taken and what's left to claim.
  if (payment.cycle_completed) {
    const feeMsg = smsTemplates.susuDay31FeeTaken(client.full_name, payment.fee_amount, payment.remaining_claimable);

    if (shouldSendClientSms("susu", client, settings)) {
      await sendSms({ to: client.phone, message: feeMsg, event: "susu_day31_fee_taken", recipientType: "client", relatedClientId: client.id });
    }
    if (shouldSendAdminSms(settings, "withdrawal")) {
      await sendSms({ to: settings.sms.company_tel!, message: feeMsg, event: "susu_day31_fee_taken_admin", recipientType: "admin", relatedClientId: client.id });
    }
  }
}
