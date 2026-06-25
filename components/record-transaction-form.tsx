"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownToLine, ArrowUpFromLine, Loader2, X } from "lucide-react";
import { formatGHS } from "@/lib/loan";
import type { CommissionTier } from "@/lib/types";

type TransactionKind = "deposit" | "withdrawal";

const KIND_COPY: Record<TransactionKind, { label: string; cta: string; endpoint: string; accent: string }> = {
  deposit: {
    label: "Record a deposit",
    cta: "Save deposit",
    endpoint: "/api/transactions/deposit",
    accent: "bg-[#1F6E4A] hover:bg-[#195C3D]",
  },
  withdrawal: {
    label: "Record a withdrawal",
    cta: "Save withdrawal",
    endpoint: "/api/transactions/withdrawal",
    accent: "bg-[#B3432B] hover:bg-[#963522]",
  },
};

function computeCommission(amount: number, tiers: CommissionTier[]): number {
  if (!tiers.length || amount <= 0) return 0;
  const sorted = [...tiers].sort((a, b) => b.min - a.min);
  const applicable = sorted.find((t) => t.min <= amount);
  return applicable?.fee ?? 0;
}

export function RecordTransactionForm({
  accountId,
  kind,
  commissionTiers,
}: {
  accountId: string;
  kind: TransactionKind;
  commissionTiers?: CommissionTier[] | null;
}) {
  const router = useRouter();
  const copy = KIND_COPY[kind];
  const Icon = kind === "deposit" ? ArrowDownToLine : ArrowUpFromLine;

  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isClient, setIsClient] = useState(true);
  const [proxyName, setProxyName] = useState("");
  const [proxyPhone, setProxyPhone] = useState("");
  const [proxyRelation, setProxyRelation] = useState("");

  const amountNum = Number(amount) || 0;
  const fee = kind === "withdrawal" ? computeCommission(amountNum, commissionTiers ?? []) : 0;

  function handleClose() {
    setOpen(false);
    setAmount("");
    setNotes("");
    setError(null);
    setIsClient(true);
    setProxyName("");
    setProxyPhone("");
    setProxyRelation("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!amountNum || amountNum <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }

    if (kind === "withdrawal" && !isClient) {
      if (!proxyName.trim()) {
        setError("Please enter the name of the person withdrawing.");
        return;
      }
      if (!proxyPhone.trim()) {
        setError("Please enter the phone number of the person withdrawing.");
        return;
      }
      if (!proxyRelation.trim()) {
        setError("Please enter their relationship to the client.");
        return;
      }
    }

    let combinedNotes = notes.trim() || "";
    if (kind === "withdrawal" && !isClient) {
      const proxyInfo = `[Proxy withdrawal] Name: ${proxyName.trim()}, Phone: ${proxyPhone.trim()}, Relation: ${proxyRelation.trim()}`;
      combinedNotes = combinedNotes ? `${proxyInfo} | ${combinedNotes}` : proxyInfo;
    }

    setSubmitting(true);
    try {
      const res = await fetch(copy.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: accountId,
          amount: amountNum,
          notes: combinedNotes || null,
          ...(!isClient && kind === "withdrawal" ? { proxy_name: proxyName.trim() } : {}),
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
        className={`inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-[13px] font-semibold text-white transition-colors ${copy.accent}`}
      >
        <Icon size={15} />
        {kind === "deposit" ? "Deposit" : "Withdraw"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/50 px-4 animate-fade-in">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl max-h-[90dvh] overflow-y-auto">
            <div className="mb-5 flex items-start justify-between">
              <h3 className="text-[15px] font-semibold text-[#0033AA]">{copy.label}</h3>
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

              {kind === "withdrawal" && (
                <label className="block">
                  <span className="mb-1.5 block text-[12.5px] font-medium text-[#0033AA]/75">Withdrawal fee (GHS)</span>
                  <input
                    type="text"
                    readOnly
                    aria-label="Withdrawal fee"
                    value={formatGHS(fee)}
                    className="w-full rounded-md border border-[#0033AA]/10 bg-[#0033AA]/[0.03] px-3.5 py-2.5 text-[14px] text-[#0A2240]/70 outline-none"
                  />
                </label>
              )}

              {kind === "withdrawal" && (
                <div className="space-y-3">
                  <fieldset>
                    <legend className="mb-1.5 block text-[12.5px] font-medium text-[#0033AA]/75">
                      Who is withdrawing?
                    </legend>
                    <div className="flex gap-3">
                      <label className="flex items-center gap-1.5 text-[13px] text-[#0A2240]/80 cursor-pointer">
                        <input
                          type="radio"
                          name="withdrawer"
                          checked={isClient}
                          onChange={() => setIsClient(true)}
                          className="accent-[#0033AA]"
                        />
                        The client
                      </label>
                      <label className="flex items-center gap-1.5 text-[13px] text-[#0A2240]/80 cursor-pointer">
                        <input
                          type="radio"
                          name="withdrawer"
                          checked={!isClient}
                          onChange={() => setIsClient(false)}
                          className="accent-[#0033AA]"
                        />
                        Someone else
                      </label>
                    </div>
                  </fieldset>

                  {!isClient && (
                    <div className="space-y-3 rounded-lg border border-[#0033AA]/10 bg-[#0033AA]/[0.02] p-3.5">
                      <label className="block">
                        <span className="mb-1 block text-[12.5px] font-medium text-[#0033AA]/75">Full name</span>
                        <input
                          type="text"
                          value={proxyName}
                          onChange={(e) => setProxyName(e.target.value)}
                         
                          className="w-full rounded-md border border-[#0033AA]/15 bg-white px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[#0062E1]"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[12.5px] font-medium text-[#0033AA]/75">Phone number</span>
                        <input
                          type="tel"
                          value={proxyPhone}
                          onChange={(e) => setProxyPhone(e.target.value)}
                         
                          className="w-full rounded-md border border-[#0033AA]/15 bg-white px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[#0062E1]"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[12.5px] font-medium text-[#0033AA]/75">Relation to client</span>
                        <input
                          type="text"
                          value={proxyRelation}
                          onChange={(e) => setProxyRelation(e.target.value)}
                         
                          className="w-full rounded-md border border-[#0033AA]/15 bg-white px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[#0062E1]"
                        />
                      </label>
                    </div>
                  )}
                </div>
              )}

              <label className="block">
                <span className="mb-1.5 block text-[12.5px] font-medium text-[#0033AA]/75">Notes (optional)</span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                 
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
                  className={`inline-flex items-center gap-2 rounded-md px-5 py-2 text-[13px] font-semibold text-white transition-colors disabled:opacity-60 ${copy.accent}`}
                >
                  {submitting && <Loader2 size={14} className="animate-spin" />}
                  {submitting ? "Saving…" : copy.cta}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
