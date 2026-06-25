export type Role = "admin" | "staff";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  is_active: boolean;
  photo_url: string | null;
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

export type ProductType = "savings" | "susu" | "fixed_deposit";
export type AccountStatus = "active" | "dormant" | "closed" | "matured";
export type MaturityInstruction =
  | "payout_full"
  | "rollover_principal"
  | "rollover_principal_and_interest";

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
  // fixed deposit
  principal_amount: number | null;
  tenor_days: number | null;
  maturity_date: string | null;
  maturity_instruction: MaturityInstruction | null;
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

export interface CommissionTier {
  min: number;
  max: number | null;
  fee: number;
}

export interface SmsSettings {
  sms_enabled: boolean;
  sms_client_enabled: boolean;
  sms_admin_enabled: boolean;
  sms_deposit: boolean;
  sms_withdrawal: boolean;
  sms_payment: boolean;
  company_tel: string | null;
}

export interface KpiCardConfig {
  visible: boolean;
}

export interface KpiCardCalcConfig extends KpiCardConfig {
  calc: "balance" | "dep";
}

export interface RevenueComponents {
  interest: boolean;
  commission: boolean;
  susu_fees: boolean;
  card_fees: boolean;
  sms_charges: boolean;
  processing_fees: boolean;
}

export interface KpiRevenueConfig extends KpiCardConfig {
  components: RevenueComponents;
}

export interface OverviewKpiSettings {
  total_clients: KpiCardConfig;
  total_savings: KpiCardCalcConfig;
  total_susu: KpiCardCalcConfig;
  total_fd: KpiCardConfig;
  combined_total: KpiCardConfig;
  total_revenue: KpiRevenueConfig;
  account_balance: KpiCardConfig;
  cash_at_hand: KpiCardConfig;
  cash_at_bank: KpiCardConfig;
}

export interface Settings {
  commission_tiers: CommissionTier[];
  sms: SmsSettings;
  card_fee_amount: number;
  fd_terms_months: number[];
  emergency_claim_penalty_basis: "daily_contribution_amount";
  overview_kpi: OverviewKpiSettings;
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

export type FdTermMonths = 3 | 6 | 9 | 12 | 18 | 24;
export type FdStatus = "active" | "matured" | "pending_early" | "approved_early" | "withdrawn" | "rolled_over";

export interface FixedDeposit {
  id: string;
  fd_number: string;
  client_id: string;
  principal: number;
  annual_rate_percent: number;
  term_months: number;
  start_date: string;
  maturity_date: string;
  expected_interest: number;
  expected_payout: number;
  status: FdStatus;
  rolled_into_fd_id: string | null;
  rolled_from_fd_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type FdEventType =
  | "early_withdrawal_requested"
  | "early_withdrawal_approved"
  | "early_withdrawal_rejected"
  | "matured_paid_out"
  | "rollover_requested"
  | "rollover_completed";

export interface FdEvent {
  id: string;
  fd_id: string;
  event_type: FdEventType;
  amount: number | null;
  actor_id: string | null;
  notes: string | null;
  created_at: string;
}
