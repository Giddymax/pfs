import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings/cache";
import { shouldSendAdminSms, shouldSendClientSms } from "@/lib/sms/gating";
import { sendSms } from "@/lib/sms/arkesel";
import { smsTemplates } from "@/lib/sms/templates";
import type { Client, SusuCycle, SusuPayment } from "@/lib/types";

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
    .single<SusuPayment>();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await notifySusuPayment(supabase, data);
  return NextResponse.json({ payment: data });
}

async function notifySusuPayment(supabase: Awaited<ReturnType<typeof createClient>>, payment: SusuPayment) {
  const { data: account } = await supabase.from("accounts").select("client_id, balance").eq("id", payment.account_id).single<{ client_id: string; balance: number }>();
  if (!account) return;

  const [{ data: client }, { data: cycle }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", account.client_id).single<Client>(),
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
}
