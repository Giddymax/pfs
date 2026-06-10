import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings/cache";
import { shouldSendAdminSms, shouldSendClientSms } from "@/lib/sms/gating";
import { sendSms } from "@/lib/sms/arkesel";
import { smsTemplates } from "@/lib/sms/templates";
import type { RepaymentMethod } from "@/lib/types";

interface RepaymentResult {
  repayment_id: string;
  remaining_balance: number;
  loan_status: string;
  client_id: string;
  client_full_name: string;
  client_phone: string;
  overpayment_amount: number;
}

const METHODS: RepaymentMethod[] = ["cash", "mobile_money", "bank_transfer"];

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const amount = Number(body?.amount);
  const paymentDate = typeof body?.payment_date === "string" ? body.payment_date : null;
  const method: RepaymentMethod = METHODS.includes(body?.method) ? body.method : "cash";
  const notes = typeof body?.notes === "string" ? body.notes.trim() || null : null;

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Amount must be greater than zero" }, { status: 400 });
  }

  const { data, error } = await supabase
    .rpc("record_loan_repayment", {
      p_loan_id: id,
      p_amount: amount,
      p_payment_date: paymentDate,
      p_method: method,
      p_notes: notes,
      p_recorded_by: user.id,
    })
    .single<RepaymentResult>();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // If the client overpaid, credit the excess to their primary savings account.
  let excessDepositedToAccount: string | null = null;
  if (data.overpayment_amount > 0) {
    const { data: savingsAccount } = await supabase
      .from("accounts")
      .select("id, account_number")
      .eq("client_id", data.client_id)
      .eq("product_type", "savings")
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle<{ id: string; account_number: string }>();

    if (savingsAccount) {
      await supabase.rpc("record_deposit", {
        p_account_id: savingsAccount.id,
        p_amount: data.overpayment_amount,
        p_recorded_by: user.id,
        p_notes: `Loan overpayment credit (${data.overpayment_amount} excess)`,
      });
      excessDepositedToAccount = savingsAccount.account_number;
    }
  }

  await notifyRepayment(supabase, data, amount);
  return NextResponse.json({
    repayment: data,
    overpayment_amount: data.overpayment_amount,
    excess_deposited_to: excessDepositedToAccount,
  });
}

async function notifyRepayment(supabase: Awaited<ReturnType<typeof createClient>>, repayment: RepaymentResult, amount: number) {
  const { data: client } = await supabase
    .from("clients")
    .select("sms_opt_in")
    .eq("id", repayment.client_id)
    .maybeSingle<{ sms_opt_in: boolean }>();

  const settings = await getSettings();

  if (client && shouldSendClientSms("payment", client, settings)) {
    await sendSms({
      to: repayment.client_phone,
      message: smsTemplates.loanRepaymentReceivedClient(repayment.client_full_name, amount, repayment.remaining_balance),
      event: "loan_repayment_received_client",
      recipientType: "client",
      relatedClientId: repayment.client_id,
    });
  }

  if (shouldSendAdminSms(settings)) {
    await sendSms({
      to: settings.sms.company_tel!,
      message: smsTemplates.loanRepaymentReceivedAdmin(repayment.client_full_name, amount, repayment.remaining_balance),
      event: "loan_repayment_received_admin",
      recipientType: "admin",
      relatedClientId: repayment.client_id,
    });
  }
}
