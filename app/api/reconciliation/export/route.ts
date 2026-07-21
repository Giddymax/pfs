import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { xlsxResponse } from "@/lib/export/xlsx";
import { round2 } from "@/lib/loan";

interface ReconciliationEntry {
  entry_date: string;
  opening_cash_at_hand: number;
  deposit_received: number;
  withdrawal_paid: number;
  cash_issued_out: number;
  cash_at_bank: number;
  debt_owed: number | null;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: entries } = await supabase
    .from("cash_reconciliations")
    .select("*")
    .order("entry_date", { ascending: true })
    .returns<ReconciliationEntry[]>();

  const rows = (entries ?? []).map((e) => {
    const balanceAfterIssue = round2(e.opening_cash_at_hand - e.cash_issued_out);
    const unspentIssued = round2(e.cash_issued_out - e.withdrawal_paid);
    const closingCashAtHand = round2(e.opening_cash_at_hand - e.withdrawal_paid + e.deposit_received);
    const totalCash = round2(closingCashAtHand + e.cash_at_bank);
    return {
      "Date": new Date(e.entry_date + "T00:00:00").toLocaleDateString("en-GB"),
      "Deposit Received": e.deposit_received,
      "Withdrawal (Paid Out)": e.withdrawal_paid,
      "Total Cash (Bank + Hand)": totalCash,
      "Cash at Bank": e.cash_at_bank,
      "Cash at Hand": closingCashAtHand,
      "Debt Owed": e.debt_owed ?? "",
      "Opening Balance (Cash at Hand)": e.opening_cash_at_hand,
      "Cash Issued Out": e.cash_issued_out,
      "Balance After Issue": balanceAfterIssue,
      "Spent from Issued Cash": e.withdrawal_paid,
      "Unspent Issued Balance": unspentIssued,
      "Deposit Added Back": e.deposit_received,
      "Closing Cash at Hand": closingCashAtHand,
    };
  });

  return xlsxResponse(rows, {
    sheetName: "Cash Reconciliation",
    filename: `cash-reconciliation-${new Date().toISOString().slice(0, 10)}.xlsx`,
    colWidths: [12, 14, 16, 16, 12, 12, 10, 16, 14, 14, 14, 14, 14, 14],
  });
}
