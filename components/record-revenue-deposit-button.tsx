"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X, Landmark } from "lucide-react";
import { formatGHS } from "@/lib/loan";

export function RecordRevenueDepositButton({ totalRevenue }: { totalRevenue: number }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const amountNum = Number(amount);

  function reset() {
    setAmount("");
    setNotes("");
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!amountNum || amountNum <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    if (amountNum > totalRevenue) {
      setError(`Cannot deposit more than the available Total Revenue of ${formatGHS(totalRevenue)}.`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/finance/revenue-deposits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amountNum, notes: notes.trim() || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not save. Try again.");
      router.refresh();
      setOpen(false);
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md bg-[#7C3AED] px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#6D28D9]"
      >
        <Landmark size={15} />
        Deposit revenue
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/50 px-4">
          <div className="w-full max-w-sm max-h-[90dvh] overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h3 className="text-[15px] font-semibold text-[#7C3AED]">Deposit revenue</h3>
                <p className="mt-0.5 text-[12.5px] text-[#0A2240]/45">
                  Sweeps an amount out of Total Revenue into the PFS Consolidated Fund — the only way money can enter that account. Can only be recorded between 19:00 and 23:30 each day.
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setOpen(false); reset(); }}
                aria-label="Close"
                className="text-[#0A2240]/35 hover:text-[#0A2240]"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-md border border-[#B3432B]/25 bg-[#B3432B]/[0.06] px-3.5 py-2.5 text-[12.5px] text-[#963522]">
                  {error}
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-[12.5px] font-medium text-[#7C3AED]/85">
                  Amount (GHS)
                  <span className="ml-2 font-normal text-[#0A2240]/40">
                    · Available: {formatGHS(totalRevenue)}
                  </span>
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  title="Amount to deposit from revenue, in GHS"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded-md border border-[#0033AA]/15 bg-[#FFFFFF]/40 px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[#7C3AED] focus:bg-white"
                />
              </div>

              <label className="block">
                <span className="mb-1.5 block text-[12.5px] font-medium text-[#7C3AED]/85">Notes (optional)</span>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-md border border-[#0033AA]/15 bg-[#FFFFFF]/40 px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[#7C3AED] focus:bg-white"
                />
              </label>

              <div className="flex justify-end gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => { setOpen(false); reset(); }}
                  className="rounded-md px-4 py-2 text-[13px] font-medium text-[#0A2240]/55 hover:text-[#0A2240]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-md bg-[#7C3AED] px-5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#6D28D9] disabled:opacity-60"
                >
                  {submitting && <Loader2 size={14} className="animate-spin" />}
                  {submitting ? "Saving…" : "Record deposit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
