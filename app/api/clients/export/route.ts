import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
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

  const { data: clients, error } = await supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: true })
    .returns<Client[]>();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const clientIds = (clients ?? []).map((c) => c.id);

  // Batch-fetch accounts and active FDs so we can show account type per client
  const accountTypeByClient = new Map<string, string>();
  const dailyContributionByClient = new Map<string, number>();
  if (clientIds.length > 0) {
    const [{ data: accounts }, { data: fds }] = await Promise.all([
      supabase
        .from("accounts")
        .select("client_id, product_type, daily_contribution_amount")
        .in("client_id", clientIds)
        .order("created_at", { ascending: true })
        .returns<{ client_id: string; product_type: string; daily_contribution_amount: number | null }[]>(),
      supabase
        .from("fixed_deposits")
        .select("client_id")
        .in("client_id", clientIds)
        .not("status", "in", '("withdrawn","rolled_over")')
        .order("created_at", { ascending: true })
        .returns<{ client_id: string }[]>(),
    ]);
    // Regular accounts take priority; fall back to FD
    for (const fd of fds ?? []) {
      if (!accountTypeByClient.has(fd.client_id)) {
        accountTypeByClient.set(fd.client_id, "fixed_deposit");
      }
    }
    for (const acc of accounts ?? []) {
      accountTypeByClient.set(acc.client_id, acc.product_type);
      if (acc.product_type === "susu" && acc.daily_contribution_amount != null) {
        dailyContributionByClient.set(acc.client_id, acc.daily_contribution_amount);
      }
    }
  }

  const rows = (clients ?? []).map((c) => ({
    "Client Code": c.client_code,
    "Full Name": c.full_name,
    "Phone": c.phone,
    "Alt Phone": c.alt_phone ?? "",
    "Gender": c.gender ?? "",
    "Date of Birth": c.date_of_birth ?? "",
    "Ghana Card Number": c.ghana_card_number ?? "",
    "Occupation": c.occupation ?? "",
    "Residential Address": c.residential_address ?? "",
    "Town": c.town ?? "",
    "Next of Kin Name": c.next_of_kin_name ?? "",
    "Next of Kin Phone": c.next_of_kin_phone ?? "",
    "Account Type": ACCOUNT_TYPE_LABEL[accountTypeByClient.get(c.id) ?? ""] ?? "",
    "Daily Contribution": dailyContributionByClient.get(c.id) ?? "",
    "Status": c.status,
    "SMS Opt-in": c.sms_opt_in ? "Yes" : "No",
    "Registered On": new Date(c.created_at).toLocaleDateString("en-GB"),
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);

  // Column widths
  ws["!cols"] = [
    { wch: 12 }, { wch: 28 }, { wch: 16 }, { wch: 16 }, { wch: 8 },
    { wch: 14 }, { wch: 20 }, { wch: 20 }, { wch: 30 }, { wch: 18 },
    { wch: 24 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 10 }, { wch: 14 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Clients");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="clients-${date}.xlsx"`,
    },
  });
}
