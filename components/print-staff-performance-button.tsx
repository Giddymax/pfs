"use client";

import { useState } from "react";
import { Printer, X, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/logo";
import { PrintPortal } from "@/components/print-portal";
import { PrintWatermark } from "@/components/print-watermark";
import { formatGHS } from "@/lib/loan";

interface StaffPerformanceRow {
  staff_id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  clients_registered: number;
  savings_collected: number;
  susu_collected: number;
}

export function PrintStaffPerformanceButton({
  rows,
  from,
  to,
  totalClients,
  totalSavings,
  totalSusu,
  totalCollected,
  printedBy,
  companyPhone,
}: {
  rows: StaffPerformanceRow[];
  from: string;
  to: string;
  totalClients: number;
  totalSavings: number;
  totalSusu: number;
  totalCollected: number;
  printedBy?: string | null;
  companyPhone?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [printedAt, setPrintedAt] = useState<Date | null>(null);

  function handleOpen() {
    setPrintedAt(new Date());
    setOpen(true);
  }

  function rowTotal(r: StaffPerformanceRow) {
    return Number(r.savings_collected) + Number(r.susu_collected);
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
              id="pfs-print-staff-performance"
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
                  <p className="font-semibold text-[#0A2240]/60">Staff Performance Report</p>
                  <p>Period: {fmtDate(from)} — {fmtDate(to)}</p>
                  <p>Printed by: {printedBy ?? "-"}</p>
                </div>
              </div>

              <div className="h-[3px] w-full bg-[#0033AA]" />
              <p className="py-3.5 text-center text-[13px] font-bold tracking-[0.12em] text-[#0A2240]">
                STAFF PERFORMANCE SUMMARY
              </p>

              {/* KPI strip — mirrors the 4 summary cards shown on screen */}
              <div className="mb-6 grid grid-cols-4 gap-3">
                <SummaryBox label="Total Clients Registered" value={String(totalClients)} color="#7C3AED" />
                <SummaryBox label="Total Savings Collected" value={formatGHS(totalSavings)} color="#EA580C" />
                <SummaryBox label="Total Susu Collected" value={formatGHS(totalSusu)} color="#0284C7" />
                <SummaryBox label="Total Collected" value={formatGHS(totalCollected)} color="#15803D" />
              </div>

              <div className="mb-5">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#0A2240]/50">
                  Individual Performance ({rows.length})
                </p>
                <div className="overflow-hidden rounded-md border border-[#0A2240]/12">
                  <table className="w-full text-left text-[11.5px]">
                    <thead>
                      <tr className="border-b border-[#0A2240]/10 bg-[#0A2240]/[0.04]">
                        <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#0A2240]/50">Staff member</th>
                        <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#0A2240]/50">Role</th>
                        <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-[#0A2240]/50">Clients</th>
                        <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-[#0A2240]/50">Savings</th>
                        <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-[#0A2240]/50">Susu</th>
                        <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-[#0A2240]/50">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#0A2240]/6">
                      {rows.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-6 text-center text-[#0A2240]/40">
                            No staff accounts found.
                          </td>
                        </tr>
                      ) : (
                        rows.map((r) => (
                          <tr key={r.staff_id} className={!r.is_active ? "opacity-55" : ""}>
                            <td className="px-4 py-2">
                              <p className="font-medium text-[#0A2240]">{r.full_name}</p>
                              <p className="text-[10.5px] text-[#0A2240]/45">{r.email}</p>
                            </td>
                            <td className="px-4 py-2 text-[#0A2240]/60">
                              <span className="inline-flex items-center gap-1">
                                {r.role === "admin" && <ShieldCheck size={11} className="text-[#1D3461]" />}
                                {r.role === "admin" ? "Administrator" : "Staff"}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-right tabular-nums font-medium text-[#7C3AED]">
                              {r.clients_registered}
                            </td>
                            <td className="px-4 py-2 text-right tabular-nums font-medium text-[#EA580C]">
                              {formatGHS(Number(r.savings_collected))}
                            </td>
                            <td className="px-4 py-2 text-right tabular-nums font-medium text-[#0284C7]">
                              {formatGHS(Number(r.susu_collected))}
                            </td>
                            <td className="px-4 py-2 text-right tabular-nums font-semibold text-[#15803D]">
                              {formatGHS(rowTotal(r))}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {rows.length > 0 && (
                      <tfoot>
                        <tr className="border-t-2 border-[#0A2240]/15 bg-[#0A2240]/[0.03]">
                          <td colSpan={2} className="px-4 py-2.5 text-[11.5px] font-bold text-[#0A2240]">
                            Total across {rows.length} staff member{rows.length === 1 ? "" : "s"}
                          </td>
                          <td className="px-4 py-2.5 text-right text-[12px] font-bold tabular-nums text-[#7C3AED]">
                            {totalClients}
                          </td>
                          <td className="px-4 py-2.5 text-right text-[12px] font-bold tabular-nums text-[#EA580C]">
                            {formatGHS(totalSavings)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-[12px] font-bold tabular-nums text-[#0284C7]">
                            {formatGHS(totalSusu)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-[13px] font-bold tabular-nums text-[#15803D]">
                            {formatGHS(totalCollected)}
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

function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
