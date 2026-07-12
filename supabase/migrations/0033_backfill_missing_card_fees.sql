-- ========================================
-- SELF-CONTAINED: creates card_fees table, RLS, and backfills all clients
-- that don't already have a card fee entry at GHS 20.
-- ========================================

-- 1. card_fees table
create table if not exists card_fees (
  id         uuid          primary key default gen_random_uuid(),
  client_id  uuid          not null references clients (id) on delete cascade,
  amount     numeric(12,2) not null default 20 check (amount >= 0),
  charged_by uuid          references profiles (id),
  created_at timestamptz   not null default now()
);

create index if not exists card_fees_client_id_idx on card_fees (client_id);

-- 2. RLS
alter table card_fees enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'card_fees' and policyname = 'card_fees_select'
  ) then
    create policy "card_fees_select" on card_fees
      for select using (
        exists (select 1 from profiles where id = auth.uid())
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where tablename = 'card_fees' and policyname = 'card_fees_insert'
  ) then
    create policy "card_fees_insert" on card_fees
      for insert with check (
        exists (select 1 from profiles where id = auth.uid())
      );
  end if;
end $$;

-- 3. Backfill at GHS 20 for every client with no card fee entry
insert into card_fees (client_id, amount)
select c.id, 20
from clients c
where not exists (
  select 1 from card_fees cf where cf.client_id = c.id
);
