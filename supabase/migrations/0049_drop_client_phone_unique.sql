-- Remove the unique constraint on clients.phone (added in 0004). A client
-- can legitimately share a phone number across different accounts/clients
-- (e.g. a household member registering on a relative's line, or a proxy
-- contact) — this was blocking valid registrations, not just duplicates.

alter table clients drop constraint if exists clients_phone_unique;
