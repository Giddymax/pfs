import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { xlsxResponse } from "@/lib/export/xlsx";
import { computeMomoStaffPerformance } from "@/lib/finance/momo-summary";
import { MOMO_TYPES } from "@/lib/momo/types";
import type { Profile } from "@/lib/types";

// Admin-only, same as the page itself (app/(dashboard)/momo/performance/page.tsx)
// — seeing every staff member's collected charges is a management view.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<Pick<Profile, "role">>();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const rows = await computeMomoStaffPerformance(supabase, {
    from: from ?? undefined,
    to: to ?? undefined,
  });

  const exportRows = rows.map((r) => ({
    "Staff member": r.fullName,
    "Role": r.role === "admin" ? "Administrator" : r.role === "staff" ? "Staff" : "—",
    "Status": r.staffId ? (r.isActive ? "Active" : "Deactivated") : "—",
    ...Object.fromEntries(MOMO_TYPES.map((t) => [`${t.label} (GHS)`, r.byType[t.value]])),
    "Total amount (GHS)": r.totalAmount,
    "Charges collected (GHS)": r.totalCharge,
    "Total transactions": r.transactionCount,
  }));

  return xlsxResponse(exportRows, {
    sheetName: "MoMo Performance",
    filename: from && to
      ? `momo-performance-${from}-to-${to}.xlsx`
      : `momo-performance-${new Date().toISOString().slice(0, 10)}.xlsx`,
    colWidths: [24, 16, 14, 12, 12, 12, 12, 14, 12, 16, 18, 16],
  });
}
