"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toISODate } from "@/lib/loan";
import type { RepaymentMethod } from "@/lib/types";

const METHODS: { value: RepaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "mobile_money", label: "Mobile Money" },
  { value: "bank_transfer", label: "Bank Transfer" },
];

export function RecordRepaymentForm({
  loanId,
  suggestedAmount,
  onRecorded,
}: {
  loanId: string;
  suggestedAmount: number;
  onRecorded?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(suggestedAmount));
  const [paymentDate, setPaymentDate] = useState(toISODate(new Date()));
  const [method, setMethod] = useState<RepaymentMethod>("cash");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const amountNum = Number(amount);
    if (!amountNum || amountNum <= 0) {
      setError("Enter a repayment amount greater than zero.");
      return;
    }

    setSubmitting(true);
    const supabase = createClient();

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error: insertError } = await supabase.from("loan_repayments").insert({
        loan_id: loanId,
        amount: amountNum,
        payment_date: paymentDate,
        method,
        notes: notes.trim() || null,
        recorded_by: user?.id ?? null,
      });

      if (insertError) throw new Error(insertError.message);

      setOpen(false);
      setNotes("");
      router.refresh();
      onRecorded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record this repayment. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md bg-[#0033AA] px-4 py-2.5 text-[13px] font-semibold text-[#FFFFFF] transition-colors hover:bg-[#002884]"
      >
        <Plus size={15} />
        Record repayment
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/50 px-4 animate-fade-in">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h3 className="text-[15px] font-semibold text-[#0033AA]">Record a repayment</h3>
                <p className="mt-0.5 text-[12.5px] text-[#0A2240]/45">Logged instantly to this loan&apos;s history.</p>
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
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded-md border border-[#0033AA]/15 bg-[#FFFFFF]/40 px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[#0062E1] focus:bg-white"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[12.5px] font-medium text-[#0033AA]/75">Payment date</span>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full rounded-md border border-[#0033AA]/15 bg-[#FFFFFF]/40 px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[#0062E1] focus:bg-white"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[12.5px] font-medium text-[#0033AA]/75">Payment method</span>
                <div className="flex gap-2">
                  {METHODS.map((m) => (
                    <button
                      type="button"
                      key={m.value}
                      onClick={() => setMethod(m.value)}
                      className={`flex-1 rounded-md border px-3 py-2 text-[12.5px] font-medium transition-colors ${
                        method === m.value
                          ? "border-[#0033AA] bg-[#0033AA] text-[#FFFFFF]"
                          : "border-[#0033AA]/15 text-[#0A2240]/55 hover:border-[#0033AA]/30"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[12.5px] font-medium text-[#0033AA]/75">Notes (optional)</span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="e.g. Paid at branch counter"
                  className="w-full resize-none rounded-md border border-[#0033AA]/15 bg-[#FFFFFF]/40 px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[#0062E1] focus:bg-white"
                />
              </label>

              <div className="flex justify-end gap-2.5 pt-1">
                <button type="button" onClick={() => setOpen(false)} className="rounded-md px-4 py-2 text-[13px] font-medium text-[#0A2240]/55 hover:text-[#0A2240]">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-md bg-[#0033AA] px-5 py-2 text-[13px] font-semibold text-[#FFFFFF] transition-colors hover:bg-[#002884] disabled:opacity-60"
                >
                  {submitting && <Loader2 size={14} className="animate-spin" />}
                  {submitting ? "Saving…" : "Save repayment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
