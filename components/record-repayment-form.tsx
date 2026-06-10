"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, X, Info, CheckCircle } from "lucide-react";
import { toISODate, formatGHS } from "@/lib/loan";
import type { RepaymentMethod } from "@/lib/types";

const METHODS: { value: RepaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "mobile_money", label: "Mobile Money" },
  { value: "bank_transfer", label: "Bank Transfer" },
];

export function RecordRepaymentForm({
  loanId,
  suggestedAmount,
  currentBalance,
  onRecorded,
}: {
  loanId: string;
  suggestedAmount: number;
  currentBalance?: number;
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
  const [result, setResult] = useState<{ overpayment: number; account: string | null } | null>(null);

  const amountNum = Number(amount);
  const overpaymentPreview =
    currentBalance != null && amountNum > 0 && amountNum > currentBalance
      ? amountNum - currentBalance
      : 0;

  function handleClose() {
    setOpen(false);
    setResult(null);
    setError(null);
    setNotes("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!amountNum || amountNum <= 0) {
      setError("Enter a repayment amount greater than zero.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch(`/api/loans/${loanId}/repayments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amountNum, payment_date: paymentDate, method, notes: notes.trim() || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not record this repayment. Try again.");

      router.refresh();
      onRecorded?.();

      if (json.overpayment_amount > 0) {
        setResult({ overpayment: json.overpayment_amount, account: json.excess_deposited_to });
      } else {
        handleClose();
      }
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
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl max-h-[90dvh] overflow-y-auto">

            {/* Success state — overpayment was credited */}
            {result ? (
              <div className="flex flex-col items-center gap-4 py-2 text-center">
                <CheckCircle size={40} className="text-[#1F6E4A]" />
                <div>
                  <p className="text-[15px] font-semibold text-[#0A2240]">Repayment recorded</p>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#0A2240]/60">
                    {result.account
                      ? <>The excess <strong className="text-[#0A2240]">{formatGHS(result.overpayment)}</strong> has been automatically deposited to account <strong className="text-[#0A2240]">{result.account}</strong>.</>
                      : <>The excess <strong className="text-[#0A2240]">{formatGHS(result.overpayment)}</strong> was recorded but could not be deposited — no active savings account found. Please credit the client manually.</>
                    }
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-md bg-[#0033AA] px-5 py-2 text-[13px] font-semibold text-white hover:bg-[#002884]"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <div className="mb-5 flex items-start justify-between">
                  <div>
                    <h3 className="text-[15px] font-semibold text-[#0033AA]">Record a repayment</h3>
                    <p className="mt-0.5 text-[12.5px] text-[#0A2240]/45">Logged instantly to this loan&apos;s history.</p>
                  </div>
                  <button type="button" onClick={handleClose} aria-label="Close" className="text-[#0A2240]/35 hover:text-[#0A2240]">
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
                    <label className="mb-1.5 block text-[12.5px] font-medium text-[#0033AA]/75">
                      Amount (GHS)
                      {currentBalance != null && (
                        <span className="ml-2 font-normal text-[#0A2240]/40">
                          · Outstanding: {formatGHS(currentBalance)}
                        </span>
                      )}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      title="Repayment amount in GHS"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full rounded-md border border-[#0033AA]/15 bg-[#FFFFFF]/40 px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[#0062E1] focus:bg-white"
                    />
                    {overpaymentPreview > 0 && (
                      <div className="mt-2 flex items-start gap-2 rounded-md border border-[#B58A2A]/25 bg-[#B58A2A]/[0.07] px-3 py-2 text-[12px] text-[#8A6A1F]">
                        <Info size={13} className="mt-0.5 shrink-0" />
                        <span>
                          This exceeds the outstanding balance by <strong>{formatGHS(overpaymentPreview)}</strong>. The excess will be automatically deposited to the client&apos;s savings account.
                        </span>
                      </div>
                    )}
                  </div>

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
                    <div className="flex flex-wrap gap-2">
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
                    <button type="button" onClick={handleClose} className="rounded-md px-4 py-2 text-[13px] font-medium text-[#0A2240]/55 hover:text-[#0A2240]">
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
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
