// Shared config for Telecom's six transaction types — one source of truth used
// by the record form's dropdown, the Transactions page filter, and the type
// badge, so the list and its colors can never drift between those three
// places. See telecom-mini-app-brief.md §5 for the underlying enum and §4 for
// why each type gets its own accent color.

export type TelecomTransactionType =
  | "cash_in"
  | "cash_out"
  | "deposit"
  | "airtime"
  | "data_bundle"
  | "mashup";

export interface TelecomTypeConfig {
  value: TelecomTransactionType;
  label: string;
  badge: string; // badge background/text/border classes
  dot: string;   // solid-color dot used in the dropdown and filter menu
}

export const TELECOM_TYPES: TelecomTypeConfig[] = [
  { value: "cash_in",     label: "Cash In",     badge: "bg-[#1F6E4A]/10 text-[#1F6E4A] border-[#1F6E4A]/25", dot: "bg-[#1F6E4A]" },
  { value: "cash_out",    label: "Cash Out",     badge: "bg-[#B3432B]/10 text-[#963522] border-[#B3432B]/25", dot: "bg-[#B3432B]" },
  { value: "deposit",     label: "Deposit",      badge: "bg-[#0284C7]/10 text-[#0284C7] border-[#0284C7]/25", dot: "bg-[#0284C7]" },
  { value: "airtime",     label: "Airtime",      badge: "bg-[#D97706]/10 text-[#B45309] border-[#D97706]/25", dot: "bg-[#D97706]" },
  { value: "data_bundle", label: "Data Bundle",  badge: "bg-[#7C3AED]/10 text-[#7C3AED] border-[#7C3AED]/25", dot: "bg-[#7C3AED]" },
  { value: "mashup",      label: "Mashup",       badge: "bg-[#DB2777]/10 text-[#DB2777] border-[#DB2777]/25", dot: "bg-[#DB2777]" },
];

const TELECOM_TYPE_MAP = new Map(TELECOM_TYPES.map((t) => [t.value, t]));

export function telecomTypeLabel(type: string): string {
  return TELECOM_TYPE_MAP.get(type as TelecomTransactionType)?.label ?? type;
}

export function telecomTypeConfig(type: string): TelecomTypeConfig | undefined {
  return TELECOM_TYPE_MAP.get(type as TelecomTransactionType);
}
