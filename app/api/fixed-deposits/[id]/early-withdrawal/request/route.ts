import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings/cache";
import { shouldSendAdminSms } from "@/lib/sms/gating";
import { sendSms } from "@/lib/sms/arkesel";
import { smsTemplates } from "@/lib/sms/templates";
import type { Client, FixedDeposit } from "@/lib/types";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data, error } = await supabase
    .rpc("request_early_withdrawal", { p_fd_id: id, p_requested_by: user.id })
    .single<FixedDeposit>();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await notifyEarlyWithdrawalRequested(supabase, data);
  return NextResponse.json({ fixed_deposit: data });
}

async function notifyEarlyWithdrawalRequested(supabase: Awaited<ReturnType<typeof createClient>>, fd: FixedDeposit) {
  const settings = await getSettings();
  if (!shouldSendAdminSms(settings)) return;

  const { data: client } = await supabase.from("clients").select("*").eq("id", fd.client_id).single<Client>();
  if (!client) return;

  await sendSms({
    to: settings.sms.company_tel!,
    message: smsTemplates.fdEarlyWithdrawalRequestedAdmin(client.full_name, fd.fd_number, fd.principal),
    event: "fd_early_withdrawal_requested_admin",
    recipientType: "admin",
    relatedClientId: client.id,
  });
}
