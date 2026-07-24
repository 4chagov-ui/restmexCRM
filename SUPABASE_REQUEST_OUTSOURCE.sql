-- Full outsourcing support for requests.
-- Prerequisites:
--   SUPABASE_REQUEST_ASSIGNEES.sql
--   SUPABASE_REQUESTS_SOFT_DELETE.sql (recommended)
-- Safe to re-run.

alter table public.requests
  add column if not exists execution_type text not null default 'internal',
  add column if not exists outsourced_at timestamptz,
  add column if not exists outsourced_by uuid references public.profiles(id) on delete set null,
  add column if not exists outsource_contact text,
  add column if not exists outsource_expected_date date,
  add column if not exists outsource_status text;

-- Ensure contractor/comment columns exist (legacy DATABASE.sql).
alter table public.requests
  add column if not exists outsource_contractor text,
  add column if not exists outsource_comment text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'requests_execution_type_check'
  ) then
    alter table public.requests
      add constraint requests_execution_type_check
      check (execution_type in ('internal', 'outsourced', 'mixed'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'requests_outsource_status_check'
  ) then
    alter table public.requests
      add constraint requests_outsource_status_check
      check (
        outsource_status is null
        or outsource_status in ('sent', 'in_progress', 'completed')
      );
  end if;
end $$;

create index if not exists requests_execution_type_idx
  on public.requests(execution_type);

create index if not exists requests_outsource_status_idx
  on public.requests(outsource_status)
  where outsource_status is not null;

-- Soft-remove assignees (history preserved).
alter table public.request_assignees
  add column if not exists removed_at timestamptz,
  add column if not exists removed_by uuid references public.profiles(id) on delete set null,
  add column if not exists removal_reason text;

create index if not exists request_assignees_active_idx
  on public.request_assignees(request_id)
  where removed_at is null;

-- One active responsible per request.
drop index if exists request_assignees_one_responsible_idx;
create unique index request_assignees_one_responsible_idx
  on public.request_assignees(request_id)
  where role = 'responsible' and removed_at is null;

-- Sync assigned_to from active responsible only.
create or replace function public.sync_request_assigned_to_from_assignees()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  responsible_id uuid;
  target_request_id uuid;
begin
  target_request_id := coalesce(new.request_id, old.request_id);

  select employee_id into responsible_id
  from public.request_assignees
  where request_id = target_request_id
    and role = 'responsible'
    and removed_at is null
  limit 1;

  update public.requests
  set assigned_to = responsible_id
  where id = target_request_id;

  return coalesce(new, old);
end;
$$;

-- Atomic transfer to outsource.
create or replace function public.transfer_request_to_outsource(
  p_request_id uuid,
  p_actor_id uuid,
  p_contractor text,
  p_contact text,
  p_comment text,
  p_expected_date date,
  p_outsourced_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_profile_role() not in ('admin', 'manager') then
    raise exception 'Only manager/admin can transfer to outsource';
  end if;

  update public.request_assignees
  set
    removed_at = p_outsourced_at,
    removed_by = p_actor_id,
    removal_reason = 'Передано на аутсорс'
  where request_id = p_request_id
    and removed_at is null;

  update public.requests
  set
    execution_type = 'outsourced',
    status = 'outsource',
    outsource_status = 'sent',
    outsource_contractor = nullif(trim(p_contractor), ''),
    outsource_contact = nullif(trim(p_contact), ''),
    outsource_comment = nullif(trim(p_comment), ''),
    outsource_expected_date = p_expected_date,
    outsourced_at = p_outsourced_at,
    outsourced_by = p_actor_id,
    assigned_to = null,
    planned_date = null,
    start_time = null,
    end_time = null,
    queue_position = null
  where id = p_request_id
    and deleted_at is null;
end;
$$;

grant execute on function public.transfer_request_to_outsource(
  uuid, uuid, text, text, text, date, timestamptz
) to authenticated;
