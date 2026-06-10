"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CalendarRange, Loader2, PiggyBank, Plus, Trash2, X } from "lucide-react";

type Mode = "single" | "batch";

interface BatchRow {
  amount: string;
  payment_date: string;
}

export function SusuContributionForm({ accountId, dailyAmount }: { accountId: string; dailyAmount: number | null }) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("single");
  const [amount, setAmount] = useState(dailyAmount ? String(dailyAmount) : "");
  const [rows, setRows] = useState<BatchRow[]>([{ amount: dailyAmount ? String(dailyAmount) : "", payment_date: "" }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setMode("single");
    setAmount(dailyAmount ? String(dailyAmount) : "");
    setRows([{ amount: dailyAmount ? String(dailyAmount) : "", payment_date: "" }]);
    setError(null);
  }

  function addRow() {
    setRows((prev) => [...prev, { amount: dailyAmount ? String(dailyAmount) : "", payment_date: "" }]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function updateRow(index: number, patch: Partial<BatchRow>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === "single") {
      const amountNum = Number(amount);
      if (!amountNum || amountNum <= 0) {
        setError("Enter an amount greater than zero.");
        return;
      }

      setSubmitting(true);
      try {
        const res = await fetch("/api/susu/payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ account_id: accountId, amount: amountNum }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Could not record this contribution. Try again.");

        setOpen(false);
        reset();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not record this contribution. Try again.");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const entries = rows.map((row) => ({
      amount: Number(row.amount),
      payment_date: row.payment_date || null,
    }));
    if (entries.length === 0 || entries.some((e) => !e.amount || e.amount <= 0)) {
      setError("Every row needs an amount greater than zero.");
      return;
    }
    if (entries.length > 93) {
      setError("A batch can cover at most 93 days (3 cycles).");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/susu/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_id: accountId, entries }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not record this batch. Try again.");

      setOpen(false);
      reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record this batch. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md bg-[#1F6E4A] px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#195C3D]"
      >
        <PiggyBank size={15} />
        Record contribution
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/50 px-4 animate-fade-in">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl max-h-[90dvh] overflow-y-auto">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h3 className="text-[15px] font-semibold text-[#0033AA]">Record a susu contribution</h3>
                <p className="mt-0.5 text-[12.5px] text-[#0A2240]/45">
                  Single-day entries post immediately; use batch mode to catch up several missed days at once.
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="text-[#0A2240]/35 hover:text-[#0A2240]">
                <X size={18} />
              </button>
            </div>

            <div className="mb-4 inline-flex rounded-md border border-[#0033AA]/15 p-0.5 text-[12.5px] font-medium">
              <button
                type="button"
                onClick={() => setMode("single")}
                className={`rounded px-3.5 py-1.5 transition-colors ${mode === "single" ? "bg-[#0033AA] text-white" : "text-[#0033AA]/60 hover:text-[#0033AA]"}`}
              >
                Single day
              </button>
              <button
                type="button"
                onClick={() => setMode("batch")}
                className={`inline-flex items-center gap-1.5 rounded px-3.5 py-1.5 transition-colors ${mode === "batch" ? "bg-[#0033AA] text-white" : "text-[#0033AA]/60 hover:text-[#0033AA]"}`}
              >
                <CalendarRange size={13} />
                Batch (catch-up)
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-md border border-[#B3432B]/25 bg-[#B3432B]/[0.06] px-3.5 py-2.5 text-[12.5px] text-[#963522]">
                  {error}
                </div>
              )}

              {mode === "single" ? (
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
              ) : (
                <div className="space-y-2.5">
                  <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                    {rows.map((row, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <span className="w-6 shrink-0 text-[12px] text-[#0A2240]/40">{index + 1}.</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Amount"
                          value={row.amount}
                          onChange={(e) => updateRow(index, { amount: e.target.value })}
                          className="w-28 rounded-md border border-[#0033AA]/15 bg-[#FFFFFF]/40 px-3 py-2 text-[13.5px] outline-none transition-colors focus:border-[#0062E1] focus:bg-white"
                        />
                        <input
                          type="date"
                          value={row.payment_date}
                          onChange={(e) => updateRow(index, { payment_date: e.target.value })}
                          className="flex-1 rounded-md border border-[#0033AA]/15 bg-[#FFFFFF]/40 px-3 py-2 text-[13.5px] outline-none transition-colors focus:border-[#0062E1] focus:bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => removeRow(index)}
                          disabled={rows.length === 1}
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#B3432B]/20 text-[#963522] transition-colors hover:bg-[#B3432B]/[0.06] disabled:opacity-40"
                          aria-label="Remove row"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={addRow}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[#0033AA]/20 px-3 py-1.5 text-[12.5px] font-medium text-[#0033AA] transition-colors hover:bg-[#0033AA]/5"
                  >
                    <Plus size={13} /> Add day
                  </button>
                  <p className="text-[11.5px] text-[#0A2240]/40">Leave a date blank to use today&rsquo;s date. Up to 93 days (3 cycles) per batch.</p>
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-1">
                <button type="button" onClick={() => setOpen(false)} className="rounded-md px-4 py-2 text-[13px] font-medium text-[#0A2240]/55 hover:text-[#0A2240]">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-md bg-[#1F6E4A] px-5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#195C3D] disabled:opacity-60"
                >
                  {submitting && <Loader2 size={14} className="animate-spin" />}
                  {submitting ? "Saving…" : mode === "single" ? "Save contribution" : "Save batch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
