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
  const { title, amount, category, date, notes } = body ?? {};

  if (!title || typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  const amt = Number(amount);
  if (!isFinite(amt) || amt <= 0) {
    return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
  }

  const { data, error } = await supabase.from("expenditures").insert({
    title: title.trim(),
    amount: amt,
    category: category?.trim() || "general",
    date: date || new Date().toISOString().slice(0, 10),
    notes: notes?.trim() || null,
    recorded_by: user.id,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ expenditure: data });
}
