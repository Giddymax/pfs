"use client";

import { useState } from "react";
import { Printer, Loader2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/logo";
import { PrintWatermark } from "@/components/print-watermark";
import { formatGHS } from "@/lib/loan";
import type { Client, Transaction } from "@/lib/types";

type TxnWithAccount = Transaction & {
  account: { account_number: string; product_type: string } | null;
};

function fmt(value: string) {
  return new Date(value).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function ClientPrintHistoryButton({
  client,
  accountNumber,
  accountBalance,
  printedBy,
  triggerClassName,
  companyPhone,
}: {
  client: Client;
  accountNumber?: string | null;
  accountBalance?: number | null;
  printedBy?: string | null;
  triggerClassName?: string;
  companyPhone?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<TxnWithAccount[] | null>(null);
  const [printedAt, setPrintedAt] = useState<Date | null>(null);

  async function handleOpen() {
    setPrintedAt(new Date());
    setOpen(true);

    if (transactions !== null) return; // already fetched

    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("transactions")
      .select("*, account:accounts(account_number, product_type)")
      .eq("client_id", client.id)
      .order("created_at", { ascending: false })
      .returns<TxnWithAccount[]>();
    setTransactions(data ?? []);
    setLoading(false);
  }

  const txns = transactions ?? [];

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={
          triggerClassName ??
          "inline-flex items-center gap-1.5 rounded-md border border-[#0033AA]/20 px-3 py-1.5 text-[11.5px] font-medium text-[#0033AA] transition-colors hover:bg-[#0033AA]/5"
        }
      >
        <Printer size={13} />
        Print history
      </button>

      {open && (
        <div className="print-overlay fixed inset-0 z-50 overflow-y-auto bg-[#061B3A]/55 px-4 py-8 animate-fade-in">
          {/* Screen controls */}
          <div className="mx-auto flex max-w-[820px] justify-end gap-2 pb-3">
            <button
              type="button"
              onClick={() => window.print()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-md bg-[#0033AA] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#002884] disabled:opacity-50"
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

          {/* Printable sheet */}
          <div
            id="pfs-print-sheet"
            className="mx-auto max-w-[820px] rounded-lg bg-white px-10 py-9 text-[#0A2240] shadow-2xl"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
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
                <p className="font-semibold text-[#0A2240]/60">Transaction History</p>
                <p>
                  Printed:{" "}
                  {printedAt
                    ? printedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                    : "—"}
                </p>
              </div>
            </div>

            <div className="h-[3px] w-full bg-[#0033AA]" />

            {/* Client summary */}
            <div className="mt-4 flex gap-4 rounded-md border border-[#0A2240]/10 bg-[#0A2240]/[0.025] px-5 py-3.5 text-[12.5px]">
              {/* Square client photo */}
              {client.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={client.photo_url}
                  alt={client.full_name}
                  className="h-[72px] w-[72px] shrink-0 rounded-sm object-cover"
                />
              ) : (
                <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-sm bg-[#0033AA]/10 text-[24px] font-bold text-[#0033AA]/40">
                  {client.full_name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-8 gap-y-2">
                <SummaryField label="Client name" value={client.full_name} />
                <SummaryField label="Client code" value={client.client_code} />
                <SummaryField label="Phone" value={client.phone} />
                <SummaryField label="Total transactions" value={loading ? "…" : String(txns.length)} />
                {accountNumber && <SummaryField label="Account number" value={accountNumber} />}
                {accountBalance != null && (
                  <SummaryField label="Current balance" value={formatGHS(accountBalance)} bold />
                )}
              </div>
            </div>

            {loading ? (
              <div className="mt-10 flex items-center justify-center gap-2 text-[13px] text-[#0A2240]/45">
                <Loader2 size={16} className="animate-spin" />
                Loading transactions…
              </div>
            ) : (
              <div className="mt-5 overflow-hidden rounded-md border border-[#0A2240]/12">
                <table className="w-full text-left text-[11.5px]">
                  <thead>
                    <tr className="border-b border-[#0A2240]/10 bg-[#0A2240]/[0.04] text-[10px] font-semibold uppercase tracking-[0.1em] text-[#0A2240]/50">
                      <th className="px-4 py-2.5">Date / Time</th>
                      <th className="px-4 py-2.5">Account</th>
                      <th className="px-4 py-2.5">Type</th>
                      <th className="px-4 py-2.5 text-right">Amount</th>
                      <th className="px-4 py-2.5 text-right">Fee</th>
                      <th className="px-4 py-2.5 text-right">Balance After</th>
                      <th className="px-4 py-2.5">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#0A2240]/6">
                    {txns.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-6 text-center text-[#0A2240]/40">
                          No transactions recorded.
                        </td>
                      </tr>
                    ) : (
                      txns.map((txn) => (
                        <tr key={txn.id} className={txn.reversed_at ? "opacity-45" : ""}>
                          <td className="whitespace-nowrap px-4 py-2.5 text-[#0A2240]/60">
                            {fmt(txn.created_at)}
                          </td>
                          <td className="px-4 py-2.5 font-medium text-[#0A2240]">
                            {txn.account?.account_number ?? "—"}
                          </td>
                          <td className="px-4 py-2.5 capitalize text-[#0A2240]">
                            {txn.reversed_at ? (
                              <span className="text-[#963522]">Reversed</span>
                            ) : (
                              txn.type
                            )}
                          </td>
                          <td className={`px-4 py-2.5 text-right tabular-nums font-medium ${txn.type === "deposit" ? "text-[#1F6E4A]" : "text-[#963522]"}`}>
                            {txn.type === "deposit" ? "+" : "−"}{formatGHS(txn.amount)}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-[#0A2240]/55">
                            {txn.fee > 0 ? formatGHS(txn.fee) : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums font-medium text-[#0A2240]">
                            {formatGHS(txn.bal_after)}
                          </td>
                          <td className="px-4 py-2.5 text-[#0A2240]/55">{txn.notes ?? "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Footer */}
            <div className="mt-6 flex items-center justify-between border-t border-[#0A2240]/10 pt-3 text-[10.5px] text-[#0A2240]/40">
              <p>Printed by: {printedBy ?? "—"}</p>
              <p>
                {printedAt
                  ? printedAt.toLocaleString("en-GB", {
                      day: "numeric", month: "short", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
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

function SummaryField({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div>
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0A2240]/45">{label}</span>
      <p className={bold ? "font-semibold text-[#0033AA]" : "font-medium text-[#0A2240]"}>{value}</p>
    </div>
  );
}
