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

interface Investment {
  id: string;
  title: string;
  investment_type: string;
  amount_invested: number;
  revenue_made: number;
  status: "active" | "returned";
  date: string;
  return_date: string | null;
  returned_by: string | null;
  notes: string | null;
  recorded_by: string | null;
  created_at: string;
  recorder: { full_name: string } | null;
  returner: { full_name: string } | null;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const [{ data: expenditures }, { data: investments }] = await Promise.all([
    supabase
      .from("expenditures")
      .select("*, recorder:recorded_by(full_name)")
      .order("date", { ascending: false })
      .returns<Expenditure[]>(),
    supabase
      .from("investments")
      .select("*, recorder:recorded_by(full_name), returner:returned_by(full_name)")
      .order("date", { ascending: false })
      .returns<Investment[]>(),
  ]);

  const expenditureRows = (expenditures ?? []).map((e) => ({
    "Title": e.title,
    "Category": e.category,
    "Amount (GHS)": e.amount,
    "Date": new Date(e.date).toLocaleDateString("en-GB"),
    "Notes": e.notes ?? "",
    "Recorded By": e.recorder?.full_name ?? "",
  }));

  const investmentRows = (investments ?? []).map((i) => ({
    "Title": i.title,
    "Type": i.investment_type,
    "Amount Invested (GHS)": i.amount_invested,
    "Revenue Made (GHS)": i.revenue_made,
    "Status": i.status === "active" ? "Active" : "Returned",
    "Date": new Date(i.date).toLocaleDateString("en-GB"),
    "Return Date": i.return_date ? new Date(i.return_date).toLocaleDateString("en-GB") : "",
    "Returned By": i.returner?.full_name ?? "",
    "Notes": i.notes ?? "",
    "Recorded By": i.recorder?.full_name ?? "",
  }));

  return xlsxMultiSheetResponse(
    [
      { sheetName: "Expenditures", rows: expenditureRows, colWidths: [24, 16, 14, 14, 30, 18] },
      { sheetName: "Investments", rows: investmentRows, colWidths: [24, 16, 18, 16, 12, 14, 14, 18, 30, 18] },
    ],
    `finance-${new Date().toISOString().slice(0, 10)}.xlsx`
  );
}
