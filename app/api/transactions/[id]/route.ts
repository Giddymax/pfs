import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings/cache";
import { shouldSendAdminSms, shouldSendClientSms } from "@/lib/sms/gating";
import { sendSms } from "@/lib/sms/arkesel";
import { smsTemplates } from "@/lib/sms/templates";
import type { Profile } from "@/lib/types";

interface ReversalResult {
  transaction_id: string;
  client_id: string;
  client_full_name: string;
  client_phone: string;
  admin_name: string;
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Only an admin can delete a transaction" }, { status: 403 });
  }

  const { data, error } = await supabase
    .rpc("delete_transaction", {
      p_transaction_id: id,
      p_deleted_by: user.id,
    })
    .single<ReversalResult>();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await notifyReversal(supabase, data);
  return NextResponse.json({ reversal: data });
}

async function notifyReversal(supabase: Awaited<ReturnType<typeof createClient>>, reversal: ReversalResult) {
  const [{ data: client }, { data: txn }] = await Promise.all([
    supabase.from("clients").select("sms_opt_in").eq("id", reversal.client_id).maybeSingle<{ sms_opt_in: boolean }>(),
    supabase.from("transactions").select("amount, account_id").eq("id", reversal.transaction_id).maybeSingle<{ amount: number; account_id: string }>(),
  ]);
  if (!txn) return;

  const { data: account } = await supabase.from("accounts").select("balance").eq("id", txn.account_id).maybeSingle<{ balance: number }>();
  const settings = await getSettings();
  const msg = smsTemplates.transactionReversed(reversal.client_full_name, txn.amount, account?.balance ?? 0);

  if (client && shouldSendClientSms("reversal", client, settings)) {
    await sendSms({ to: reversal.client_phone, message: msg, event: "transaction_reversed", recipientType: "client", relatedClientId: reversal.client_id });
  }

  if (shouldSendAdminSms(settings)) {
    await sendSms({ to: settings.sms.company_tel!, message: msg, event: "transaction_reversed_admin", recipientType: "admin", relatedClientId: reversal.client_id });
  }
}
