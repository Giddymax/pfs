import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: accountId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<{ role: string }>();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  // Verify the account exists
  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .eq("id", accountId)
    .single<{ id: string }>();

  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  // Delete all transactions for this account
  const { error: deleteError } = await supabase
    .from("transactions")
    .delete()
    .eq("account_id", accountId);

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 });

  // Reset the account balance counters
  const { error: resetError } = await supabase
    .from("accounts")
    .update({ balance: 0, dep: 0, wdr: 0, comm: 0 })
    .eq("id", accountId);

  if (resetError) return NextResponse.json({ error: resetError.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
