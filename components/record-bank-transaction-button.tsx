"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { formatGHS } from "@/lib/loan";

type Mode = "deposit" | "withdrawal";

function Modal({
  mode,
  cashAtBank,
  onClose,
}: {
  mode: Mode;
  cashAtBank: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDeposit = mode === "deposit";
  const accent = isDeposit ? "#1F6E4A" : "#963522";
  const amountNum = Number(amount);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!amountNum || amountNum <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    if (!isDeposit && amountNum > cashAtBank) {
      setError(`Cannot withdraw more than the current bank balance of ${formatGHS(cashAtBank)}.`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: mode, amount: amountNum, description: description.trim() || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not save. Try again.");
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/50 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl max-h-[90dvh] overflow-y-auto">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h3 className="text-[15px] font-semibold" style={{ color: accent }}>
              {isDeposit ? "Bank deposit" : "Bank withdrawal"}
            </h3>
            <p className="mt-0.5 text-[12.5px] text-[#0A2240]/45">
              {isDeposit
                ? "Record cash deposited into the company bank account."
                : "Record cash withdrawn from the company bank account."}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-[#0A2240]/35 hover:text-[#0A2240]">
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
              {!isDeposit && (
                <span className="ml-2 font-normal text-[#0A2240]/40">
                  · Bank balance: {formatGHS(cashAtBank)}
                </span>
              )}
            </label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              title={isDeposit ? "Deposit amount in GHS" : "Withdrawal amount in GHS"}
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-md border border-[#0033AA]/15 bg-[#FFFFFF]/40 px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[#0062E1] focus:bg-white"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[12.5px] font-medium text-[#0033AA]/75">
              Description (optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={isDeposit ? "e.g. Daily takings deposited" : "e.g. Cash for client payouts"}
              className="w-full rounded-md border border-[#0033AA]/15 bg-[#FFFFFF]/40 px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[#0062E1] focus:bg-white"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-[13px] font-medium text-[#0A2240]/55 hover:text-[#0A2240]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-md px-5 py-2 text-[13px] font-semibold text-white transition-colors disabled:opacity-60"
              style={{ backgroundColor: accent }}
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              {submitting ? "Saving…" : isDeposit ? "Record deposit" : "Record withdrawal"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function BankDepositButton({ cashAtBank }: { cashAtBank: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md bg-[#1F6E4A] px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#185c3e]"
      >
        <ArrowDownToLine size={15} />
        Bank deposit
      </button>
      {open && <Modal mode="deposit" cashAtBank={cashAtBank} onClose={() => setOpen(false)} />}
    </>
  );
}

export function BankWithdrawalButton({ cashAtBank }: { cashAtBank: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md border border-[#963522]/25 bg-white px-4 py-2.5 text-[13px] font-semibold text-[#963522] transition-colors hover:bg-[#963522]/5"
      >
        <ArrowUpFromLine size={15} />
        Bank withdrawal
      </button>
      {open && <Modal mode="withdrawal" cashAtBank={cashAtBank} onClose={() => setOpen(false)} />}
    </>
  );
}
