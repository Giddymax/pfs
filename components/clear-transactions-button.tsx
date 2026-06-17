"use client";

import { useState } from "react";
import { Trash2, Loader2, X } from "lucide-react";

export function ClearTransactionsButton({ accountId }: { accountId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClear() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/accounts/${accountId}/clear-transactions`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not delete transactions.");
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md border border-[#B3432B]/25 px-4 py-2.5 text-[13px] font-medium text-[#963522] transition-colors hover:bg-[#B3432B]/[0.06]"
      >
        <Trash2 size={14} />
        Clear transactions
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/50 px-4 animate-fade-in">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl max-h-[90dvh] overflow-y-auto">
            <div className="mb-4 flex items-start justify-between">
              <h3 className="text-[15px] font-semibold text-[#963522]">Delete all transactions?</h3>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="text-[#0A2240]/35 hover:text-[#0A2240]"
              >
                <X size={18} />
              </button>
            </div>

            <p className="mb-2 text-[13.5px] leading-relaxed text-[#0A2240]/70">
              This will permanently delete <strong>every transaction</strong> on this account and reset the balance, deposits, withdrawals, and commission to zero.
            </p>
            <p className="mb-5 text-[13px] font-semibold text-[#963522]">
              This action cannot be undone.
            </p>

            {error && (
              <div className="mb-4 rounded-md border border-[#B3432B]/25 bg-[#B3432B]/[0.06] px-3.5 py-2.5 text-[12.5px] text-[#963522]">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={loading}
                className="rounded-md px-4 py-2 text-[13px] font-medium text-[#0A2240]/55 hover:text-[#0A2240] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClear}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-md bg-[#B3432B] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#963522] disabled:opacity-60"
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                {loading ? "Deleting…" : "Yes, delete all"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
