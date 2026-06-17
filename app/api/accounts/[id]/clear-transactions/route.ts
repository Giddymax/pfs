import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

  const admin = createAdminClient();

  const { data: account } = await admin
    .from("accounts")
    .select("id")
    .eq("id", accountId)
    .single<{ id: string }>();

  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  // Delete in FK dependency order: susu_payments → susu_claims → transactions → susu_cycles
  const [{ error: paymentsErr }, { error: claimsErr }] = await Promise.all([
    admin.from("susu_payments").delete().eq("account_id", accountId),
    admin.from("susu_claims").delete().eq("account_id", accountId),
  ]);

  if (paymentsErr) return NextResponse.json({ error: paymentsErr.message }, { status: 400 });
  if (claimsErr) return NextResponse.json({ error: claimsErr.message }, { status: 400 });

  const { error: deleteError } = await admin
    .from("transactions")
    .delete()
    .eq("account_id", accountId);

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 });

  const { error: cyclesErr } = await admin
    .from("susu_cycles")
    .delete()
    .eq("account_id", accountId);

  if (cyclesErr) return NextResponse.json({ error: cyclesErr.message }, { status: 400 });

  const { error: resetError } = await admin
    .from("accounts")
    .update({ balance: 0, dep: 0, wdr: 0, comm: 0 })
    .eq("id", accountId);

  if (resetError) return NextResponse.json({ error: resetError.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
