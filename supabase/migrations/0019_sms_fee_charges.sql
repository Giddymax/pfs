-- Track monthly SMS fee deductions to prevent double-charging
create table sms_fee_charges (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id) on delete restrict,
  account_id uuid not null references accounts (id) on delete restrict,
  month text not null,
  amount numeric(12, 2) not null,
  charged_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  unique (client_id, month)
);

create index sms_fee_charges_month_idx on sms_fee_charges (month);

alter table sms_fee_charges enable row level security;

create policy "sms_fee_charges_select" on sms_fee_charges
  for select using (is_staff_or_admin());

create policy "sms_fee_charges_insert" on sms_fee_charges
  for insert with check (is_admin());

-- Seed the default SMS monthly fee
insert into settings (key, value, updated_at)
values ('sms_monthly_fee', '2', now())
on conflict (key) do nothing;
