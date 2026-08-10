import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Client } from "@/lib/types";

const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  savings: "Savings",
  susu: "Daily Susu",
  fixed_deposit: "Fixed Deposit",
};

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: clients } = await supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<Client[]>();

  const clientIds = (clients ?? []).map((c) => c.id);

  // Regular accounts take priority; fall back to the client's active FD principal
  const accountTypeByClient = new Map<string, string>();
  const dailyContributionByClient = new Map<string, number>();
  const balanceByClient = new Map<string, number>();
  const clientsWithFees = new Set<string>();
  if (clientIds.length > 0) {
    const [{ data: fds }, { data: accounts }, { data: cardFeeRows }] = await Promise.all([
      supabase
        .from("fixed_deposits")
        .select("client_id, principal")
        .in("client_id", clientIds)
        .not("status", "in", '("withdrawn","rolled_over")')
        .order("created_at", { ascending: true })
        .returns<{ client_id: string; principal: number }[]>(),
      supabase
        .from("accounts")
        .select("client_id, product_type, daily_contribution_amount, balance")
        .in("client_id", clientIds)
        .order("created_at", { ascending: true })
        .returns<{ client_id: string; product_type: string; daily_contribution_amount: number | null; balance: number }[]>(),
      supabase
        .from("card_fees")
        .select("client_id, amount")
        .in("client_id", clientIds)
        .returns<{ client_id: string; amount: number }[]>(),
    ]);
    // Regular accounts take priority; fall back to FD (same rule as the Excel export)
    for (const fd of fds ?? []) {
      if (!accountTypeByClient.has(fd.client_id)) {
        accountTypeByClient.set(fd.client_id, "fixed_deposit");
        balanceByClient.set(fd.client_id, fd.principal);
      }
    }
    for (const acc of accounts ?? []) {
      accountTypeByClient.set(acc.client_id, acc.product_type);
      balanceByClient.set(acc.client_id, acc.balance);
      if (acc.product_type === "susu" && acc.daily_contribution_amount != null) {
        dailyContributionByClient.set(acc.client_id, acc.daily_contribution_amount);
      }
    }
    for (const r of cardFeeRows ?? []) {
      if ((r.amount ?? 0) > 0) clientsWithFees.add(r.client_id);
    }
  }

  const rows = [
    ["Client Code", "Full Name", "Gender", "Date of Birth", "Phone", "Alt Phone", "Ghana Card", "Occupation", "Address", "Town", "Next of Kin", "Next of Kin Phone", "Status", "Client Type", "Account Type", "Daily Contribution", "Balance", "SMS Opt-In", "Registered"],
    ...(clients ?? []).map((c) => [
      c.client_code,
      c.full_name,
      c.gender ?? "",
      c.date_of_birth ?? "",
      c.phone,
      c.alt_phone ?? "",
      c.ghana_card_number ?? "",
      c.occupation ?? "",
      c.residential_address ?? "",
      c.town ?? "",
      c.next_of_kin_name ?? "",
      c.next_of_kin_phone ?? "",
      c.status,
      clientsWithFees.has(c.id) ? "New" : "Old (Migrated)",
      ACCOUNT_TYPE_LABEL[accountTypeByClient.get(c.id) ?? ""] ?? "",
      dailyContributionByClient.get(c.id) ?? "",
      balanceByClient.get(c.id) ?? "",
      c.sms_opt_in ? "Yes" : "No",
      new Date(c.created_at).toLocaleDateString("en-GB"),
    ]),
  ];

  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="clients-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
