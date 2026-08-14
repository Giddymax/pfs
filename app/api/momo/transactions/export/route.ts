import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { xlsxResponse } from "@/lib/export/xlsx";
import { momoTypeLabel } from "@/lib/momo/types";
import type { MomoTransaction, Profile } from "@/lib/types";

// MoMo's own Excel export — entirely separate from every PFS export route
// (see momo-mini-app-brief.md §7). Reversed rows are excluded, matching the
// "deleted transactions never appear in exports" rule already established
// for PFS's own transaction exports.
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

  let query = supabase
    .from("momo_transactions")
    .select("*, recorder:recorded_by(full_name)")
    .is("reversed_at", null)
    .order("created_at", { ascending: false });

  if (from) query = query.gte("created_at", `${from}T00:00:00`);
  if (to) query = query.lte("created_at", `${to}T23:59:59.999`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const rows = (data ?? []) as MomoTransaction[];

  const exportRows = rows.map((t) => ({
    "Date": new Date(t.created_at).toLocaleDateString("en-GB"),
    "Time": new Date(t.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
    "Phone number": t.phone_number,
    "Type": momoTypeLabel(t.type),
    "Charge (GHS)": t.charge,
    "Note": t.note ?? "",
    "Recorded by": t.recorder?.full_name ?? "",
  }));

  return xlsxResponse(exportRows, {
    sheetName: "MoMo Transactions",
    filename: from && to
      ? `momo-transactions-${from}-to-${to}.xlsx`
      : `momo-transactions-${new Date().toISOString().slice(0, 10)}.xlsx`,
    colWidths: [12, 10, 16, 14, 14, 30, 20],
  });
}
