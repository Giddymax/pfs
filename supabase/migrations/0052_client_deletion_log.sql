-- Records every client deletion going forward, with a mandatory disclosure
-- of whether the client's balance/history was transferred elsewhere first
-- (e.g. merged into another client record, paid out in cash) before being
-- removed. Prompted by 65 clients being mass-deleted with no such record,
-- making it impossible afterward to tell which deletions were safe cleanup
-- vs which needed a closer look.
--
-- No foreign key on client_id — the client row is gone by the time this is
-- read back, so client_code/full_name/phone are snapshotted here instead.
--
-- delete_client_with_log is the single choke point for both single-client
-- and bulk deletion — it snapshots + logs + deletes in one transaction, so
-- a deletion can never happen without a matching log row (or a log row
-- without an actual deletion).

create table client_deletion_log (
  id                   uuid primary key default gen_random_uuid(),
  client_id            uuid not null,
  client_code          text not null,
  full_name            text not null,
  phone                text,
  history_transferred  boolean not null,
  transfer_note        text,
  deleted_by           uuid references profiles(id),
  deleted_at           timestamptz not null default now()
);

create index client_deletion_log_deleted_at_idx on client_deletion_log (deleted_at);

alter table client_deletion_log enable row level security;

create policy "client_deletion_log_select" on client_deletion_log
  for select using (is_admin());

-- No insert/update/delete policies for direct table access — every write
-- goes through delete_client_with_log (security definer), keeping this an
-- append-only trail even an admin can't edit after the fact via the client.

create or replace function delete_client_with_log(
  p_client_id           uuid,
  p_history_transferred boolean,
  p_transfer_note       text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client clients%rowtype;
begin
  if not is_admin() then
    raise exception 'Only an admin can delete a client';
  end if;

  if p_history_transferred and (p_transfer_note is null or trim(p_transfer_note) = '') then
    raise exception 'A transfer note is required when history was transferred elsewhere';
  end if;

  select * into v_client from clients where id = p_client_id for update;
  if not found then
    raise exception 'Client not found';
  end if;

  insert into client_deletion_log (
    client_id, client_code, full_name, phone,
    history_transferred, transfer_note, deleted_by
  )
  values (
    v_client.id, v_client.client_code, v_client.full_name, v_client.phone,
    p_history_transferred, nullif(trim(coalesce(p_transfer_note, '')), ''), auth.uid()
  );

  delete from clients where id = p_client_id;
end;
$$;
