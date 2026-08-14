import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MOMO_TYPES } from "@/lib/momo/types";
import type { Profile } from "@/lib/types";

const VALID_TYPES = new Set(MOMO_TYPES.map((t) => t.value));

// Admin-only, for now (momo-mini-app-brief.md §3) — checked here
// independently of the page-level redirect in
// app/(dashboard)/momo/layout.tsx and the RLS policy on momo_transactions
// itself (0062_momo_transactions.sql), so this route refuses a staff
// session even if someone calls it directly.
export async function POST(request: Request) {
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

  const body = await request.json().catch(() => null);
  const phoneNumber = typeof body?.phone_number === "string" ? body.phone_number.trim() : "";
  const type = typeof body?.type === "string" ? body.type : "";
  const charge = Number(body?.charge);
  const note = typeof body?.note === "string" ? body.note.trim() || null : null;

  if (!phoneNumber) {
    return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
  }
  if (!VALID_TYPES.has(type as never)) {
    return NextResponse.json({ error: "Invalid transaction type" }, { status: 400 });
  }
  if (!Number.isFinite(charge) || charge < 0) {
    return NextResponse.json({ error: "Charge must be 0 or more" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("momo_transactions")
    .insert({
      phone_number: phoneNumber,
      type,
      charge,
      note,
      recorded_by: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ transaction: data });
}
