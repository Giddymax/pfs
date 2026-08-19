"use client";

import { useState } from "react";
import { Printer, X } from "lucide-react";
import { Logo } from "@/components/logo";
import { PrintPortal } from "@/components/print-portal";
import { PrintWatermark } from "@/components/print-watermark";
import { formatGHS } from "@/lib/loan";

interface BankTxn {
  id: string;
  type: "deposit" | "withdrawal";
  amount: number;
  description: string | null;
  created_at: string;
  recorder?: { full_name: string } | null;
}

export function PrintBankSummaryButton({
  transactions,
  cashAtBank,
  cashAtHand,
  accountBalance,
  printedBy,
  companyPhone,
}: {
  transactions: BankTxn[];
  cashAtBank: number;
  cashAtHand: number;
  accountBalance: number;
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
              id="pfs-print-bank"
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
                  <p className="font-semibold text-[#0A2240]/60">Bank Account Report</p>
                  <p>
                    Printed:{" "}
                    {printedAt
                      ? printedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                      : "-"}
                  </p>
                  <p>Printed by: {printedBy ?? "-"}</p>
                </div>
              </div>

              <div className="h-[3px] w-full bg-[#0033AA]" />
              <p className="py-3.5 text-center text-[13px] font-bold tracking-[0.12em] text-[#0A2240]">
                BANK ACCOUNT SUMMARY
              </p>

              {/* KPI strip — mirrors the 3 balance cards shown on screen */}
              <div className="mb-6 grid grid-cols-3 gap-3">
                <SummaryBox label="Cash at Bank" value={formatGHS(cashAtBank)} color="#1F6E4A" />
                <SummaryBox label="Cash at Hand" value={formatGHS(cashAtHand)} color="#0033AA" />
                <SummaryBox label="Account Balance" value={formatGHS(accountBalance)} color="#0A2240" />
              </div>

              <div className="mb-5">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#0A2240]/50">
                  Bank Transaction History ({transactions.length})
                </p>
                <div className="overflow-hidden rounded-md border border-[#0A2240]/12">
                  <table className="w-full text-left text-[11.5px]">
                    <thead>
                      <tr className="border-b border-[#0A2240]/10 bg-[#0A2240]/[0.04]">
                        <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#0A2240]/50">Date / Time</th>
                        <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#0A2240]/50">Type</th>
                        <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#0A2240]/50">Description</th>
                        <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#0A2240]/50">Recorded by</th>
                        <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-[#0A2240]/50">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#0A2240]/6">
                      {transactions.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-3 py-6 text-center text-[#0A2240]/40">
                            No bank transactions recorded.
                          </td>
                        </tr>
                      ) : (
                        transactions.map((t) => (
                          <tr key={t.id}>
                            <td className="whitespace-nowrap px-3 py-2 text-[#0A2240]/60">
                              {new Date(t.created_at).toLocaleString("en-GB", {
                                day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                              })}
                            </td>
                            <td className="px-3 py-2 capitalize text-[#0A2240]">
                              {t.type}
                            </td>
                            <td className="px-3 py-2 text-[#0A2240]/60">{t.description ?? "—"}</td>
                            <td className="px-3 py-2 text-[#0A2240]/60">{t.recorder?.full_name ?? "—"}</td>
                            <td
                              className={`whitespace-nowrap px-3 py-2 text-right tabular-nums font-medium ${
                                t.type === "deposit" ? "text-[#1F6E4A]" : "text-[#963522]"
                              }`}
                            >
                              {t.type === "deposit" ? "+" : "−"}{formatGHS(t.amount)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {transactions.length > 0 && (
                      <tfoot>
                        <tr className="border-t-2 border-[#0A2240]/15 bg-[#0A2240]/[0.03]">
                          <td colSpan={4} className="px-3 py-2 text-[11px] font-bold text-[#0A2240]">Cash at bank</td>
                          <td className="px-3 py-2 text-right text-[12px] font-bold tabular-nums text-[#0033AA]">
                            {formatGHS(cashAtBank)}
                          </td>
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
