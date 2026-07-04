-- Computes COLLECTED loan interest (interest actually received through repayments)
-- rather than EXPECTED interest from the loan schedule.
-- Formula per repayment: amount × (loan.total_interest / loan.total_repayable)
create or replace function compute_collected_loan_interest()
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(
    case
      when l.total_repayable > 0
      then lr.amount * l.total_interest / l.total_repayable
      else 0
    end
  ), 0)
  from loan_repayments lr
  join loans l on l.id = lr.loan_id;
$$;
