-- Town/locality is tracked separately from the free-text residential address so
-- client lists can be filtered and reported on by area (e.g. branch routing).
alter table clients add column town text;

create index clients_town_idx on clients (town);
