-- Per-account page restrictions for admins. Roles are otherwise all-or-
-- nothing (admin sees every ADMIN_NAV page, staff sees none of them) — this
-- adds a narrow, explicit exception mechanism: an admin account can have
-- specific admin-only pages hidden/blocked for them individually, without
-- being demoted to staff (which would also strip withdrawal rights, MoMo
-- edit/delete rights, etc. — a full demotion, not what was asked for).
--
-- Valid keys (enforced at the application layer, not a DB check constraint,
-- so adding a new restrictable page later doesn't need a migration):
--   'overview'          -> app/(dashboard)/page.tsx
--   'settings'          -> app/(dashboard)/settings/page.tsx
--   'staff_performance' -> app/(dashboard)/staff/performance/page.tsx
--   'momo_performance'  -> app/(dashboard)/momo/performance/page.tsx
--
-- Staff accounts never have entries here in practice (they can't reach
-- these pages regardless, via the existing role check), but the column
-- isn't role-gated at the DB level — simpler than two separate columns.

alter table profiles add column restricted_pages text[] not null default '{}';

-- Applies the specific request this migration was written for: Vera Botwe
-- (manager@pfs.com) keeps Administrator otherwise, but Overview, Settings,
-- and both Performance pages (PFS's and MoMo's — "Performance" wasn't
-- disambiguated, so both are restricted; adjust via the Edit staff modal
-- if only one was meant) are hidden/blocked for her account specifically.
update profiles
set restricted_pages = array['overview', 'settings', 'staff_performance', 'momo_performance']
where email = 'manager@pfs.com';
