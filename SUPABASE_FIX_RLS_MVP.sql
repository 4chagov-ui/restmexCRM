-- Temporary MVP fix for creating requests before authentication is added.
-- Run this once in Supabase SQL Editor if the app shows error code 42501.

drop policy if exists "MVP anon can read profiles" on public.profiles;
create policy "MVP anon can read profiles"
on public.profiles for select
to anon
using (true);

drop policy if exists "MVP anon can read locations" on public.locations;
create policy "MVP anon can read locations"
on public.locations for select
to anon
using (true);

drop policy if exists "MVP anon can create locations" on public.locations;
create policy "MVP anon can create locations"
on public.locations for insert
to anon
with check (true);

drop policy if exists "MVP anon can update locations" on public.locations;
create policy "MVP anon can update locations"
on public.locations for update
to anon
using (true)
with check (true);

drop policy if exists "MVP anon can read requests" on public.requests;
create policy "MVP anon can read requests"
on public.requests for select
to anon
using (true);

drop policy if exists "MVP anon can create requests" on public.requests;
create policy "MVP anon can create requests"
on public.requests for insert
to anon
with check (true);

drop policy if exists "MVP anon can update requests" on public.requests;
create policy "MVP anon can update requests"
on public.requests for update
to anon
using (true)
with check (true);

grant usage on schema public to anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant select, insert, update on public.locations to anon, authenticated;
grant select on public.location_tags to anon, authenticated;
grant select, insert, update on public.requests to anon, authenticated;
grant select, insert on public.request_comments to anon, authenticated;
grant select, insert on public.request_events to anon, authenticated;
grant select, insert on public.attachments to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
