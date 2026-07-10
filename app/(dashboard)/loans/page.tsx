import Link from "next/link";
import { Plus, Search, AlertTriangle, Phone } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, LoanStatusBadge, EmptyState, Card } from "@/components/ui";
import { TableFilter, type FilterOption } from "@/components/table-filter";
import { ExportCsvButton } from "@/components/export-csv-button";
import { formatGHS } from "@/lib/loan";
import type { Client, Loan, LoanStatus } from "@/lib/types";

const STATUS_PILLS: { label: string; value: LoanStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Active", value: "active" },
  { label: "Completed", value: "completed" },
  { label: "Defaulted", value: "defaulted" },
  { label: "Rejected", value: "rejected" },
];

const STATUS_OPTIONS: FilterOption[] = STATUS_PILLS.filter((p) => p.value !== "all").map((p) => ({
  value: p.value,
  label: p.label,
}));

function pillHref(statusValue: string, q: string | undefined) {
  const p = new URLSearchParams();
  if (q?.trim()) p.set("q", q.trim());
  if (statusValue !== "all") p.set("status", statusValue);
  const s = p.toString();
  return s ? `/loans?${s}` : "/loans";
}

function daysOverdue(dueDateStr: string | null): number {
  if (!dueDateStr) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDateStr);
  due.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)));
}

