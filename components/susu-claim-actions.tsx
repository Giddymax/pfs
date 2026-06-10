"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Wallet, X } from "lucide-react";
import type { SusuClaim } from "@/lib/types";

export function SusuClaimActions({ claim, isAdmin }: { claim: SusuClaim; isAdmin: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"approve" | "reject" | "pay" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "approve" | "reject" | "pay") {
    setError(null);
    setLoading(action);
    try {
      const res = await fetch(`/api/susu/claims/${claim.id}/${action}`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "That action could not be completed. Try again.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That action could not be completed. Try again.");
    } finally {
      setLoading(null);
    }
  }

  const buttons: React.ReactNode[] = [];

  if (isAdmin && claim.claim_type === "emergency" && claim.status === "pending_admin") {
    buttons.push(
      <button
        key="approve"
        onClick={() => act("approve")}
        disabled={loading !== null}
        className="inline-flex items-center gap-1.5 rounded-md bg-[#1F6E4A] px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-[#195C3D] disabled:opacity-60"
      >
        {loading === "approve" ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
        Approve
      </button>,
      <button
        key="reject"
        onClick={() => act("reject")}
        disabled={loading !== null}
        className="inline-flex items-center gap-1.5 rounded-md border border-[#B3432B]/25 px-3 py-1.5 text-[12px] font-medium text-[#963522] transition-colors hover:bg-[#B3432B]/[0.06] disabled:opacity-60"
      >
        {loading === "reject" ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
        Reject
      </button>
    );
  }

  if (claim.status === "approved") {
    buttons.push(
      <button
        key="pay"
        onClick={() => act("pay")}
        disabled={loading !== null}
        className="inline-flex items-center gap-1.5 rounded-md bg-[#0033AA] px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-[#002884] disabled:opacity-60"
      >
        {loading === "pay" ? <Loader2 size={12} className="animate-spin" /> : <Wallet size={12} />}
        Pay out
      </button>
    );
  }

  if (buttons.length === 0) return null;

  return (
    <div className="flex shrink-0 flex-col items-end gap-1.5">
      <div className="flex items-center gap-2">{buttons}</div>
      {error && <p className="max-w-[14rem] text-right text-[11px] text-[#963522]">{error}</p>}
    </div>
  );
}
