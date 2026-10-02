-- RestMex CRM v1: checklist items inside a request.
-- Safe to re-run. Does not rewrite older migrations.
--
-- Prerequisites:
--   current_profile_role(), current_profile_employee_id(), is_request_participant()
--   public.set_updated_at()
--
-- Old requests have zero rows here and keep the existing close rules.

create table if not exists public.request_tasks (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  title text not null,
  position integer not null,
  is_completed boolean not null default false,
  completed_at timestamptz,
  completed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint request_tasks_title_not_blank check (length(trim(title)) > 0),
  constraint request_tasks_position_positive check (position > 0)
);

create index if not exists request_tasks_request_id_position_idx
  on public.request_tasks (request_id, position);

drop trigger if exists set_request_tasks_updated_at on public.request_tasks;
create trigger set_request_tasks_updated_at
before update on public.request_tasks
for each row execute function public.set_updated_at();

alter table public.request_tasks enable row level security;

drop policy if exists "Role read request tasks" on public.request_tasks;
drop policy if exists "Role insert request tasks" on public.request_tasks;
drop policy if exists "Role update request tasks" on public.request_tasks;
drop policy if exists "Role delete request tasks" on public.request_tasks;

create policy "Role read request tasks"
  on public.request_tasks
  for select
  to authenticated
  using (public.can_access_request_media(request_id));

create policy "Role insert request tasks"
  on public.request_tasks
  for insert
  to authenticated
  with check (
    public.current_profile_role() in ('admin', 'manager')
    and public.can_access_request_media(request_id)
  );

create policy "Role update request tasks"
  on public.request_tasks
  for update
  to authenticated
  using (public.can_access_request_media(request_id))
  with check (public.can_access_request_media(request_id));

create policy "Role delete request tasks"
  on public.request_tasks
  for delete
  to authenticated
  using (
    public.current_profile_role() in ('admin', 'manager')
    and public.can_access_request_media(request_id)
  );

grant select, insert, update, delete on public.request_tasks to authenticated;
revoke all on public.request_tasks from anon;

create or replace function public.guard_request_task_mechanic_update()
returns trigger
language plpgsql
as $$
begin
  if public.current_profile_role() = 'mechanic' then
    if new.title is distinct from old.title
      or new.position is distinct from old.position
      or new.request_id is distinct from old.request_id
    then
      raise exception 'Mechanic can only change task completion';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_request_task_mechanic_update on public.request_tasks;
create trigger guard_request_task_mechanic_update
before update on public.request_tasks
for each row execute function public.guard_request_task_mechanic_update();
