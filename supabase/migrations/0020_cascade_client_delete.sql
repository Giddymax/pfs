-- Allow deleting clients by cascading through all related data

-- loans → loan_repayments already cascades (on delete cascade in 0001)
-- We need to change: accounts, transactions, loans, fixed_deposits,
-- susu_cycles, susu_payments, susu_claims, card_fees, sms_fee_charges,
-- sms_log (related_client_id) from restrict → cascade

-- ── accounts.client_id ──
alter table accounts drop constraint accounts_client_id_fkey;
alter table accounts add constraint accounts_client_id_fkey
  foreign key (client_id) references clients (id) on delete cascade;

-- ── transactions.client_id ──
alter table transactions drop constraint transactions_client_id_fkey;
alter table transactions add constraint transactions_client_id_fkey
  foreign key (client_id) references clients (id) on delete cascade;

-- ── transactions.account_id ──
alter table transactions drop constraint transactions_account_id_fkey;
alter table transactions add constraint transactions_account_id_fkey
  foreign key (account_id) references accounts (id) on delete cascade;

-- ── loans.client_id ──
alter table loans drop constraint loans_client_id_fkey;
alter table loans add constraint loans_client_id_fkey
  foreign key (client_id) references clients (id) on delete cascade;

-- ── fixed_deposits.client_id ──
alter table fixed_deposits drop constraint fixed_deposits_client_id_fkey;
alter table fixed_deposits add constraint fixed_deposits_client_id_fkey
  foreign key (client_id) references clients (id) on delete cascade;

-- ── susu_cycles.account_id ──
alter table susu_cycles drop constraint susu_cycles_account_id_fkey;
alter table susu_cycles add constraint susu_cycles_account_id_fkey
  foreign key (account_id) references accounts (id) on delete cascade;

-- ── susu_payments.account_id ──
alter table susu_payments drop constraint susu_payments_account_id_fkey;
alter table susu_payments add constraint susu_payments_account_id_fkey
  foreign key (account_id) references accounts (id) on delete cascade;

-- ── susu_claims.account_id ──
alter table susu_claims drop constraint susu_claims_account_id_fkey;
alter table susu_claims add constraint susu_claims_account_id_fkey
  foreign key (account_id) references accounts (id) on delete cascade;

-- ── card_fees.client_id ──
alter table card_fees drop constraint card_fees_client_id_fkey;
alter table card_fees add constraint card_fees_client_id_fkey
  foreign key (client_id) references clients (id) on delete cascade;

-- ── sms_fee_charges.client_id ──
alter table sms_fee_charges drop constraint sms_fee_charges_client_id_fkey;
alter table sms_fee_charges add constraint sms_fee_charges_client_id_fkey
  foreign key (client_id) references clients (id) on delete cascade;

-- ── sms_fee_charges.account_id ──
alter table sms_fee_charges drop constraint sms_fee_charges_account_id_fkey;
alter table sms_fee_charges add constraint sms_fee_charges_account_id_fkey
  foreign key (account_id) references accounts (id) on delete cascade;
