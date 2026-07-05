import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single<Pick<Profile, "role">>();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Only admins can return investments" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const { revenue_made, return_date } = body ?? {};

  const revenue = Number(revenue_made ?? 0);
  if (!isFinite(revenue) || revenue < 0) {
    return NextResponse.json({ error: "Revenue made cannot be negative" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("investments")
    .update({
      status: "returned",
      revenue_made: revenue,
      return_date: return_date || new Date().toISOString().slice(0, 10),
      returned_by: user.id,
      returned_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "active")
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Investment was not found or has already been returned" }, { status: 404 });

  return NextResponse.json({ investment: data });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single<Pick<Profile, "role">>();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Only admins can delete investments" }, { status: 403 });
  }

  const { error } = await supabase.from("investments").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
