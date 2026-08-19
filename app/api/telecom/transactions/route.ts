import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TELECOM_TYPES } from "@/lib/telecom/types";
import type { Profile } from "@/lib/types";

const VALID_TYPES = new Set(TELECOM_TYPES.map((t) => t.value));

// Open to any active staff or admin — recording a transaction is everyday
// work, not an admin-only action (0065_momo_staff_access.sql). Editing,
// reversing, and deleting an existing transaction is still admin-only; see
// the PATCH/DELETE routes under [id]. Checked here independently of the
// RLS policy on telecom_transactions itself, so the error message is
// meaningful instead of a generic RLS rejection.
export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_active")
    .eq("id", user.id)
    .single<Pick<Profile, "is_active">>();

  if (!profile?.is_active) {
    return NextResponse.json({ error: "Your account is deactivated" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const phoneNumber = typeof body?.phone_number === "string" ? body.phone_number.trim() : "";
  const type = typeof body?.type === "string" ? body.type : "";
  const amount = Number(body?.amount);
  const charge = Number(body?.charge);
  const note = typeof body?.note === "string" ? body.note.trim() || null : null;

  if (!phoneNumber) {
    return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
  }
  if (!VALID_TYPES.has(type as never)) {
    return NextResponse.json({ error: "Invalid transaction type" }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount < 0) {
    return NextResponse.json({ error: "Amount must be 0 or more" }, { status: 400 });
  }
  if (!Number.isFinite(charge) || charge < 0) {
    return NextResponse.json({ error: "Charge must be 0 or more" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("telecom_transactions")
    .insert({
      phone_number: phoneNumber,
      type,
      amount,
      charge,
      note,
      recorded_by: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ transaction: data });
}
