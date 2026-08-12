import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface AccountRow {
  id: string;
  account_number: string;
  product_type: "savings" | "susu";
  balance: number;
  daily_contribution_amount: number | null;
  status: string;
  client_id: string;
  client: { full_name: string; client_code: string } | null;
}

// Searches open savings/susu accounts by client name, client ID, phone, or
// account number — feeds the account picker on the Withdrawals and Deposits
// pages so an admin/staff member can jump straight to recording a
// transaction without navigating through the client list first.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ accounts: [] });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: matchedClients } = await supabase
    .from("clients")
    .select("id")
    .or(`full_name.ilike.%${q}%,client_code.ilike.%${q}%,phone.ilike.%${q}%`);
  const clientIds = (matchedClients ?? []).map((c: { id: string }) => c.id);

  let query = supabase
    .from("accounts")
    .select("id, account_number, product_type, balance, daily_contribution_amount, status, client_id, client:clients(full_name, client_code)")
    .neq("status", "closed")
    .order("account_number", { ascending: true })
    .limit(15);

  query = clientIds.length > 0
    ? query.or(`account_number.ilike.%${q}%,client_id.in.(${clientIds.join(",")})`)
    : query.ilike("account_number", `%${q}%`);

  const { data, error } = await query.returns<AccountRow[]>();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const accounts = (data ?? []).map((a) => ({
    id: a.id,
    account_number: a.account_number,
    product_type: a.product_type,
    balance: a.balance,
    daily_contribution_amount: a.daily_contribution_amount,
    status: a.status,
    client_id: a.client_id,
    client_full_name: a.client?.full_name ?? "",
    client_code: a.client?.client_code ?? "",
  }));

  return NextResponse.json({ accounts });
}
