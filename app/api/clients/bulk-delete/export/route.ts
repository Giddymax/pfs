import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { xlsxResponse } from "@/lib/export/xlsx";
import { round2 } from "@/lib/loan";

// Backup snapshot taken immediately before a bulk delete executes — this is
// the only record that survives once the cascade removes these clients'
// accounts, transactions, loans, and everything else tied to them.
export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<{ role: string }>();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((id: unknown) => typeof id === "string") : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "No client ids provided" }, { status: 400 });
  }

  const { data: clients, error } = await supabase
    .from("clients")
    .select("id, client_code, full_name, phone, alt_phone, ghana_card_number, status, town, created_at, created_by")
    .in("id", ids)
    .returns<
      {
        id: string;
        client_code: string;
        full_name: string;
        phone: string;
        alt_phone: string | null;
        ghana_card_number: string | null;
        status: string;
        town: string | null;
        created_at: string;
        created_by: string | null;
      }[]
    >();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const [{ data: accounts }, { data: loans }, { data: registrars }] = await Promise.all([
    supabase.from("accounts").select("client_id, account_number, product_type, balance, dep, wdr").in("client_id", ids),
    supabase.from("loans").select("client_id, loan_code, status, principal").in("client_id", ids),
    supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", [...new Set((clients ?? []).map((c) => c.created_by).filter((v): v is string => !!v))]),
  ]);

  const registrarNameById = new Map((registrars ?? []).map((r: { id: string; full_name: string }) => [r.id, r.full_name]));
  const accountsByClient = new Map<string, { account_number: string; product_type: string; balance: number; dep: number; wdr: number }[]>();
  for (const a of (accounts ?? []) as { client_id: string; account_number: string; product_type: string; balance: number; dep: number; wdr: number }[]) {
    if (!accountsByClient.has(a.client_id)) accountsByClient.set(a.client_id, []);
    accountsByClient.get(a.client_id)!.push(a);
  }
  const loansByClient = new Map<string, { loan_code: string; status: string; principal: number }[]>();
  for (const l of (loans ?? []) as { client_id: string; loan_code: string; status: string; principal: number }[]) {
    if (!loansByClient.has(l.client_id)) loansByClient.set(l.client_id, []);
    loansByClient.get(l.client_id)!.push(l);
  }

  const rows = (clients ?? []).map((c) => {
    const accts = accountsByClient.get(c.id) ?? [];
    const clientLoans = loansByClient.get(c.id) ?? [];
    return {
      "Client Code": c.client_code,
      "Full Name": c.full_name,
      "Phone": c.phone,
      "Alt Phone": c.alt_phone ?? "",
      "Ghana Card": c.ghana_card_number ?? "",
      "Status": c.status,
      "Town": c.town ?? "",
      "Registered On": new Date(c.created_at).toLocaleString("en-GB"),
      "Registered By": c.created_by ? (registrarNameById.get(c.created_by) ?? "") : "",
      "Accounts": accts.map((a) => `${a.product_type} ${a.account_number} (bal ${round2(a.balance)})`).join("; "),
      "Total Lifetime Deposits": round2(accts.reduce((s, a) => s + Number(a.dep ?? 0), 0)),
      "Total Lifetime Withdrawals": round2(accts.reduce((s, a) => s + Number(a.wdr ?? 0), 0)),
      "Loans": clientLoans.map((l) => `${l.loan_code} (${l.status}, GHS ${round2(l.principal)})`).join("; "),
    };
  });

  return xlsxResponse(rows, {
    sheetName: "Deleted Clients Backup",
    filename: `bulk-delete-backup-${new Date().toISOString().slice(0, 10)}.xlsx`,
    colWidths: [14, 24, 14, 14, 16, 12, 14, 20, 18, 40, 16, 18, 40],
  });
}
