-- Change client_code, loan_code, and account_number from 5-digit to 4-digit padding
-- e.g. PFS-00001 → PFS-0001, LN-00001 → LN-0001, SAV-00001 → SAV-0001

create or replace function generate_client_code()
returns trigger as $$
begin
  if new.client_code is null or new.client_code = '' then
    new.client_code := 'PFS-' || lpad(nextval('client_code_seq')::text, 4, '0');
  end if;
  return new;
end;
$$ language plpgsql;

create or replace function generate_loan_code()
returns trigger as $$
begin
  if new.loan_code is null or new.loan_code = '' then
    new.loan_code := 'LN-' || lpad(nextval('loan_code_seq')::text, 4, '0');
  end if;
  return new;
end;
$$ language plpgsql;

create or replace function generate_account_number()
returns trigger as $$
declare
  prefix text;
begin
  if new.account_number is null or new.account_number = '' then
    prefix := case new.product_type
      when 'savings' then 'SAV'
      when 'susu' then 'SUS'
      when 'fixed_deposit' then 'FXD'
    end;
    new.account_number := prefix || '-' || lpad(nextval('account_code_seq')::text, 4, '0');
  end if;
  return new;
end;
$$ language plpgsql;

create or replace function generate_fd_number()
returns trigger as $$
begin
  if new.fd_number is null or new.fd_number = '' then
    new.fd_number := 'FXD-' || lpad(nextval('fd_code_seq')::text, 4, '0');
  end if;
  return new;
end;
$$ language plpgsql;
