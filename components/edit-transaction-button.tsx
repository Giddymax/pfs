"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Clock, Loader2, Pencil, Undo2, X } from "lucide-react";
import type { Transaction } from "@/lib/types";

// Converts an ISO datetime string to the value format required by <input type="datetime-local">
// (which is YYYY-MM-DDTHH:mm, in local time)
function toDatetimeLocalValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

export function EditTransactionButton({ transaction }: { transaction: Transaction }) {
  const router = useRouter();
  const [mode, setMode] = useState<"closed" | "edit" | "reverse" | "datetime">("closed");
  const [amount, setAmount] = useState(String(transaction.amount));
  const [datetime, setDatetime] = useState(toDatetimeLocalValue(transaction.created_at));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setMode("closed");
    setError(null);
    setAmount(String(transaction.amount));
    setDatetime(toDatetimeLocalValue(transaction.created_at));
  }

  async function handleEdit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const amountNum = Number(amount);
    if (!amountNum || amountNum <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/transactions/${transaction.id}/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amountNum }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not edit this transaction. Try again.");

      setMode("closed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not edit this transaction. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReverse() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/transactions/${transaction.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not reverse this transaction. Try again.");

      setMode("closed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reverse this transaction. Try again.");
      setSubmitting(false);
    }
  }

  async function handleDatetime(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!datetime) {
      setError("Select a valid date and time.");
      return;
    }

    // datetime-local value is in local browser time; convert to UTC ISO for the API
    const parsed = new Date(datetime);
    if (isNaN(parsed.getTime())) {
      setError("Invalid date or time.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/transactions/${transaction.id}/edit-datetime`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ created_at: parsed.toISOString() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not update the date/time. Try again.");

      setMode("closed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the date/time. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setMode("edit")}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#0033AA]/15 text-[#0033AA]/60 transition-colors hover:bg-[#0033AA]/[0.06] hover:text-[#0033AA]"
          aria-label="Edit amount"
          title="Edit amount"
        >
          <Pencil size={13} />
        </button>
        <button
          onClick={() => setMode("datetime")}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#7C3AED]/20 text-[#7C3AED]/60 transition-colors hover:bg-[#7C3AED]/[0.06] hover:text-[#7C3AED]"
          aria-label="Edit date & time"
          title="Edit date & time"
        >
          <Clock size={13} />
        </button>
        <button
          onClick={() => setMode("reverse")}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#B3432B]/20 text-[#963522]/70 transition-colors hover:bg-[#B3432B]/[0.06] hover:text-[#963522]"
          aria-label="Reverse transaction"
          title="Reverse transaction"
        >
          <Undo2 size={13} />
        </button>
      </div>

      {mode !== "closed" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/50 px-4 animate-fade-in">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl max-h-[90dvh] overflow-y-auto">

            {mode === "edit" && (
              <>
                <div className="mb-5 flex items-start justify-between">
                  <div>
                    <h3 className="text-[15px] font-semibold text-[#0033AA]">Edit transaction amount</h3>
                    <p className="mt-0.5 text-[12.5px] text-[#0A2240]/45">
                      The balance and every later transaction on this account will be recalculated.
                    </p>
                  </div>
                  <button onClick={close} className="text-[#0A2240]/35 hover:text-[#0A2240]">
                    <X size={18} />
                  </button>
                </div>
                <form onSubmit={handleEdit} className="space-y-4">
                  {error && (
                    <div className="rounded-md border border-[#B3432B]/25 bg-[#B3432B]/[0.06] px-3.5 py-2.5 text-[12.5px] text-[#963522]">
                      {error}
                    </div>
                  )}
                  <label className="block">
                    <span className="mb-1.5 block text-[12.5px] font-medium text-[#0033AA]/75">New amount (GHS)</span>
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
                    <button type="button" onClick={close} className="rounded-md px-4 py-2 text-[13px] font-medium text-[#0A2240]/55 hover:text-[#0A2240]">
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="inline-flex items-center gap-2 rounded-md bg-[#0033AA] px-5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#002884] disabled:opacity-60"
                    >
                      {submitting && <Loader2 size={14} className="animate-spin" />}
                      {submitting ? "Saving…" : "Save changes"}
                    </button>
                  </div>
                </form>
              </>
            )}

            {mode === "datetime" && (
              <>
                <div className="mb-5 flex items-start justify-between">
                  <div>
                    <h3 className="text-[15px] font-semibold text-[#0033AA]">Edit transaction date &amp; time</h3>
                    <p className="mt-0.5 text-[12.5px] text-[#0A2240]/45">
                      The recorded staff member stays unchanged. Balance snapshots are automatically reordered.
                    </p>
                  </div>
                  <button onClick={close} className="text-[#0A2240]/35 hover:text-[#0A2240]">
                    <X size={18} />
                  </button>
                </div>
                <form onSubmit={handleDatetime} className="space-y-4">
                  {error && (
                    <div className="rounded-md border border-[#B3432B]/25 bg-[#B3432B]/[0.06] px-3.5 py-2.5 text-[12.5px] text-[#963522]">
                      {error}
                    </div>
                  )}
                  <label className="block">
                    <span className="mb-1.5 block text-[12.5px] font-medium text-[#0033AA]/75">Date &amp; time</span>
                    <input
                      type="datetime-local"
                      autoFocus
                      value={datetime}
                      onChange={(e) => setDatetime(e.target.value)}
                      className="w-full rounded-md border border-[#0033AA]/15 bg-[#FFFFFF]/40 px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[#0062E1] focus:bg-white"
                    />
                  </label>
                  <p className="text-[11.5px] text-[#0A2240]/40">
                    Recorded by: <span className="font-medium text-[#0A2240]/65">
                      {(transaction as Transaction & { recorder?: { full_name: string } | null }).recorder?.full_name ?? "—"}
                    </span>
                  </p>
                  <div className="flex justify-end gap-2.5 pt-1">
                    <button type="button" onClick={close} className="rounded-md px-4 py-2 text-[13px] font-medium text-[#0A2240]/55 hover:text-[#0A2240]">
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="inline-flex items-center gap-2 rounded-md bg-[#7C3AED] px-5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#6D28D9] disabled:opacity-60"
                    >
                      {submitting && <Loader2 size={14} className="animate-spin" />}
                      {submitting ? "Saving…" : "Save date & time"}
                    </button>
                  </div>
                </form>
              </>
            )}

            {mode === "reverse" && (
              <>
                <div className="mb-4 flex items-start justify-between">
                  <h3 className="text-[15px] font-semibold text-[#0033AA]">Reverse this transaction?</h3>
                  <button onClick={close} className="text-[#0A2240]/35 hover:text-[#0A2240]">
                    <X size={18} />
                  </button>
                </div>
                <p className="mb-5 text-[13.5px] leading-relaxed text-[#0A2240]/60">
                  This reverses the balance impact and flags the entry as reversed (it stays in the history for the
                  audit trail). The client receives a &ldquo;transaction reversed&rdquo; SMS naming you as the admin.
                </p>
                {error && (
                  <div className="mb-4 rounded-md border border-[#B3432B]/25 bg-[#B3432B]/[0.06] px-3.5 py-2.5 text-[12.5px] text-[#963522]">
                    {error}
                  </div>
                )}
                <div className="flex justify-end gap-2.5">
                  <button onClick={close} className="rounded-md px-4 py-2 text-[13px] font-medium text-[#0A2240]/55 hover:text-[#0A2240]">
                    Cancel
                  </button>
                  <button
                    onClick={handleReverse}
                    disabled={submitting}
                    className="inline-flex items-center gap-2 rounded-md bg-[#B3432B] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#963522] disabled:opacity-60"
                  >
                    {submitting && <Loader2 size={14} className="animate-spin" />}
                    {submitting ? "Reversing…" : "Yes, reverse it"}
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}
    </>
  );
}
