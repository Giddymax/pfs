"use client";

import { useState, type FormEvent } from "react";
import { ArrowUpFromLine, Loader2, X } from "lucide-react";
import { formatGHS } from "@/lib/loan";
import type { SusuCycle } from "@/lib/types";

export function SusuWithdrawalForm({
  accountId,
  availableBalance,
  dailyAmount,
  isQualified = false,
  emergencyCycle = null,
}: {
  accountId: string;
  availableBalance: number;
  dailyAmount: number;
  isQualified?: boolean;
  emergencyCycle?: SusuCycle | null;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showEmergencyFlow = !isQualified && emergencyCycle !== null;
  const companyFee = dailyAmount;
  const emergencyPayout = Math.max(availableBalance - companyFee, 0);

  function close() {
    setOpen(false);
    setError(null);
    setAmount("");
    setReason("");
  }

  async function handleQualifiedWithdrawal(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const amountNum = Number(amount);
    if (!amountNum || amountNum <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    if (amountNum > availableBalance) {
      setError("That exceeds the account's available balance.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/susu/withdrawal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_id: accountId, amount: amountNum }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not record this withdrawal. Try again.");

      close();
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record this withdrawal. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEmergencyWithdrawal(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!reason.trim()) {
      setError("Please provide a reason for the emergency withdrawal.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/susu/emergency-withdrawal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: accountId,
          reason: reason.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not process emergency withdrawal. Try again.");

      close();
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not process emergency withdrawal. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-[13px] font-semibold text-white transition-colors ${
          isQualified
            ? "bg-[#1F6E4A] hover:bg-[#195C3D]"
            : "bg-[#B3432B] hover:bg-[#963522]"
        }`}
      >
        <ArrowUpFromLine size={15} />
        {isQualified ? "Qualified to withdraw" : "Emergency withdrawal"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/50 px-4 animate-fade-in">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl max-h-[90dvh] overflow-y-auto">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h3 className="text-[15px] font-semibold text-[#0033AA]">
                  {showEmergencyFlow ? "Emergency withdrawal" : "Qualified withdrawal"}
                </h3>
                <p className="mt-0.5 text-[12.5px] text-[#0A2240]/45">
                  {showEmergencyFlow
                    ? "The cycle is still in progress. The company fee (1 day's contribution) is deducted automatically."
                    : "The 30-day cycle is complete. Drawn against the available balance — exempt from commission."}
                </p>
              </div>
              <button type="button" aria-label="Close" onClick={close} className="text-[#0A2240]/35 hover:text-[#0A2240]">
                <X size={18} />
              </button>
            </div>

            {showEmergencyFlow ? (
              <form onSubmit={handleEmergencyWithdrawal} className="space-y-4">
                {error && (
                  <div className="rounded-md border border-[#B3432B]/25 bg-[#B3432B]/[0.06] px-3.5 py-2.5 text-[12.5px] text-[#963522]">
                    {error}
                  </div>
                )}

                {/* Payout breakdown */}
                <div className="rounded-lg border border-[#0033AA]/10 bg-[#0033AA]/[0.02] px-4 py-3 text-[13px]">
                  <div className="flex items-center justify-between text-[#0A2240]/60">
                    <span>Account balance</span>
                    <span className="font-medium text-[#0A2240]">{formatGHS(availableBalance)}</span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[#963522]">
                    <span>Company fee (1 day)</span>
                    <span className="font-medium">− {formatGHS(companyFee)}</span>
                  </div>
                  <div className="mt-2 border-t border-[#0033AA]/10 pt-2 flex items-center justify-between text-[#1F6E4A] font-semibold">
                    <span>Client receives</span>
                    <span>{formatGHS(emergencyPayout)}</span>
                  </div>
                </div>

                <label className="block">
                  <span className="mb-1.5 block text-[12.5px] font-medium text-[#0033AA]/75">
                    Reason for emergency withdrawal
                  </span>
                  <textarea
                    autoFocus
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Explain why this withdrawal is needed before the cycle is complete…"
                    className="w-full rounded-md border border-[#0033AA]/15 bg-[#FFFFFF]/40 px-3.5 py-2.5 text-[14px] outline-none transition-colors placeholder:text-[#0A2240]/35 focus:border-[#0062E1] focus:bg-white"
                  />
                </label>

                <div className="flex justify-end gap-2.5 pt-1">
                  <button type="button" onClick={close} className="rounded-md px-4 py-2 text-[13px] font-medium text-[#0A2240]/55 hover:text-[#0A2240]">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || emergencyPayout <= 0}
                    className="inline-flex items-center gap-2 rounded-md bg-[#B3432B] px-5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#963522] disabled:opacity-60"
                  >
                    {submitting && <Loader2 size={14} className="animate-spin" />}
                    {submitting ? "Processing…" : `Withdraw ${formatGHS(emergencyPayout)}`}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleQualifiedWithdrawal} className="space-y-4">
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
                    className="inline-flex items-center gap-2 rounded-md bg-[#1F6E4A] px-5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#195C3D] disabled:opacity-60"
                  >
                    {submitting && <Loader2 size={14} className="animate-spin" />}
                    {submitting ? "Saving…" : "Save withdrawal"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
