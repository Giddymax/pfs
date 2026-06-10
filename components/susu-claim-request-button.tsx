"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ReceiptText, X } from "lucide-react";
import { formatGHS } from "@/lib/loan";
import type { SusuCycle } from "@/lib/types";

export function SusuClaimRequestButton({
  accountId,
  normalCycle,
  emergencyCycle,
}: {
  accountId: string;
  normalCycle: SusuCycle | null;
  emergencyCycle: SusuCycle | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState<"normal" | "emergency" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!normalCycle && !emergencyCycle) return null;

  async function submit(claimType: "normal" | "emergency", cycleId: string) {
    setError(null);
    setSubmitting(claimType);
    try {
      const res = await fetch("/api/susu/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_id: accountId, cycle_id: cycleId, claim_type: claimType }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not submit this claim. Try again.");

      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit this claim. Try again.");
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md border border-[#0033AA]/20 px-4 py-2.5 text-[13px] font-medium text-[#0033AA] transition-colors hover:bg-[#0033AA]/5"
      >
        <ReceiptText size={15} />
        Request claim
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/50 px-4 animate-fade-in">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl max-h-[90dvh] overflow-y-auto">
            <div className="mb-5 flex items-start justify-between">
              <h3 className="text-[15px] font-semibold text-[#0033AA]">Request a susu claim</h3>
              <button onClick={() => setOpen(false)} className="text-[#0A2240]/35 hover:text-[#0A2240]">
                <X size={18} />
              </button>
            </div>

            {error && (
              <div className="mb-4 rounded-md border border-[#B3432B]/25 bg-[#B3432B]/[0.06] px-3.5 py-2.5 text-[12.5px] text-[#963522]">
                {error}
              </div>
            )}

            <div className="space-y-3">
              {normalCycle && (
                <div className="rounded-lg border border-[#1F6E4A]/20 bg-[#1F6E4A]/[0.04] p-4">
                  <p className="text-[13.5px] font-semibold text-[#1F6E4A]">Normal claim — cycle {normalCycle.cycle_number}</p>
                  <p className="mt-1 text-[12.5px] text-[#0A2240]/55">
                    Cycle complete. Payout ≈ {formatGHS(Math.max(normalCycle.total_collected - (normalCycle.company_fee ?? 0), 0))}{" "}
                    (collected minus the day-31 company fee). Auto-approved — no admin step required.
                  </p>
                  <button
                    onClick={() => submit("normal", normalCycle.id)}
                    disabled={submitting !== null}
                    className="mt-3 inline-flex items-center gap-2 rounded-md bg-[#1F6E4A] px-4 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-[#195C3D] disabled:opacity-60"
                  >
                    {submitting === "normal" && <Loader2 size={13} className="animate-spin" />}
                    Submit normal claim
                  </button>
                </div>
              )}

              {emergencyCycle && (
                <div className="rounded-lg border border-[#B3432B]/20 bg-[#B3432B]/[0.04] p-4">
                  <p className="text-[13.5px] font-semibold text-[#963522]">Emergency claim — cycle {emergencyCycle.cycle_number}</p>
                  <p className="mt-1 text-[12.5px] text-[#0A2240]/55">
                    Cycle still in progress. A penalty equal to one day&rsquo;s contribution is deducted, and an admin
                    must approve the payout before it can be paid.
                  </p>
                  <button
                    onClick={() => submit("emergency", emergencyCycle.id)}
                    disabled={submitting !== null}
                    className="mt-3 inline-flex items-center gap-2 rounded-md bg-[#B3432B] px-4 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-[#963522] disabled:opacity-60"
                  >
                    {submitting === "emergency" && <Loader2 size={13} className="animate-spin" />}
                    Submit emergency claim
                  </button>
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end">
              <button onClick={() => setOpen(false)} className="rounded-md px-4 py-2 text-[13px] font-medium text-[#0A2240]/55 hover:text-[#0A2240]">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
