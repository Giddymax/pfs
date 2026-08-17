import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Loan, Profile } from "@/lib/types";

// Attaches (or changes) the auto-deduction repayment account on an
// already-active loan — for loans activated before 0073's monthly
// auto-deduction feature existed, which have no repayment_account_id yet.
// See set_loan_repayment_account() (0073_loan_repayment_automation.sql).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Only an admin can set a loan's repayment account" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const accountId = typeof body?.account_id === "string" ? body.account_id : null;
  if (!accountId) {
    return NextResponse.json({ error: "Choose an account" }, { status: 400 });
  }

  const { data, error } = await supabase
    .rpc("set_loan_repayment_account", { p_loan_id: id, p_account_id: accountId })
    .single<Loan>();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ loan: data });
}
