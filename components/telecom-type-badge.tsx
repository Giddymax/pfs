import clsx from "clsx";
import { telecomTypeConfig } from "@/lib/telecom/types";

// Gives each of Telecom's six transaction types its own accent color, so the
// log scans at a glance without reading the text — see
// telecom-mini-app-brief.md §4. Config lives in lib/telecom/types.ts, shared with
// the record form's dropdown and the Transactions page filter.
export function TelecomTypeBadge({ type }: { type: string }) {
  const config = telecomTypeConfig(type);
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide",
        config?.badge ?? "border-[#0A2240]/15 bg-[#0A2240]/8 text-[#0A2240]/50"
      )}
    >
      {config?.label ?? type}
    </span>
  );
}
