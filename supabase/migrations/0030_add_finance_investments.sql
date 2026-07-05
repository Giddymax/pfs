-- Company investment log. These entries track company funds placed into
-- investments and the revenue earned from those investments.

create table investments (
  id              uuid primary key default gen_random_uuid(),
  title           text not null check (length(trim(title)) > 0),
  investment_type text not null check (length(trim(investment_type)) > 0),
  amount_invested numeric(12, 2) not null check (amount_invested > 0),
  revenue_made    numeric(12, 2) not null default 0 check (revenue_made >= 0),
  date            date not null default current_date,
  notes           text,
  recorded_by     uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now()
);

alter table investments enable row level security;

create policy "Admins manage investments"
  on investments for all
  using  (is_admin())
  with check (is_admin());
