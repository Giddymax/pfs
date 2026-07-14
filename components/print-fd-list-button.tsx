"use client";

import { useState } from "react";
import { Printer, X } from "lucide-react";
import { Logo } from "@/components/logo";
import { PrintWatermark } from "@/components/print-watermark";
import { formatGHS } from "@/lib/loan";

type FdRow = {
  id: string;
  fd_number: string;
  principal: number;
  expected_payout: number;
  term_months: number;
  annual_rate_percent: number;
  status: string;
  maturity_date?: string | null;
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
  active: "Active",
  matured: "Matured",
  pending_early: "Early w/d pending",
  approved_early: "Early w/d approved",
  withdrawn: "Withdrawn",
  rolled_over: "Rolled over",
};

export function PrintFdListButton({
  deposits,
  clientCount,
  totalPrincipal,
  totalPayout,
  activeCount,
  maturedCount,
  companyPhone,
}: {
  deposits: FdRow[];
  clientCount: number;
  totalPrincipal: number;
  totalPayout: number;
  activeCount: number;
  maturedCount: number;
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
                <p className="font-semibold text-[#0A2240]/60">Fixed Deposits Report</p>
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
            <div className="mt-5 grid grid-cols-5 gap-3">
              <KpiBox label="Total clients" value={String(clientCount)} />
              <KpiBox label="Active principal" value={formatGHS(totalPrincipal)} />
              <KpiBox label="Expected payout" value={formatGHS(totalPayout)} />
              <KpiBox label="Active deposits" value={String(activeCount)} />
              <KpiBox label="Matured deposits" value={String(maturedCount)} />
            </div>

            {/* FD table */}
            <div className="mt-5 overflow-hidden rounded-md border border-[#0A2240]/12">
              <table className="w-full text-left text-[11.5px]">
                <thead>
                  <tr className="border-b border-[#0A2240]/10 bg-[#0A2240]/[0.04] text-[10px] font-semibold uppercase tracking-[0.1em] text-[#0A2240]/50">
                    <th className="px-4 py-2.5">#</th>
                    <th className="px-4 py-2.5">FD Number</th>
                    <th className="px-4 py-2.5">Client</th>
                    <th className="px-4 py-2.5 text-right">Principal</th>
                    <th className="px-4 py-2.5">Term · Rate</th>
                    <th className="px-4 py-2.5 text-right">Expected Payout</th>
                    <th className="px-4 py-2.5">Maturity</th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#0A2240]/6">
                  {deposits.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-center text-[#0A2240]/40">
                        No fixed deposits found.
                      </td>
                    </tr>
                  ) : (
                    deposits.map((fd, i) => (
                      <tr key={fd.id}>
                        <td className="px-4 py-2 text-[#0A2240]/40">{i + 1}</td>
                        <td className="px-4 py-2 font-medium text-[#0A2240]">{fd.fd_number}</td>
                        <td className="px-4 py-2 text-[#0A2240]/70">{fd.client?.full_name ?? "—"}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-[#0A2240]/70">
                          {formatGHS(fd.principal)}
                        </td>
                        <td className="px-4 py-2 text-[#0A2240]/60">
                          {fd.term_months}mo · {fd.annual_rate_percent}%
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums font-medium text-[#0A2240]">
                          {formatGHS(fd.expected_payout)}
                        </td>
                        <td className="px-4 py-2 text-[#0A2240]/60">{formatDate(fd.maturity_date)}</td>
                        <td className="px-4 py-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                              fd.status === "active"
                                ? "bg-[#0062E1]/10 text-[#0A4DA6]"
                                : fd.status === "matured"
                                ? "bg-[#B58A2A]/10 text-[#8A6A1F]"
                                : fd.status === "withdrawn" || fd.status === "rolled_over"
                                ? "bg-[#0A2240]/8 text-[#0A2240]/55"
                                : "bg-[#B58A2A]/10 text-[#8A6A1F]"
                            }`}
                          >
                            {STATUS_LABEL[fd.status] ?? fd.status}
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
                {deposits.length} deposit{deposits.length !== 1 ? "s" : ""} shown
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
