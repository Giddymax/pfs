"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

type Preset = "today" | "yesterday" | "this_week" | "this_month" | "last_month" | "custom";

function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

function presetDates(preset: Preset): { from: string; to: string } {
  const now  = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  const today = new Date(y, m, d);

  switch (preset) {
    case "today":
      return { from: toISO(today), to: toISO(today) };
    case "yesterday": {
      const yest = new Date(y, m, d - 1);
      return { from: toISO(yest), to: toISO(yest) };
    }
    case "this_week": {
      const mon = new Date(y, m, d - ((now.getDay() + 6) % 7));
      return { from: toISO(mon), to: toISO(today) };
    }
    case "this_month":
      return { from: toISO(new Date(y, m, 1)), to: toISO(today) };
    case "last_month": {
      const first = new Date(y, m - 1, 1);
      const last  = new Date(y, m, 0);
      return { from: toISO(first), to: toISO(last) };
    }
    default:
      return { from: toISO(new Date(y, m, 1)), to: toISO(today) };
  }
}

const PRESETS: { value: Preset; label: string }[] = [
  { value: "today",      label: "Today" },
  { value: "yesterday",  label: "Yesterday" },
  { value: "this_week",  label: "This week" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
];

export function SummaryControls({
  from,
  to,
  preset: initialPreset,
}: {
  from: string;
  to: string;
  preset: string;
}) {
  const router = useRouter();

  // Derive initial custom-mode from the preset prop — no useSearchParams needed.
  const isCustom = initialPreset === "custom";
  const [activePreset, setActivePreset] = useState<Preset>(
    isCustom ? "custom" : (initialPreset as Preset) || "this_month"
  );
  const [showCustom, setShowCustom] = useState(isCustom);
  const [customFrom, setCustomFrom] = useState(from);
  const [customTo,   setCustomTo]   = useState(to);

  function navigate(preset: Preset, f: string, t: string) {
    const params = new URLSearchParams({ preset, from: f, to: t });
    router.push(`?${params}`);
  }

  function selectPreset(p: Preset) {
    if (p === "custom") {
      setActivePreset("custom");
      setShowCustom(true);
      return;
    }
    const dates = presetDates(p);
    setActivePreset(p);
    setShowCustom(false);
    navigate(p, dates.from, dates.to);
  }

  function applyCustom() {
    if (customFrom && customTo && customFrom <= customTo) {
      navigate("custom", customFrom, customTo);
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      {/* Preset pills */}
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => selectPreset(p.value)}
            className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition-colors ${
              activePreset === p.value
                ? "bg-[#0033AA] text-white"
                : "border border-[#0033AA]/15 text-[#0A2240]/55 hover:border-[#0033AA]/30 hover:text-[#0A2240]"
            }`}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => selectPreset("custom")}
          className={`inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition-colors ${
            activePreset === "custom"
              ? "bg-[#0033AA] text-white"
              : "border border-[#0033AA]/15 text-[#0A2240]/55 hover:border-[#0033AA]/30 hover:text-[#0A2240]"
          }`}
        >
          Custom <ChevronDown size={12} />
        </button>
      </div>

      {/* Custom date inputs */}
      {showCustom && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            title="Start date"
            value={customFrom}
            max={customTo}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="rounded-md border border-[#0033AA]/15 px-3 py-1.5 text-[13px] outline-none focus:border-[#0033AA]"
          />
          <span className="text-[12px] text-[#0A2240]/40">to</span>
          <input
            type="date"
            title="End date"
            value={customTo}
            min={customFrom}
            onChange={(e) => setCustomTo(e.target.value)}
            className="rounded-md border border-[#0033AA]/15 px-3 py-1.5 text-[13px] outline-none focus:border-[#0033AA]"
          />
          <button
            type="button"
            onClick={applyCustom}
            className="rounded-md bg-[#0033AA] px-4 py-1.5 text-[12.5px] font-semibold text-white hover:bg-[#002884]"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
