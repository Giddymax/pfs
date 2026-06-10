"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PlayCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { LoanStatusBadge } from "@/components/ui";
import type { LoanStatus } from "@/lib/types";

// Only the transitions an admin can manually force once a loan is active —
// pending -> active goes through the activate_loan RPC below (it sets the
// real disbursement/due dates and seeds current_balance), and
// active -> completed also happens automatically as repayments land.
const ACTIVE_TRANSITIONS: { value: LoanStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "defaulted", label: "Defaulted" },
];

export function LoanStatusControl({ loanId, status }: { loanId: string; status: LoanStatus }) {
  const router = useRouter();
  const [updating, setUpdating] = useState(false);
  const [value, setValue] = useState(status);
  const [error, setError] = useState<string | null>(null);

  async function handleActivate() {
    setUpdating(true);
    setError(null);
    try {
      const res = await fetch(`/api/loans/${loanId}/activate`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not activate this loan. Try again.");

      setValue("active");
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
          onClick={handleActivate}
          disabled={updating}
          className="inline-flex items-center gap-2 rounded-md bg-[#1F6E4A] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#195C3D] disabled:opacity-60"
        >
          {updating ? <Loader2 size={14} className="animate-spin" /> : <PlayCircle size={14} />}
          {updating ? "Activating…" : "Activate loan"}
        </button>
        {error && <span className="text-[11.5px] text-[#963522]">{error}</span>}
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
