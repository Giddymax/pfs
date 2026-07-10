import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

  const { data: txns } = await query;

  const rows = [
    ["Date", "Time", "Client", "Client Code", "Account Number", "Product", "Type", "Amount (GHS)", "Fee (GHS)", "Balance After (GHS)", "Notes", "Recorded By", "Reversed"],
    ...(txns ?? []).map((t) => {
      const dt = new Date(t.created_at);
      return [
        dt.toLocaleDateString("en-GB"),
        dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
        t.client?.full_name ?? "",
        t.client?.client_code ?? "",
        t.account?.account_number ?? "",
        t.account?.product_type ?? "",
        t.type,
        t.amount,
        t.fee ?? 0,
        t.bal_after ?? "",
        t.notes ?? "",
        t.recorder?.full_name ?? "",
        t.reversed_at ? "Yes" : "No",
      ];
    }),
  ];

  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="transactions-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
