import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { xlsxResponse } from "@/lib/export/xlsx";
import type { Client, Loan } from "@/lib/types";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: loans } = await supabase
    .from("loans")
    .select("*, client:clients(full_name, phone, client_code)")
    .order("created_at", { ascending: false })
    .returns<(Loan & { client: Pick<Client, "full_name" | "phone" | "client_code"> | null })[]>();

  const rows = (loans ?? []).map((l) => ({
    "Loan Code": l.loan_code,
    "Client Name": l.client?.full_name ?? "",
    "Client Code": l.client?.client_code ?? "",
    "Phone": l.client?.phone ?? "",
    "Principal (GHS)": l.principal,
    "Interest (GHS)": l.total_interest,
    "Total Repayable (GHS)": l.total_repayable,
    "Monthly Installment (GHS)": l.monthly_installment,
    "Rate (%)": l.flat_rate_percent,
    "Tenor (months)": l.tenor_months,
    "Processing Fee (GHS)": l.processing_fee ?? 0,
    "Status": l.status,
    "Disbursement Date": l.disbursement_date ?? "",
    "Due Date": l.due_date ?? "",
    "Current Balance (GHS)": l.current_balance ?? "",
    "Purpose": l.purpose ?? "",
    "Issued Date": new Date(l.created_at).toLocaleDateString("en-GB"),
  }));

  return xlsxResponse(rows, {
    sheetName: "Loans",
    filename: `loans-${new Date().toISOString().slice(0, 10)}.xlsx`,
    colWidths: [14, 24, 12, 14, 14, 14, 16, 18, 10, 12, 14, 12, 16, 14, 16, 24, 14],
  });
}
