"use client";

import { useState } from "react";
import { Printer, X } from "lucide-react";
import { Logo } from "@/components/logo";
import { PrintWatermark } from "@/components/print-watermark";
import { formatGHS } from "@/lib/loan";

type LoanRow = {
  id: string;
  loan_code: string;
  principal: number;
  total_repayable: number;
  tenor_months: number;
  flat_rate_percent: number;
  status: string;
  due_date?: string | null;
  client?: { full_name: string } | null;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function KpiBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#0A2240]/10 bg-[#0A2240]/[0.025] px-3 py-2.5">
      <p className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-[#0A2240]/45">{label}</p>
      <p className="mt-0.5 text-[13.5px] font-bold tabular-nums text-[#0A2240]">{value}</p>
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  active: "Active",
  completed: "Completed",
  defaulted: "Defaulted",
  rejected: "Rejected",
};

export function PrintLoanListButton({
  loans,
  clientCount,
  totalPrincipal,
  totalOutstanding,
  activeCount,
  completedCount,
  defaultedCount,
  companyPhone,
}: {
  loans: LoanRow[];
  clientCount: number;
  totalPrincipal: number;
  totalOutstanding: number;
  activeCount: number;
  completedCount: number;
  defaultedCount: number;
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
        Print list
      </button>

      {open && (
        <div className="print-overlay fixed inset-0 z-50 overflow-y-auto bg-[#061B3A]/55 px-4 py-8 animate-fade-in">
          <div className="mx-auto flex max-w-[860px] justify-end gap-2 pb-3">
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
            id="pfs-print-sheet"
            className="mx-auto max-w-[860px] rounded-lg bg-white px-10 py-9 text-[#0A2240] shadow-2xl"
          >
            <PrintWatermark />

            {/* Letterhead */}
            <div className="flex items-start justify-between gap-6 pb-5">
              <div className="flex items-center gap-3">
                <Logo size={44} />
                <div className="leading-tight">
                  <p className="text-[18px] font-bold tracking-[0.08em] text-[#0033AA]">PRIME</p>
                  <p className="text-[11px] font-semibold tracking-[0.18em] text-[#0A2240]/70">FINANCIAL SERVICE</p>
                  {companyPhone && <p className="mt-0.5 text-[10.5px] text-[#0A2240]/45">Tel: {companyPhone}</p>}
                </div>
              </div>
              <div className="text-right text-[11px] text-[#0A2240]/40">
                <p className="font-semibold text-[#0A2240]/60">Loans Report</p>
                <p>
                  Printed:{" "}
                  {printedAt
                    ? printedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                    : "—"}
                </p>
              </div>
            </div>

            <div className="h-[3px] w-full bg-[#0033AA]" />

            {/* KPI strip */}
            <div className="mt-5 grid grid-cols-6 gap-3">
              <KpiBox label="Total clients" value={String(clientCount)} />
              <KpiBox label="Total principal" value={formatGHS(totalPrincipal)} />
              <KpiBox label="Outstanding" value={formatGHS(totalOutstanding)} />
              <KpiBox label="Active" value={String(activeCount)} />
              <KpiBox label="Completed" value={String(completedCount)} />
              <KpiBox label="Defaulted" value={String(defaultedCount)} />
            </div>

            {/* Loan table */}
            <div className="mt-5 overflow-hidden rounded-md border border-[#0A2240]/12">
              <table className="w-full text-left text-[11.5px]">
                <thead>
                  <tr className="border-b border-[#0A2240]/10 bg-[#0A2240]/[0.04] text-[10px] font-semibold uppercase tracking-[0.1em] text-[#0A2240]/50">
                    <th className="px-4 py-2.5">#</th>
                    <th className="px-4 py-2.5">Loan Code</th>
                    <th className="px-4 py-2.5">Client</th>
                    <th className="px-4 py-2.5 text-right">Principal</th>
                    <th className="px-4 py-2.5 text-right">Repayable</th>
                    <th className="px-4 py-2.5">Tenor</th>
                    <th className="px-4 py-2.5">Due Date</th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#0A2240]/6">
                  {loans.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-center text-[#0A2240]/40">
                        No loans found.
                      </td>
                    </tr>
                  ) : (
                    loans.map((loan, i) => (
                      <tr key={loan.id}>
                        <td className="px-4 py-2 text-[#0A2240]/40">{i + 1}</td>
                        <td className="px-4 py-2 font-medium text-[#0A2240]">{loan.loan_code}</td>
                        <td className="px-4 py-2 text-[#0A2240]/70">{loan.client?.full_name ?? "—"}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-[#0A2240]/70">
                          {formatGHS(loan.principal)}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums font-medium text-[#0A2240]">
                          {formatGHS(loan.total_repayable)}
                        </td>
                        <td className="px-4 py-2 text-[#0A2240]/60">{loan.tenor_months}mo · {loan.flat_rate_percent}%</td>
                        <td className="px-4 py-2 text-[#0A2240]/60">{formatDate(loan.due_date)}</td>
                        <td className="px-4 py-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                              loan.status === "active"
                                ? "bg-[#0062E1]/10 text-[#0A4DA6]"
                                : loan.status === "completed"
                                ? "bg-[#1F6E4A]/10 text-[#1F6E4A]"
                                : loan.status === "defaulted"
                                ? "bg-[#B3432B]/10 text-[#963522]"
                                : "bg-[#0A2240]/8 text-[#0A2240]/55"
                            }`}
                          >
                            {STATUS_LABEL[loan.status] ?? loan.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="mt-6 flex items-center justify-between border-t border-[#0A2240]/10 pt-3 text-[10.5px] text-[#0A2240]/40">
              <p>
                {loans.length} loan{loans.length !== 1 ? "s" : ""} shown
              </p>
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
      )}
    </>
  );
}
