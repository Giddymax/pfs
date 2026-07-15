import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { xlsxResponse } from "@/lib/export/xlsx";

interface BankTxn {
  id: string;
  type: "deposit" | "withdrawal";
  amount: number;
  description: string | null;
  created_at: string;
  recorder: { full_name: string } | null;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: txns } = await supabase
    .from("bank_transactions")
    .select("*, recorder:recorded_by(full_name)")
    .order("created_at", { ascending: false })
    .returns<BankTxn[]>();

  const rows = (txns ?? []).map((t) => {
    const dt = new Date(t.created_at);
    return {
      "Date": dt.toLocaleDateString("en-GB"),
      "Time": dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      "Type": t.type === "deposit" ? "Deposit" : "Withdrawal",
      "Amount (GHS)": t.amount,
      "Description": t.description ?? "",
      "Recorded By": t.recorder?.full_name ?? "",
    };
  });

  return xlsxResponse(rows, {
    sheetName: "Bank Transactions",
    filename: `bank-transactions-${new Date().toISOString().slice(0, 10)}.xlsx`,
    colWidths: [14, 10, 12, 14, 32, 20],
  });
}
