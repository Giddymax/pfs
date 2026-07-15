import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings/cache";
import { shouldSendClientSms } from "@/lib/sms/gating";
import { sendSms } from "@/lib/sms/arkesel";
import { smsTemplates } from "@/lib/sms/templates";
import { INTEREST_PERIOD_END, INTEREST_PERIOD_START } from "@/lib/interest";
import type { Account, Client, Transaction } from "@/lib/types";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const amount = Number(body?.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Amount must be greater than zero" }, { status: 400 });
  }

  const { data: txn, error } = await supabase
    .rpc("disburse_interest", {
      p_account_id: id,
      p_amount: amount,
      p_period_start: INTEREST_PERIOD_START,
      p_period_end: INTEREST_PERIOD_END,
      p_disbursed_by: user.id,
    })
    .single<Transaction>();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const [{ data: client }, { data: account }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", txn.client_id).single<Client>(),
    supabase.from("accounts").select("*").eq("id", txn.account_id).single<Account>(),
  ]);

  if (client && account) {
    const settings = await getSettings();
    if (shouldSendClientSms("interest", client, settings)) {
      const msg = smsTemplates.interestDisbursed(client.full_name, txn.amount, txn.bal_after, account.account_number);
      await sendSms({ to: client.phone, message: msg, event: "interest_disbursed", recipientType: "client", relatedClientId: client.id });
    }
  }

  return NextResponse.json({ transaction: txn });
}
