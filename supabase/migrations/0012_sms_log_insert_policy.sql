-- ========================================
-- SMS LOG — INSERT POLICY
-- The Arkesel integration (Phase F) logs every send attempt from within
-- authenticated route handlers (staff/admin sessions), the same way
-- card_fees is written today — so it gets the same insert grant rather
-- than a separate security-definer RPC for a simple append-only audit row.
-- ========================================
create policy "sms_log_insert" on sms_log
  for insert with check (is_staff_or_admin());
