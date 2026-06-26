-- Allow admins to update and delete bank transactions
create policy "bank_update_admin" on bank_transactions
  for update using (is_admin()) with check (is_admin());

create policy "bank_delete_admin" on bank_transactions
  for delete using (is_admin());
