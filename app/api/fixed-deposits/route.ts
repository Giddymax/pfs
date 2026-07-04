import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings/cache";
import { shouldSendAdminSms, shouldSendClientSms } from "@/lib/sms/gating";
import { sendSms } from "@/lib/sms/arkesel";
import { smsTemplates } from "@/lib/sms/templates";
import type { Client, FixedDeposit } from "@/lib/types";

const TERM_OPTIONS = [3, 6, 9, 12, 18, 24];

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const clientId = body?.client_id;
  const principal = Number(body?.principal);
  const annualRate = Number(body?.annual_rate_percent);
  const termMonths = Number(body?.term_months);

  if (!clientId || typeof clientId !== "string") {
    return NextResponse.json({ error: "client_id is required" }, { status: 400 });
  }
  if (!Number.isFinite(principal) || principal <= 0) {
    return NextResponse.json({ error: "Principal must be greater than zero" }, { status: 400 });
  }
  if (!Number.isFinite(annualRate) || annualRate < 0) {
    return NextResponse.json({ error: "Annual rate cannot be negative" }, { status: 400 });
  }
  if (!TERM_OPTIONS.includes(termMonths)) {
    return NextResponse.json({ error: "Term must be one of 3, 6, 9, 12, 18, 24 months" }, { status: 400 });
  }

  const { data, error } = await supabase
    .rpc("open_fixed_deposit", {
      p_client_id: clientId,
      p_principal: principal,
      p_annual_rate: annualRate,
      p_term_months: termMonths,
      p_created_by: user.id,
    })
    .single<FixedDeposit>();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await notifyFdOpened(supabase, data, termMonths);
  return NextResponse.json({ fixed_deposit: data });
}

async function notifyFdOpened(
  supabase: Awaited<ReturnType<typeof createClient>>,
  fd: FixedDeposit,
  termMonths: number,
) {
  const { data: client } = await supabase.from("clients").select("*").eq("id", fd.client_id).single<Client>();
  if (!client) return;

  const settings = await getSettings();
  const maturityDate = fd.maturity_date
    ? new Date(fd.maturity_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "—";

  if (shouldSendClientSms("fixed_deposit", client, settings)) {
    await sendSms({
      to: client.phone,
      message: smsTemplates.fdOpened(client.full_name, fd.fd_number, fd.principal, maturityDate),
      event: "fd_opened",
      recipientType: "client",
      relatedClientId: client.id,
    });
  }

  if (shouldSendAdminSms(settings)) {
    await sendSms({
      to: settings.sms.company_tel!,
      message: smsTemplates.fdOpenedAdmin(client.full_name, fd.fd_number, fd.principal, termMonths),
      event: "fd_opened_admin",
      recipientType: "admin",
      relatedClientId: client.id,
    });
  }
}
