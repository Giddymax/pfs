-- sms_log.related_client_id was omitted from 0020_cascade_client_delete.sql.
-- Use SET NULL (not CASCADE) so SMS history is preserved after a client is deleted.
alter table sms_log drop constraint sms_log_related_client_id_fkey;
alter table sms_log add constraint sms_log_related_client_id_fkey
  foreign key (related_client_id) references clients (id) on delete set null;
