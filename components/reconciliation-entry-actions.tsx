"use client";

import { useState, type FormEvent } from "react";
import { Pencil, Trash2, Loader2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface EditableEntry {
  id: string;
  opening_cash_at_hand: number;
  deposit_received: number;
  withdrawal_paid: number;
  cash_issued_out: number;
  cash_at_bank: number;
  debt_owed: number | null;
}

export function EditReconciliationButton({ entry }: { entry: EditableEntry }) {
  const [open, setOpen] = useState(false);
  const [openingCashAtHand, setOpeningCashAtHand] = useState(String(entry.opening_cash_at_hand));
  const [depositReceived, setDepositReceived] = useState(String(entry.deposit_received));
  const [withdrawalPaid, setWithdrawalPaid] = useState(String(entry.withdrawal_paid));
  const [cashIssuedOut, setCashIssuedOut] = useState(String(entry.cash_issued_out));
  const [cashAtBank, setCashAtBank] = useState(String(entry.cash_at_bank));
  const [debtOwed, setDebtOwed] = useState(entry.debt_owed === null ? "" : String(entry.debt_owed));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputCls = "w-full rounded-md border border-[#0033AA]/15 bg-[#FFFFFF]/40 px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[#0062E1] focus:bg-white";
  const labelCls = "mb-1.5 block text-[12.5px] font-medium text-[#0033AA]/75";

  function handleClose() {
    setOpen(false);
    setError(null);
  }

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

    setSaving(true);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("cash_reconciliations")
      .update({ ...fields, debt_owed: debtOwed.trim() === "" ? null : Number(debtOwed) })
      .eq("id", entry.id);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    window.location.reload();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] font-medium text-[#0033AA]/60 transition-colors hover:bg-[#0033AA]/5 hover:text-[#0033AA]"
      >
        <Pencil size={12} />
        Edit
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/50 px-4 animate-fade-in">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl max-h-[90dvh] overflow-y-auto">
            <div className="mb-5 flex items-start justify-between">
              <h3 className="text-[15px] font-semibold text-[#0033AA]">Edit reconciliation entry</h3>
              <button type="button" onClick={handleClose} className="text-[#0A2240]/35 hover:text-[#0A2240]">
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
                <span className={labelCls}>Opening balance (cash at hand)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  autoFocus
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
                <span className={labelCls}>Cash issued out</span>
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
                <button type="button" onClick={handleClose} className="rounded-md px-4 py-2 text-[13px] font-medium text-[#0A2240]/55 hover:text-[#0A2240]">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-md bg-[#0033AA] px-5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#002884] disabled:opacity-60"
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export function DeleteReconciliationButton({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: deleteError } = await supabase.from("cash_reconciliations").delete().eq("id", id);

    if (deleteError) {
      setError(deleteError.message);
      setLoading(false);
      return;
    }

    window.location.reload();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] font-medium text-[#963522]/60 transition-colors hover:bg-[#B3432B]/5 hover:text-[#963522]"
      >
        <Trash2 size={12} />
        Delete
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/50 px-4 animate-fade-in">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl max-h-[90dvh] overflow-y-auto">
            <div className="mb-4 flex items-start justify-between">
              <h3 className="text-[15px] font-semibold text-[#0033AA]">Delete this entry?</h3>
              <button onClick={() => setOpen(false)} className="text-[#0A2240]/35 hover:text-[#0A2240]">
                <X size={18} />
              </button>
            </div>
            <p className="mb-5 text-[13.5px] leading-relaxed text-[#0A2240]/60">
              This will permanently remove this day&apos;s reconciliation entry. This cannot be undone.
            </p>
            {error && (
              <div className="mb-4 rounded-md border border-[#B3432B]/25 bg-[#B3432B]/[0.06] px-3.5 py-2.5 text-[12.5px] text-[#963522]">
                {error}
              </div>
            )}
            <div className="flex justify-end gap-2.5">
              <button onClick={() => setOpen(false)} className="rounded-md px-4 py-2 text-[13px] font-medium text-[#0A2240]/55 hover:text-[#0A2240]">
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-md bg-[#B3432B] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#963522] disabled:opacity-60"
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                {loading ? "Deleting…" : "Yes, delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
