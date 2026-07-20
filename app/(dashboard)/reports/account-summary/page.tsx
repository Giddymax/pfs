import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { MonthYearControl } from "@/components/month-year-control";
import { PrintButton } from "@/components/print-button";
import { Logo } from "@/components/logo";
import { PrintWatermark } from "@/components/print-watermark";
import { formatGHS } from "@/lib/loan";
import type { Profile } from "@/lib/types";

interface DailySummaryRow {
  summary_date: string;
  total_deposits: number;
  total_withdrawals: number;
  total_commission: number;
  total_sms_fees: number;
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
      smsFees: acc.smsFees + Number(r.total_sms_fees),
    }),
    { deposits: 0, withdrawals: 0, commission: 0, smsFees: 0 }
  );

  const printedAt = new Date().toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div>
      <div className="print:hidden">
        <PageHeader
          back="/"
          eyebrow="Reports"
          title="Account Summary"
          description="Daily deposits, withdrawals, commission, and SMS fees for any month."
        />
      </div>

      <div className="mb-6 print:hidden">
        <MonthYearControl month={month} />
      </div>

      {/* ══════════════════════════════════════
          PRINTABLE SHEET  —  id="pfs-summary-sheet"
          ══════════════════════════════════════ */}
      <div id="pfs-summary-sheet" className="space-y-5">

        {/* Watermark (print only) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <PrintWatermark />

        {/* Print-only letterhead */}
        <div className="hidden print:flex print:items-start print:justify-between print:pb-4">
          <div className="flex items-center gap-3">
            <Logo size={40} />
            <div className="leading-tight">
              <p className="text-[17px] font-bold tracking-[0.08em] text-[#0033AA]">PRIME</p>
              <p className="text-[10px] font-semibold tracking-[0.18em] text-[#0A2240]/70">FINANCIAL SERVICE</p>
            </div>
          </div>
          <div className="text-right text-[11px] text-[#0A2240]/45">
            <p className="font-semibold text-[#0A2240]/60">Account Summary Report</p>
            <p>Printed: {printedAt}</p>
            <p>By: {profile.full_name}</p>
          </div>
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
              <table className="w-full min-w-[680px] text-left text-[14px]">
                <thead>
                  <tr className="border-b border-[#0A2240]/8 bg-[#0A2240]/[0.02] text-[11px] uppercase tracking-[0.1em] text-[#0A2240]/45">
                    <th className="px-5 py-3 font-semibold">Date</th>
                    <th className="px-5 py-3 text-right font-semibold">Total Deposits</th>
                    <th className="px-5 py-3 text-right font-semibold">Total Withdrawals</th>
                    <th className="px-5 py-3 text-right font-semibold">Total Commission</th>
                    <th className="px-5 py-3 text-right font-semibold">Total SMS Fees</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#0A2240]/6">
                  {rows.map((r) => (
                    <tr key={r.summary_date} className="transition-colors hover:bg-[#0A2240]/[0.02]">
                      <td className="px-5 py-3 text-[#0A2240]/70">{fmtDay(r.summary_date)}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-[#1F6E4A]">{formatGHS(Number(r.total_deposits))}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-[#963522]">{formatGHS(Number(r.total_withdrawals))}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-[#0A2240]">{formatGHS(Number(r.total_commission))}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-[#0A2240]">{formatGHS(Number(r.total_sms_fees))}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[#0A2240]/10 bg-[#0A2240]/[0.03]">
                    <td className="px-5 py-3.5 text-[13px] font-semibold text-[#0A2240]">Total</td>
                    <td className="px-5 py-3.5 text-right text-[14px] font-bold tabular-nums text-[#1F6E4A]">{formatGHS(totals.deposits)}</td>
                    <td className="px-5 py-3.5 text-right text-[14px] font-bold tabular-nums text-[#963522]">{formatGHS(totals.withdrawals)}</td>
                    <td className="px-5 py-3.5 text-right text-[14px] font-bold tabular-nums text-[#0A2240]">{formatGHS(totals.commission)}</td>
                    <td className="px-5 py-3.5 text-right text-[14px] font-bold tabular-nums text-[#0A2240]">{formatGHS(totals.smsFees)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* ─── Print footer ─── */}
        <div className="hidden border-t border-[#0A2240]/10 pt-3 text-[10.5px] text-[#0A2240]/40 print:flex print:items-center print:justify-between">
          <p>Prime Financial Service — confidential</p>
          <p>{printedAt}</p>
        </div>
      </div>

      {/* Floating print button on screen (outside the sheet so it doesn't print) */}
      <div className="mt-6 flex justify-end print:hidden">
        <PrintButton label="Print account summary" />
      </div>
    </div>
  );
}
