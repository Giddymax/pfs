import clsx from "clsx";

// Telecom's own stat card — deliberately not a reuse of components/ui.tsx's
// StatCard, whose value/icon colors are hard-coded to PFS's navy/green
// palette with no way to retint. This one carries Telecom's own identity
// instead (see telecom-mini-app-brief.md §4), while matching StatCard's layout
// (label, icon, value) so the two read as siblings, not strangers.
//
// `tone` gives every card the same light-tint-plus-matching-border
// treatment the original yellow "emphasis" card used, just varied — green,
// blue, or yellow — instead of leaving most cards plain white with only one
// card colored.
export type TelecomStatTone = "neutral" | "yellow" | "green" | "blue";

const TONES: Record<TelecomStatTone, { border: string; bg: string; icon: string; value: string }> = {
  neutral: { border: "border-[#1A1A1A]/10", bg: "bg-white", icon: "text-[#1A1A1A]/50", value: "text-[#1A1A1A]" },
  yellow:  { border: "border-[#E0A800]/40", bg: "bg-[#FFC72C]/[0.10]", icon: "text-[#B45309]", value: "text-[#8A5A00]" },
  green:   { border: "border-[#16A34A]/35", bg: "bg-[#16A34A]/[0.08]", icon: "text-[#15803D]", value: "text-[#15803D]" },
  blue:    { border: "border-[#1D4ED8]/30", bg: "bg-[#1D4ED8]/[0.07]", icon: "text-[#1D4ED8]", value: "text-[#1D4ED8]" },
};

export function TelecomStatCard({
  label,
  value,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  tone?: TelecomStatTone;
}) {
  const t = TONES[tone];
  return (
    <div className={clsx("min-w-0 rounded-xl border px-5 py-4 shadow-sm", t.border, t.bg)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-[#1A1A1A]/45">{label}</p>
        {icon && <span className={clsx("shrink-0", t.icon)}>{icon}</span>}
      </div>
      <p className={clsx("break-words text-[1.25rem] font-semibold tracking-tight sm:text-[1.6rem]", t.value)}>{value}</p>
    </div>
  );
}
