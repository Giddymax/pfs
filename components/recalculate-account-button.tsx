"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCcw, X } from "lucide-react";

export function RecalculateAccountButton({ accountId }: { accountId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRecalculate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/transactions/recalculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_id: accountId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not recalculate this account. Try again.");

      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not recalculate this account. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md border border-[#0033AA]/15 px-4 py-2.5 text-[13px] font-medium text-[#0033AA]/70 transition-colors hover:bg-[#0033AA]/[0.06] hover:text-[#0033AA]"
      >
        <RefreshCcw size={14} />
        Recalculate
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/50 px-4 animate-fade-in">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between">
              <h3 className="text-[15px] font-semibold text-[#0033AA]">Recompute this account&rsquo;s totals?</h3>
              <button onClick={() => setOpen(false)} className="text-[#0A2240]/35 hover:text-[#0A2240]">
                <X size={18} />
              </button>
            </div>
            <p className="mb-5 text-[13.5px] leading-relaxed text-[#0A2240]/60">
              Rebuilds the balance, deposits, withdrawals, and commission totals from this account&rsquo;s
              non-reversed transaction history. Use this if the running totals look out of sync with the ledger.
            </p>
            {error && (
              <div className="mb-4 rounded-md border border-[#B3432B]/25 bg-[#B3432B]/[0.06] px-3.5 py-2.5 text-[12.5px] text-[#963522]">
                {error}
              </div>
            )}
            <div className="flex justify-end gap-2.5">
              <button onClick={() => setOpen(false)} className="rounded-md px-4 py-2 text-[13px] font-medium text-[#0A2240]/55 hover:text-[#0A2240]">
                Cancel
              </button>
              <button
                onClick={handleRecalculate}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-md bg-[#0033AA] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#002884] disabled:opacity-60"
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                {loading ? "Recalculating…" : "Yes, recalculate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
