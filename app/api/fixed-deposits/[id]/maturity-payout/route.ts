import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings/cache";
import { shouldSendAdminSms, shouldSendClientSms } from "@/lib/sms/gating";
import { sendSms } from "@/lib/sms/arkesel";
import { smsTemplates } from "@/lib/sms/templates";

interface PayoutResult {
  fd_id: string;
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
    .rpc("process_maturity_payout", { p_fd_id: id, p_paid_by: user.id })
    .single<PayoutResult>();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await notifyMaturityPaidOut(supabase, data);
  return NextResponse.json({ payout: data });
}

async function notifyMaturityPaidOut(supabase: Awaited<ReturnType<typeof createClient>>, payout: PayoutResult) {
  const { data: client } = await supabase
    .from("clients")
    .select("sms_opt_in")
    .eq("id", payout.client_id)
    .maybeSingle<{ sms_opt_in: boolean }>();

  const settings = await getSettings();
  const msg = smsTemplates.fdMaturityPaidOut(payout.client_full_name, payout.amount);

  if (client && shouldSendClientSms("fixed_deposit", client, settings)) {
    await sendSms({ to: payout.client_phone, message: msg, event: "fd_maturity_paid_out", recipientType: "client", relatedClientId: payout.client_id });
  }

  if (shouldSendAdminSms(settings)) {
    await sendSms({ to: settings.sms.company_tel!, message: msg, event: "fd_maturity_paid_out_admin", recipientType: "admin", relatedClientId: payout.client_id });
  }
}
