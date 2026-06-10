import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Loan, Profile } from "@/lib/types";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const { data, error } = await supabase
    .rpc("activate_loan", { p_loan_id: id, p_activated_by: user.id })
    .single<Loan>();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ loan: data });
}
