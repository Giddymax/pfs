export type Role = "admin" | "staff";

// Per-account exceptions carving specific admin-only pages out for an
// otherwise-full admin — see 0066_profile_page_restrictions.sql for why
// this exists instead of just demoting the account to staff.
export type RestrictablePage = "overview" | "settings" | "staff_performance" | "momo_performance";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  is_active: boolean;
  photo_url: string | null;
  restricted_pages: RestrictablePage[];
  created_at: string;
}

export type Gender = "male" | "female";
export type ClientStatus = "active" | "inactive" | "dormant" | "suspended";

export interface Client {
  id: string;
  client_code: string;
  full_name: string;
  date_of_birth: string | null;
  gender: Gender | null;
  phone: string;
  alt_phone: string | null;
  ghana_card_number: string | null;
  occupation: string | null;
  residential_address: string | null;
  town: string | null;
  next_of_kin_name: string | null;
  next_of_kin_phone: string | null;
  photo_url: string | null;
  status: ClientStatus;
  sms_opt_in: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type LoanStatus = "pending" | "active" | "completed" | "defaulted" | "rejected";

export interface Loan {
  id: string;
  loan_code: string;
  client_id: string;
  principal: number;
  flat_rate_percent: number;
  tenor_months: number;
  total_interest: number;
  total_repayable: number;
  monthly_installment: number;
  processing_fee: number;
  current_balance: number;
  purpose: string | null;
  status: LoanStatus;
  disbursement_date: string | null;
  due_date: string | null;
  issued_by: string | null;
  created_at: string;
  updated_at: string;
  // joined
  client?: Client;
}

export type ProductType = "savings" | "susu";
export type AccountStatus = "active" | "dormant" | "closed";

export interface Account {
  id: string;
  account_number: string;
  client_id: string;
  product_type: ProductType;
  status: AccountStatus;
  branch: string | null;
  agent_id: string | null;
  opening_date: string;
  balance: number; // current balance — plays the role of the spec's `bal`
  dep: number; // lifetime deposits
  wdr: number; // lifetime withdrawals
  comm: number; // lifetime commission paid
  // savings
  minimum_opening_deposit: number | null;
  minimum_operating_balance: number | null;
  interest_rate_annual: number | null;
  // daily susu
  daily_contribution_amount: number | null;
  cycle_length_days: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // joined
  client?: Client;
}

export type RepaymentMethod = "cash" | "mobile_money" | "bank_transfer";

export interface LoanRepayment {
  id: string;
  loan_id: string;
  amount: number;
  payment_date: string;
  method: RepaymentMethod;
  notes: string | null;
  recorded_by: string | null;
  created_at: string;
}

export type TransactionType = "deposit" | "withdrawal" | "fee" | "reversal";

export interface Transaction {
  id: string;
  account_id: string;
  client_id: string;
  type: TransactionType;
  amount: number;
  fee: number;
  bal_after: number;
  notes: string | null;
  recorded_by: string | null;
  original_amount: number | null;
  edited_by: string | null;
  edited_at: string | null;
  reversed_by: string | null;
  reversed_at: string | null;
  time_edited_by: string | null;
  time_edited_at: string | null;
  created_at: string;
  // joined
  account?: Account;
  client?: Client;
}

export interface CardFee {
  id: string;
  client_id: string;
  amount: number;
  charged_by: string | null;
  created_at: string;
}

export interface SmsSettings {
  sms_enabled: boolean;
  sms_client_enabled: boolean;
  sms_admin_enabled: boolean;
  sms_deposit: boolean;
  sms_withdrawal: boolean;
  sms_payment: boolean;
  sms_admin_deposit: boolean;
  sms_admin_withdrawal: boolean;
  sms_admin_registration: boolean;
  company_tel: string | null;
}

export interface KpiCardConfig {
  visible: boolean;
}

export interface KpiCardCalcConfig extends KpiCardConfig {
  calc: "balance" | "dep";
}

// Company Income (P&L revenue) — generic accounting default: every fee
// charged for a service rendered is Fee Income, recognized gross, on the
// same cash basis. Card Fees and SMS Fees were briefly carved out as
// non-income "Other Receipts" per an earlier owner instruction, then
// reverted back to this default.
export interface RevenueComponents {
  interest: boolean;        // loan interest
  commission: boolean;      // savings withdrawal commission
  susu_fees: boolean;       // susu fee (day-31 + early-withdrawal/emergency penalties)
  card_fees: boolean;       // registration card fees
  sms_fees: boolean;        // monthly SMS charges
  processing_fees: boolean; // loan processing fees
}

export interface KpiRevenueConfig extends KpiCardConfig {
  components: RevenueComponents;
}

export interface OverviewKpiSettings {
  total_clients: KpiCardConfig;
  total_savings: KpiCardCalcConfig;
  total_susu: KpiCardCalcConfig;
  combined_total: KpiCardConfig;
  total_revenue: KpiRevenueConfig;
  net_revenue: KpiCardConfig;
  account_balance: KpiCardConfig;
  total_withdrawals: KpiCardConfig;
  loans_disbursed: KpiCardConfig;
  loan_repayments: KpiCardConfig;
  card_fees: KpiCardConfig;
  withdrawal_commission: KpiCardConfig;
  susu_fees: KpiCardConfig;
  sms_fees: KpiCardConfig;
  processing_fees: KpiCardConfig;
  loan_interest: KpiCardConfig;
  cash_at_hand: KpiCardConfig;
  cash_at_bank: KpiCardConfig;
}

export interface Settings {
  sms: SmsSettings;
  card_fee_amount: number;
  emergency_claim_penalty_basis: "daily_contribution_amount";
  overview_kpi: OverviewKpiSettings;
  sms_monthly_fee: number;
}

export type SettingsKey = keyof Settings;

export interface SettingsRow {
  key: string;
  value: unknown;
  updated_by: string | null;
  updated_at: string;
}

export type SmsRecipientType = "client" | "admin";
export type SmsStatus = "sent" | "failed";

export interface SmsLogEntry {
  id: string;
  recipient_phone: string;
  recipient_type: SmsRecipientType;
  event: string;
  message: string;
  status: SmsStatus;
  cost: number | null;
  related_client_id: string | null;
  created_at: string;
}

export type SusuCycleStatus = "in_progress" | "complete" | "closed";

export interface SusuCycle {
  id: string;
  account_id: string;
  cycle_number: number;
  started_on: string;
  completed_on: string | null;
  status: SusuCycleStatus;
  total_collected: number;
  company_fee: number | null;
  created_at: string;
}

export interface SusuPayment {
  id: string;
  cycle_id: string;
  account_id: string;
  transaction_id: string | null;
  amount: number;
  day_in_cycle: number;
  payment_date: string;
  recorded_by: string | null;
  created_at: string;
}

export type SusuClaimType = "normal" | "emergency";
export type SusuClaimStatus = "pending_admin" | "approved" | "paid" | "rejected";

export interface SusuClaim {
  id: string;
  account_id: string;
  cycle_id: string | null;
  transaction_id: string | null;
  claim_type: SusuClaimType;
  status: SusuClaimStatus;
  amount: number;
  penalty_amount: number;
  requested_by: string | null;
  approved_by: string | null;
  paid_by: string | null;
  requested_at: string;
  decided_at: string | null;
  paid_at: string | null;
}

// MoMo mini-app (see momo-mini-app-brief.md) — a flat, independent
// transaction log, not related to Client/Account/Transaction above. No
// wallet, no balance, no foreign key to clients — see the brief's §7 for why.
export interface MomoTransaction {
  id: string;
  phone_number: string;
  type: "cash_in" | "cash_out" | "deposit" | "airtime" | "data_bundle" | "mashup";
  amount: number; // the principal that moved through the customer's MoMo wallet
  charge: number; // what PFS billed for facilitating it — see 0063_momo_transactions_amount.sql
  note: string | null;
  recorded_by: string | null; // nullable since 0064_staff_delete_set_null.sql — set null if the staff member's account was later deleted
  reversed_at: string | null;
  created_at: string;
  // joined
  recorder?: { full_name: string } | null;
}

