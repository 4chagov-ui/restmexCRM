-- RestMex CRM: performance indexes for /today and /requests hot paths.
-- Idempotent. Review and run manually in Supabase SQL Editor.
-- Does NOT change RLS. May add soft-delete / soft-remove columns if missing
-- (same columns as soft-delete / outsource migrations — safe no-op if already applied).
--
-- Existing indexes (do not recreate):
--   requests_status_idx, requests_planned_date_idx, requests_assigned_to_idx,
--   requests_created_at_idx, requests_planned_queue_idx,
--   requests_active_idx (created_at WHERE deleted_at IS NULL),
--   request_assignees_request_id_idx, request_assignees_employee_id_idx,
--   request_assignees_active_idx (request_id WHERE removed_at IS NULL)

-- Prerequisites for partial indexes (no-op if already present).
alter table public.requests
  add column if not exists deleted_at timestamptz;

alter table public.request_assignees
  add column if not exists removed_at timestamptz,
  add column if not exists removed_by uuid references public.profiles(id) on delete set null,
  add column if not exists removal_reason text;

-- Closed-on-date lookups (mechanic today completed + dispatcher completed section).
create index if not exists requests_closed_at_idx
  on public.requests (closed_at);

-- Active rows by planned day (today active columns / stats).
create index if not exists requests_active_planned_date_idx
  on public.requests (planned_date)
  where deleted_at is null;

-- Overdue / open backlog by planned_date (today stats.overdue).
create index if not exists requests_open_planned_date_idx
  on public.requests (planned_date)
  where deleted_at is null
    and status not in ('done', 'cancelled', 'duplicate', 'not_actual', 'outsource');

-- Journal list: newest first among non-deleted.
create index if not exists requests_active_created_at_assigned_idx
  on public.requests (created_at desc, assigned_to)
  where deleted_at is null;

-- Mechanic visibility: assignees by employee among active memberships.
create index if not exists request_assignees_employee_active_idx
  on public.request_assignees (employee_id)
  where removed_at is null;

comment on index public.requests_closed_at_idx is
  'Perf: closed_at day-range filters for completed sections';
comment on index public.request_assignees_employee_active_idx is
  'Perf: mechanic cabinet visibility via request_assignees.employee_id';
