import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { MonthYearControl } from "@/components/month-year-control";
import { formatGHS } from "@/lib/loan";
import type { Profile } from "@/lib/types";

interface DailySummaryRow {
  summary_date: string;
  total_deposits: number;
  total_withdrawals: number;
  total_commission: number;
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

export default async function AccountSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
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

  const { data, error } = await supabase.rpc("list_daily_account_summary", { p_from: from, p_to: to });
  const rows = (data ?? []) as DailySummaryRow[];

  const totals = rows.reduce(
    (acc, r) => ({
      deposits: acc.deposits + Number(r.total_deposits),
      withdrawals: acc.withdrawals + Number(r.total_withdrawals),
      commission: acc.commission + Number(r.total_commission),
    }),
    { deposits: 0, withdrawals: 0, commission: 0 }
  );

  return (
    <div>
      <PageHeader
        back="/"
        eyebrow="Reports"
        title="Account Summary"
        description="Daily deposits, withdrawals, and commission for any month."
      />

      <div className="mb-6">
        <MonthYearControl month={month} />
      </div>

      <div className="overflow-hidden rounded-xl border border-[#0A2240]/8 bg-white shadow-sm">
        <div className="border-b border-[#0A2240]/8 px-5 py-3.5">
          <h2 className="text-[13.5px] font-semibold text-[#0A2240]">{fmtMonthLabel(month)}</h2>
        </div>

        {error ? (
          <div className="px-5 py-10 text-center text-[13.5px] text-[#963522]">{error.message}</div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-10 text-center text-[13.5px] text-[#0A2240]/40">
            No data for this month.
          </div>
        ) : (
          <div className="pfs-table-scroll">
            <table className="w-full min-w-[560px] text-left text-[14px]">
              <thead>
                <tr className="border-b border-[#0A2240]/8 bg-[#0A2240]/[0.02] text-[11px] uppercase tracking-[0.1em] text-[#0A2240]/45">
                  <th className="px-5 py-3 font-semibold">Date</th>
                  <th className="px-5 py-3 text-right font-semibold">Total Deposits</th>
                  <th className="px-5 py-3 text-right font-semibold">Total Withdrawals</th>
                  <th className="px-5 py-3 text-right font-semibold">Total Commission</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#0A2240]/6">
                {rows.map((r) => (
                  <tr key={r.summary_date} className="transition-colors hover:bg-[#0A2240]/[0.02]">
                    <td className="px-5 py-3 text-[#0A2240]/70">{fmtDay(r.summary_date)}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-[#1F6E4A]">{formatGHS(Number(r.total_deposits))}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-[#963522]">{formatGHS(Number(r.total_withdrawals))}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-[#0A2240]">{formatGHS(Number(r.total_commission))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#0A2240]/10 bg-[#0A2240]/[0.03]">
                  <td className="px-5 py-3.5 text-[13px] font-semibold text-[#0A2240]">Total</td>
                  <td className="px-5 py-3.5 text-right text-[14px] font-bold tabular-nums text-[#1F6E4A]">{formatGHS(totals.deposits)}</td>
                  <td className="px-5 py-3.5 text-right text-[14px] font-bold tabular-nums text-[#963522]">{formatGHS(totals.withdrawals)}</td>
                  <td className="px-5 py-3.5 text-right text-[14px] font-bold tabular-nums text-[#0A2240]">{formatGHS(totals.commission)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
