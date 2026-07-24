-- RestMex CRM: collaborative request assignees
-- Prerequisites:
--   SUPABASE_EMPLOYEES_MIGRATION.sql
--   SUPABASE_AUTH_ROLES_MIGRATION.sql
--   SUPABASE_RLS_MECHANIC_CABINET.sql (helpers)
--
-- Note: assignee identity is employees.id (same as requests.assigned_to),
-- NOT profiles.id. Auth still maps via profiles.employee_id.

-- Optional: track when work actually started on the request.
alter table public.requests
  add column if not exists started_at timestamptz;

create table if not exists public.request_assignees (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null
    references public.requests(id)
    on delete cascade,
  employee_id uuid not null
    references public.employees(id)
    on delete cascade,
  role text not null default 'participant'
    check (role in ('responsible', 'participant')),
  participation_status text not null default 'assigned'
    check (
      participation_status in (
        'assigned',
        'in_progress',
        'completed'
      )
    ),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (request_id, employee_id)
);

create index if not exists request_assignees_request_id_idx
  on public.request_assignees(request_id);

create index if not exists request_assignees_employee_id_idx
  on public.request_assignees(employee_id);

create unique index if not exists request_assignees_one_responsible_idx
  on public.request_assignees(request_id)
  where role = 'responsible';

-- Backfill: current assigned_to becomes responsible.
insert into public.request_assignees (
  request_id,
  employee_id,
  role,
  participation_status
)
select
  r.id,
  r.assigned_to,
  'responsible',
  case
    when r.status = 'done' then 'completed'
    when r.status = 'in_progress' then 'in_progress'
    else 'assigned'
  end
from public.requests r
where r.assigned_to is not null
on conflict (request_id, employee_id) do nothing;

-- Keep assigned_to in sync with responsible going forward (app-level).
-- Optional trigger for safety:
create or replace function public.sync_request_assigned_to_from_assignees()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  responsible_id uuid;
begin
  select employee_id into responsible_id
  from public.request_assignees
  where request_id = coalesce(new.request_id, old.request_id)
    and role = 'responsible'
  limit 1;

  update public.requests
  set assigned_to = responsible_id
  where id = coalesce(new.request_id, old.request_id);

  return coalesce(new, old);
end;
$$;

drop trigger if exists request_assignees_sync_assigned_to on public.request_assignees;
create trigger request_assignees_sync_assigned_to
after insert or update or delete on public.request_assignees
for each row
execute function public.sync_request_assigned_to_from_assignees();

-- Helper avoids RLS recursion when checking teammate visibility.
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

-- RLS
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

-- Requests: mechanic sees rows where they are an assignee.
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
