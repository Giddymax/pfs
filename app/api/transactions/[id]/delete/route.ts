import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

  const admin = createAdminClient();

  const { data: txn } = await admin
    .from("transactions")
    .select("id, account_id")
    .eq("id", txnId)
    .single<{ id: string; account_id: string }>();

  if (!txn) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

  // Find any linked susu_payment before deleting the transaction
  const { data: linkedPayment } = await admin
    .from("susu_payments")
    .select("id, cycle_id")
    .eq("transaction_id", txnId)
    .maybeSingle<{ id: string; cycle_id: string }>();

  // Delete the transaction
  const { error: deleteError } = await admin
    .from("transactions")
    .delete()
    .eq("id", txnId);

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 });

  // Clean up linked susu data so cycle progress, dashboard totals, and reconciliation stay accurate
  if (linkedPayment) {
    await admin
      .from("susu_payments")
      .delete()
      .eq("id", linkedPayment.id);

    // Recalculate the cycle from remaining payments
    const { data: remaining } = await admin
      .from("susu_payments")
      .select("amount, day_in_cycle")
      .eq("cycle_id", linkedPayment.cycle_id);

    const payments = remaining ?? [];

    if (payments.length === 0) {
      // No payments left — delete any claims tied to this cycle, then delete the cycle
      await admin
        .from("susu_claims")
        .delete()
        .eq("cycle_id", linkedPayment.cycle_id);
      await admin
        .from("susu_cycles")
        .delete()
        .eq("id", linkedPayment.cycle_id);
    } else {
      const newTotal = payments.reduce((s, p) => s + Number(p.amount), 0);
      const maxDay = Math.max(...payments.map((p) => p.day_in_cycle));

      if (maxDay >= 31) {
        await admin
          .from("susu_cycles")
          .update({ total_collected: newTotal })
          .eq("id", linkedPayment.cycle_id);
      } else {
        await admin
          .from("susu_cycles")
          .update({
            total_collected: newTotal,
            status: "in_progress" as const,
            completed_on: null,
            company_fee: null,
          })
          .eq("id", linkedPayment.cycle_id);
      }
    }
  }

  // Recalculate account balance, dep, wdr, comm from remaining transactions
  const { error: recalcError } = await admin.rpc("recalculate_account", {
    p_account_id: txn.account_id,
  });

  if (recalcError) {
    return NextResponse.json({ error: recalcError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
