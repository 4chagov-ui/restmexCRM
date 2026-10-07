-- RestMex CRM: rename mechanic display name Олег → Никита.
-- Run in Supabase → SQL Editor after code deploy (or together).
-- Safe to re-run.
--
-- Does NOT change:
--   employees.id, auth, profiles, roles, RLS, assigned_to, request_assignees.

begin;

do $$
declare
  target_id uuid := '94b0a5d9-ef96-429e-bee9-5c0f9071be36';
  updated_count integer;
begin
  if not exists (
    select 1
    from public.employees
    where id = target_id
      and name = 'Олег'
  ) then
    if exists (
      select 1
      from public.employees
      where id = target_id
        and name = 'Никита'
    ) then
      raise notice 'Employee % already named Никита — nothing to do', target_id;
      return;
    end if;

    raise exception
      'Expected employee % with name Олег was not found',
      target_id;
  end if;

  if exists (
    select 1
    from public.employees
    where name = 'Никита'
      and id <> target_id
  ) then
    raise exception
      'Another employee already has name Никита — refusing rename';
  end if;

  update public.employees
  set name = 'Никита'
  where id = target_id
    and name = 'Олег';

  get diagnostics updated_count = row_count;

  if updated_count <> 1 then
    raise exception 'Expected to update 1 row, updated %', updated_count;
  end if;
end;
$$;

select id, name, role, is_active, sort_order
from public.employees
order by sort_order, name;

commit;
