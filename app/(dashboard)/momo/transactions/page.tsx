import { Search, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { computeMomoSummary } from "@/lib/finance/momo-summary";
import { MOMO_TYPES } from "@/lib/momo/types";
import { MomoStatCard } from "@/components/momo-stat-card";
import { MomoTypeBadge } from "@/components/momo-type-badge";
import { MomoTransactionForm } from "@/components/momo-transaction-form";
import { MomoTransactionRowActions } from "@/components/momo-transaction-row-actions";
import { SummaryControls } from "@/components/summary-controls";
import { TableFilter, type FilterOption } from "@/components/table-filter";
import { ExportCsvButton } from "@/components/export-csv-button";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { formatGHS } from "@/lib/loan";
import type { MomoTransaction } from "@/lib/types";

const TYPE_OPTIONS: FilterOption[] = MOMO_TYPES.map((t) => ({ value: t.value, label: t.label }));

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

// The MoMo transaction log — the only place a transaction's phone number or
// history is viewable, since MoMo has no wallet list/detail page by design
// (momo-mini-app-brief.md §3). Recording, filtering by type/phone/date, and
// admin edit/reverse all live on this one page.
export default async function MomoTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; preset?: string; type?: string; q?: string }>;
}) {
  const supabase = await createClient();
  const params = await searchParams;
  const from = params.from ?? monthStartISO();
  const to = params.to ?? todayISO();
  const type = params.type;
  const q = params.q?.trim() ?? "";

  let query = supabase
    .from("momo_transactions")
    .select("*, recorder:recorded_by(full_name)")
    .gte("created_at", `${from}T00:00:00`)
    .lte("created_at", `${to}T23:59:59.999`)
    .order("created_at", { ascending: false });

  if (type) query = query.eq("type", type);
  if (q) query = query.or(`phone_number.ilike.%${q}%,note.ilike.%${q}%`);

  const [{ data: rows, error }, summary] = await Promise.all([
    query.returns<(MomoTransaction & { recorder: { full_name: string } | null })[]>(),
    computeMomoSummary(supabase, { from, to }),
  ]);

  const transactions = rows ?? [];
  const qs = new URLSearchParams({
    from, to, preset: params.preset ?? "this_month",
    ...(q ? { q } : {}),
  }).toString();

  return (
    <div>
      <PageHeader
        eyebrow="MoMo"
        title="Transactions"
        description="Every walk-in MoMo transaction, newest first. Search by phone number, filter by type, or pick a date range."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ExportCsvButton
              endpoint="/api/momo/transactions/export"
              filename={`momo-transactions-${from}-to-${to}.xlsx`}
              label="Export Excel"
              params={{ from, to }}
            />
            <MomoTransactionForm />
          </div>
        }
      />

      {/* Date controls */}
      <div className="mb-6">
        <SummaryControls from={from} to={to} preset={params.preset ?? "this_month"} />
      </div>

      {/* Period band */}
      <div className="mb-6 rounded-lg border border-[#1A1A1A]/10 bg-[#1A1A1A]/[0.03] px-5 py-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#1A1A1A]/50">Period</p>
        <p className="mt-0.5 text-[15px] font-semibold text-[#0A2240]">{fmtDate(from)} — {fmtDate(to)}</p>
      </div>

      {/* Stat cards for the selected period */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MomoStatCard
          label="Transactions in period"
          value={String(summary.transactionCount)}
          tone="blue"
        />
        <MomoStatCard
          label="Amount moved in period"
          value={formatGHS(summary.totalAmount)}
          tone="green"
        />
        <MomoStatCard
          label="Charges collected in period"
          value={formatGHS(summary.totalCharge)}
          tone="yellow"
        />
      </div>

      {/* Search + type filter */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <form className="flex-1 min-w-[220px] max-w-sm">
          <input type="hidden" name="from" value={from} />
          <input type="hidden" name="to" value={to} />
          <input type="hidden" name="preset" value={params.preset ?? "this_month"} />
          {type && <input type="hidden" name="type" value={type} />}
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#1A1A1A]/35" />
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Search phone number or note"
              className="w-full rounded-md border border-[#1A1A1A]/15 bg-white py-2.5 pl-10 pr-4 text-[14px] outline-none transition-colors focus:border-[#E0A800]"
            />
          </div>
        </form>
        <span className="text-[11.5px] font-medium text-[#0A2240]/40">Type:</span>
        <TableFilter param="type" label="All types" options={TYPE_OPTIONS} current={type} qs={qs} />
      </div>

      {/* Transaction log */}
      <Card>
        {error && (
          <div className="border-b border-[#B3432B]/15 bg-[#B3432B]/[0.05] px-5 py-3 text-[12.5px] text-[#963522]">
            {error.message}
          </div>
        )}

        {transactions.length === 0 ? (
          <div className="px-5 py-12">
            <EmptyState
              title="No transactions in this period"
              description="Record one with the button above, or widen the date range."
            />
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <ul className="divide-y divide-[#1A1A1A]/6 lg:hidden">
              {transactions.map((t) => (
                <li key={t.id} className={`px-5 py-4 ${t.reversed_at ? "opacity-50" : ""}`}>
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <MomoTypeBadge type={t.type} />
                    <div className="text-right">
                      <p className="text-[13px] font-semibold tabular-nums text-[#1A1A1A]">{formatGHS(t.amount)}</p>
                      <p className="text-[11px] tabular-nums text-[#0A2240]/45">charge {formatGHS(t.charge)}</p>
                    </div>
                  </div>
                  <p className="flex items-center gap-1.5 text-[13.5px] font-medium text-[#0A2240]">
                    <UserRound size={13} className="text-[#0A2240]/35" />
                    {t.phone_number}
                  </p>
                  {t.note && <p className="mt-1 text-[12px] text-[#0A2240]/50">{t.note}</p>}
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-[11.5px] text-[#0A2240]/40">
                      {new Date(t.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} ·{" "}
                      {new Date(t.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                      {t.reversed_at && " · Reversed"}
                    </p>
                    <MomoTransactionRowActions transaction={t} />
                  </div>
                </li>
              ))}
            </ul>

            {/* Desktop table */}
            <div className="admin-table-wrap hidden lg:block">
              <table className="w-full min-w-[960px] text-left text-[14px]">
                <thead>
                  <tr className="border-b border-[#1A1A1A]/8 bg-[#1A1A1A]/[0.02] text-[11px] uppercase tracking-[0.1em] text-[#0A2240]/45">
                    <th className="px-5 py-3 font-semibold">Date</th>
                    <th className="px-5 py-3 font-semibold">Phone number</th>
                    <th className="px-5 py-3 font-semibold">Type</th>
                    <th className="px-5 py-3 text-right font-semibold">Amount</th>
                    <th className="px-5 py-3 text-right font-semibold">Charge</th>
                    <th className="px-5 py-3 font-semibold">Note</th>
                    <th className="px-5 py-3 font-semibold">Recorded by</th>
                    <th aria-label="Actions" className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1A1A1A]/6">
                  {transactions.map((t) => (
                    <tr key={t.id} className={`transition-colors hover:bg-[#1A1A1A]/[0.02] ${t.reversed_at ? "opacity-50" : ""}`}>
                      <td className="px-5 py-3.5 text-[#0A2240]/60">
                        {new Date(t.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        <span className="ml-1.5 text-[11.5px] text-[#0A2240]/35">
                          {new Date(t.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {t.reversed_at && <span className="ml-1.5 text-[11px] font-semibold text-[#963522]">Reversed</span>}
                      </td>
                      <td className="px-5 py-3.5 font-medium text-[#0A2240]">{t.phone_number}</td>
                      <td className="px-5 py-3.5"><MomoTypeBadge type={t.type} /></td>
                      <td className="px-5 py-3.5 text-right tabular-nums text-[#0A2240]/75">{formatGHS(t.amount)}</td>
                      <td className="px-5 py-3.5 text-right font-semibold tabular-nums text-[#1A1A1A]">{formatGHS(t.charge)}</td>
                      <td className="px-5 py-3.5 max-w-[220px] truncate text-[#0A2240]/55">{t.note ?? "—"}</td>
                      <td className="px-5 py-3.5 text-[#0A2240]/55">{t.recorder?.full_name ?? "—"}</td>
                      <td className="px-5 py-3.5">
                        <MomoTransactionRowActions transaction={t} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
