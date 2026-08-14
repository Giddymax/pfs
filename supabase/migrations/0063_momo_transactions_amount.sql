-- momo_transactions was originally logging only `charge` (what PFS collects
-- for handling a transaction) — see momo-mini-app-brief.md §9's open
-- question on whether the underlying MoMo principal should be tracked too.
-- Now decided: yes. `amount` is the actual sum that moved through the
-- customer's MoMo wallet (e.g. the GHS 500 they cashed out); `charge`
-- remains what PFS billed them for facilitating it (e.g. GHS 5). The two
-- are recorded separately, never conflated into one figure.
--
-- default 0 exists only to satisfy NOT NULL on any pre-existing rows from
-- phase 1 (this feature shipped very recently, so there should be few if
-- any) — every new row from the form going forward always supplies a real
-- amount.

alter table momo_transactions
  add column amount numeric(12,2) not null default 0 check (amount >= 0);

alter table momo_transactions alter column amount drop default;
