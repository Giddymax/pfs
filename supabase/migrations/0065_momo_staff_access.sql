-- Opens MoMo up to all staff, not just admins (momo-mini-app-brief.md §3's
-- "admin-only for now" default is now lifted). Staff can view the MoMo
-- pages and record transactions; editing, reversing, and deleting an
-- existing transaction stays admin-only, mirroring the same split PFS
-- already uses everywhere else (staff can deposit, only admin can
-- edit/delete/reverse — see 0058_admin_only_withdrawals.sql for the
-- precedent this follows).

drop policy if exists "momo_transactions_admin_all" on momo_transactions;

create policy "momo_transactions_staff_read_write" on momo_transactions
  for select using (is_staff_or_admin());

create policy "momo_transactions_staff_insert" on momo_transactions
  for insert with check (is_staff_or_admin());

create policy "momo_transactions_admin_update" on momo_transactions
  for update using (is_admin()) with check (is_admin());

create policy "momo_transactions_admin_delete" on momo_transactions
  for delete using (is_admin());
