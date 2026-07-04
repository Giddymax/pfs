"use client";

import { useState } from "react";
import { Loader2, Zap } from "lucide-react";
import { Card } from "@/components/ui";

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function isAllowedToCharge(selectedMonth: string): { allowed: boolean; reason?: string } {
  const now = new Date();
  const thisMonth = currentMonth();

  if (selectedMonth > thisMonth) {
    return { allowed: false, reason: "Cannot charge fees for a future month." };
  }
  if (selectedMonth < thisMonth) {
    return { allowed: true };
  }
  // Current month — only allowed from the 25th onwards
  const today = now.getDate();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const cutoff = lastDay - 6; // last 7 days
  if (today < cutoff) {
    return { allowed: false, reason: `SMS fees for the current month can only be charged from the ${cutoff}th onwards (last 7 days of the month).` };
  }
  return { allowed: true };
}

export function ChargeSmsFeeButton() {
  const [month, setMonth] = useState(currentMonth());
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; charged?: number; skipped?: number; fee?: number; error?: string } | null>(null);

  const chargeCheck = isAllowedToCharge(month);

  async function handleCharge() {
    if (!chargeCheck.allowed) return;
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/sms-deductions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month }),
      });
      const json = await res.json();
      if (!res.ok) {
        setResult({ ok: false, error: json.error ?? "Failed" });
      } else {
        setResult({ ok: true, charged: json.charged, skipped: json.skipped, fee: json.fee });
      }
    } catch {
      setResult({ ok: false, error: "Network error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <div className="border-b border-[#0033AA]/8 px-5 py-4">
        <h2 className="text-[15px] font-semibold text-[#0033AA]">Monthly SMS fee deduction</h2>
        <p className="mt-1 text-[12.5px] text-[#0A2240]/50">
          Deduct the configured monthly SMS fee from all clients who have opted in. Each month can only be charged once.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-4 px-5 py-5">
        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-medium text-[#0033AA]/75">Month</span>
          <input
            type="month"
            value={month}
            onChange={(e) => { setMonth(e.target.value); setResult(null); }}
            className="rounded-md border border-[#0033AA]/15 bg-[#FFFFFF]/40 px-3.5 py-2.5 text-[14px] text-[#0A2240] outline-none transition-colors focus:border-[#0062E1] focus:bg-white"
          />
        </label>
        <button
          type="button"
          onClick={handleCharge}
          disabled={loading || !chargeCheck.allowed}
          className="inline-flex items-center gap-2 rounded-md bg-[#0033AA] px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#002884] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
          {loading ? "Charging…" : "Charge SMS fees"}
        </button>
      </div>

      {!chargeCheck.allowed && (
        <div className="mx-5 mb-5 rounded-md border border-[#B58A2A]/25 bg-[#B58A2A]/[0.07] px-4 py-3 text-[13px] text-[#8A6A1F]">
          {chargeCheck.reason}
        </div>
      )}

      {result && (
        <div className={`mx-5 mb-5 rounded-md border px-4 py-3 text-[13px] ${
          result.ok
            ? "border-[#1F6E4A]/25 bg-[#1F6E4A]/[0.06] text-[#1F6E4A]"
            : "border-[#B3432B]/25 bg-[#B3432B]/[0.06] text-[#963522]"
        }`}>
          {result.ok
            ? `Done. ${result.charged} client${result.charged === 1 ? "" : "s"} charged GHS ${result.fee?.toFixed(2)} each. ${result.skipped} skipped (insufficient balance).`
            : result.error}
        </div>
      )}
    </Card>
  );
}
