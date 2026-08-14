"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Trash2, X } from "lucide-react";
import { MOMO_TYPES, type MomoTransactionType } from "@/lib/momo/types";
import type { MomoTransaction } from "@/lib/types";

// Admin edit/reverse for a single MoMo transaction row — the page these
// render on is already admin-only (app/(dashboard)/momo/layout.tsx), so
// there's no separate role check needed here, but the API routes underneath
// still verify independently (never trust the client alone).
export function MomoTransactionRowActions({ transaction }: { transaction: MomoTransaction }) {
  const router = useRouter();
  const [mode, setMode] = useState<"closed" | "edit" | "reverse">("closed");
  const [phone, setPhone] = useState(transaction.phone_number);
  const [type, setType] = useState<MomoTransactionType>(transaction.type);
  const [amount, setAmount] = useState(String(transaction.amount));
  const [charge, setCharge] = useState(String(transaction.charge));
  const [note, setNote] = useState(transaction.note ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setMode("closed");
    setError(null);
    setPhone(transaction.phone_number);
    setType(transaction.type);
    setAmount(String(transaction.amount));
    setCharge(String(transaction.charge));
    setNote(transaction.note ?? "");
  }

  async function handleEdit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const amountNum = Number(amount);
    const chargeNum = Number(charge);
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
      const res = await fetch(`/api/momo/transactions/${transaction.id}`, {
        method: "PATCH",
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
      if (!res.ok) throw new Error(json.error ?? "Could not save changes. Try again.");

      setMode("closed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save changes. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReverse() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/momo/transactions/${transaction.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not reverse this transaction. Try again.");

      setMode("closed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reverse this transaction. Try again.");
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setMode("edit")}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#0A2240]/15 text-[#0A2240]/60 transition-colors hover:bg-[#0A2240]/[0.06] hover:text-[#0A2240]"
          aria-label="Edit transaction"
          title="Edit transaction"
        >
          <Pencil size={13} />
        </button>
        <button
          onClick={() => setMode("reverse")}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#B3432B]/20 text-[#963522]/70 transition-colors hover:bg-[#B3432B]/[0.06] hover:text-[#963522]"
          aria-label="Reverse transaction"
          title="Reverse transaction"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {mode !== "closed" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/50 px-4 animate-fade-in">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl max-h-[90dvh] overflow-y-auto">

            {mode === "edit" && (
              <>
                <div className="mb-5 flex items-start justify-between">
                  <h3 className="text-[15px] font-semibold text-[#1A1A1A]">Edit transaction</h3>
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
                    <span className="mb-1.5 block text-[12.5px] font-medium text-[#0A2240]/75">Phone number</span>
                    <input
                      type="tel"
                      autoFocus
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full rounded-md border border-[#0A2240]/15 bg-[#FFFFFF]/40 px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[#E0A800] focus:bg-white"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-[12.5px] font-medium text-[#0A2240]/75">Type</span>
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value as MomoTransactionType)}
                      className="w-full rounded-md border border-[#0A2240]/15 bg-[#FFFFFF]/40 px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[#E0A800] focus:bg-white"
                    >
                      {MOMO_TYPES.map((t) => (
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
                    <button type="button" onClick={close} className="rounded-md px-4 py-2 text-[13px] font-medium text-[#0A2240]/55 hover:text-[#0A2240]">
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="inline-flex items-center gap-2 rounded-md bg-[#1A1A1A] px-5 py-2 text-[13px] font-semibold text-[#FFC72C] transition-colors hover:bg-[#000000] disabled:opacity-60"
                    >
                      {submitting && <Loader2 size={14} className="animate-spin" />}
                      {submitting ? "Saving…" : "Save changes"}
                    </button>
                  </div>
                </form>
              </>
            )}

            {mode === "reverse" && (
              <>
                <div className="mb-4 flex items-start justify-between">
                  <h3 className="text-[15px] font-semibold text-[#1A1A1A]">Reverse this transaction?</h3>
                  <button onClick={close} className="text-[#0A2240]/35 hover:text-[#0A2240]">
                    <X size={18} />
                  </button>
                </div>
                <p className="mb-5 text-[13.5px] leading-relaxed text-[#0A2240]/60">
                  This flags the entry as reversed — it stays in the log for the record, but drops out of the
                  MoMo Overview totals and the Excel export.
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
