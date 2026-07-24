-- Optional MVP helper for creating mechanic profiles.
-- Do not run as-is: replace UUIDs with existing auth.users.id values first.
-- The profiles.id column references auth.users(id), so these users must exist in Supabase Auth.

-- To inspect existing auth users in Supabase SQL Editor:
-- select id, email, created_at from auth.users order by created_at;

insert into public.profiles (id, full_name, role, is_active)
values
  ('00000000-0000-0000-0000-000000000001'::uuid, 'Иван', 'executor', true),
  ('00000000-0000-0000-0000-000000000002'::uuid, 'Максим', 'executor', true),
  ('00000000-0000-0000-0000-000000000003'::uuid, 'Олег', 'executor', true)
on conflict (id) do update
set
  full_name = excluded.full_name,
  role = excluded.role,
  is_active = excluded.is_active;
