import { createClient } from "@/lib/supabase/server";
import type { CommissionTier, OverviewKpiSettings, Settings, SettingsRow, SmsSettings } from "@/lib/types";

const TTL_MS = 5 * 60 * 1000;

const DEFAULTS: Settings = {
  commission_tiers: [
    { min: 50, max: 200, fee: 5 },
    { min: 300, max: 500, fee: 10 },
    { min: 600, max: 1000, fee: 15 },
    { min: 1000, max: 1500, fee: 20 },
    { min: 2000, max: null, fee: 40 },
  ],
  sms: {
    sms_enabled: false,
    sms_client_enabled: true,
    sms_admin_enabled: true,
    sms_deposit: true,
    sms_withdrawal: true,
    sms_payment: true,
    company_tel: null,
  },
  card_fee_amount: 20,
  fd_terms_months: [3, 6, 9, 12, 18, 24],
  emergency_claim_penalty_basis: "daily_contribution_amount",
  sms_monthly_fee: 2,
  overview_kpi: {
    total_clients:   { visible: true },
    total_savings:   { visible: true, calc: "dep" },
    total_susu:      { visible: true, calc: "dep" },
    total_fd:        { visible: true },
    combined_total:  { visible: true },
    total_revenue:   { visible: true, components: { interest: true, commission: true, susu_fees: true, card_fees: true, sms_charges: true, processing_fees: true } },
    account_balance: { visible: true },
    cash_at_hand:    { visible: true },
    cash_at_bank:    { visible: true },
  },
};

let cache: { value: Settings; fetchedAt: number } | null = null;

export async function getSettings(): Promise<Settings> {
  if (cache && Date.now() - cache.fetchedAt < TTL_MS) return cache.value;

  const supabase = await createClient();
  const { data: rows } = await supabase.from("settings").select("*").returns<SettingsRow[]>();
  const byKey = new Map((rows ?? []).map((row) => [row.key, row.value]));

  const value: Settings = {
    commission_tiers: (byKey.get("commission_tiers") as CommissionTier[] | undefined) ?? DEFAULTS.commission_tiers,
    sms: (byKey.get("sms") as SmsSettings | undefined) ?? DEFAULTS.sms,
    card_fee_amount: (byKey.get("card_fee_amount") as number | undefined) ?? DEFAULTS.card_fee_amount,
    fd_terms_months: (byKey.get("fd_terms_months") as number[] | undefined) ?? DEFAULTS.fd_terms_months,
    emergency_claim_penalty_basis: "daily_contribution_amount",
    sms_monthly_fee: (byKey.get("sms_monthly_fee") as number | undefined) ?? DEFAULTS.sms_monthly_fee,
    overview_kpi: (byKey.get("overview_kpi") as OverviewKpiSettings | undefined) ?? DEFAULTS.overview_kpi,
  };

  cache = { value, fetchedAt: Date.now() };
  return value;
}

export function invalidateSettingsCache() {
  cache = null;
}
