import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { xlsxMultiSheetResponse } from "@/lib/export/xlsx";

interface Expenditure {
  id: string;
  title: string;
  amount: number;
  category: string;
  date: string;
  notes: string | null;
  recorded_by: string | null;
  created_at: string;
  recorder: { full_name: string } | null;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: expenditures } = await supabase
    .from("expenditures")
    .select("*, recorder:recorded_by(full_name)")
    .order("date", { ascending: false })
    .returns<Expenditure[]>();

  const expenditureRows = (expenditures ?? []).map((e) => ({
    "Title": e.title,
    "Category": e.category,
    "Amount (GHS)": e.amount,
    "Date": new Date(e.date).toLocaleDateString("en-GB"),
    "Notes": e.notes ?? "",
    "Recorded By": e.recorder?.full_name ?? "",
  }));

  return xlsxMultiSheetResponse(
    [
      { sheetName: "Expenditures", rows: expenditureRows, colWidths: [24, 16, 14, 14, 30, 18] },
    ],
    `finance-${new Date().toISOString().slice(0, 10)}.xlsx`
  );
}
