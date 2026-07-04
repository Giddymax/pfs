-- Company expenditure log — admin-only entries that represent real costs
-- paid out of company funds. Revenue minus total expenditures = net balance.

create table expenditures (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (length(trim(title)) > 0),
  amount      numeric(12, 2) not null check (amount > 0),
  category    text not null default 'general',
  date        date not null default current_date,
  notes       text,
  recorded_by uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

alter table expenditures enable row level security;

create policy "Admins manage expenditures"
  on expenditures for all
  using  (is_admin())
  with check (is_admin());
