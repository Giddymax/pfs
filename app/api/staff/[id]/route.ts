import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile } from "@/lib/types";

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };

  const { data: caller } = await supabase.from("profiles").select("role").eq("id", user.id).single<Pick<Profile, "role">>();
  if (caller?.role !== "admin") return { user: null, error: NextResponse.json({ error: "Only admins can manage staff accounts" }, { status: 403 }) };

  return { user, error: null };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { user, error } = await requireAdmin(supabase);
  if (error) return error;

  const { full_name, role, email } = await request.json();

  if (!full_name && !role && !email) {
    return NextResponse.json({ error: "Provide at least full_name, role, or email to update" }, { status: 400 });
  }
  if (role && !["admin", "staff"].includes(role)) {
    return NextResponse.json({ error: "role must be 'admin' or 'staff'" }, { status: 400 });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }

  const admin = createAdminClient();

  // The login credential lives on the auth user, not the profiles row — an
  // email change has to update both, or the account would show a new email
  // in the staff list while still requiring the old one to sign in.
  if (email) {
    const { error: authUpdateError } = await admin.auth.admin.updateUserById(id, { email });
    if (authUpdateError) return NextResponse.json({ error: authUpdateError.message }, { status: 400 });
  }

  const update: Record<string, string> = {};
  if (full_name) update.full_name = full_name;
  if (role) update.role = role;
  if (email) update.email = email;

  if (Object.keys(update).length > 0) {
    const { error: updateError } = await admin.from("profiles").update(update).eq("id", id);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { user, error } = await requireAdmin(supabase);
  if (error) return error;

  if (id === user!.id) {
    return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error: deleteError } = await admin.auth.admin.deleteUser(id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
