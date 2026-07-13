-- Migration 0032 added a 5-param version of record_deposit / record_withdrawal
-- (adding p_created_at timestamptz default null) via CREATE OR REPLACE FUNCTION.
-- Because the new signature differs from the old one, Postgres created a NEW
-- overload instead of replacing the original, leaving the live database with two
-- functions that both match a 4-arg call:
--
--   record_deposit(uuid, numeric, uuid, text)          ← old 4-param (0005)
--   record_deposit(uuid, numeric, uuid, text, timestamptz) ← new 5-param (0032)
--
-- When record_susu_payment calls record_deposit with 4 arguments Postgres finds
-- both candidates (exact 4-param match + 5-param with the 5th defaulting to null)
-- and throws: "function record_deposit(uuid, numeric, uuid, text) is not unique"
--
-- Fix: drop the old 4-param overloads.  The 5-param versions from 0032 handle
-- all existing callers — any call without p_created_at simply gets null, which
-- the function body coalesces to now().

drop function if exists record_deposit(uuid, numeric, uuid, text);
drop function if exists record_withdrawal(uuid, numeric, uuid, text);
