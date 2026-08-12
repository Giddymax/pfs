import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { xlsxResponse } from "@/lib/export/xlsx";

interface PeriodTransaction {
  id: string;
  created_at: string;
  type: "deposit" | "withdrawal" | "fee" | "reversal";
  amount: number;
  fee: number;
  bal_after: number;
  notes: string | null;
  client_full_name: string;
  client_code: string;
  account_number: string;
  product_type: "savings" | "susu";
  recorded_by_name: string | null;
  edited_by_name: string | null;
  edited_at: string | null;
  original_amount: number | null;
  reversed_by_name: string | null;
  reversed_at: string | null;
}

const PRODUCT_LABEL: Record<PeriodTransaction["product_type"], string> = {
  savings: "Savings",
  susu: "Daily Susu",
};

// Mirrors the Withdrawals report page's own search box exactly, so an admin
// exporting "what's currently on screen" gets the same rows they searched
// for — not the whole period's withdrawals.
function matchesSearch(t: PeriodTransaction, term: string) {
  const q = term.toLowerCase();
  return (
    t.client_full_name?.toLowerCase().includes(q) ||
    t.client_code?.toLowerCase().includes(q) ||
    t.account_number?.toLowerCase().includes(q) ||
    t.notes?.toLowerCase().includes(q)
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const q = searchParams.get("q")?.trim();
  if (!from || !to) {
    return NextResponse.json({ error: "from and to are required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data, error } = await supabase.rpc("list_period_transactions", { p_from: from, p_to: to });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Reversed transactions were undone — an external accounting export should
  // never include them, only the settled record.
  let txns = ((data ?? []) as PeriodTransaction[]).filter((t) => t.type === "withdrawal" && !t.reversed_at);
  if (q) txns = txns.filter((t) => matchesSearch(t, q));

  const rows = txns.map((t) => {
    const dt = new Date(t.created_at);
    return {
      "Date": dt.toLocaleDateString("en-GB"),
      "Time": dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      "Client Name": t.client_full_name,
      "Client Code": t.client_code,
      "Account Number": t.account_number,
      "Product Type": PRODUCT_LABEL[t.product_type],
      "Amount (GHS)": t.amount,
      "Commission (GHS)": t.fee ?? 0,
      "Balance After (GHS)": t.bal_after,
      "Recorded By": t.recorded_by_name ?? "",
      "Edited By": t.edited_by_name ?? "",
      "Original Amount (GHS)": t.original_amount ?? "",
      "Notes": t.notes ?? "",
    };
  });

  return xlsxResponse(rows, {
    sheetName: "Withdrawals",
    filename: `withdrawals-${from}-to-${to}.xlsx`,
    colWidths: [12, 10, 24, 12, 16, 14, 14, 16, 18, 18, 16, 30],
  });
}
