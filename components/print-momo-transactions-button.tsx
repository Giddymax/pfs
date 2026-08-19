"use client";

import { useState } from "react";
import { Printer, X } from "lucide-react";
import { Logo } from "@/components/logo";
import { PrintPortal } from "@/components/print-portal";
import { PrintWatermark } from "@/components/print-watermark";
import { momoTypeLabel } from "@/lib/momo/types";
import { formatGHS } from "@/lib/loan";
import type { MomoTransaction } from "@/lib/types";

interface Row extends MomoTransaction {
  recorder: { full_name: string } | null;
}

// MoMo's own print modal, following the same PrintPortal + #pfs-momo-print
// pattern as every other PFS print button (print-finance-summary-button.tsx
// is the closest sibling) — still identifies as Prime Financial Service in
// the header, since a printed record is the company's official document
// regardless of which product line it covers; only the on-screen app UI
// draws the "no PFS branding" line (momo-mini-app-brief.md §7).
export function PrintMomoTransactionsButton({
  transactions,
  from,
  to,
  transactionCount,
  totalAmount,
  totalCharge,
  printedBy,
  companyPhone,
}: {
  transactions: Row[];
  from: string;
  to: string;
  transactionCount: number;
  totalAmount: number;
  totalCharge: number;
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
        className="inline-flex items-center gap-1.5 rounded-md border border-[#1A1A1A]/20 px-3 py-2 text-[12.5px] font-medium text-[#1A1A1A] transition-colors hover:bg-[#1A1A1A]/5"
      >
        <Printer size={13} />
        Print
      </button>

      {open && (
        <PrintPortal>
          <div className="print-overlay fixed inset-0 z-50 overflow-y-auto bg-[#061B3A]/55 px-4 py-8 animate-fade-in">
            <div className="mx-auto flex max-w-[820px] justify-end gap-2 pb-3 print:hidden">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 rounded-md bg-[#1E3A8A] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#172554]"
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
              id="pfs-momo-print"
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
                  <p className="font-semibold text-[#0A2240]/60">MoMo Transaction Log</p>
                  <p>Period: {fmtDate(from)} — {fmtDate(to)}</p>
                  <p>Printed by: {printedBy ?? "-"}</p>
                </div>
              </div>

              <div className="h-[3px] w-full bg-[#1E3A8A]" />
              <p className="py-3.5 text-center text-[13px] font-bold tracking-[0.12em] text-[#0A2240]">
                MOMO TRANSACTION LOG
              </p>

              <div className="mb-6 grid grid-cols-3 gap-3">
                <SummaryBox label="Transactions" value={String(transactionCount)} color="#1D4ED8" />
                <SummaryBox label="Amount Moved" value={formatGHS(totalAmount)} color="#15803D" />
                <SummaryBox label="Charges Collected" value={formatGHS(totalCharge)} color="#B45309" />
              </div>

              <div className="mb-5">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#0A2240]/50">
                  Transactions ({transactions.length})
                </p>
                <div className="overflow-hidden rounded-md border border-[#0A2240]/12">
                  {transactions.length === 0 ? (
                    <p className="px-4 py-4 text-[12px] text-[#0A2240]/45">No transactions in this period.</p>
                  ) : (
                    <table className="w-full text-left text-[11.5px]">
                      <thead>
                        <tr className="border-b border-[#0A2240]/10 bg-[#0A2240]/[0.04]">
                          <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#0A2240]/50">Date</th>
                          <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#0A2240]/50">Phone</th>
                          <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#0A2240]/50">Type</th>
                          <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-[#0A2240]/50">Amount</th>
                          <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-[#0A2240]/50">Charge</th>
                          <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#0A2240]/50">Recorded by</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#0A2240]/6">
                        {transactions.map((t) => (
                          <tr key={t.id} className={t.reversed_at ? "opacity-50" : ""}>
                            <td className="whitespace-nowrap px-3 py-2 text-[#0A2240]/60">
                              {new Date(t.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                            </td>
                            <td className="px-3 py-2 font-medium text-[#0A2240]">{t.phone_number}</td>
                            <td className="px-3 py-2 text-[#0A2240]/70">
                              {momoTypeLabel(t.type)}{t.reversed_at ? " (reversed)" : ""}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-[#0A2240]/70">{formatGHS(t.amount)}</td>
                            <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums font-medium text-[#0A2240]">{formatGHS(t.charge)}</td>
                            <td className="px-3 py-2 text-[#0A2240]/60">{t.recorder?.full_name ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-[#0A2240]/15 bg-[#0A2240]/[0.03]">
                          <td colSpan={3} className="px-3 py-2 text-[11px] font-bold text-[#0A2240]">Total</td>
                          <td className="px-3 py-2 text-right text-[11.5px] font-bold tabular-nums text-[#0A2240]">{formatGHS(totalAmount)}</td>
                          <td className="px-3 py-2 text-right text-[11.5px] font-bold tabular-nums text-[#B45309]">{formatGHS(totalCharge)}</td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  )}
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
