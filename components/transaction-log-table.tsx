"use client";

import { useMemo, useState } from "react";
import { formatGHS } from "@/lib/loan";

interface PeriodTransaction {
  id: string;
  created_at: string;
  type: "deposit" | "withdrawal" | "fee" | "reversal";
  amount: number;
  fee: number;
  bal_after: number;
  notes: string | null;
  client_id: string;
  client_full_name: string;
  client_code: string;
  account_id: string;
  account_number: string;
  product_type: "savings" | "susu";
  recorded_by_name: string | null;
  edited_by_name: string | null;
  edited_at: string | null;
  original_amount: number | null;
  reversed_by_name: string | null;
  reversed_at: string | null;
}

const PRODUCT_LABEL: Record<PeriodTransaction["product_type"], string> = {
  savings: "Savings",
  susu: "Daily Susu",
};

type TypeFilter = "all" | PeriodTransaction["type"];

const FILTERS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "deposit", label: "Deposits" },
  { value: "withdrawal", label: "Withdrawals" },
  { value: "fee", label: "Fees" },
  { value: "reversal", label: "Reversals" },
];

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TransactionLogTable({
  transactions,
  error,
  title = "Transaction log",
  description = "Every deposit, withdrawal, fee, and reversal recorded in this period, newest first — including reversed/edited entries the totals above net out.",
  showTypeFilter = true,
}: {
  transactions: PeriodTransaction[];
  error?: string | null;
  title?: string;
  description?: string;
  showTypeFilter?: boolean;
}) {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  const filtered = useMemo(
    () => (typeFilter === "all" ? transactions : transactions.filter((t) => t.type === typeFilter)),
    [transactions, typeFilter]
  );

  const emptyMessage =
    transactions.length === 0
      ? "No transactions were recorded in this period."
      : `No ${typeFilter === "all" ? "" : FILTERS.find((f) => f.value === typeFilter)?.label.toLowerCase() + " "}transactions match this filter.`;

  return (
    <div className="overflow-hidden rounded-xl border border-[#0A2240]/8 bg-white shadow-sm">
      <div
        className="flex flex-wrap items-center justify-between gap-3 border-b border-[#0A2240]/8 px-5 py-3"
        style={{ borderLeftWidth: 3, borderLeftColor: "#0A2240", borderLeftStyle: "solid" }}
      >
        <div>
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[#0A2240]">
            {title} ({filtered.length}{typeFilter !== "all" ? ` of ${transactions.length}` : ""})
          </h2>
          <p className="mt-0.5 text-[11.5px] text-[#0A2240]/45 print:hidden">
            {description}
          </p>
        </div>
        {showTypeFilter && (
          <div className="flex flex-wrap gap-1.5 print:hidden">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setTypeFilter(f.value)}
                className={`rounded-full px-3 py-1 text-[11.5px] font-medium transition-colors ${
                  typeFilter === f.value
                    ? "bg-[#0033AA] text-white"
                    : "border border-[#0033AA]/15 text-[#0A2240]/55 hover:border-[#0033AA]/30 hover:text-[#0A2240]"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {error ? (
        <div className="px-5 py-8 text-center text-[13px] text-[#963522]">
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="px-5 py-8 text-center text-[13px] text-[#0A2240]/45">
          {emptyMessage}
        </div>
      ) : (
        <div className="pfs-table-scroll">
          <table className="w-full min-w-[820px] text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-[#0A2240]/8 bg-[#0A2240]/[0.02] text-[10.5px] uppercase tracking-[0.08em] text-[#0A2240]/45">
                <th className="px-4 py-2.5 font-semibold">Date &amp; time</th>
                <th className="px-4 py-2.5 font-semibold">Client</th>
                <th className="px-4 py-2.5 font-semibold">Account</th>
                <th className="px-4 py-2.5 font-semibold">Type</th>
                <th className="px-4 py-2.5 font-semibold">Amount</th>
                <th className="px-4 py-2.5 font-semibold">Balance after</th>
                <th className="px-4 py-2.5 font-semibold">Recorded by</th>
                <th className="px-4 py-2.5 font-semibold">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#0A2240]/6">
              {filtered.map((txn) => (
                <tr key={txn.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-2.5 text-[#0A2240]/70">{fmtDateTime(txn.created_at)}</td>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-[#0A2240]">{txn.client_full_name}</p>
                    <p className="text-[11px] text-[#0A2240]/40">{txn.client_code}</p>
                  </td>
                  <td className="px-4 py-2.5 text-[#0A2240]/70">
                    {PRODUCT_LABEL[txn.product_type]}
                    {txn.account_number ? ` · ${txn.account_number}` : ""}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="rounded-full border border-[#0033AA]/12 px-2 py-0.5 text-[10.5px] font-medium capitalize text-[#0A2240]/55">
                      {txn.type}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 font-semibold tabular-nums">
                    <span className={txn.type === "deposit" ? "text-[#1F6E4A]" : "text-[#963522]"}>
                      {txn.type === "deposit" ? "+" : "−"} {formatGHS(txn.amount)}
                    </span>
                    {txn.fee > 0 && (
                      <span className="ml-1 font-normal text-[#0A2240]/40">(+{formatGHS(txn.fee)} fee)</span>
                    )}
                    <PeriodTxnFlags txn={txn} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-[#0A2240]/70">{formatGHS(txn.bal_after)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-[#0A2240]/70">{txn.recorded_by_name ?? "—"}</td>
                  <td className="px-4 py-2.5 text-[#0A2240]/55">{txn.notes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PeriodTxnFlags({ txn }: { txn: PeriodTransaction }) {
  if (txn.reversed_at) {
    return (
      <span className="ml-1.5 inline-block rounded-full border border-[#B3432B]/20 bg-[#B3432B]/[0.06] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#963522]">
        Reversed{txn.reversed_by_name ? ` by ${txn.reversed_by_name}` : ""}
      </span>
    );
  }
  if (txn.edited_at) {
    return (
      <span className="ml-1.5 inline-block rounded-full border border-[#0062E1]/20 bg-[#0062E1]/[0.06] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#0A4DA6]">
        Edited{txn.original_amount != null ? ` from ${formatGHS(txn.original_amount)}` : ""}
        {txn.edited_by_name ? ` by ${txn.edited_by_name}` : ""}
      </span>
    );
  }
  return null;
}
