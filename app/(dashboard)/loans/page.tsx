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
            className="inline-flex items-center gap-2 rounded-md bg-[#1D3461] px-5 py-2.5 text-[13.5px] font-semibold text-[#FFFFFF] transition-colors hover:bg-[#152847]"
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
                  ? "border-[#1D3461] bg-[#1D3461] text-[#FFFFFF]"
                  : "border-[#1D3461]/15 text-[#0A2240]/55 hover:border-[#1D3461]/30"
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
            <Link href="/loans/new" className="inline-flex items-center gap-2 rounded-md bg-[#1D3461] px-5 py-2.5 text-[13.5px] font-semibold text-[#FFFFFF] hover:bg-[#152847]">
              <Plus size={15} /> Issue loan
            </Link>
          }
        />
      ) : (
        <>
          {/* ── Mobile card list (hidden on lg+) ─────────────────────── */}
          <ul className="space-y-3 lg:hidden">
            {loans.map((loan) => (
              <li key={loan.id} className="rounded-xl border border-[#1D3461]/8 bg-white shadow-sm">
                <Link href={`/loans/${loan.id}`} className="flex items-center justify-between gap-3 px-4 py-3.5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[14px] font-semibold text-[#0A2240]">{loan.loan_code}</p>
                      <LoanStatusBadge status={loan.status} />
                    </div>
                    <p className="mt-0.5 truncate text-[13px] text-[#0A2240]/65">{loan.client?.full_name ?? "—"}</p>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-[#0A2240]/50">
                      <span className="font-medium text-[#0A2240]">{formatGHS(loan.principal)}</span>
                      <span>repayable {formatGHS(loan.total_repayable)}</span>
                      <span>{loan.tenor_months} months · {loan.flat_rate_percent}% flat</span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {/* ── Desktop table (hidden on mobile) ─────────────────────── */}
          <Card className="hidden overflow-hidden lg:block">
            <table className="w-full text-left text-[14px]">
              <thead>
                <tr className="border-b border-[#1D3461]/8 bg-[#1D3461]/[0.02] text-[11px] uppercase tracking-[0.1em] text-[#0A2240]/45">
                  <th className="px-5 py-3 font-semibold">Loan</th>
                  <th className="px-5 py-3 font-semibold">Client</th>
                  <th className="px-5 py-3 font-semibold">Principal</th>
                  <th className="px-5 py-3 font-semibold">Repayable</th>
                  <th className="px-5 py-3 font-semibold">Tenor</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1D3461]/6">
                {loans.map((loan) => (
                  <tr key={loan.id} className="transition-colors hover:bg-[#1D3461]/[0.025]">
                    <td className="px-5 py-3.5">
                      <Link href={`/loans/${loan.id}`} className="font-medium text-[#0A2240] hover:text-[#1D3461]">
                        {loan.loan_code}
                      </Link>
                      <p className="text-[12px] text-[#0A2240]/40">{loan.flat_rate_percent}% flat</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <Link href={`/clients/${loan.client_id}`} className="text-[#0A2240]/70 hover:text-[#1D3461]">
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
        </>
      )}
    </div>
  );
}
