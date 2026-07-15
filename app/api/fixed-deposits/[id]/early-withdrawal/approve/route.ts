import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings/cache";
import { shouldSendAdminSms, shouldSendClientSms } from "@/lib/sms/gating";
import { sendSms } from "@/lib/sms/arkesel";
import { smsTemplates } from "@/lib/sms/templates";
import type { Client, FixedDeposit, Profile } from "@/lib/types";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Only an admin can approve an early withdrawal" }, { status: 403 });
  }

  const { data, error } = await supabase
    .rpc("approve_early_withdrawal", { p_fd_id: id, p_approved_by: user.id })
    .single<FixedDeposit>();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await notifyEarlyWithdrawalApproved(supabase, data);
  return NextResponse.json({ fixed_deposit: data });
}

async function notifyEarlyWithdrawalApproved(supabase: Awaited<ReturnType<typeof createClient>>, fd: FixedDeposit) {
  const { data: client } = await supabase.from("clients").select("*").eq("id", fd.client_id).single<Client>();
  if (!client) return;

  const settings = await getSettings();
  if (shouldSendClientSms("fixed_deposit", client, settings)) {
    await sendSms({
      to: client.phone,
      message: smsTemplates.fdEarlyWithdrawalApproved(client.full_name, fd.fd_number),
      event: "fd_early_withdrawal_approved",
      recipientType: "client",
      relatedClientId: client.id,
    });
  }

  if (shouldSendAdminSms(settings, "withdrawal")) {
    await sendSms({
      to: settings.sms.company_tel!,
      message: smsTemplates.fdEarlyWithdrawalApprovedAdmin(client.full_name, fd.fd_number),
      event: "fd_early_withdrawal_approved_admin",
      recipientType: "admin",
      relatedClientId: client.id,
    });
  }
}
