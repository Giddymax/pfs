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
    return NextResponse.json({ error: "Only admins can record investments" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const { title, investment_type, amount_invested, date, notes } = body ?? {};

  if (!title || typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "Investment name is required" }, { status: 400 });
  }
  if (!investment_type || typeof investment_type !== "string" || !investment_type.trim()) {
    return NextResponse.json({ error: "Investment type is required" }, { status: 400 });
  }

  const invested = Number(amount_invested);
  if (!isFinite(invested) || invested <= 0) {
    return NextResponse.json({ error: "Amount invested must be a positive number" }, { status: 400 });
  }

  const { data, error } = await supabase.from("investments").insert({
    title: title.trim(),
    investment_type: investment_type.trim(),
    amount_invested: invested,
    revenue_made: 0,
    status: "active",
    date: date || new Date().toISOString().slice(0, 10),
    notes: notes?.trim() || null,
    recorded_by: user.id,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ investment: data });
}
