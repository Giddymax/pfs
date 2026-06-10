import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings/cache";
import { shouldSendClientSms } from "@/lib/sms/gating";
import { sendSms } from "@/lib/sms/arkesel";
import { smsTemplates } from "@/lib/sms/templates";

interface RolloverResult {
  old_fd_id: string;
  new_fd_id: string;
  client_id: string;
  client_full_name: string;
  client_phone: string;
  cash_interest_paid: number;
}

const TERM_OPTIONS = [3, 6, 9, 12, 18, 24];

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const newTermMonths = Number(body?.new_term_months);
  const newRate = Number(body?.annual_rate_percent);
  const capitaliseInterest = Boolean(body?.capitalise_interest);

  if (!TERM_OPTIONS.includes(newTermMonths)) {
    return NextResponse.json({ error: "Term must be one of 3, 6, 9, 12, 18, 24 months" }, { status: 400 });
  }
  if (!Number.isFinite(newRate) || newRate < 0) {
    return NextResponse.json({ error: "Annual rate cannot be negative" }, { status: 400 });
  }

  const { data, error } = await supabase
    .rpc("process_rollover", {
      p_fd_id: id,
      p_new_term_months: newTermMonths,
      p_new_rate: newRate,
      p_capitalise_interest: capitaliseInterest,
      p_paid_by: user.id,
    })
    .single<RolloverResult>();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await notifyRolledOver(supabase, data);
  return NextResponse.json({ rollover: data });
}

async function notifyRolledOver(supabase: Awaited<ReturnType<typeof createClient>>, rollover: RolloverResult) {
  const { data: client } = await supabase
    .from("clients")
    .select("sms_opt_in")
    .eq("id", rollover.client_id)
    .maybeSingle<{ sms_opt_in: boolean }>();
  if (!client) return;

  const settings = await getSettings();
  if (!shouldSendClientSms("fixed_deposit", client, settings)) return;

  const { data: fds } = await supabase
    .from("fixed_deposits")
    .select("id, fd_number")
    .in("id", [rollover.old_fd_id, rollover.new_fd_id]);
  const oldFdNumber = fds?.find((fd) => fd.id === rollover.old_fd_id)?.fd_number ?? "";
  const newFdNumber = fds?.find((fd) => fd.id === rollover.new_fd_id)?.fd_number ?? "";

  await sendSms({
    to: rollover.client_phone,
    message: smsTemplates.fdRolledOver(rollover.client_full_name, oldFdNumber, newFdNumber, rollover.cash_interest_paid),
    event: "fd_rolled_over",
    recipientType: "client",
    relatedClientId: rollover.client_id,
  });
}
