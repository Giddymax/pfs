import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { xlsxResponse } from "@/lib/export/xlsx";
import type { Profile } from "@/lib/types";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single<{ role: string }>();
  if (!profile || profile.role !== "admin") return NextResponse.json({ error: "Not authorised" }, { status: 403 });

  const { data: staff } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<Profile[]>();

  const rows = (staff ?? []).map((s) => ({
    "Full Name": s.full_name,
    "Email": s.email,
    "Role": s.role === "admin" ? "Administrator" : "Staff",
    "Status": s.is_active ? "Active" : "Deactivated",
    "Joined": new Date(s.created_at).toLocaleDateString("en-GB"),
  }));

  return xlsxResponse(rows, {
    sheetName: "Staff",
    filename: `staff-${new Date().toISOString().slice(0, 10)}.xlsx`,
    colWidths: [24, 28, 16, 14, 14],
  });
}
