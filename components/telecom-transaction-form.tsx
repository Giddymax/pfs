"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, X } from "lucide-react";
import { TELECOM_TYPES, type TelecomTransactionType } from "@/lib/telecom/types";

// Records a Telecom transaction — phone number, type, amount, charge, note
// (see telecom-mini-app-brief.md §3, and 0063_momo_transactions_amount.sql for
// why amount and charge are two separate fields: amount is the principal
// that moved through the customer's Telecom wallet, charge is what PFS billed
// for facilitating it). Nothing is looked up first: there's no wallet or
// client to find, so submitting this just appends one row to
// telecom_transactions.
export function TelecomTransactionForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [type, setType] = useState<TelecomTransactionType>("cash_in");
  const [amount, setAmount] = useState("");
  const [charge, setCharge] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountNum = Number(amount) || 0;
  const chargeNum = Number(charge) || 0;

  function handleClose() {
    setOpen(false);
    setPhone("");
    setType("cash_in");
    setAmount("");
    setCharge("");
    setNote("");
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!phone.trim()) {
      setError("Enter the phone number.");
      return;
    }
    if (!amount || amountNum < 0) {
      setError("Enter an amount of 0 or more.");
      return;
    }
    if (!charge || chargeNum < 0) {
      setError("Enter a charge of 0 or more.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/telecom/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone_number: phone.trim(),
          type,
          amount: amountNum,
          charge: chargeNum,
          note: note.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not record this transaction. Try again.");

      handleClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record this transaction. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md bg-[#1E3A8A] px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#172554]"
      >
        <Plus size={15} />
        Record transaction
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/50 px-4 animate-fade-in">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl max-h-[90dvh] overflow-y-auto">
            <div className="mb-5 flex items-start justify-between">
              <h3 className="text-[15px] font-semibold text-[#1A1A1A]">Record a Telecom transaction</h3>
              <button type="button" aria-label="Close" onClick={handleClose} className="text-[#0A2240]/35 hover:text-[#0A2240]">
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
                <span className="mb-1.5 block text-[12.5px] font-medium text-[#0A2240]/75">Phone number</span>
                <input
                  type="tel"
                  autoFocus
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 024 123 4567"
                  className="w-full rounded-md border border-[#0A2240]/15 bg-[#FFFFFF]/40 px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[#E0A800] focus:bg-white"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[12.5px] font-medium text-[#0A2240]/75">Type</span>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as TelecomTransactionType)}
                  className="w-full rounded-md border border-[#0A2240]/15 bg-[#FFFFFF]/40 px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[#E0A800] focus:bg-white"
                >
                  {TELECOM_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[12.5px] font-medium text-[#0A2240]/75">Amount (GHS)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="What moved through their Telecom wallet"
                  className="w-full rounded-md border border-[#0A2240]/15 bg-[#FFFFFF]/40 px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[#E0A800] focus:bg-white"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[12.5px] font-medium text-[#0A2240]/75">Charge (GHS)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={charge}
                  onChange={(e) => setCharge(e.target.value)}
                  placeholder="What you billed them for it"
                  className="w-full rounded-md border border-[#0A2240]/15 bg-[#FFFFFF]/40 px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[#E0A800] focus:bg-white"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[12.5px] font-medium text-[#0A2240]/75">Note (optional)</span>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  className="w-full resize-none rounded-md border border-[#0A2240]/15 bg-[#FFFFFF]/40 px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[#E0A800] focus:bg-white"
                />
              </label>

              <div className="flex justify-end gap-2.5 pt-1">
                <button type="button" onClick={handleClose} className="rounded-md px-4 py-2 text-[13px] font-medium text-[#0A2240]/55 hover:text-[#0A2240]">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-md bg-[#1E3A8A] px-5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#172554] disabled:opacity-60"
                >
                  {submitting && <Loader2 size={14} className="animate-spin" />}
                  {submitting ? "Saving…" : "Save transaction"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
