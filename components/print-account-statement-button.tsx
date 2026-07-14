"use client";

import { useState } from "react";
import { FileText, Printer, X, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/logo";
import { PrintPortal } from "@/components/print-portal";
import { PrintWatermark } from "@/components/print-watermark";
import { formatGHS } from "@/lib/loan";
import type { Client, Transaction } from "@/lib/types";

type TxnRow = Transaction & {
  recorder: { full_name: string } | null;
};

function fmt(value: string) {
  return new Date(value).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function PrintAccountStatementButton({
  client,
  accountId,
  accountNumber,
  printedBy,
  companyPhone,
}: {
  client: Client;
  accountId: string;
  accountNumber: string;
  printedBy: string | null;
  companyPhone?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<TxnRow[] | null>(null);
  const [printedAt, setPrintedAt] = useState<Date | null>(null);

  async function handleFetch() {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("transactions")
      .select("*, recorder:recorded_by(full_name)")
      .eq("account_id", accountId)
      .gte("created_at", from + "T00:00:00")
      .lte("created_at", to + "T23:59:59")
      .is("reversed_at", null)
      .order("created_at", { ascending: true })
      .returns<TxnRow[]>();
    setTransactions(data ?? []);
    setPrintedAt(new Date());
    setLoading(false);
  }

  function handleOpen() {
    setOpen(true);
    setTransactions(null);
  }

  const txns = transactions ?? [];

  // Compute opening balance: balance just before `from`
  // We use the first transaction's bal_after minus its effect
  // Simpler: track running balance directly from the list
  let openingBalance = 0;
  if (txns.length > 0) {
    const first = txns[0];
    if (first.type === "deposit") openingBalance = first.bal_after - first.amount;
    else if (first.type === "withdrawal") openingBalance = first.bal_after + first.amount + first.fee;
    else if (first.type === "fee") openingBalance = first.bal_after + first.amount;
  }
  const closingBalance = txns.length > 0 ? txns[txns.length - 1].bal_after : openingBalance;
  const totalIn = txns.filter((t) => t.type === "deposit").reduce((s, t) => s + t.amount, 0);
  const totalOut = txns.filter((t) => t.type !== "deposit").reduce((s, t) => s + t.amount + (t.fee ?? 0), 0);

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center gap-1.5 rounded-md border border-[#0033AA]/20 px-3 py-1.5 text-[11.5px] font-medium text-[#0033AA] transition-colors hover:bg-[#0033AA]/5"
      >
        <FileText size={13} />
        Statement
      </button>

      {open && (
        <PrintPortal>
        <div className="print-overlay fixed inset-0 z-50 overflow-y-auto bg-[#061B3A]/55 px-4 py-8 animate-fade-in">
          {/* Screen controls */}
          <div className="mx-auto flex max-w-[820px] flex-wrap items-center justify-between gap-3 pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-[12.5px] text-white/80">
                From
                <input
                  type="date"
                  value={from}
                  onChange={(e) => { setFrom(e.target.value); setTransactions(null); }}
                  className="rounded border border-white/20 bg-white/10 px-2.5 py-1.5 text-[12.5px] text-white outline-none focus:border-white/40"
                />
              </label>
              <label className="flex items-center gap-2 text-[12.5px] text-white/80">
                To
                <input
                  type="date"
                  value={to}
                  onChange={(e) => { setTo(e.target.value); setTransactions(null); }}
                  className="rounded border border-white/20 bg-white/10 px-2.5 py-1.5 text-[12.5px] text-white outline-none focus:border-white/40"
                />
              </label>
              <button
                type="button"
                onClick={handleFetch}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-md bg-white/15 px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-white/25 disabled:opacity-50"
              >
                {loading && <Loader2 size={13} className="animate-spin" />}
                {loading ? "Loading…" : "Generate"}
              </button>
            </div>
            <div className="flex gap-2">
              {transactions !== null && (
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-2 rounded-md bg-[#0033AA] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#002884]"
                >
                  <Printer size={14} /> Print
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-2 rounded-md border border-white/25 px-4 py-2 text-[13px] font-medium text-white hover:bg-white/10"
              >
                <X size={14} /> Close
              </button>
            </div>
          </div>

          {/* Printable statement */}
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
                <p className="font-semibold text-[#0A2240]/60">Account Statement</p>
                <p>Period: {fmtDate(from)} – {fmtDate(to)}</p>
                {printedAt && (
                  <p>Printed: {printedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
                )}
              </div>
            </div>

            <div className="h-[3px] w-full bg-[#0033AA]" />

            {transactions === null ? (
              <div className="py-16 text-center text-[13.5px] text-[#0A2240]/40">
                Select a date range and click <strong>Generate</strong> to load transactions.
              </div>
            ) : (
              <>
                {/* Client + account summary */}
                <div className="mt-4 flex gap-4 rounded-md border border-[#0A2240]/10 bg-[#0A2240]/[0.025] px-5 py-3.5 text-[12.5px]">
                  {client.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={client.photo_url} alt={client.full_name} className="h-[72px] w-[72px] shrink-0 rounded-sm object-cover" />
                  ) : (
                    <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-sm bg-[#0033AA]/10 text-[24px] font-bold text-[#0033AA]/40">
                      {client.full_name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-8 gap-y-2">
                    <SField label="Client name" value={client.full_name} />
                    <SField label="Client code" value={client.client_code} />
                    <SField label="Phone" value={client.phone} />
                    <SField label="Account number" value={accountNumber} />
                    <SField label="Opening balance" value={formatGHS(openingBalance)} />
                    <SField label="Closing balance" value={formatGHS(closingBalance)} bold />
                  </div>
                </div>

                {/* Period totals */}
                <div className="mt-3 grid grid-cols-3 gap-3">
                  <div className="rounded-md border border-[#1F6E4A]/20 bg-[#1F6E4A]/[0.04] px-4 py-3 text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#1F6E4A]/60">Total In</p>
                    <p className="mt-1 text-[15px] font-bold text-[#1F6E4A]">{formatGHS(totalIn)}</p>
                  </div>
                  <div className="rounded-md border border-[#963522]/20 bg-[#963522]/[0.04] px-4 py-3 text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#963522]/60">Total Out</p>
                    <p className="mt-1 text-[15px] font-bold text-[#963522]">{formatGHS(totalOut)}</p>
                  </div>
                  <div className="rounded-md border border-[#0033AA]/20 bg-[#0033AA]/[0.04] px-4 py-3 text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0033AA]/60">Transactions</p>
                    <p className="mt-1 text-[15px] font-bold text-[#0033AA]">{txns.length}</p>
                  </div>
                </div>

                {/* Transaction table */}
                <div className="mt-4 overflow-hidden rounded-md border border-[#0A2240]/12">
                  <table className="w-full text-left text-[11px]">
                    <thead>
                      <tr className="border-b border-[#0A2240]/10 bg-[#0A2240]/[0.04] text-[9.5px] font-semibold uppercase tracking-[0.1em] text-[#0A2240]/50">
                        <th className="px-3 py-2.5">Date / Time</th>
                        <th className="px-3 py-2.5">Type</th>
                        <th className="px-3 py-2.5 text-right">Amount</th>
                        <th className="px-3 py-2.5 text-right">Fee</th>
                        <th className="px-3 py-2.5 text-right">Balance After</th>
                        <th className="px-3 py-2.5">Notes</th>
                        <th className="px-3 py-2.5">By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#0A2240]/6">
                      {txns.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-3 py-6 text-center text-[#0A2240]/40">
                            No transactions in this period.
                          </td>
                        </tr>
                      ) : (
                        txns.map((txn) => (
                          <tr key={txn.id}>
                            <td className="whitespace-nowrap px-3 py-2 text-[#0A2240]/55">{fmt(txn.created_at)}</td>
                            <td className="px-3 py-2 capitalize text-[#0A2240]">{txn.type}</td>
                            <td className={`px-3 py-2 text-right tabular-nums font-medium ${txn.type === "deposit" ? "text-[#1F6E4A]" : "text-[#963522]"}`}>
                              {txn.type === "deposit" ? "+" : "−"}{formatGHS(txn.amount)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-[#0A2240]/50">
                              {txn.fee > 0 ? formatGHS(txn.fee) : "—"}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums font-medium text-[#0A2240]">
                              {formatGHS(txn.bal_after)}
                            </td>
                            <td className="px-3 py-2 text-[#0A2240]/50">{txn.notes ?? "—"}</td>
                            <td className="px-3 py-2 text-[#0A2240]/50">{txn.recorder?.full_name ?? "—"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Footer */}
                <div className="mt-5 flex items-center justify-between border-t border-[#0A2240]/10 pt-3 text-[10.5px] text-[#0A2240]/40">
                  <p>Printed by: {printedBy ?? "—"}</p>
                  {printedAt && (
                    <p>{printedAt.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
        </PrintPortal>
      )}
    </>
  );
}

function SField({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div>
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0A2240]/45">{label}</span>
      <p className={bold ? "font-semibold text-[#0033AA]" : "font-medium text-[#0A2240]"}>{value}</p>
    </div>
  );
}
