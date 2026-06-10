"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, X } from "lucide-react";

const TERM_OPTIONS = [3, 6, 9, 12, 18, 24];

export function FdRolloverForm({
  fdId,
  currentTermMonths,
  currentRate,
}: {
  fdId: string;
  currentTermMonths: number;
  currentRate: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [termMonths, setTermMonths] = useState(currentTermMonths);
  const [rate, setRate] = useState(String(currentRate));
  const [capitalise, setCapitalise] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/fixed-deposits/${fdId}/rollover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          new_term_months: termMonths,
          annual_rate_percent: Number(rate),
          capitalise_interest: capitalise,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not roll over this deposit. Try again.");

      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not roll over this deposit. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md border border-[#0033AA]/20 px-4 py-2.5 text-[13px] font-medium text-[#0033AA] transition-colors hover:bg-[#0033AA]/5"
      >
        <RefreshCw size={14} />
        Roll over
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#061B3A]/50 px-4 animate-fade-in">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl max-h-[90dvh] overflow-y-auto">
            <div className="mb-5 flex items-start justify-between">
              <h3 className="text-[15px] font-semibold text-[#0033AA]">Roll over this deposit</h3>
              <button onClick={() => setOpen(false)} className="text-[#0A2240]/35 hover:text-[#0A2240]">
                <X size={18} />
              </button>
            </div>

            {error && (
              <div className="mb-4 rounded-md border border-[#B3432B]/25 bg-[#B3432B]/[0.06] px-3.5 py-2.5 text-[12.5px] text-[#963522]">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-[12.5px] font-medium text-[#0A2240]/70">New term</span>
                <select
                  value={termMonths}
                  onChange={(e) => setTermMonths(Number(e.target.value))}
                  className="w-full rounded-md border border-[#0033AA]/15 px-3 py-2 text-[13.5px] text-[#0A2240] outline-none focus:border-[#0033AA]/40"
                >
                  {TERM_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      {m} months
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[12.5px] font-medium text-[#0A2240]/70">Annual rate (%)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  required
                  className="w-full rounded-md border border-[#0033AA]/15 px-3 py-2 text-[13.5px] text-[#0A2240] outline-none focus:border-[#0033AA]/40"
                />
              </label>

              <label className="flex items-start gap-2.5 rounded-lg border border-[#0033AA]/8 bg-[#0033AA]/[0.025] px-3.5 py-3">
                <input
                  type="checkbox"
                  checked={capitalise}
                  onChange={(e) => setCapitalise(e.target.checked)}
                  className="mt-0.5"
                />
                <span className="text-[12.5px] leading-relaxed text-[#0A2240]/65">
                  Capitalise interest — add the matured interest to the new principal. If unchecked, the interest is
                  paid out in cash now and only the original principal rolls into the new deposit.
                </span>
              </label>

              <div className="flex justify-end gap-2.5 pt-1">
                <button type="button" onClick={() => setOpen(false)} className="rounded-md px-4 py-2 text-[13px] font-medium text-[#0A2240]/55 hover:text-[#0A2240]">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-md bg-[#0033AA] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#002884] disabled:opacity-60"
                >
                  {loading && <Loader2 size={14} className="animate-spin" />}
                  {loading ? "Rolling over…" : "Confirm rollover"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
