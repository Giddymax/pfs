import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { MonthYearControl } from "@/components/month-year-control";
import { ExportCsvButton } from "@/components/export-csv-button";
import { AddReconciliationButton } from "@/components/record-reconciliation-button";
import { EditReconciliationButton, DeleteReconciliationButton } from "@/components/reconciliation-entry-actions";
import { formatGHS, round2 } from "@/lib/loan";
import type { Profile } from "@/lib/types";

interface ReconciliationEntry {
  id: string;
  entry_date: string;
  opening_cash_at_hand: number;
  deposit_received: number;
  withdrawal_paid: number;
  cash_issued_out: number;
  cash_at_bank: number;
  debt_owed: number | null;
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthBounds(month: string): { from: string; to: string } {
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthNum = Number(monthStr);
  const from = `${yearStr}-${monthStr}-01`;
  const lastDay = new Date(year, monthNum, 0).getDate();
  const to = `${yearStr}-${monthStr}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

function fmtDay(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function fmtMonthLabel(month: string) {
  const [year, monthStr] = month.split("-");
  return new Date(Number(year), Number(monthStr) - 1, 1).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
}

function derive(e: ReconciliationEntry) {
  const balanceAfterIssue = round2(e.opening_cash_at_hand - e.cash_issued_out);
  const unspentIssued = round2(e.cash_issued_out - e.withdrawal_paid);
  const closingCashAtHand = round2(e.opening_cash_at_hand - e.withdrawal_paid + e.deposit_received);
  const totalCash = round2(closingCashAtHand + e.cash_at_bank);
  return { balanceAfterIssue, unspentIssued, closingCashAtHand, totalCash };
}

export default async function ReconciliationPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();
  if (!profile || profile.role !== "admin") redirect("/");

  const params = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(params.month ?? "") ? params.month! : currentMonth();
  const { from, to } = monthBounds(month);

  const [{ data: monthRows, error }, { data: latestRows }] = await Promise.all([
    supabase
      .from("cash_reconciliations")
      .select("*")
      .gte("entry_date", from)
      .lte("entry_date", to)
      .order("entry_date", { ascending: true })
      .returns<ReconciliationEntry[]>(),
    supabase
      .from("cash_reconciliations")
      .select("*")
      .order("entry_date", { ascending: false })
      .limit(1)
      .returns<ReconciliationEntry[]>(),
  ]);

  const rows = monthRows ?? [];
  const suggestedOpeningBalance = latestRows?.[0] ? derive(latestRows[0]).closingCashAtHand : 0;

  const totals = rows.reduce(
    (acc, r) => {
      const d = derive(r);
      return {
        deposits: acc.deposits + Number(r.deposit_received),
        withdrawals: acc.withdrawals + Number(r.withdrawal_paid),
        closingCash: acc.closingCash + d.closingCashAtHand,
        cashAtBank: acc.cashAtBank + Number(r.cash_at_bank),
        totalCash: acc.totalCash + d.totalCash,
        debtOwed: acc.debtOwed + Number(r.debt_owed ?? 0),
      };
    },
    { deposits: 0, withdrawals: 0, closingCash: 0, cashAtBank: 0, totalCash: 0, debtOwed: 0 }
  );

  return (
    <div>
      <PageHeader
        back="/"
        eyebrow="Finance"
        title="Cash Reconciliation"
        description="Daily cash-in-hand and cash-at-bank reconciliation, one entry per day."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ExportCsvButton endpoint="/api/reconciliation/export" filename="cash-reconciliation.xlsx" label="Export Excel" />
            <AddReconciliationButton suggestedOpeningBalance={suggestedOpeningBalance} />
          </div>
        }
      />

      <div className="mb-6">
        <MonthYearControl month={month} />
      </div>

      <Card>
        <div className="border-b border-[#0033AA]/8 px-5 py-4">
          <h2 className="text-[15px] font-semibold text-[#0033AA]">{fmtMonthLabel(month)}</h2>
        </div>

        {error ? (
          <div className="px-5 py-10 text-center text-[13.5px] text-[#963522]">{error.message}</div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-10">
            <EmptyState title="No entries for this month" description="Use “Add entry” to record the first day's reconciliation." />
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table className="w-full min-w-[980px] text-left text-[14px]">
              <thead>
                <tr className="border-b border-[#0033AA]/8 bg-[#0033AA]/[0.02] text-[11px] uppercase tracking-[0.1em] text-[#0A2240]/45">
                  <th className="px-5 py-3 font-semibold">Date</th>
                  <th className="admin-col-secondary px-5 py-3 text-right font-semibold">Opening Balance</th>
                  <th className="px-5 py-3 text-right font-semibold">Deposit Received</th>
                  <th className="px-5 py-3 text-right font-semibold">Withdrawal Paid</th>
                  <th className="admin-col-secondary px-5 py-3 text-right font-semibold">Cash Issued Out</th>
                  <th className="admin-col-secondary px-5 py-3 text-right font-semibold">Unspent Issued</th>
                  <th className="px-5 py-3 text-right font-semibold">Closing Cash at Hand</th>
                  <th className="px-5 py-3 text-right font-semibold">Cash at Bank</th>
                  <th className="px-5 py-3 text-right font-semibold">Total Cash</th>
                  <th className="admin-col-secondary px-5 py-3 text-right font-semibold">Debt Owed</th>
                  <th className="px-5 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#0033AA]/6">
                {rows.map((r) => {
                  const d = derive(r);
                  return (
                    <tr key={r.id} className="transition-colors hover:bg-[#0033AA]/[0.02]">
                      <td className="whitespace-nowrap px-5 py-3.5 text-[#0A2240]/70">{fmtDay(r.entry_date)}</td>
                      <td className="admin-col-secondary px-5 py-3.5 text-right tabular-nums text-[#0A2240]/55">
                        {formatGHS(r.opening_cash_at_hand)}
                      </td>
                      <td className="px-5 py-3.5 text-right tabular-nums text-[#1F6E4A]">
                        {formatGHS(r.deposit_received)}
                      </td>
                      <td className="px-5 py-3.5 text-right tabular-nums text-[#963522]">
                        {formatGHS(r.withdrawal_paid)}
                      </td>
                      <td className="admin-col-secondary px-5 py-3.5 text-right tabular-nums text-[#0A2240]/55">
                        {formatGHS(r.cash_issued_out)}
                      </td>
                      <td className={`admin-col-secondary px-5 py-3.5 text-right tabular-nums ${d.unspentIssued < 0 ? "text-[#963522]" : "text-[#0A2240]/55"}`}>
                        {formatGHS(d.unspentIssued)}
                      </td>
                      <td className="px-5 py-3.5 text-right font-semibold tabular-nums text-[#0033AA]">
                        {formatGHS(d.closingCashAtHand)}
                      </td>
                      <td className="px-5 py-3.5 text-right tabular-nums text-[#0A2240]">
                        {formatGHS(r.cash_at_bank)}
                      </td>
                      <td className="px-5 py-3.5 text-right font-semibold tabular-nums text-[#0A2240]">
                        {formatGHS(d.totalCash)}
                      </td>
                      <td className="admin-col-secondary px-5 py-3.5 text-right tabular-nums text-[#963522]">
                        {r.debt_owed ? formatGHS(r.debt_owed) : <span className="text-[#0A2240]/30">—</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1">
                          <EditReconciliationButton entry={r} />
                          <DeleteReconciliationButton id={r.id} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#0033AA]/10 bg-[#0033AA]/[0.03]">
                  <td className="px-5 py-3.5 text-[13px] font-semibold text-[#0033AA]">Total</td>
                  <td className="admin-col-secondary px-5 py-3.5" />
                  <td className="px-5 py-3.5 text-right text-[14px] font-bold tabular-nums text-[#1F6E4A]">
                    {formatGHS(totals.deposits)}
                  </td>
                  <td className="px-5 py-3.5 text-right text-[14px] font-bold tabular-nums text-[#963522]">
                    {formatGHS(totals.withdrawals)}
                  </td>
                  <td className="admin-col-secondary px-5 py-3.5" />
                  <td className="admin-col-secondary px-5 py-3.5" />
                  <td className="px-5 py-3.5 text-right text-[14px] font-bold tabular-nums text-[#0033AA]">
                    {formatGHS(totals.closingCash)}
                  </td>
                  <td className="px-5 py-3.5 text-right text-[14px] font-bold tabular-nums text-[#0A2240]">
                    {formatGHS(totals.cashAtBank)}
                  </td>
                  <td className="px-5 py-3.5 text-right text-[14px] font-bold tabular-nums text-[#0A2240]">
                    {formatGHS(totals.totalCash)}
                  </td>
                  <td className="admin-col-secondary px-5 py-3.5 text-right text-[14px] font-bold tabular-nums text-[#963522]">
                    {formatGHS(totals.debtOwed)}
                  </td>
                  <td className="px-5 py-3.5" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
