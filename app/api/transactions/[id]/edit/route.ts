import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

  // Sync linked susu_payment amount and recalculate cycle total
  const admin = createAdminClient();
  const { data: linkedPayment } = await admin
    .from("susu_payments")
    .select("id, cycle_id")
    .eq("transaction_id", id)
    .maybeSingle<{ id: string; cycle_id: string }>();

  if (linkedPayment) {
    await admin
      .from("susu_payments")
      .update({ amount: newAmount })
      .eq("id", linkedPayment.id);

    const { data: allPayments } = await admin
      .from("susu_payments")
      .select("amount")
      .eq("cycle_id", linkedPayment.cycle_id);

    const newTotal = (allPayments ?? []).reduce((s, p) => s + Number(p.amount), 0);
    await admin
      .from("susu_cycles")
      .update({ total_collected: newTotal })
      .eq("id", linkedPayment.cycle_id);
  }

  return NextResponse.json({ transaction: data });
}
