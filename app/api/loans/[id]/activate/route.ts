import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Loan, Profile } from "@/lib/types";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Only an admin can activate a loan" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const repaymentAccountId = typeof body?.repayment_account_id === "string" ? body.repayment_account_id : null;
  if (!repaymentAccountId) {
    return NextResponse.json({ error: "Choose which account the monthly repayment will be deducted from" }, { status: 400 });
  }

  const { data, error } = await supabase
    .rpc("activate_loan", {
      p_loan_id: id,
      p_activated_by: user.id,
      p_repayment_account_id: repaymentAccountId,
    })
    .single<Loan>();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ loan: data });
}
