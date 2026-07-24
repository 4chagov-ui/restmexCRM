-- Soft delete / trash for requests.
-- Prerequisites: SUPABASE_AUTH_ROLES_MIGRATION.sql, SUPABASE_RLS_MECHANIC_CABINET.sql
-- Safe to re-run.

-- Run this whole file in Supabase SQL Editor (safe to re-run).
alter table public.requests
  add column if not exists deleted_at timestamptz;

alter table public.requests
  add column if not exists deleted_by uuid references public.profiles(id) on delete set null;

alter table public.requests
  add column if not exists deletion_reason text;

create index if not exists requests_deleted_at_idx
  on public.requests(deleted_at)
  where deleted_at is not null;

create index if not exists requests_active_idx
  on public.requests(created_at desc)
  where deleted_at is null;

-- Mechanic must not see trashed rows (even if still assigned).
drop policy if exists "Role read requests" on public.requests;
create policy "Role read requests"
  on public.requests
  for select
  to authenticated
  using (
    public.current_profile_role() in ('admin', 'manager')
    or (
      public.current_profile_role() = 'mechanic'
      and deleted_at is null
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
      and deleted_at is null
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
      and deleted_at is null
      and (
        assigned_to = public.current_profile_employee_id()
        or public.is_request_participant(id)
      )
    )
  );
