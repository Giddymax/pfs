"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, X } from "lucide-react";

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function Modal({
  suggestedOpeningBalance,
  onClose,
}: {
  suggestedOpeningBalance: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [entryDate, setEntryDate] = useState(todayISO());
  const [openingCashAtHand, setOpeningCashAtHand] = useState(String(suggestedOpeningBalance));
  const [depositReceived, setDepositReceived] = useState("");
  const [withdrawalPaid, setWithdrawalPaid] = useState("");
  const [cashIssuedOut, setCashIssuedOut] = useState("");
  const [cashAtBank, setCashAtBank] = useState("");
  const [debtOwed, setDebtOwed] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const fields = {
      opening_cash_at_hand: Number(openingCashAtHand || 0),
      deposit_received: Number(depositReceived || 0),
      withdrawal_paid: Number(withdrawalPaid || 0),
      cash_issued_out: Number(cashIssuedOut || 0),
      cash_at_bank: Number(cashAtBank || 0),
    };
    if (Object.values(fields).some((v) => !Number.isFinite(v) || v < 0)) {
      setError("Amounts must be zero or greater.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/reconciliation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entry_date: entryDate,
          ...fields,
          debt_owed: debtOwed.trim() === "" ? null : Number(debtOwed),
        }),
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

  const inputCls = "w-full rounded-md border border-[#0033AA]/15 bg-[#FFFFFF]/40 px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[#0062E1] focus:bg-white";
  const labelCls = "mb-1.5 block text-[12.5px] font-medium text-[#0033AA]/75";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/50 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl max-h-[90dvh] overflow-y-auto">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h3 className="text-[15px] font-semibold text-[#0033AA]">Daily reconciliation entry</h3>
            <p className="mt-0.5 text-[12.5px] text-[#0A2240]/45">
              Record the day&apos;s cash movement — closing figures are calculated automatically.
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

          <label className="block">
            <span className={labelCls}>Date</span>
            <input
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              className={inputCls}
            />
          </label>

          <label className="block">
            <span className={labelCls}>
              Opening balance (cash at hand)
              <span className="ml-1.5 font-normal text-[#0A2240]/40">— carried over from the previous day</span>
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={openingCashAtHand}
              onChange={(e) => setOpeningCashAtHand(e.target.value)}
              className={inputCls}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={labelCls}>Deposit received</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={depositReceived}
                onChange={(e) => setDepositReceived(e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className={labelCls}>Withdrawal paid out</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={withdrawalPaid}
                onChange={(e) => setWithdrawalPaid(e.target.value)}
                className={inputCls}
              />
            </label>
          </div>

          <label className="block">
            <span className={labelCls}>Cash issued out (handed to field agent)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={cashIssuedOut}
              onChange={(e) => setCashIssuedOut(e.target.value)}
              className={inputCls}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={labelCls}>Cash at bank</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={cashAtBank}
                onChange={(e) => setCashAtBank(e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className={labelCls}>Debt owed (optional)</span>
              <input
                type="number"
                step="0.01"
                value={debtOwed}
                onChange={(e) => setDebtOwed(e.target.value)}
                className={inputCls}
              />
            </label>
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
              className="inline-flex items-center gap-2 rounded-md bg-[#0033AA] px-5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#002884] disabled:opacity-60"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              {submitting ? "Saving…" : "Save entry"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AddReconciliationButton({ suggestedOpeningBalance }: { suggestedOpeningBalance: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md bg-[#0033AA] px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#002884]"
      >
        <Plus size={15} />
        Add entry
      </button>
      {open && <Modal suggestedOpeningBalance={suggestedOpeningBalance} onClose={() => setOpen(false)} />}
    </>
  );
}
