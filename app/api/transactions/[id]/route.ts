import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

  // Find linked susu_payment before the reversal so we can clean it up
  const admin = createAdminClient();
  const { data: linkedPayment } = await admin
    .from("susu_payments")
    .select("id, cycle_id")
    .eq("transaction_id", id)
    .maybeSingle<{ id: string; cycle_id: string }>();

  const { data, error } = await supabase
    .rpc("delete_transaction", {
      p_transaction_id: id,
      p_deleted_by: user.id,
    })
    .single<ReversalResult>();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Clean up susu data so cycle progress, dashboard, and reconciliation stay accurate
  if (linkedPayment) {
    await admin
      .from("susu_payments")
      .delete()
      .eq("id", linkedPayment.id);

    const { data: remaining } = await admin
      .from("susu_payments")
      .select("amount, day_in_cycle")
      .eq("cycle_id", linkedPayment.cycle_id);

    const payments = remaining ?? [];

    if (payments.length === 0) {
      await admin
        .from("susu_claims")
        .delete()
        .eq("cycle_id", linkedPayment.cycle_id);
      await admin
        .from("susu_cycles")
        .delete()
        .eq("id", linkedPayment.cycle_id);
    } else {
      const newTotal = payments.reduce((s, p) => s + Number(p.amount), 0);
      const maxDay = Math.max(...payments.map((p) => p.day_in_cycle));

      if (maxDay >= 31) {
        await admin
          .from("susu_cycles")
          .update({ total_collected: newTotal })
          .eq("id", linkedPayment.cycle_id);
      } else {
        await admin
          .from("susu_cycles")
          .update({
            total_collected: newTotal,
            status: "in_progress" as const,
            completed_on: null,
            company_fee: null,
          })
          .eq("id", linkedPayment.cycle_id);
      }
    }
  }

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
