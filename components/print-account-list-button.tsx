"use client";

import { useState } from "react";
import { Printer, X } from "lucide-react";
import { Logo } from "@/components/logo";
import { PrintWatermark } from "@/components/print-watermark";
import { formatGHS } from "@/lib/loan";

type AccountRow = {
  id: string;
  account_number: string;
  product_type: string;
  balance: number;
  status: string;
  daily_contribution_amount?: number | null;
  client?: { full_name: string; phone?: string | null } | null;
};

function KpiBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#0A2240]/10 bg-[#0A2240]/[0.025] px-3 py-2.5">
      <p className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-[#0A2240]/45">{label}</p>
      <p className="mt-0.5 text-[13.5px] font-bold tabular-nums text-[#0A2240]">{value}</p>
    </div>
  );
}

export function PrintAccountListButton({
  productType,
  accounts,
  totalCount,
  totalBalance,
  totalDep,
  totalWdr,
  totalComm,
  companyPhone,
}: {
  productType: "savings" | "susu";
  accounts: AccountRow[];
  totalCount: number;
  totalBalance: number;
  totalDep: number;
  totalWdr: number;
  totalComm: number;
  companyPhone?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [printedAt, setPrintedAt] = useState<Date | null>(null);

  function handleOpen() {
    setPrintedAt(new Date());
    setOpen(true);
  }

  const isSavings = productType === "savings";
  const title = isSavings ? "Savings Accounts Report" : "Daily Susu Accounts Report";

  function detailValue(account: AccountRow) {
    if (account.product_type === "savings") {
      return account.client?.phone ?? "—";
    }
    return account.daily_contribution_amount != null
      ? `${formatGHS(account.daily_contribution_amount)}/day`
      : "—";
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
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[#061B3A]/55 px-4 py-8 animate-fade-in">
          <div className="mx-auto flex max-w-[820px] justify-end gap-2 pb-3">
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
            className="mx-auto max-w-[820px] rounded-lg bg-white px-10 py-9 text-[#0A2240] shadow-2xl"
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
                <p className="font-semibold text-[#0A2240]/60">{title}</p>
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
            <div className={`mt-5 grid gap-3 ${isSavings ? "grid-cols-5" : "grid-cols-4"}`}>
              <KpiBox label="Total clients" value={String(totalCount)} />
              <KpiBox label="Total balance" value={formatGHS(totalBalance)} />
              <KpiBox label={isSavings ? "Total deposits" : "Total contributions"} value={formatGHS(totalDep)} />
              <KpiBox label={isSavings ? "Total withdrawals" : "Total withdrawn"} value={formatGHS(totalWdr)} />
              {isSavings && <KpiBox label="Total commission" value={formatGHS(totalComm)} />}
            </div>

            {/* Account table */}
            <div className="mt-5 overflow-hidden rounded-md border border-[#0A2240]/12">
              <table className="w-full text-left text-[11.5px]">
                <thead>
                  <tr className="border-b border-[#0A2240]/10 bg-[#0A2240]/[0.04] text-[10px] font-semibold uppercase tracking-[0.1em] text-[#0A2240]/50">
                    <th className="px-4 py-2.5">#</th>
                    <th className="px-4 py-2.5">Client</th>
                    <th className="px-4 py-2.5">Account No.</th>
                    <th className="px-4 py-2.5">{isSavings ? "Phone" : "Daily Amount"}</th>
                    <th className="px-4 py-2.5 text-right">Balance</th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#0A2240]/6">
                  {accounts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-[#0A2240]/40">
                        No accounts found.
                      </td>
                    </tr>
                  ) : (
                    accounts.map((account, i) => (
                      <tr key={account.id}>
                        <td className="px-4 py-2 text-[#0A2240]/40">{i + 1}</td>
                        <td className="px-4 py-2 font-medium text-[#0A2240]">
                          {account.client?.full_name ?? "—"}
                        </td>
                        <td className="px-4 py-2 text-[#0A2240]/60">{account.account_number}</td>
                        <td className="px-4 py-2 text-[#0A2240]/60">{detailValue(account)}</td>
                        <td className="px-4 py-2 text-right tabular-nums font-medium text-[#0A2240]">
                          {formatGHS(account.balance)}
                        </td>
                        <td className="px-4 py-2 capitalize text-[#0A2240]/60">{account.status}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="mt-6 flex items-center justify-between border-t border-[#0A2240]/10 pt-3 text-[10.5px] text-[#0A2240]/40">
              <p>
                {accounts.length} account{accounts.length !== 1 ? "s" : ""} shown
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
