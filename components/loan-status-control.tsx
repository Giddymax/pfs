"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PlayCircle, X, Landmark } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { LoanStatusBadge } from "@/components/ui";
import { formatGHS } from "@/lib/loan";
import type { Account, LoanStatus } from "@/lib/types";

// Only the transitions an admin can manually force once a loan is active —
// pending -> active goes through the activate_loan RPC below (it sets the
// real disbursement/due dates and seeds current_balance), and
// active -> completed also happens automatically as repayments land.
const ACTIVE_TRANSITIONS: { value: LoanStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "defaulted", label: "Defaulted" },
];

export function LoanStatusControl({
  loanId,
  status,
  accounts,
}: {
  loanId: string;
  status: LoanStatus;
  accounts: Pick<Account, "id" | "account_number" | "product_type" | "balance">[];
}) {
  const router = useRouter();
  const [updating, setUpdating] = useState(false);
  const [value, setValue] = useState(status);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");

  async function handleActivate() {
    if (!accountId) {
      setError("Choose which account the monthly repayment will be deducted from.");
      return;
    }
    setUpdating(true);
    setError(null);
    try {
      const res = await fetch(`/api/loans/${loanId}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repayment_account_id: accountId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not activate this loan. Try again.");

      setValue("active");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not activate this loan. Try again.");
    } finally {
      setUpdating(false);
    }
  }

  async function handleChange(next: LoanStatus) {
    setValue(next);
    setUpdating(true);
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase.from("loans").update({ status: next }).eq("id", loanId);
    if (updateError) setError(updateError.message);
    setUpdating(false);
    router.refresh();
  }

  if (status === "pending") {
    return (
      <div className="flex flex-col items-end gap-1.5">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-md bg-[#1F6E4A] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#195C3D]"
        >
          <PlayCircle size={14} />
          Activate loan
        </button>
        {error && !open && <span className="text-[11.5px] text-[#963522]">{error}</span>}

        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/50 px-4">
            <div className="w-full max-w-sm rounded-xl bg-white p-6 text-left shadow-xl">
              <div className="mb-5 flex items-start justify-between">
                <div>
                  <h3 className="text-[15px] font-semibold text-[#1F6E4A]">Activate loan</h3>
                  <p className="mt-0.5 text-[12.5px] text-[#0A2240]/45">Disburses the loan and seeds the repayment balance.</p>
                </div>
                <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-[#0A2240]/35 hover:text-[#0A2240]">
                  <X size={18} />
                </button>
              </div>

              {error && (
                <div className="mb-4 rounded-md border border-[#B3432B]/25 bg-[#B3432B]/[0.06] px-3.5 py-2.5 text-[12.5px] text-[#963522]">
                  {error}
                </div>
              )}

              {accounts.length === 0 ? (
                <p className="text-[13px] text-[#0A2240]/60">
                  This client has no active savings or susu account — one is required to enroll the loan in monthly auto-deduction before it can be activated.
                </p>
              ) : (
                <>
                  <label className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-medium text-[#1F6E4A]/85">
                    <Landmark size={13} /> Deduct monthly repayment from
                  </label>
                  <select
                    aria-label="Repayment account"
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    disabled={updating}
                    className="w-full rounded-md border border-[#0033AA]/15 bg-white px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[#1F6E4A] disabled:opacity-60"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.account_number} ({a.product_type}) · {formatGHS(a.balance)}
                      </option>
                    ))}
                  </select>

                  <div className="mt-5 flex justify-end gap-2.5">
                    <button type="button" onClick={() => setOpen(false)} className="rounded-md px-4 py-2 text-[13px] font-medium text-[#0A2240]/55 hover:text-[#0A2240]">
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleActivate}
                      disabled={updating}
                      className="inline-flex items-center gap-2 rounded-md bg-[#1F6E4A] px-5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#195C3D] disabled:opacity-60"
                    >
                      {updating && <Loader2 size={14} className="animate-spin" />}
                      {updating ? "Activating…" : "Activate"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (status !== "active") {
    return <LoanStatusBadge status={status} />;
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2">
        <select
          aria-label="Loan status"
          value={value}
          onChange={(e) => handleChange(e.target.value as LoanStatus)}
          disabled={updating}
          className="rounded-md border border-[#0033AA]/20 bg-white px-3 py-2 text-[13px] font-medium text-[#0033AA] outline-none transition-colors focus:border-[#0062E1] disabled:opacity-60"
        >
          {ACTIVE_TRANSITIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {updating && <Loader2 size={15} className="animate-spin text-[#0033AA]/40" />}
      </div>
      {error && <span className="text-[11.5px] text-[#963522]">{error}</span>}
    </div>
  );
}
