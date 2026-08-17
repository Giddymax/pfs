import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single<Pick<Profile, "role">>();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Only admins can delete expenditures" }, { status: 403 });
  }

  // Reverses the linked PFS Consolidated Fund withdrawal (credits the
  // amount back) before removing the row — see delete_expenditure() in
  // 0074_consolidated_fund_finance_link.sql.
  const { error } = await supabase.rpc("delete_expenditure", { p_expenditure_id: id });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
