"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Wallet } from "lucide-react";
import { formatGHS } from "@/lib/loan";

export function FdMaturityPayoutButton({ fdId, expectedPayout }: { fdId: string; expectedPayout: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePayout() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/fixed-deposits/${fdId}/maturity-payout`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not process this payout. Try again.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not process this payout. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        onClick={handlePayout}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-md bg-[#0033AA] px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#002884] disabled:opacity-60"
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Wallet size={14} />}
        Pay out {formatGHS(expectedPayout)} (principal + interest)
      </button>
      {error && <p className="max-w-[16rem] text-right text-[11px] text-[#963522]">{error}</p>}
    </div>
  );
}
