"use client";

import { useState } from "react";
import { Printer, X } from "lucide-react";
import { Logo } from "@/components/logo";
import { PrintPortal } from "@/components/print-portal";
import { PrintWatermark } from "@/components/print-watermark";
import { formatGHS } from "@/lib/loan";
import type { TelecomTypeBreakdown } from "@/lib/finance/telecom-summary";

export function PrintTelecomOverviewButton({
  todayCount,
  todayAmount,
  todayCharge,
  allTimeCharge,
  allTimeCount,
  byType,
  printedBy,
  companyPhone,
}: {
  todayCount: number;
  todayAmount: number;
  todayCharge: number;
  allTimeCharge: number;
  allTimeCount: number;
  byType: TelecomTypeBreakdown[];
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
        className="inline-flex items-center gap-1.5 rounded-md border border-[#1A1A1A]/20 px-3.5 py-2 text-[12.5px] font-semibold text-[#1A1A1A] transition-colors hover:bg-[#1A1A1A]/5"
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
              id="pfs-telecom-print"
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
                  <p className="font-semibold text-[#0A2240]/60">Telecom Overview</p>
                  <p>As at: {printedAt ? printedAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "-"}</p>
                  <p>Printed by: {printedBy ?? "-"}</p>
                </div>
              </div>

              <div className="h-[3px] w-full bg-[#1E3A8A]" />
              <p className="py-3.5 text-center text-[13px] font-bold tracking-[0.12em] text-[#0A2240]">
                TELECOM OVERVIEW SUMMARY
              </p>

              <div className="mb-6 grid grid-cols-3 gap-3">
                <SummaryBox label="Transactions Today" value={String(todayCount)} color="#1D4ED8" />
                <SummaryBox label="Amount Moved Today" value={formatGHS(todayAmount)} color="#15803D" />
                <SummaryBox label="Charges Collected Today" value={formatGHS(todayCharge)} color="#B45309" />
              </div>

              <div className="mb-5 rounded-md border border-[#0A2240]/12 bg-[#0A2240]/[0.025] px-5 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0A2240]/50">
                  All-Time Charges Collected
                </p>
                <p className="mt-1 text-[1.25rem] font-bold tabular-nums text-[#0A2240]">{formatGHS(allTimeCharge)}</p>
                <p className="mt-0.5 text-[11px] text-[#0A2240]/45">{allTimeCount} transaction{allTimeCount === 1 ? "" : "s"} total</p>
              </div>

              <div className="mb-5">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#0A2240]/50">Today, by Type</p>
                <div className="overflow-hidden rounded-md border border-[#0A2240]/12">
                  <table className="w-full text-left text-[12px]">
                    <thead>
                      <tr className="border-b border-[#0A2240]/10 bg-[#0A2240]/[0.04]">
                        <th className="px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#0A2240]/50">Type</th>
                        <th className="px-4 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-[#0A2240]/50">Count</th>
                        <th className="px-4 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-[#0A2240]/50">Amount</th>
                        <th className="px-4 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-[#0A2240]/50">Charge</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#0A2240]/6">
                      {byType.map((row) => (
                        <tr key={row.type}>
                          <td className="px-4 py-2.5 text-[#0A2240]/70">{row.label}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-[#0A2240]/60">{row.count}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-[#0A2240]">{formatGHS(row.amount)}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums font-medium text-[#0A2240]">{formatGHS(row.charge)}</td>
                        </tr>
                      ))}
                    </tbody>
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
