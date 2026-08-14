import clsx from "clsx";

// MoMo's own stat card — deliberately not a reuse of components/ui.tsx's
// StatCard, whose value/icon colors are hard-coded to PFS's navy/green
// palette with no way to retint. This one carries MoMo's yellow identity
// instead (see momo-mini-app-brief.md §4), while matching StatCard's layout
// (label, icon, value, optional hint) so the two read as siblings, not
// strangers.
export function MomoStatCard({
  label,
  value,
  hint,
  icon,
  emphasis = false,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div
      className={clsx(
        "min-w-0 rounded-xl border px-5 py-4 shadow-sm",
        emphasis ? "border-[#E0A800]/40 bg-[#FFC72C]/[0.10]" : "border-[#1A1A1A]/10 bg-white"
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-[#1A1A1A]/45">{label}</p>
        {icon && <span className="shrink-0 text-[#B45309]">{icon}</span>}
      </div>
      <p className="break-words text-[1.25rem] font-semibold tracking-tight text-[#1A1A1A] sm:text-[1.6rem]">{value}</p>
      {hint && <p className="mt-1 text-[12px] text-[#1A1A1A]/45">{hint}</p>}
    </div>
  );
}
