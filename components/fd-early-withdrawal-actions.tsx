"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Wallet, X } from "lucide-react";
import type { FdStatus } from "@/lib/types";

type Action = "request" | "approve" | "reject" | "payout";

const ENDPOINT: Record<Action, string> = {
  request: "request",
  approve: "approve",
  reject: "reject",
  payout: "payout",
};

export function FdEarlyWithdrawalActions({ fdId, status, isAdmin }: { fdId: string; status: FdStatus; isAdmin: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(action: Action) {
    setError(null);
    setLoading(action);
    try {
      const res = await fetch(`/api/fixed-deposits/${fdId}/early-withdrawal/${ENDPOINT[action]}`, { method: "POST" });
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

  if (status === "active") {
    buttons.push(
      <button
        key="request"
        onClick={() => act("request")}
        disabled={loading !== null}
        className="inline-flex items-center gap-1.5 rounded-md border border-[#B58A2A]/30 px-3 py-1.5 text-[12px] font-medium text-[#8A6A1F] transition-colors hover:bg-[#B58A2A]/[0.08] disabled:opacity-60"
      >
        {loading === "request" && <Loader2 size={12} className="animate-spin" />}
        Request early withdrawal
      </button>
    );
  }

  if (status === "pending_early" && isAdmin) {
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

  if (status === "approved_early") {
    buttons.push(
      <button
        key="payout"
        onClick={() => act("payout")}
        disabled={loading !== null}
        className="inline-flex items-center gap-1.5 rounded-md bg-[#0033AA] px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-[#002884] disabled:opacity-60"
      >
        {loading === "payout" ? <Loader2 size={12} className="animate-spin" /> : <Wallet size={12} />}
        Pay out (principal only)
      </button>
    );
  }

  if (buttons.length === 0) return null;

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap items-center justify-end gap-2">{buttons}</div>
      {error && <p className="max-w-[16rem] text-right text-[11px] text-[#963522]">{error}</p>}
      {status === "pending_early" && !isAdmin && (
        <p className="text-[11px] text-[#0A2240]/40">Awaiting admin review.</p>
      )}
    </div>
  );
}
