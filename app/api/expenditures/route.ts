import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single<Pick<Profile, "role">>();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Only admins can record expenditures" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const { title, amount, category, date, notes, commission } = body ?? {};

  if (!title || typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  const amt = Number(amount);
  if (!isFinite(amt) || amt <= 0) {
    return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
  }
  const commissionNum = Number(commission) || 0;
  if (commissionNum < 0) {
    return NextResponse.json({ error: "Commission cannot be negative" }, { status: 400 });
  }

  // Every expenditure is now, for real, a withdrawal from the PFS
  // Consolidated Fund — following the exact same withdrawal conventions
  // (including an optional commission fee) any other savings withdrawal
  // does, atomically alongside logging the expenditure row. See
  // 0076_expenditure_follows_withdrawal_conventions.sql.
  const { data, error } = await supabase
    .rpc("record_expenditure", {
      p_title: title.trim(),
      p_amount: amt,
      p_category: category?.trim() || "general",
      p_date: date || new Date().toISOString().slice(0, 10),
      p_notes: notes?.trim() || null,
      p_commission: commissionNum,
      p_recorded_by: user.id,
    })
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ expenditure: data });
}
