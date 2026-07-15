import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { xlsxResponse } from "@/lib/export/xlsx";
import type { Account, Client, SusuClaim } from "@/lib/types";

type ClaimRow = SusuClaim & {
  account: (Account & { client: Client }) | null;
  requester: { full_name: string } | null;
  approver: { full_name: string } | null;
  payer: { full_name: string } | null;
};

const STATUS_LABEL: Record<SusuClaim["status"], string> = {
  pending_admin: "Pending admin",
  approved: "Approved",
  paid: "Paid",
  rejected: "Rejected",
};

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single<{ role: string }>();
  if (!profile || profile.role !== "admin") return NextResponse.json({ error: "Not authorised" }, { status: 403 });

  const { data: claims } = await supabase
    .from("susu_claims")
    .select("*, account:accounts(*, client:clients(*)), requester:requested_by(full_name), approver:approved_by(full_name), payer:paid_by(full_name)")
    .order("requested_at", { ascending: false })
    .returns<ClaimRow[]>();

  const rows = (claims ?? []).map((c) => ({
    "Client Name": c.account?.client?.full_name ?? "",
    "Client Code": c.account?.client?.client_code ?? "",
    "Account Number": c.account?.account_number ?? "",
    "Claim Type": c.claim_type,
    "Status": STATUS_LABEL[c.status],
    "Amount (GHS)": c.amount,
    "Penalty (GHS)": c.penalty_amount ?? 0,
    "Requested By": c.requester?.full_name ?? "",
    "Requested At": new Date(c.requested_at).toLocaleString("en-GB"),
    "Approved/Rejected By": c.approver?.full_name ?? "",
    "Decided At": c.decided_at ? new Date(c.decided_at).toLocaleString("en-GB") : "",
    "Paid By": c.payer?.full_name ?? "",
    "Paid At": c.paid_at ? new Date(c.paid_at).toLocaleString("en-GB") : "",
  }));

  return xlsxResponse(rows, {
    sheetName: "Susu Claims",
    filename: `susu-claims-${new Date().toISOString().slice(0, 10)}.xlsx`,
    colWidths: [24, 12, 16, 12, 16, 14, 14, 18, 20, 20, 20, 18, 20],
  });
}
