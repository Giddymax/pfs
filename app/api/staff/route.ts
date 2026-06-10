import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile } from "@/lib/types";

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: caller } = await supabase.from("profiles").select("role").eq("id", user.id).single<Pick<Profile, "role">>();
  if (caller?.role !== "admin") return NextResponse.json({ error: "Only admins can create staff accounts" }, { status: 403 });

  const { email, password, full_name, role } = await request.json();

  if (!email || !password || !full_name || !role) {
    return NextResponse.json({ error: "email, password, full_name, and role are required" }, { status: 400 });
  }
  if (!["admin", "staff"].includes(role)) {
    return NextResponse.json({ error: "role must be 'admin' or 'staff'" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError || !authData.user) {
    return NextResponse.json({ error: authError?.message ?? "Failed to create auth user" }, { status: 400 });
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: authData.user.id,
    email,
    full_name,
    role,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(authData.user.id);
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
