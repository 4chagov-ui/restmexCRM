-- RestMex CRM: remove temporary MVP anon open policies before production.
-- Run manually in Supabase SQL Editor AFTER cabinet RLS is confirmed working
-- (SUPABASE_RLS_MECHANIC_CABINET.sql + assignees + soft-delete policies).
--
-- WARNING: After this, anonymous clients can no longer read/write requests/locations.
-- Authenticated manager/mechanic access must rely on role RLS policies.

drop policy if exists "MVP anon can read profiles" on public.profiles;
drop policy if exists "MVP anon can read locations" on public.locations;
drop policy if exists "MVP anon can create locations" on public.locations;
drop policy if exists "MVP anon can update locations" on public.locations;
drop policy if exists "MVP anon can read requests" on public.requests;
drop policy if exists "MVP anon can create requests" on public.requests;
drop policy if exists "MVP anon can update requests" on public.requests;

-- If create request fails with 42501 after this, add an authenticated INSERT
-- policy for admin/manager (cabinet SQL historically only covers SELECT/UPDATE).
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'requests'
      and policyname = 'Role insert requests'
  ) then
    execute $policy$
      create policy "Role insert requests"
      on public.requests for insert
      to authenticated
      with check (
        public.current_profile_role() in ('admin', 'manager')
      )
    $policy$;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'locations'
      and policyname = 'Role insert locations'
  ) then
    execute $policy$
      create policy "Role insert locations"
      on public.locations for insert
      to authenticated
      with check (
        public.current_profile_role() in ('admin', 'manager')
      )
    $policy$;
  end if;
end;
$$;
