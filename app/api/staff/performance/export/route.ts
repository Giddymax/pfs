import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { xlsxResponse } from "@/lib/export/xlsx";

interface StaffPerformanceRow {
  staff_id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  clients_registered: number;
  savings_collected: number;
  susu_collected: number;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single<{ role: string }>();
  if (!profile || profile.role !== "admin") return NextResponse.json({ error: "Not authorised" }, { status: 403 });

  const { data } = await supabase.rpc("staff_performance");
  const staff = (data ?? []) as StaffPerformanceRow[];

  const rows = staff.map((s) => ({
    "Full Name": s.full_name,
    "Email": s.email,
    "Role": s.role === "admin" ? "Administrator" : "Staff",
    "Status": s.is_active ? "Active" : "Deactivated",
    "Clients Registered": s.clients_registered,
    "Savings Collected (GHS)": s.savings_collected,
    "Susu Collected (GHS)": s.susu_collected,
  }));

  return xlsxResponse(rows, {
    sheetName: "Staff Performance",
    filename: `staff-performance-${new Date().toISOString().slice(0, 10)}.xlsx`,
    colWidths: [24, 28, 16, 14, 18, 20, 18],
  });
}
