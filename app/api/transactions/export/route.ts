import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { xlsxResponse } from "@/lib/export/xlsx";

interface TxnRow {
  created_at: string;
  type: string;
  amount: number;
  fee: number | null;
  bal_after: number | null;
  notes: string | null;
  reversed_at: string | null;
  account: { account_number: string; product_type: string } | null;
  client: { full_name: string; client_code: string } | null;
  recorder: { full_name: string } | null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("account_id");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let query = supabase
    .from("transactions")
    .select("*, account:accounts(account_number, product_type), client:clients(full_name, client_code), recorder:recorded_by(full_name)")
    .order("created_at", { ascending: false });

  if (accountId) query = query.eq("account_id", accountId);

  const { data: txns } = await query.returns<TxnRow[]>();

  const rows = (txns ?? []).map((t) => {
    const dt = new Date(t.created_at);
    return {
      "Date": dt.toLocaleDateString("en-GB"),
      "Time": dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      "Client": t.client?.full_name ?? "",
      "Client Code": t.client?.client_code ?? "",
      "Account Number": t.account?.account_number ?? "",
      "Product": t.account?.product_type ?? "",
      "Type": t.type,
      "Amount (GHS)": t.amount,
      "Fee (GHS)": t.fee ?? 0,
      "Balance After (GHS)": t.bal_after ?? "",
      "Notes": t.notes ?? "",
      "Recorded By": t.recorder?.full_name ?? "",
      "Reversed": t.reversed_at ? "Yes" : "No",
    };
  });

  return xlsxResponse(rows, {
    sheetName: "Transactions",
    filename: `transactions-${new Date().toISOString().slice(0, 10)}.xlsx`,
    colWidths: [12, 10, 24, 12, 16, 12, 10, 14, 12, 16, 30, 18, 10],
  });
}
