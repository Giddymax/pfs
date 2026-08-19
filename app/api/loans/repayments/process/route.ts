import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

interface ProcessedRepayment {
  loan_id: string;
  loan_code: string;
  client_full_name: string;
  account_number: string;
  due_amount: number;
  collected: number;
  new_arrears: number;
  new_status: string;
}

// Admin-triggered batch: deducts every currently-due monthly loan
// repayment from its pinned repayment account (or whatever's available,
// carrying the shortfall forward as arrears). See
// process_due_loan_repayments() (0073_loan_repayment_automation.sql) —
// every deduction it makes goes through the same record_withdrawal()/
// record_loan_repayment() RPCs a manually-recorded one does.
export async function POST() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Only an admin can process due loan repayments" }, { status: 403 });
  }

  const { data, error } = await supabase
    .rpc("process_due_loan_repayments", { p_processed_by: user.id })
    .returns<ProcessedRepayment[]>();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ processed: data ?? [] });
}
