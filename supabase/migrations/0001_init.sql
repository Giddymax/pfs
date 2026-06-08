-- Prime Financial Service — initial schema
-- Run this in Supabase SQL Editor (or via `supabase db push`) after creating the project.

create extension if not exists "pgcrypto";

-- ========================================
-- STAFF / ADMIN PROFILES
-- One row per login-capable user (linked to Supabase Auth).
-- role: 'admin' -> full access incl. edit & delete
--       'staff' -> can register clients, issue loans, record repayments; cannot edit/delete
-- ========================================
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null unique,
  role text not null check (role in ('admin', 'staff')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ========================================
-- CLIENTS
-- ========================================
create table clients (
  id uuid primary key default gen_random_uuid(),
  client_code text not null unique,                 -- e.g. PFS-00001, generated on registration
  full_name text not null,
  date_of_birth date,
  gender text check (gender in ('male', 'female')),
  phone text not null,
  alt_phone text,
  ghana_card_number text,
  occupation text,
  residential_address text,
  next_of_kin_name text,
  next_of_kin_phone text,
  photo_url text,                                    -- Supabase Storage public URL
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index clients_full_name_idx on clients using gin (to_tsvector('english', full_name));
create index clients_phone_idx on clients (phone);

-- ========================================
-- LOANS  (simple flat-rate term loan)
-- total_repayable = principal + (principal * flat_rate_percent / 100)
-- monthly_installment = total_repayable / tenor_months
-- ========================================
create table loans (
  id uuid primary key default gen_random_uuid(),
  loan_code text not null unique,                    -- e.g. LN-00001
  client_id uuid not null references clients (id) on delete restrict,
  principal numeric(12, 2) not null check (principal > 0),
  flat_rate_percent numeric(5, 2) not null check (flat_rate_percent >= 0),
  tenor_months integer not null check (tenor_months > 0),
  total_interest numeric(12, 2) not null,
  total_repayable numeric(12, 2) not null,
  monthly_installment numeric(12, 2) not null,
  purpose text,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'completed', 'defaulted', 'rejected')),
  disbursement_date date,
  due_date date,                                     -- disbursement_date + tenor_months
  issued_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index loans_client_id_idx on loans (client_id);
create index loans_status_idx on loans (status);

-- ========================================
-- LOAN REPAYMENTS
-- ========================================
create table loan_repayments (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references loans (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  payment_date date not null default current_date,
  method text not null default 'cash' check (method in ('cash', 'mobile_money', 'bank_transfer')),
  notes text,
  recorded_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

create index loan_repayments_loan_id_idx on loan_repayments (loan_id);

-- ========================================
-- Auto-maintain updated_at
-- ========================================
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger clients_set_updated_at before update on clients
  for each row execute function set_updated_at();

create trigger loans_set_updated_at before update on loans
  for each row execute function set_updated_at();

-- ========================================
-- Sequence-style code generators (PFS-00001, LN-00001)
-- ========================================
create sequence client_code_seq start 1;
create sequence loan_code_seq start 1;

create or replace function generate_client_code()
returns trigger as $$
begin
  if new.client_code is null or new.client_code = '' then
    new.client_code := 'PFS-' || lpad(nextval('client_code_seq')::text, 5, '0');
  end if;
  return new;
end;
$$ language plpgsql;

create or replace function generate_loan_code()
returns trigger as $$
begin
  if new.loan_code is null or new.loan_code = '' then
    new.loan_code := 'LN-' || lpad(nextval('loan_code_seq')::text, 5, '0');
  end if;
  return new;
end;
$$ language plpgsql;

create trigger clients_generate_code before insert on clients
  for each row execute function generate_client_code();

create trigger loans_generate_code before insert on loans
  for each row execute function generate_loan_code();

-- ========================================
-- ROW LEVEL SECURITY
-- Any authenticated staff/admin can read & create.
-- Only admins can update or delete clients / loans.
-- Repayments are append-only (no update/delete by anyone via the API).
-- ========================================
alter table profiles enable row level security;
alter table clients enable row level security;
alter table loans enable row level security;
alter table loan_repayments enable row level security;

create or replace function is_admin()
returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin' and is_active
  );
$$ language sql stable security definer;

create or replace function is_staff_or_admin()
returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and is_active
  );
$$ language sql stable security definer;

-- profiles: a user can read their own profile; admins can read all
create policy "profiles_select_own_or_admin" on profiles
  for select using (id = auth.uid() or is_admin());

create policy "profiles_admin_write" on profiles
  for all using (is_admin()) with check (is_admin());

-- clients
create policy "clients_select" on clients
  for select using (is_staff_or_admin());

create policy "clients_insert" on clients
  for insert with check (is_staff_or_admin());

create policy "clients_update_admin_only" on clients
  for update using (is_admin()) with check (is_admin());

create policy "clients_delete_admin_only" on clients
  for delete using (is_admin());

-- loans
create policy "loans_select" on loans
  for select using (is_staff_or_admin());

create policy "loans_insert" on loans
  for insert with check (is_staff_or_admin());

create policy "loans_update_admin_only" on loans
  for update using (is_admin()) with check (is_admin());

create policy "loans_delete_admin_only" on loans
  for delete using (is_admin());

-- loan repayments — staff & admin can record (insert) and view; only admin can delete (e.g. correct an error)
create policy "repayments_select" on loan_repayments
  for select using (is_staff_or_admin());

create policy "repayments_insert" on loan_repayments
  for insert with check (is_staff_or_admin());

create policy "repayments_delete_admin_only" on loan_repayments
  for delete using (is_admin());

-- ========================================
-- STORAGE: client photo bucket
-- Create a public bucket named 'client-photos' (Storage > New bucket > Public)
-- then apply these policies in Storage > client-photos > Policies (or via SQL below).
-- ========================================
insert into storage.buckets (id, name, public)
values ('client-photos', 'client-photos', true)
on conflict (id) do nothing;

create policy "client_photos_read_public" on storage.objects
  for select using (bucket_id = 'client-photos');

create policy "client_photos_upload_staff" on storage.objects
  for insert with check (bucket_id = 'client-photos' and is_staff_or_admin());

create policy "client_photos_update_admin" on storage.objects
  for update using (bucket_id = 'client-photos' and is_admin());

create policy "client_photos_delete_admin" on storage.objects
  for delete using (bucket_id = 'client-photos' and is_admin());
