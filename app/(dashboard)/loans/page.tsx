import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, LoanStatusBadge, EmptyState, Card } from "@/components/ui";
import { formatGHS } from "@/lib/loan";
import type { Loan, LoanStatus } from "@/lib/types";

const STATUS_FILTERS: { label: string; value: LoanStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Active", value: "active" },
  { label: "Completed", value: "completed" },
  { label: "Defaulted", value: "defaulted" },
  { label: "Rejected", value: "rejected" },
];

export default async function LoansPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const supabase = await createClient();

  let query = supabase.from("loans").select("*, client:clients(*)").order("created_at", { ascending: false });
  if (status && status !== "all") {
    query = query.eq("status", status);
  }
  const { data: loans } = await query.returns<Loan[]>();

  return (
    <div>
      <PageHeader
        eyebrow="Loans"
        title="All loans"
        description="Track issued loans, their repayment status and outstanding balances."
        action={
          <Link
            href="/loans/new"
            className="inline-flex items-center gap-2 rounded-md bg-[#0033AA] px-5 py-2.5 text-[13.5px] font-semibold text-[#FFFFFF] transition-colors hover:bg-[#002884]"
          >
            <Plus size={16} />
            Issue loan
          </Link>
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => {
          const active = (status ?? "all") === f.value;
          return (
            <Link
              key={f.value}
              href={f.value === "all" ? "/loans" : `/loans?status=${f.value}`}
              className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium transition-colors ${
                active
                  ? "border-[#0033AA] bg-[#0033AA] text-[#FFFFFF]"
                  : "border-[#0033AA]/15 text-[#0A2240]/55 hover:border-[#0033AA]/30"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {!loans || loans.length === 0 ? (
        <EmptyState
          title="No loans found"
          description="Loans matching this filter will appear here."
          action={
            <Link href="/loans/new" className="inline-flex items-center gap-2 rounded-md bg-[#0033AA] px-5 py-2.5 text-[13.5px] font-semibold text-[#FFFFFF] hover:bg-[#002884]">
              <Plus size={15} /> Issue loan
            </Link>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-left text-[14px]">
            <thead>
              <tr className="border-b border-[#0033AA]/8 bg-[#0033AA]/[0.02] text-[11px] uppercase tracking-[0.1em] text-[#0A2240]/45">
                <th className="px-5 py-3 font-semibold">Loan</th>
                <th className="px-5 py-3 font-semibold">Client</th>
                <th className="px-5 py-3 font-semibold">Principal</th>
                <th className="px-5 py-3 font-semibold">Repayable</th>
                <th className="px-5 py-3 font-semibold">Tenor</th>
                <th className="px-5 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#0033AA]/6">
              {loans.map((loan) => (
                <tr key={loan.id} className="transition-colors hover:bg-[#0033AA]/[0.025]">
                  <td className="px-5 py-3.5">
                    <Link href={`/loans/${loan.id}`} className="font-medium text-[#0A2240] hover:text-[#0033AA]">
                      {loan.loan_code}
                    </Link>
                    <p className="text-[12px] text-[#0A2240]/40">{loan.flat_rate_percent}% flat</p>
                  </td>
                  <td className="px-5 py-3.5">
                    <Link href={`/clients/${loan.client_id}`} className="text-[#0A2240]/70 hover:text-[#0033AA]">
                      {loan.client?.full_name ?? "—"}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 text-[#0A2240]/70">{formatGHS(loan.principal)}</td>
                  <td className="px-5 py-3.5 text-[#0A2240]/70">{formatGHS(loan.total_repayable)}</td>
                  <td className="px-5 py-3.5 text-[#0A2240]/70">{loan.tenor_months} months</td>
                  <td className="px-5 py-3.5">
                    <LoanStatusBadge status={loan.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
