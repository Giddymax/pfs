"use client";

import { useState } from "react";
import { Printer, X } from "lucide-react";
import { Logo } from "@/components/logo";
import { PrintPortal } from "@/components/print-portal";
import { PrintWatermark } from "@/components/print-watermark";
import { formatGHS } from "@/lib/loan";

interface DepositRow {
  id: string;
  created_at: string;
  amount: number;
  client_full_name: string;
  client_code: string;
  account_number: string;
  product_type: "savings" | "susu";
  recorded_by_name: string | null;
  notes: string | null;
  reversed_at: string | null;
}

export function PrintDepositsReportButton({
  transactions,
  from,
  to,
  accountBalance,
  totalDeposits,
  savingsDeposits,
  susuDeposits,
  printedBy,
  companyPhone,
}: {
  transactions: DepositRow[];
  from: string;
  to: string;
  accountBalance: number;
  totalDeposits: number;
  savingsDeposits: number;
  susuDeposits: number;
  printedBy?: string | null;
  companyPhone?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [printedAt, setPrintedAt] = useState<Date | null>(null);

  function handleOpen() {
    setPrintedAt(new Date());
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center gap-1.5 rounded-md border border-[#0033AA]/20 px-3 py-1.5 text-[11.5px] font-medium text-[#0033AA] transition-colors hover:bg-[#0033AA]/5"
      >
        <Printer size={14} />
        Print report
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
              id="pfs-print-deposits"
              className="mx-auto max-w-[820px] rounded-lg bg-white px-10 py-9 text-[#0A2240] shadow-2xl print:max-w-none print:rounded-none print:px-12 print:py-10 print:shadow-none"
            >
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
                  <p className="font-semibold text-[#0A2240]/60">Deposits Report</p>
                  <p>Period: {fmtDate(from)} — {fmtDate(to)}</p>
                  <p>Printed by: {printedBy ?? "-"}</p>
                </div>
              </div>

              <div className="h-[3px] w-full bg-[#0033AA]" />
              <p className="py-3.5 text-center text-[13px] font-bold tracking-[0.12em] text-[#0A2240]">
                DEPOSITS REPORT
              </p>

              {/* KPI strip — mirrors the 4 stat cards shown on screen */}
              <div className="mb-6 grid grid-cols-4 gap-3">
                <SummaryBox label="Account Balance" value={formatGHS(accountBalance)} color="#0033AA" />
                <SummaryBox label="Total Deposits" value={formatGHS(totalDeposits)} color="#15803D" />
                <SummaryBox label="Savings Deposits" value={formatGHS(savingsDeposits)} color="#EA580C" />
                <SummaryBox label="Daily Susu Deposits" value={formatGHS(susuDeposits)} color="#0284C7" />
              </div>

              <div className="mb-5">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#0A2240]/50">
                  Deposit Log ({transactions.length})
                </p>
                <div className="overflow-hidden rounded-md border border-[#0A2240]/12">
                  <table className="w-full text-left text-[11.5px]">
                    <thead>
                      <tr className="border-b border-[#0A2240]/10 bg-[#0A2240]/[0.04]">
                        <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#0A2240]/50">Date</th>
                        <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#0A2240]/50">Client</th>
                        <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#0A2240]/50">Account</th>
                        <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#0A2240]/50">Product</th>
                        <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-[#0A2240]/50">Amount</th>
                        <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#0A2240]/50">Recorded by</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#0A2240]/6">
                      {transactions.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-3 py-6 text-center text-[#0A2240]/40">
                            No deposits in this period.
                          </td>
                        </tr>
                      ) : (
                        transactions.map((t) => (
                          <tr key={t.id} className={t.reversed_at ? "opacity-50" : ""}>
                            <td className="whitespace-nowrap px-3 py-2 text-[#0A2240]/60">
                              {new Date(t.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                            </td>
                            <td className="px-3 py-2 font-medium text-[#0A2240]">
                              {t.client_full_name}
                              {t.reversed_at && <span className="ml-1 text-[10px] font-normal text-[#963522]">(reversed)</span>}
                            </td>
                            <td className="px-3 py-2 text-[#0A2240]/60">{t.account_number}</td>
                            <td className="px-3 py-2 capitalize text-[#0A2240]/60">{t.product_type}</td>
                            <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums font-medium text-[#15803D]">
                              +{formatGHS(t.amount)}
                            </td>
                            <td className="px-3 py-2 text-[#0A2240]/60">{t.recorded_by_name ?? "—"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {transactions.length > 0 && (
                      <tfoot>
                        <tr className="border-t-2 border-[#0A2240]/15 bg-[#0A2240]/[0.03]">
                          <td colSpan={4} className="px-3 py-2 text-[11px] font-bold text-[#0A2240]">Total</td>
                          <td className="px-3 py-2 text-right text-[11.5px] font-bold tabular-nums text-[#15803D]">
                            {formatGHS(totalDeposits)}
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-[#0A2240]/10 pt-3 text-[10.5px] text-[#0A2240]/40">
                <p>Printed by: {printedBy ?? "-"}</p>
                <p>
                  {printedAt
                    ? printedAt.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
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

function SummaryBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg px-3 py-3 text-white" style={{ backgroundColor: color }}>
      <p className="text-[8.5px] font-semibold uppercase tracking-[0.12em] text-white/70">{label}</p>
      <p className="mt-1 text-[0.9rem] font-bold tabular-nums leading-tight">{value}</p>
    </div>
  );
}

function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
