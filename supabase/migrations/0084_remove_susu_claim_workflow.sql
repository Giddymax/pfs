-- Removes the entire "request a claim" workflow. Susu withdrawals no longer
-- have a separate qualified/emergency/claim distinction — they go through
-- record_withdrawal() exactly like a savings withdrawal, which already
-- (0082_susu_commission_always_daily.sql) charges susu commission as
-- exactly one day's contribution unconditionally. The end-of-cycle day-31
-- fee is untouched — it's a completely separate mechanism
-- (sweep_susu_cycle_fee, 0078_susu_fee_as_commission.sql) that fires
-- automatically on cycle completion and has nothing to do with any of
-- these functions.
--
-- susu_claims itself is NOT dropped — it's left in place, read-only from
-- here on, as the historical record of every claim ever requested/paid
-- before this change. Nothing will ever insert into it again.

drop function if exists request_normal_claim(uuid, uuid, uuid);
drop function if exists request_emergency_claim(uuid, uuid, uuid);
drop function if exists approve_emergency_claim(uuid, uuid);
drop function if exists reject_emergency_claim(uuid, uuid);
drop function if exists pay_susu_claim(uuid, uuid);

-- record_susu_partial_withdrawal is superseded too — it was already just a
-- product_type check plus a balance check in front of record_withdrawal(),
-- both of which record_withdrawal() already does itself.
drop function if exists record_susu_partial_withdrawal(uuid, numeric, uuid);
