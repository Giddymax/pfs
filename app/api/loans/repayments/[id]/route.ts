import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { LoanRepayment, Profile, RepaymentMethod } from "@/lib/types";

const METHODS: RepaymentMethod[] = ["cash", "mobile_money", "bank_transfer", "account_deduction"];

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single<Pick<Profile, "role">>();
  if (!profile || profile.role !== "admin") {
    return { error: NextResponse.json({ error: "Only an admin can edit or delete a loan repayment" }, { status: 403 }) };
  }
  return { user };
}

// Edits a repayment and recomputes the loan's current_balance/status from
// every remaining repayment — see edit_loan_repayment()
// (0075_fund_delete_and_repayment_edit.sql).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => null);
  const amount = Number(body?.amount);
  const paymentDate = typeof body?.payment_date === "string" ? body.payment_date : null;
  const method: RepaymentMethod | null = METHODS.includes(body?.method) ? body.method : null;
  const notes = typeof body?.notes === "string" ? body.notes.trim() || null : null;

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Amount must be greater than zero" }, { status: 400 });
  }

  const { data, error } = await supabase
    .rpc("edit_loan_repayment", {
      p_repayment_id: id,
      p_amount: amount,
      p_payment_date: paymentDate,
      p_method: method,
      p_notes: notes,
    })
    .single<LoanRepayment>();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ repayment: data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (auth.error) return auth.error;

  const { error } = await supabase.rpc("delete_loan_repayment", { p_repayment_id: id });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
