import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Transaction } from "@/lib/types";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Only an admin can edit a transaction" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const newAmount = Number(body?.amount);
  if (!Number.isFinite(newAmount) || newAmount <= 0) {
    return NextResponse.json({ error: "Amount must be greater than zero" }, { status: 400 });
  }

  const { data, error } = await supabase
    .rpc("edit_transaction", {
      p_transaction_id: id,
      p_new_amount: newAmount,
      p_edited_by: user.id,
    })
    .single<Transaction>();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ transaction: data });
}
