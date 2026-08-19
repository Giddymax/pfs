"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PlayCircle, X, CheckCircle2 } from "lucide-react";
import { formatGHS } from "@/lib/loan";

interface ProcessedRepayment {
  loan_id: string;
  loan_code: string;
  client_full_name: string;
  account_number: string;
  due_amount: number;
  collected: number;
  new_arrears: number;
  new_status: string;
}

export function ProcessDueRepaymentsButton({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ProcessedRepayment[] | null>(null);

  async function handleProcess() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/loans/repayments/process", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not process repayments. Try again.");
      setResults(json.processed ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not process repayments. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    setResults(null);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={handleProcess}
        disabled={disabled || submitting}
        className="inline-flex items-center gap-2 rounded-md bg-[#1F6E4A] px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#195C3D] disabled:opacity-50"
      >
        {submitting ? <Loader2 size={14} className="animate-spin" /> : <PlayCircle size={14} />}
        {submitting ? "Processing…" : "Process due repayments"}
      </button>
      {error && <p className="mt-2 text-[12px] text-[#963522]">{error}</p>}

      {results && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/50 px-4">
          <div className="w-full max-w-lg max-h-[85dvh] overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-start justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={20} className="text-[#1F6E4A]" />
                <h3 className="text-[15px] font-semibold text-[#0A2240]">
                  {results.length === 0 ? "Nothing to process" : `${results.length} repayment${results.length === 1 ? "" : "s"} processed`}
                </h3>
              </div>
              <button type="button" onClick={handleClose} aria-label="Close" className="text-[#0A2240]/35 hover:text-[#0A2240]">
                <X size={18} />
              </button>
            </div>

            {results.length === 0 ? (
              <p className="text-[13px] text-[#0A2240]/55">Nothing was due, or an account behind a due loan is no longer active.</p>
            ) : (
              <ul className="divide-y divide-[#0033AA]/6">
                {results.map((r) => (
                  <li key={r.loan_id} className="py-3 text-[13px]">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-[#0A2240]">{r.client_full_name}</span>
                      <span className="text-[11.5px] text-[#0A2240]/45">{r.loan_code} · {r.account_number}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-[12px] text-[#0A2240]/60">
                      <span>Due {formatGHS(r.due_amount)}</span>
                      <span className="text-[#1F6E4A]">Collected {formatGHS(r.collected)}</span>
                      {r.new_arrears > 0 && <span className="text-[#B3432B]">Carried forward {formatGHS(r.new_arrears)}</span>}
                      {r.new_status === "completed" && <span className="font-medium text-[#0033AA]">Loan completed 🎉</span>}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-md bg-[#0033AA] px-5 py-2 text-[13px] font-semibold text-white hover:bg-[#002884]"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
