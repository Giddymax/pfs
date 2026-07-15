import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { xlsxResponse } from "@/lib/export/xlsx";
import type { Client, FdStatus, FixedDeposit } from "@/lib/types";

const FD_STATUS_LABEL: Record<FdStatus, string> = {
  active: "Active",
  matured: "Matured",
  pending_early: "Early w/d pending",
  approved_early: "Early w/d approved",
  withdrawn: "Withdrawn",
  rolled_over: "Rolled over",
};

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: deposits } = await supabase
    .from("fixed_deposits")
    .select("*, client:clients(*)")
    .order("created_at", { ascending: false })
    .returns<(FixedDeposit & { client: Client | null })[]>();

  const rows = (deposits ?? []).map((fd) => ({
    "Client Name": fd.client?.full_name ?? "",
    "Client Code": fd.client?.client_code ?? "",
    "Phone": fd.client?.phone ?? "",
    "FD Number": fd.fd_number,
    "Principal (GHS)": fd.principal,
    "Term (months)": fd.term_months,
    "Annual Rate (%)": fd.annual_rate_percent,
    "Expected Interest (GHS)": fd.expected_interest,
    "Expected Payout (GHS)": fd.expected_payout,
    "Start Date": new Date(fd.start_date).toLocaleDateString("en-GB"),
    "Maturity Date": new Date(fd.maturity_date).toLocaleDateString("en-GB"),
    "Status": FD_STATUS_LABEL[fd.status],
  }));

  return xlsxResponse(rows, {
    sheetName: "Fixed Deposits",
    filename: `fixed-deposits-${new Date().toISOString().slice(0, 10)}.xlsx`,
    colWidths: [24, 12, 14, 14, 14, 12, 14, 18, 16, 14, 14, 16],
  });
}
