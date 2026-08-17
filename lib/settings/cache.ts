import { createClient } from "@/lib/supabase/server";
import type { OverviewKpiSettings, Settings, SettingsRow, SmsSettings } from "@/lib/types";

const TTL_MS = 30 * 1000;

const DEFAULTS: Settings = {
  sms: {
    sms_enabled: false,
    sms_client_enabled: true,
    sms_admin_enabled: true,
    sms_deposit: true,
    sms_withdrawal: true,
    sms_payment: true,
    sms_admin_deposit: true,
    sms_admin_withdrawal: true,
    sms_admin_registration: true,
    company_tel: null,
  },
  card_fee_amount: 20,
  emergency_claim_penalty_basis: "daily_contribution_amount",
  sms_monthly_fee: 2,
  // Overview on request: Total Clients, Combined Account Total, Total
  // Revenue, Total Withdrawals, Transactional Withdrawals, Revenue
  // Withdrawals, Loans Disbursed, Loan Repayments, Repayment Remaining,
  // Loan Interest, Account Balance. Every other KPI stays fully computed
  // for other pages — only its Overview visibility is off, so it can be
  // turned back on here without touching any calculation. Net Revenue
  // (Total Revenue minus Deposits Taken From Revenue) was removed entirely
  // on request, along with Deposits Taken From Revenue itself — Total
  // Revenue is shown gross, full stop.
  overview_kpi: {
    total_clients:   { visible: true },
    total_savings:   { visible: false, calc: "dep" },
    total_susu:      { visible: false, calc: "dep" },
    combined_total:  { visible: true },
    total_revenue:   { visible: true, components: { interest: true, commission: true, susu_fees: true, card_fees: true, sms_fees: true, processing_fees: true } },
    account_balance: { visible: true },
    total_withdrawals: { visible: true },
    transactional_withdrawals: { visible: true },
    revenue_withdrawals: { visible: true },
    loans_disbursed: { visible: true },
    loan_repayments: { visible: true },
    repayment_remaining: { visible: true },
    card_fees:           { visible: false },
    withdrawal_commission: { visible: false },
    susu_fees:           { visible: false },
    sms_fees:            { visible: false },
    processing_fees:     { visible: false },
    loan_interest:       { visible: true },
    cash_at_hand:    { visible: false },
    cash_at_bank:    { visible: false },
  },
};

let cache: { value: Settings; fetchedAt: number } | null = null;

export async function getSettings(): Promise<Settings> {
  if (cache && Date.now() - cache.fetchedAt < TTL_MS) return cache.value;

  const supabase = await createClient();
  const { data: rows } = await supabase.from("settings").select("*").returns<SettingsRow[]>();
  const byKey = new Map((rows ?? []).map((row) => [row.key, row.value]));

  const value: Settings = {
    sms: { ...DEFAULTS.sms, ...(byKey.get("sms") as Partial<SmsSettings> | undefined) },
    card_fee_amount: (byKey.get("card_fee_amount") as number | undefined) ?? DEFAULTS.card_fee_amount,
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
