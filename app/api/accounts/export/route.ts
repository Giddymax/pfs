import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { xlsxResponse } from "@/lib/export/xlsx";
import type { Account, Client, ProductType } from "@/lib/types";

const PRODUCT_LABEL: Record<ProductType, string> = {
  savings: "Savings",
  susu: "Daily Susu",
  fixed_deposit: "Fixed Deposit",
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const product = searchParams.get("product");
  if (product !== "savings" && product !== "susu") {
    return NextResponse.json({ error: "product must be savings or susu" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: accounts } = await supabase
    .from("accounts")
    .select("*, client:clients(*)")
    .eq("product_type", product)
    .order("created_at", { ascending: false })
    .returns<(Account & { client: Client | null })[]>();

  const rows = (accounts ?? []).map((a) => ({
    "Client Name": a.client?.full_name ?? "",
    "Client Code": a.client?.client_code ?? "",
    "Phone": a.client?.phone ?? "",
    "Account Number": a.account_number,
    "Product Type": PRODUCT_LABEL[a.product_type],
    "Balance (GHS)": a.balance,
    "Total Deposits (GHS)": a.dep ?? 0,
    "Total Withdrawals (GHS)": a.wdr ?? 0,
    "Total Commission (GHS)": a.comm ?? 0,
    ...(product === "susu" ? { "Daily Contribution (GHS)": a.daily_contribution_amount ?? "" } : {}),
    "Status": a.status,
    "Opening Date": a.opening_date ? new Date(a.opening_date).toLocaleDateString("en-GB") : "",
    "Registered On": new Date(a.created_at).toLocaleDateString("en-GB"),
  }));

  return xlsxResponse(rows, {
    sheetName: product === "savings" ? "Savings Accounts" : "Susu Accounts",
    filename: `${product}-accounts-${new Date().toISOString().slice(0, 10)}.xlsx`,
    colWidths: product === "susu"
      ? [24, 12, 14, 16, 14, 14, 16, 16, 18, 10, 14, 14]
      : [24, 12, 14, 16, 14, 14, 16, 16, 18, 10, 14],
  });
}
