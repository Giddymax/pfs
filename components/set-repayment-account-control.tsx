"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Landmark } from "lucide-react";
import { formatGHS } from "@/lib/loan";
import type { Account } from "@/lib/types";

// Shown on an already-active loan that predates the monthly auto-deduction
// feature (0073_loan_repayment_automation.sql) — lets an admin attach a
// repayment account after the fact. See set_loan_repayment_account().
export function SetRepaymentAccountControl({
  loanId,
  accounts,
}: {
  loanId: string;
  accounts: Pick<Account, "id" | "account_number" | "product_type" | "balance">[];
}) {
  const router = useRouter();
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!accountId) {
      setError("Choose an account first.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/loans/${loanId}/repayment-account`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_id: accountId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not set the repayment account. Try again.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not set the repayment account. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (accounts.length === 0) {
    return (
      <div className="rounded-md border border-[#B58A2A]/25 bg-[#B58A2A]/[0.07] px-3.5 py-3 text-[12.5px] text-[#8A6A1F]">
        This loan isn&apos;t enrolled in monthly auto-deduction — the client has no active savings or susu account to deduct from.
      </div>
    );
  }

  return (
    <div className="rounded-md border border-[#0033AA]/12 bg-[#0033AA]/[0.025] px-3.5 py-3">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#0033AA]/70">
        <Landmark size={13} /> Set up auto-deduction
      </p>
      <p className="mb-2.5 text-[12px] text-[#0A2240]/55">This loan isn&apos;t enrolled yet — pick the account monthly installments will be deducted from.</p>
      {error && <p className="mb-2 text-[11.5px] text-[#963522]">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Repayment account"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          disabled={submitting}
          className="min-w-0 flex-1 rounded-md border border-[#0033AA]/20 bg-white px-3 py-2 text-[12.5px] font-medium text-[#0033AA] outline-none transition-colors focus:border-[#0062E1] disabled:opacity-60"
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.account_number} ({a.product_type}) · {formatGHS(a.balance)}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="inline-flex items-center gap-1.5 rounded-md bg-[#0033AA] px-3.5 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-[#002884] disabled:opacity-60"
        >
          {submitting && <Loader2 size={13} className="animate-spin" />}
          {submitting ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
