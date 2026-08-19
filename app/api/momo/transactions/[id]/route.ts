import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MOMO_TYPES } from "@/lib/momo/types";
import type { Profile } from "@/lib/types";

const VALID_TYPES = new Set(MOMO_TYPES.map((t) => t.value));

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<Pick<Profile, "role">>();

  if (profile?.role !== "admin") {
    return { error: NextResponse.json({ error: "Admin access required" }, { status: 403 }) };
  }
  return { user };
}

// Edit a MoMo transaction's fields directly — there's no balance to
// recalculate (see momo-mini-app-brief.md §5), so this is a plain update.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { error: authError } = await requireAdmin(supabase);
  if (authError) return authError;

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
    .from("momo_transactions")
    .update({ phone_number: phoneNumber, type, amount, charge, note })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ transaction: data });
}

// Soft-delete: flags reversed_at instead of removing the row, matching the
// reversed_at column's purpose in 0062_momo_transactions.sql — the entry
// stays for the record but drops out of computeMomoSummary() and the export.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { error: authError } = await requireAdmin(supabase);
  if (authError) return authError;

  const { error } = await supabase
    .from("momo_transactions")
    .update({ reversed_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
