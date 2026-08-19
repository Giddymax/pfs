"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Loader2, X } from "lucide-react";
import { toISODate } from "@/lib/loan";
import type { RepaymentMethod } from "@/lib/types";

const METHODS: { value: RepaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "mobile_money", label: "Mobile Money" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "account_deduction", label: "Auto-deducted" },
];

export function EditLoanRepaymentButton({
  repaymentId,
  amount,
  paymentDate,
  method,
  notes,
}: {
  repaymentId: string;
  amount: number;
  paymentDate: string;
  method: RepaymentMethod;
  notes: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [amountVal, setAmountVal] = useState(String(amount));
  const [dateVal, setDateVal] = useState(toISODate(new Date(paymentDate)));
  const [methodVal, setMethodVal] = useState(method);
  const [notesVal, setNotesVal] = useState(notes ?? "");

  function handleClose() {
    setOpen(false);
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const amountNum = Number(amountVal);
    if (!amountNum || amountNum <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/loans/repayments/${repaymentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amountNum, payment_date: dateVal, method: methodVal, notes: notesVal.trim() || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not save. Try again.");
      router.refresh();
      handleClose();
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
        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#0033AA]/15 text-[#0033AA]/60 transition-colors hover:bg-[#0033AA]/[0.06] hover:text-[#0033AA]"
        aria-label="Edit repayment"
      >
        <Pencil size={12} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/50 px-4">
          <div className="w-full max-w-sm max-h-[90dvh] overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-start justify-between">
              <h3 className="text-[15px] font-semibold text-[#0033AA]">Edit repayment</h3>
              <button type="button" onClick={handleClose} aria-label="Close" className="text-[#0A2240]/35 hover:text-[#0A2240]">
                <X size={18} />
              </button>
            </div>
            <p className="mb-4 text-[12.5px] text-[#0A2240]/45">
              The loan&apos;s outstanding balance and status are recomputed from every remaining repayment after this saves.
            </p>

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
                  min="0.01"
                  step="0.01"
                  value={amountVal}
                  onChange={(e) => setAmountVal(e.target.value)}
                  className="w-full rounded-md border border-[#0033AA]/15 bg-white px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[#0062E1]"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[12.5px] font-medium text-[#0033AA]/75">Payment date</span>
                <input
                  type="date"
                  value={dateVal}
                  onChange={(e) => setDateVal(e.target.value)}
                  className="w-full rounded-md border border-[#0033AA]/15 bg-white px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[#0062E1]"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[12.5px] font-medium text-[#0033AA]/75">Method</span>
                <select
                  value={methodVal}
                  onChange={(e) => setMethodVal(e.target.value as RepaymentMethod)}
                  className="w-full rounded-md border border-[#0033AA]/15 bg-white px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[#0062E1]"
                >
                  {METHODS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[12.5px] font-medium text-[#0033AA]/75">Notes (optional)</span>
                <input
                  type="text"
                  value={notesVal}
                  onChange={(e) => setNotesVal(e.target.value)}
                  className="w-full rounded-md border border-[#0033AA]/15 bg-white px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[#0062E1]"
                />
              </label>

              <div className="flex justify-end gap-2.5 pt-1">
                <button type="button" onClick={handleClose} className="rounded-md px-4 py-2 text-[13px] font-medium text-[#0A2240]/55 hover:text-[#0A2240]">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-md bg-[#0033AA] px-5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#002884] disabled:opacity-60"
                >
                  {submitting && <Loader2 size={14} className="animate-spin" />}
                  {submitting ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
