import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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

  const rows = [
    ["Loan Code", "Client Name", "Client Code", "Phone", "Principal (GHS)", "Interest (GHS)", "Total Repayable (GHS)", "Monthly Installment (GHS)", "Rate (%)", "Tenor (months)", "Processing Fee (GHS)", "Status", "Disbursement Date", "Due Date", "Current Balance (GHS)", "Purpose", "Issued Date"],
    ...(loans ?? []).map((l) => [
      l.loan_code,
      l.client?.full_name ?? "",
      l.client?.client_code ?? "",
      l.client?.phone ?? "",
      l.principal,
      l.total_interest,
      l.total_repayable,
      l.monthly_installment,
      l.flat_rate_percent,
      l.tenor_months,
      l.processing_fee ?? 0,
      l.status,
      l.disbursement_date ?? "",
      l.due_date ?? "",
      l.current_balance ?? "",
      l.purpose ?? "",
      new Date(l.created_at).toLocaleDateString("en-GB"),
    ]),
  ];

  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="loans-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
