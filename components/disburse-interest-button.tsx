"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, X } from "lucide-react";
import { formatGHS } from "@/lib/loan";

export function DisburseInterestButton({
  accountId,
  clientName,
  accountNumber,
  balance,
}: {
  accountId: string;
  clientName: string;
  accountNumber: string;
  balance: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rate, setRate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rateNum = Number(rate) || 0;
  const computedAmount = rateNum > 0 ? Math.round(balance * (rateNum / 100) * 100) / 100 : 0;

  function handleClose() {
    setOpen(false);
    setRate("");
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!rateNum || rateNum <= 0) {
      setError("Enter a rate greater than zero.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/accounts/${accountId}/interest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rate_percent: rateNum }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not disburse interest. Try again.");

      handleClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not disburse interest. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md bg-[#1F6E4A] px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-[#195C3D]"
      >
        <Sparkles size={13} />
        Disburse interest
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/50 px-4 animate-fade-in">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-start justify-between">
              <h3 className="text-[15px] font-semibold text-[#0033AA]">Disburse interest</h3>
              <button type="button" aria-label="Close" onClick={handleClose} className="text-[#0A2240]/35 hover:text-[#0A2240]">
                <X size={18} />
              </button>
            </div>

            <p className="mb-4 text-[13px] text-[#0A2240]/60">
              {clientName} · {accountNumber} · Qualifying balance {formatGHS(balance)}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-md border border-[#B3432B]/25 bg-[#B3432B]/[0.06] px-3.5 py-2.5 text-[12.5px] text-[#963522]">
                  {error}
                </div>
              )}

              <label className="block">
                <span className="mb-1.5 block text-[12.5px] font-medium text-[#0033AA]/75">Interest rate (%)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  autoFocus
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  className="w-full rounded-md border border-[#0033AA]/15 bg-[#FFFFFF]/40 px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[#0062E1] focus:bg-white"
                />
                <p className="mt-1 text-[11.5px] text-[#0A2240]/45">
                  A flat, manually-decided rate applied to the qualifying balance (not today&rsquo;s balance).
                </p>
              </label>

              <div className="rounded-md border border-[#1F6E4A]/15 bg-[#1F6E4A]/[0.04] px-3.5 py-2.5">
                <p className="text-[11.5px] font-medium uppercase tracking-[0.08em] text-[#1F6E4A]/70">Interest to credit</p>
                <p className="mt-0.5 text-[16px] font-bold tabular-nums text-[#1F6E4A]">{formatGHS(computedAmount)}</p>
                <p className="mt-0.5 text-[11px] text-[#0A2240]/45">
                  {formatGHS(balance)} × {rateNum || 0}% — credited to the account and the client is notified by SMS.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-md border border-[#0033AA]/15 px-4 py-2 text-[13px] font-medium text-[#0033AA]/70 transition-colors hover:bg-[#0033AA]/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-md bg-[#1F6E4A] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#195C3D] disabled:opacity-60"
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  Disburse
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
