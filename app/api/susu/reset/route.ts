import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Profile, SusuCycle } from "@/lib/types";

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Only an admin can reset a susu account" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const accountId = body?.account_id;
  if (!accountId || typeof accountId !== "string") {
    return NextResponse.json({ error: "account_id is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .rpc("reset_susu_account", { p_account_id: accountId, p_reset_by: user.id })
    .single<SusuCycle>();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ cycle: data });
}
