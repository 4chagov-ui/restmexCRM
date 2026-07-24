-- Fix: mechanic must see collaborative requests via request_assignees,
-- not only requests.assigned_to (responsible).
--
-- Safe to re-run. Prerequisites:
--   SUPABASE_EMPLOYEES_MIGRATION.sql
--   SUPABASE_AUTH_ROLES_MIGRATION.sql
--   SUPABASE_REQUEST_ASSIGNEES.sql (table + is_request_participant)

create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role::text
  from public.profiles
  where id = auth.uid()
    and is_active = true
$$;

create or replace function public.current_profile_employee_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select employee_id
  from public.profiles
  where id = auth.uid()
    and is_active = true
$$;

create or replace function public.is_request_participant(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.request_assignees
    where request_id = p_request_id
      and employee_id = public.current_profile_employee_id()
  );
$$;

-- Assignees: teammate list visible to any assigned mechanic on that request.
alter table public.request_assignees enable row level security;

drop policy if exists "Role read request_assignees" on public.request_assignees;
create policy "Role read request_assignees"
  on public.request_assignees
  for select
  to authenticated
  using (
    public.current_profile_role() in ('admin', 'manager')
    or (
      public.current_profile_role() = 'mechanic'
      and public.is_request_participant(request_id)
    )
  );

drop policy if exists "Role insert request_assignees" on public.request_assignees;
create policy "Role insert request_assignees"
  on public.request_assignees
  for insert
  to authenticated
  with check (public.current_profile_role() in ('admin', 'manager'));

drop policy if exists "Role delete request_assignees" on public.request_assignees;
create policy "Role delete request_assignees"
  on public.request_assignees
  for delete
  to authenticated
  using (public.current_profile_role() in ('admin', 'manager'));

drop policy if exists "Role update request_assignees" on public.request_assignees;
create policy "Role update request_assignees"
  on public.request_assignees
  for update
  to authenticated
  using (
    public.current_profile_role() in ('admin', 'manager')
    or (
      public.current_profile_role() = 'mechanic'
      and employee_id = public.current_profile_employee_id()
    )
  )
  with check (
    public.current_profile_role() in ('admin', 'manager')
    or (
      public.current_profile_role() = 'mechanic'
      and employee_id = public.current_profile_employee_id()
    )
  );

-- Requests: responsible OR any assignee (participant).
drop policy if exists "Role read requests" on public.requests;
create policy "Role read requests"
  on public.requests
  for select
  to authenticated
  using (
    public.current_profile_role() in ('admin', 'manager')
    or (
      public.current_profile_role() = 'mechanic'
      and (
        assigned_to = public.current_profile_employee_id()
        or public.is_request_participant(id)
      )
    )
  );

drop policy if exists "Role update requests" on public.requests;
create policy "Role update requests"
  on public.requests
  for update
  to authenticated
  using (
    public.current_profile_role() in ('admin', 'manager')
    or (
      public.current_profile_role() = 'mechanic'
      and (
        assigned_to = public.current_profile_employee_id()
        or public.is_request_participant(id)
      )
    )
  )
  with check (
    public.current_profile_role() in ('admin', 'manager')
    or (
      public.current_profile_role() = 'mechanic'
      and (
        assigned_to = public.current_profile_employee_id()
        or public.is_request_participant(id)
      )
    )
  );
