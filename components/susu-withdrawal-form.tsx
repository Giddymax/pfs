"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpFromLine, Loader2, X } from "lucide-react";

export function SusuWithdrawalForm({ accountId, availableBalance }: { accountId: string; availableBalance: number }) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const amountNum = Number(amount);
    if (!amountNum || amountNum <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    if (amountNum > availableBalance) {
      setError("That exceeds the account's available balance.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/susu/withdrawal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_id: accountId, amount: amountNum }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not record this withdrawal. Try again.");

      setOpen(false);
      setAmount("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record this withdrawal. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md bg-[#B3432B] px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#963522]"
      >
        <ArrowUpFromLine size={15} />
        Partial withdrawal
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/50 px-4 animate-fade-in">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h3 className="text-[15px] font-semibold text-[#0033AA]">Partial susu withdrawal</h3>
                <p className="mt-0.5 text-[12.5px] text-[#0A2240]/45">
                  Drawn against the account&rsquo;s available balance — independent of any cycle claim, and exempt from commission.
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="text-[#0A2240]/35 hover:text-[#0A2240]">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-md border border-[#B3432B]/25 bg-[#B3432B]/[0.06] px-3.5 py-2.5 text-[12.5px] text-[#963522]">
                  {error}
                </div>
              )}

              <label className="block">
                <span className="mb-1.5 block text-[12.5px] font-medium text-[#0033AA]/75">Amount (GHS)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  autoFocus
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded-md border border-[#0033AA]/15 bg-[#FFFFFF]/40 px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[#0062E1] focus:bg-white"
                />
              </label>

              <div className="flex justify-end gap-2.5 pt-1">
                <button type="button" onClick={() => setOpen(false)} className="rounded-md px-4 py-2 text-[13px] font-medium text-[#0A2240]/55 hover:text-[#0A2240]">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-md bg-[#B3432B] px-5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#963522] disabled:opacity-60"
                >
                  {submitting && <Loader2 size={14} className="animate-spin" />}
                  {submitting ? "Saving…" : "Save withdrawal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
