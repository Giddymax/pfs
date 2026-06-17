import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSettings } from "@/lib/settings/cache";
import { shouldSendAdminSms, shouldSendClientSms } from "@/lib/sms/gating";
import { sendSms } from "@/lib/sms/arkesel";
import { smsTemplates } from "@/lib/sms/templates";
import type { Client, Profile } from "@/lib/types";

export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const accountId = body?.account_id;
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";

  if (!accountId || typeof accountId !== "string") {
    return NextResponse.json({ error: "account_id is required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Fetch account details
  const { data: account } = await admin
    .from("accounts")
    .select("id, balance, daily_contribution_amount, client_id")
    .eq("id", accountId)
    .single<{ id: string; balance: number; daily_contribution_amount: number; client_id: string }>();

  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const daily = account.daily_contribution_amount ?? 0;
  if (daily <= 0) return NextResponse.json({ error: "No daily contribution amount set" }, { status: 400 });
  if (account.balance <= daily) {
    return NextResponse.json({ error: "Balance is too low for an emergency withdrawal after the company fee" }, { status: 400 });
  }

  // Fetch the active cycle
  const { data: activeCycle } = await admin
    .from("susu_cycles")
    .select("id, total_collected, cycle_number")
    .eq("account_id", accountId)
    .eq("status", "in_progress")
    .maybeSingle<{ id: string; total_collected: number; cycle_number: number }>();

  const companyFee = daily;
  const payout = account.balance - companyFee;

  // Record the withdrawal transaction (payout to client)
  const { data: txn, error: txnError } = await admin
    .from("transactions")
    .insert({
      account_id: accountId,
      client_id: account.client_id,
      type: "withdrawal",
      amount: payout,
      fee: companyFee,
      bal_after: 0,
      notes: `Emergency withdrawal${reason ? `: ${reason}` : ""} (company fee ${daily} deducted)`,
      recorded_by: user.id,
    })
    .select("id, amount, bal_after, client_id")
    .single<{ id: string; amount: number; bal_after: number; client_id: string }>();

  if (txnError) return NextResponse.json({ error: txnError.message }, { status: 400 });

  // Reset account balance to 0 and update counters
  const { error: acctError } = await admin
    .from("accounts")
    .update({
      balance: 0,
      wdr: account.balance,
      comm: companyFee,
    })
    .eq("id", accountId);

  if (acctError) return NextResponse.json({ error: acctError.message }, { status: 400 });

  // Close the cycle and record the company fee
  if (activeCycle) {
    await admin
      .from("susu_cycles")
      .update({
        status: "closed" as const,
        company_fee: companyFee,
        completed_on: new Date().toISOString(),
      })
      .eq("id", activeCycle.id);
  }

  // Recalculate account to get accurate counters
  await admin.rpc("recalculate_account", { p_account_id: accountId });

  // Send SMS notifications
  const { data: client } = await admin
    .from("clients")
    .select("*")
    .eq("id", account.client_id)
    .single<Client>();

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single<Pick<Profile, "full_name">>();

  if (client) {
    const settings = await getSettings();
    const clientMsg = smsTemplates.susuEmergencyWithdrawal(
      client.full_name,
      payout,
      companyFee,
      0,
    );

    if (shouldSendClientSms("withdrawal", client, settings)) {
      await sendSms({
        to: client.phone,
        message: clientMsg,
        event: "susu_emergency_withdrawal",
        recipientType: "client",
        relatedClientId: client.id,
      });
    }

    if (shouldSendAdminSms(settings)) {
      const adminMsg = smsTemplates.susuEmergencyWithdrawalAdmin(
        client.full_name,
        payout,
        companyFee,
        reason,
        profile?.full_name ?? "Staff",
      );
      await sendSms({
        to: settings.sms.company_tel!,
        message: adminMsg,
        event: "susu_emergency_withdrawal_admin",
        recipientType: "admin",
        relatedClientId: client.id,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    payout,
    companyFee,
  });
}
