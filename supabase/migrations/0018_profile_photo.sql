-- Add photo_url to staff/admin profiles
alter table profiles add column if not exists photo_url text;

-- Storage bucket for profile photos
insert into storage.buckets (id, name, public)
values ('profile-photos', 'profile-photos', true)
on conflict (id) do nothing;

create policy "profile_photos_read_public" on storage.objects
  for select using (bucket_id = 'profile-photos');

create policy "profile_photos_upload_staff" on storage.objects
  for insert with check (bucket_id = 'profile-photos' and is_staff_or_admin());

create policy "profile_photos_update_staff" on storage.objects
  for update using (bucket_id = 'profile-photos' and is_staff_or_admin());

create policy "profile_photos_delete_staff" on storage.objects
  for delete using (bucket_id = 'profile-photos' and is_staff_or_admin());
