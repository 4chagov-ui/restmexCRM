-- RestMex CRM: immutable request audit log (request_history).
-- Safe to re-run. Soft-delete of requests does NOT remove history rows
-- (CASCADE only applies on hard DELETE of the request row).
--
-- Prerequisites (recommended):
--   SUPABASE_AUTH_ROLES_MIGRATION.sql
--   SUPABASE_EMPLOYEES_MIGRATION.sql
--   SUPABASE_REQUEST_ASSIGNEES.sql / SUPABASE_FIX_RLS_COLLABORATIVE_ASSIGNEES.sql
--   SUPABASE_RLS_MECHANIC_CABINET.sql (current_profile_role, is_request_participant)

-- Soft-delete column used in read policy (no-op if already applied).
alter table public.requests
  add column if not exists deleted_at timestamptz;

create table if not exists public.request_history (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  actor_id uuid null references public.profiles(id) on delete set null,
  action text not null,
  field_name text null,
  old_value jsonb null,
  new_value jsonb null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists request_history_request_id_created_at_idx
  on public.request_history (request_id, created_at desc);

create index if not exists request_history_actor_id_idx
  on public.request_history (actor_id);

create index if not exists request_history_action_idx
  on public.request_history (action);

alter table public.request_history enable row level security;

-- Immutable: no UPDATE / DELETE for app roles.
revoke update, delete on public.request_history from anon, authenticated;
revoke insert on public.request_history from anon, authenticated;
grant select on public.request_history to authenticated;

-- Helpers (no-op if already present from cabinet RLS).
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

create or replace function public.can_read_request_history(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.requests r
    where r.id = p_request_id
      and (
        public.current_profile_role() in ('admin', 'manager')
        or (
          public.current_profile_role() = 'mechanic'
          and r.deleted_at is null
          and (
            r.assigned_to = public.current_profile_employee_id()
            or public.is_request_participant(r.id)
          )
        )
      )
  );
$$;

create or replace function public.can_write_request_history(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.current_profile_role() in ('admin', 'manager')
    or (
      public.current_profile_role() = 'mechanic'
      and public.can_read_request_history(p_request_id)
    );
$$;

drop policy if exists "Read request history by role" on public.request_history;
create policy "Read request history by role"
on public.request_history for select
to authenticated
using (public.can_read_request_history(request_id));

-- No insert/update/delete policies for direct table access.
-- Writes go through SECURITY DEFINER RPC that forces actor_id = auth.uid().

create or replace function public.insert_request_history(
  p_request_id uuid,
  p_action text,
  p_field_name text default null,
  p_old_value jsonb default null,
  p_new_value jsonb default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_actor uuid := auth.uid();
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_action is null or length(trim(p_action)) = 0 then
    raise exception 'action is required';
  end if;

  if not public.can_write_request_history(p_request_id) then
    raise exception 'Not allowed to write history for this request';
  end if;

  insert into public.request_history (
    request_id,
    actor_id,
    action,
    field_name,
    old_value,
    new_value,
    metadata
  )
  values (
    p_request_id,
    v_actor,
    trim(p_action),
    nullif(trim(coalesce(p_field_name, '')), ''),
    p_old_value,
    p_new_value,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.insert_request_history(uuid, text, text, jsonb, jsonb, jsonb)
  from public;
grant execute on function public.insert_request_history(uuid, text, text, jsonb, jsonb, jsonb)
  to authenticated;

comment on table public.request_history is
  'Immutable audit trail for request changes. Writes only via insert_request_history().';
