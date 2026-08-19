import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

// Genuine hard delete — removes the row entirely, unlike DELETE
// /api/telecom/transactions/[id] (that one reverses: flags reversed_at and
// keeps the row for the record). Mirrors PFS's own
// /api/transactions/[id] (reverse) vs /api/transactions/[id]/delete (hard
// delete) split. There's nothing to recalculate afterward — no balance, no
// wallet (telecom-mini-app-brief.md §5) — so this is just a plain delete.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  const { error } = await supabase
    .from("telecom_transactions")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
