export type Role = "admin" | "staff";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  is_active: boolean;
  created_at: string;
}

export type Gender = "male" | "female";
export type ClientStatus = "active" | "inactive";

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
  next_of_kin_name: string | null;
  next_of_kin_phone: string | null;
  photo_url: string | null;
  status: ClientStatus;
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
  balance: number;
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
