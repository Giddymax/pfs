"use client";

import { useState } from "react";
import { Printer, X } from "lucide-react";
import { Logo } from "@/components/logo";
import { PrintPortal } from "@/components/print-portal";
import { PrintWatermark } from "@/components/print-watermark";
import { formatGHS } from "@/lib/loan";

interface RevenueItem {
  label: string;
  value: number;
}

interface Expenditure {
  id: string;
  title: string;
  amount: number;
  category: string;
  date: string;
  notes: string | null;
}

type InvestmentStatus = "active" | "returned";

interface Investment {
  id: string;
  title: string;
  investment_type: string;
  amount_invested: number;
  revenue_made: number;
  status: InvestmentStatus;
  date: string;
  return_date: string | null;
  notes: string | null;
}

export function PrintFinanceSummaryButton({
  totalRevenue,
  totalExpenditure,
  netBalance,
  revenueItems,
  expenditures,
  investments,
  totalInvested,
  activeInvestmentTotal,
  investmentDeductedFromRevenue,
  investmentDeductedFromAccount,
  investmentRevenue,
  printedBy,
  companyPhone,
}: {
  totalRevenue: number;
  totalExpenditure: number;
  netBalance: number;
  revenueItems: RevenueItem[];
  expenditures: Expenditure[];
  investments: Investment[];
  totalInvested: number;
  activeInvestmentTotal: number;
  investmentDeductedFromRevenue: number;
  investmentDeductedFromAccount: number;
  investmentRevenue: number;
  printedBy?: string | null;
  companyPhone?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [printedAt, setPrintedAt] = useState<Date | null>(null);

  function handleOpen() {
    setPrintedAt(new Date());
    setOpen(true);
  }

  const surplus = netBalance >= 0;

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center gap-1.5 rounded-md border border-[#0033AA]/20 px-3 py-1.5 text-[11.5px] font-medium text-[#0033AA] transition-colors hover:bg-[#0033AA]/5"
      >
        <Printer size={12} />
        Print summary
      </button>

      {open && (
        <PrintPortal>
        <div className="print-overlay fixed inset-0 z-50 overflow-y-auto bg-[#061B3A]/55 px-4 py-8 animate-fade-in">
          <div className="mx-auto flex max-w-[820px] justify-end gap-2 pb-3 print:hidden">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-md bg-[#0033AA] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#002884]"
            >
              <Printer size={14} />
              Print
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-2 rounded-md border border-white/25 px-4 py-2 text-[13px] font-medium text-white hover:bg-white/10"
            >
              <X size={14} />
              Close
            </button>
          </div>

          <div
            id="pfs-print-finance"
            className="mx-auto max-w-[820px] rounded-lg bg-white px-10 py-9 text-[#0A2240] shadow-2xl print:max-w-none print:rounded-none print:px-12 print:py-10 print:shadow-none"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <PrintWatermark />

            <div className="flex items-start justify-between gap-6 pb-5">
              <div className="flex items-center gap-3">
                <Logo size={44} />
                <div className="leading-tight">
                  <p className="text-[18px] font-bold tracking-[0.08em] text-[#0033AA]">PRIME</p>
                  <p className="text-[11px] font-semibold tracking-[0.18em] text-[#0A2240]/70">FINANCIAL SERVICE</p>
                  {companyPhone && <p className="mt-0.5 text-[10.5px] text-[#0A2240]/45">Tel: {companyPhone}</p>}
                </div>
              </div>
              <div className="text-right text-[11px] text-[#0A2240]/45">
                <p className="font-semibold text-[#0A2240]/60">Finance Summary Report</p>
                <p>
                  As at: {" "}
                  {printedAt
                    ? printedAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
                    : "-"}
                </p>
                <p>Printed by: {printedBy ?? "-"}</p>
              </div>
            </div>

            <div className="h-[3px] w-full bg-[#0033AA]" />
            <p className="py-3.5 text-center text-[13px] font-bold tracking-[0.12em] text-[#0A2240]">
              COMPANY FINANCE SUMMARY
            </p>

            <div className="mb-6 grid grid-cols-5 gap-3">
              <SummaryBox label="Total Revenue" value={formatGHS(totalRevenue)} color="#15803D" />
              <SummaryBox label="Returned Investment Revenue" value={formatGHS(investmentRevenue)} color="#1F6E4A" />
              <SummaryBox label="Active Investments" value={formatGHS(activeInvestmentTotal)} color="#0D9488" sub={`${formatGHS(investmentDeductedFromRevenue)} from revenue`} />
              <SummaryBox label="Account Balance Used" value={formatGHS(investmentDeductedFromAccount)} color="#D97706" />
              <SummaryBox
                label="Net Balance"
                value={(surplus ? "" : "-") + formatGHS(Math.abs(netBalance))}
                color={surplus ? "#0033AA" : "#7C3AED"}
                sub={surplus ? "Surplus" : "Deficit"}
              />
            </div>

            <Section title="Revenue Breakdown">
              <table className="w-full text-left text-[12px]">
                <thead>
                  <tr className="border-b border-[#0A2240]/10 bg-[#0A2240]/[0.04]">
                    <th className="px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#0A2240]/50">Source</th>
                    <th className="px-4 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-[#0A2240]/50">Amount</th>
                    <th className="px-4 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-[#0A2240]/50">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#0A2240]/6">
                  {revenueItems.map((item) => (
                    <tr key={item.label}>
                      <td className="px-4 py-2.5 text-[#0A2240]/70">{item.label}</td>
                      <td className={`px-4 py-2.5 text-right tabular-nums font-medium ${item.value < 0 ? "text-[#B3432B]" : "text-[#0A2240]"}`}>
                        {formatGHS(item.value)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-[#0A2240]/50">
                        {totalRevenue > 0 && item.value > 0 ? ((item.value / totalRevenue) * 100).toFixed(1) + "%" : "-"}
                      </td>
                    </tr>
                  ))}
                  {investmentDeductedFromAccount > 0 && (
                    <tr>
                      <td className="px-4 py-2.5 text-[#0A2240]/70">Taken from account balance</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium text-[#D97706]">
                        {formatGHS(investmentDeductedFromAccount)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-[#0A2240]/50">-</td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[#0A2240]/15 bg-[#0A2240]/[0.03]">
                    <td className="px-4 py-2.5 text-[12px] font-bold text-[#0A2240]">Total Revenue</td>
                    <td className="px-4 py-2.5 text-right text-[13px] font-bold tabular-nums text-[#15803D]">
                      {formatGHS(totalRevenue)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-[12px] font-semibold tabular-nums text-[#0A2240]/60">100%</td>
                  </tr>
                </tfoot>
              </table>
            </Section>

            <Section title={`Investment Log (${investments.length} entr${investments.length === 1 ? "y" : "ies"})`}>
              {investments.length === 0 ? (
                <p className="px-4 py-4 text-[12px] text-[#0A2240]/45">No investments recorded.</p>
              ) : (
                <table className="w-full text-left text-[12px]">
                  <thead>
                    <tr className="border-b border-[#0A2240]/10 bg-[#0A2240]/[0.04]">
                      <th className="px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#0A2240]/50">Date</th>
                      <th className="px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#0A2240]/50">Status</th>
                      <th className="px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#0A2240]/50">Investment</th>
                      <th className="px-4 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-[#0A2240]/50">Invested</th>
                      <th className="px-4 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-[#0A2240]/50">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#0A2240]/6">
                    {investments.map((investment) => (
                      <tr key={investment.id}>
                        <td className="whitespace-nowrap px-4 py-2.5 text-[#0A2240]/60">
                          {formatDate(investment.date)}
                        </td>
                        <td className="px-4 py-2.5 text-[#0A2240]/70">
                          {investment.status === "returned" ? "Returned" : "Active"}
                          {investment.return_date && <p className="text-[11px] text-[#0A2240]/45">{formatDate(investment.return_date)}</p>}
                        </td>
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-[#0A2240]">{investment.title}</p>
                          <p className="text-[11px] text-[#0A2240]/45">{investment.investment_type}</p>
                          {investment.notes && (
                            <p className="text-[11px] text-[#0A2240]/45">{investment.notes}</p>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums font-medium text-[#0A2240]">
                          {formatGHS(investment.amount_invested)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums font-medium text-[#15803D]">
                          {formatGHS(investment.revenue_made)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-[#0A2240]/15 bg-[#0A2240]/[0.03]">
                      <td colSpan={3} className="px-4 py-2.5 text-[12px] font-bold text-[#0A2240]">Total Investments</td>
                      <td className="px-4 py-2.5 text-right text-[13px] font-bold tabular-nums text-[#0A2240]">
                        {formatGHS(totalInvested)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-[13px] font-bold tabular-nums text-[#15803D]">
                        {formatGHS(investmentRevenue)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </Section>

            <Section title={`Expenditure Log (${expenditures.length} entr${expenditures.length === 1 ? "y" : "ies"})`}>
              {expenditures.length === 0 ? (
                <p className="px-4 py-4 text-[12px] text-[#0A2240]/45">No expenditures recorded.</p>
              ) : (
                <table className="w-full text-left text-[12px]">
                  <thead>
                    <tr className="border-b border-[#0A2240]/10 bg-[#0A2240]/[0.04]">
                      <th className="px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#0A2240]/50">Date</th>
                      <th className="px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#0A2240]/50">Category</th>
                      <th className="px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#0A2240]/50">Description</th>
                      <th className="px-4 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-[#0A2240]/50">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#0A2240]/6">
                    {expenditures.map((exp) => (
                      <tr key={exp.id}>
                        <td className="whitespace-nowrap px-4 py-2.5 text-[#0A2240]/60">
                          {formatDate(exp.date)}
                        </td>
                        <td className="px-4 py-2.5 text-[#0A2240]/70">{exp.category}</td>
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-[#0A2240]">{exp.title}</p>
                          {exp.notes && (
                            <p className="text-[11px] text-[#0A2240]/45">{exp.notes}</p>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums font-medium text-[#B3432B]">
                          {formatGHS(exp.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-[#0A2240]/15 bg-[#0A2240]/[0.03]">
                      <td colSpan={3} className="px-4 py-2.5 text-[12px] font-bold text-[#0A2240]">Total Expenditure</td>
                      <td className="px-4 py-2.5 text-right text-[13px] font-bold tabular-nums text-[#B3432B]">
                        {formatGHS(totalExpenditure)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </Section>

            <div className="mt-5 rounded-md border border-[#0A2240]/12 bg-[#0A2240]/[0.025] px-5 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0A2240]/50">
                    Net Balance (Revenue - Expenditure)
                  </p>
                  <p className="mt-1 text-[11.5px] text-[#0A2240]/55">
                    {formatGHS(totalRevenue)} - {formatGHS(totalExpenditure)} = {surplus ? "Surplus" : "Deficit"} of {formatGHS(Math.abs(netBalance))}
                  </p>
                </div>
                <p className={`text-[1.5rem] font-bold tabular-nums ${surplus ? "text-[#15803D]" : "text-[#B3432B]"}`}>
                  {surplus ? "" : "-"}{formatGHS(Math.abs(netBalance))}
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-[#0A2240]/10 pt-3 text-[10.5px] text-[#0A2240]/40">
              <p>Printed by: {printedBy ?? "-"}</p>
              <p>
                {printedAt
                  ? printedAt.toLocaleString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : ""}
              </p>
            </div>
          </div>
        </div>
        </PrintPortal>
      )}
    </>
  );
}

function SummaryBox({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div
      className="rounded-lg px-3 py-3 text-white"
      style={{ backgroundColor: color }}
    >
      <p className="text-[8.5px] font-semibold uppercase tracking-[0.12em] text-white/70">{label}</p>
      <p className="mt-1 text-[0.9rem] font-bold tabular-nums leading-tight">{value}</p>
      {sub && <p className="mt-0.5 text-[10px] text-white/65">{sub}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#0A2240]/50">{title}</p>
      <div className="overflow-hidden rounded-md border border-[#0A2240]/12">{children}</div>
    </div>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
