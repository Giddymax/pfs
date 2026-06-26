"use client";

import { useState } from "react";
import { Loader2, Zap } from "lucide-react";
import { Card } from "@/components/ui";

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function ChargeSmsFeeButton() {
  const [month, setMonth] = useState(currentMonth());
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; charged?: number; skipped?: number; fee?: number; error?: string } | null>(null);

  async function handleCharge() {
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
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-md border border-[#0033AA]/15 bg-[#FFFFFF]/40 px-3.5 py-2.5 text-[14px] text-[#0A2240] outline-none transition-colors focus:border-[#0062E1] focus:bg-white"
          />
        </label>
        <button
          type="button"
          onClick={handleCharge}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-md bg-[#0033AA] px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#002884] disabled:opacity-60"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
          {loading ? "Charging…" : "Charge SMS fees"}
        </button>
      </div>

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
