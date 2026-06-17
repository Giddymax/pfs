import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: txnId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<Pick<Profile, "role">>();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { data: txn } = await supabase
    .from("transactions")
    .select("id, account_id")
    .eq("id", txnId)
    .single<{ id: string; account_id: string }>();

  if (!txn) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

  const { error: deleteError } = await supabase
    .from("transactions")
    .delete()
    .eq("id", txnId);

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 });

  const { error: recalcError } = await supabase.rpc("recalculate_account", {
    p_account_id: txn.account_id,
  });

  if (recalcError) {
    return NextResponse.json({ error: recalcError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