export default async function LoansPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status, q } = await searchParams;
  const supabase = await createClient();

  const qs = new URLSearchParams({
    ...(status && status !== "all" ? { status } : {}),
    ...(q?.trim() ? { q: q.trim() } : {}),
  }).toString();

  // Fetch overdue active loans for the at-risk banner (always, regardless of filter)
  const today = new Date().toISOString().slice(0, 10);
  const { data: overdueLoans } = await supabase
    .from("loans")
    .select("*, client:clients(full_name, phone, client_code)")
    .eq("status", "active")
    .lt("due_date", today)
    .order("due_date", { ascending: true })
    .returns<(Loan & { client: Pick<Client, "full_name" | "phone" | "client_code"> | null })[]>();

  // Main loan list
  let query = supabase
    .from("loans")
    .select("*, client:clients(*)")
    .order("created_at", { ascending: false });

  if (status && status !== "all") query = query.eq("status", status);

  if (q?.trim()) {
    const term = q.trim();
    const { data: matchedClients } = await supabase
      .from("clients")
      .select("id")
      .ilike("full_name", `%${term}%`);
    const cids = (matchedClients ?? []).map((c: { id: string }) => c.id);
    if (cids.length > 0) {
      query = query.or(`loan_code.ilike.%${term}%,client_id.in.(${cids.join(",")})`);
    } else {
      query = query.ilike("loan_code", `%${term}%`);
    }
  }

  const { data: loans } = await query.returns<Loan[]>();

  const hasSearch = !!q?.trim();
  const hasFilter = !!(status && status !== "all");
  const showOverdueBanner = (overdueLoans ?? []).length > 0 && !hasFilter && !hasSearch;

  return (
    <div>
      <PageHeader
        eyebrow="Loans"
        title="All loans"
        description="Track issued loans, their repayment status and outstanding balances."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ExportCsvButton endpoint="/api/export/loans" filename="loans.csv" label="Export CSV" />
            <Link
              href="/loans/new"
              className="inline-flex items-center gap-2 rounded-md bg-[#1D3461] px-5 py-2.5 text-[13.5px] font-semibold text-[#FFFFFF] transition-colors hover:bg-[#152847]"
            >
              <Plus size={16} />
              Issue loan
            </Link>
          </div>
        }
      />

      {/* ── Overdue / At-Risk Banner ── */}
      {showOverdueBanner && (
        <div className="mb-6 rounded-xl border border-[#B3432B]/25 bg-[#FEF2F0]">
          <div className="flex items-center gap-2.5 border-b border-[#B3432B]/15 px-5 py-3.5">
            <AlertTriangle size={16} className="shrink-0 text-[#963522]" />
            <p className="text-[13.5px] font-semibold text-[#963522]">
              {overdueLoans!.length} overdue loan{overdueLoans!.length > 1 ? "s" : ""} — past due date but still active
            </p>
            <Link
              href="/loans?status=defaulted"
              className="ml-auto text-[12px] font-medium text-[#963522] underline underline-offset-2 hover:text-[#7a2918]"
            >
              View defaulted
            </Link>
          </div>
          <ul className="divide-y divide-[#B3432B]/10">
            {overdueLoans!.map((loan) => {
              const overdue = daysOverdue(loan.due_date);
              return (
                <li key={loan.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/loans/${loan.id}`} className="text-[13.5px] font-semibold text-[#963522] hover:underline">
                        {loan.loan_code}
                      </Link>
                      <span className="rounded-full bg-[#B3432B]/12 px-2 py-0.5 text-[11px] font-semibold text-[#963522]">
                        {overdue}d overdue
                      </span>
                    </div>
                    <p className="text-[12px] text-[#0A2240]/55">
                      {loan.client?.full_name ?? "—"} · due {formatDate(loan.due_date)} · {formatGHS(loan.current_balance ?? 0)} remaining
                    </p>
                  </div>
                  {loan.client?.phone && (
                    <a
                      href={`tel:${loan.client.phone}`}
                      className="inline-flex items-center gap-1.5 rounded-md border border-[#B3432B]/20 px-3 py-1.5 text-[11.5px] font-medium text-[#963522] transition-colors hover:bg-[#B3432B]/[0.06]"
                    >
                      <Phone size={12} />
                      {loan.client.phone}
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Search */}
      <form className="mb-4 sm:max-w-sm">
        {status && status !== "all" && <input type="hidden" name="status" value={status} />}
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#1D3461]/35" />
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search loans or clients…"
            className="w-full rounded-md border border-[#1D3461]/15 bg-white py-2.5 pl-10 pr-4 text-[14px] outline-none transition-colors focus:border-[#2CBFBF]"
          />
        </div>
      </form>

      {/* Status pills */}
      <div className="mb-6 flex flex-wrap gap-2">
        {STATUS_PILLS.map((f) => {
          const active = (status ?? "all") === f.value;
          return (
            <Link
              key={f.value}
              href={pillHref(f.value, q)}
              className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium transition-colors ${
                active
                  ? "border-[#1D3461] bg-[#1D3461] text-[#FFFFFF]"
                  : "border-[#1D3461]/15 text-[#0A2240]/55 hover:border-[#1D3461]/30"
              }`}
            >
              {f.label}
              {f.value === "active" && (overdueLoans ?? []).length > 0 && (
                <span className="ml-1.5 rounded-full bg-[#963522] px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {overdueLoans!.length}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {!loans || loans.length === 0 ? (
        <EmptyState
          title={hasSearch || hasFilter ? "No loans match your search" : "No loans found"}
          description={
            hasSearch || hasFilter
              ? "Try adjusting your search term or status filter."
              : "Loans matching this filter will appear here."
          }
          action={
            !hasSearch && !hasFilter ? (
              <Link href="/loans/new" className="inline-flex items-center gap-2 rounded-md bg-[#1D3461] px-5 py-2.5 text-[13.5px] font-semibold text-[#FFFFFF] hover:bg-[#152847]">
                <Plus size={15} /> Issue loan
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          {/* ── Mobile card list ── */}
          <ul className="space-y-3 lg:hidden">
            {loans.map((loan) => {
              const overdue = loan.status === "active" ? daysOverdue(loan.due_date) : 0;
              return (
                <li key={loan.id} className={`rounded-xl border bg-white shadow-sm ${overdue > 0 ? "border-[#B3432B]/30" : "border-[#1D3461]/8"}`}>
                  <Link href={`/loans/${loan.id}`} className="flex items-center justify-between gap-3 px-4 py-3.5">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[14px] font-semibold text-[#0A2240]">{loan.loan_code}</p>
                        <LoanStatusBadge status={loan.status} />
                        {overdue > 0 && (
                          <span className="rounded-full bg-[#B3432B]/12 px-2 py-0.5 text-[10.5px] font-semibold text-[#963522]">
                            {overdue}d overdue
                          </span>
                        )}
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
              );
            })}
          </ul>

          {/* ── Desktop table ── */}
          <Card className="hidden overflow-hidden lg:block">
            <div className="pfs-table-scroll">
            <table className="w-full min-w-[860px] text-left text-[14px]">
              <thead>
                <tr className="border-b border-[#1D3461]/8 bg-[#1D3461]/[0.02] text-[11px] uppercase tracking-[0.1em] text-[#0A2240]/45">
                  <th className="px-5 py-3 font-semibold">Loan</th>
                  <th className="px-5 py-3 font-semibold">Client</th>
                  <th className="px-5 py-3 font-semibold">Principal</th>
                  <th className="px-5 py-3 font-semibold">Repayable</th>
                  <th className="px-5 py-3 font-semibold">Tenor</th>
                  <th className="px-5 py-3 font-semibold">Due Date</th>
                  <th aria-label="Status" className="px-5 py-3 font-semibold">
                    <TableFilter
                      param="status"
                      label="Status"
                      options={STATUS_OPTIONS}
                      current={status && status !== "all" ? status : undefined}
                      qs={qs}
                    />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1D3461]/6">
                {loans.map((loan) => {
                  const overdue = loan.status === "active" ? daysOverdue(loan.due_date) : 0;
                  return (
                    <tr key={loan.id} className={`transition-colors ${overdue > 0 ? "bg-[#FEF2F0]/60 hover:bg-[#FEF2F0]" : "hover:bg-[#1D3461]/[0.025]"}`}>
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
                        {loan.due_date ? (
                          <span className={overdue > 0 ? "font-medium text-[#963522]" : "text-[#0A2240]/70"}>
                            {formatDate(loan.due_date)}
                            {overdue > 0 && <span className="ml-1 text-[11px]">({overdue}d)</span>}
                          </span>
                        ) : <span className="text-[#0A2240]/35">—</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        <LoanStatusBadge status={loan.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
