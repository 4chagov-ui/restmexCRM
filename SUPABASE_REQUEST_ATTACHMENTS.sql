-- RestMex CRM: request photos + comment photos (attachments + request_comments RLS).
-- Safe to run on an existing pilot DB. Does NOT rewrite prior migrations.
--
-- Prerequisites (already applied in pilot):
--   DATABASE.sql (attachments, request_comments)
--   SUPABASE_AUTH_ROLES_MIGRATION.sql / SUPABASE_RLS_MECHANIC_CABINET.sql
--     (current_profile_role, current_profile_employee_id)
--   SUPABASE_REQUEST_ASSIGNEES.sql or SUPABASE_FIX_RLS_COLLABORATIVE_ASSIGNEES.sql
--     (is_request_participant)
--
-- After this SQL:
--   1. Create private Storage bucket `request-attachments` (see SUPABASE_REQUEST_ATTACHMENTS_SETUP.md)
--   2. Apply Storage policies from that doc (or the storage.objects section below if you have rights)

-- =========================
-- Schema extensions
-- =========================

alter table public.attachments
  add column if not exists comment_id uuid references public.request_comments(id) on delete cascade;

alter table public.attachments
  add column if not exists file_size bigint;

comment on column public.attachments.comment_id is
  'NULL = photo attached to the request itself; set = photo attached to a request_comments row.';

comment on column public.attachments.file_size is
  'Original/uploaded byte size after client-side optimization.';

create index if not exists attachments_comment_id_idx
  on public.attachments(comment_id)
  where comment_id is not null;

-- Allow photo-only comments (empty body + photos).
alter table public.request_comments
  alter column body set default '';

alter table public.request_comments
  alter column body set not null;

-- =========================
-- Access helper (mirrors request visibility)
-- =========================

create or replace function public.can_access_request_media(p_request_id uuid)
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

revoke all on function public.can_access_request_media(uuid) from public;
grant execute on function public.can_access_request_media(uuid) to authenticated;

-- =========================
-- attachments RLS
-- =========================

alter table public.attachments enable row level security;

drop policy if exists "Authenticated users can read attachments" on public.attachments;
drop policy if exists "Authenticated users can manage attachments" on public.attachments;
drop policy if exists "Role read attachments" on public.attachments;
drop policy if exists "Role insert attachments" on public.attachments;
drop policy if exists "Role delete attachments" on public.attachments;
drop policy if exists "Role update attachments" on public.attachments;

create policy "Role read attachments"
  on public.attachments
  for select
  to authenticated
  using (public.can_access_request_media(request_id));

create policy "Role insert attachments"
  on public.attachments
  for insert
  to authenticated
  with check (
    public.can_access_request_media(request_id)
    and uploaded_by = auth.uid()
  );

-- Managers may delete any attachment on accessible requests.
-- Mechanics may delete only their own uploads on accessible requests.
create policy "Role delete attachments"
  on public.attachments
  for delete
  to authenticated
  using (
    public.can_access_request_media(request_id)
    and (
      public.current_profile_role() in ('admin', 'manager')
      or uploaded_by = auth.uid()
    )
  );

-- No general update needed for MVP photos (immutable metadata).
-- Keep update policy closed.

grant select, insert, delete on public.attachments to authenticated;
revoke all on public.attachments from anon;

-- =========================
-- request_comments RLS
-- =========================

alter table public.request_comments enable row level security;

drop policy if exists "Authenticated users can read request comments" on public.request_comments;
drop policy if exists "Authenticated users can manage request comments" on public.request_comments;
drop policy if exists "Role read request comments" on public.request_comments;
drop policy if exists "Role insert request comments" on public.request_comments;
drop policy if exists "Role delete request comments" on public.request_comments;

create policy "Role read request comments"
  on public.request_comments
  for select
  to authenticated
  using (public.can_access_request_media(request_id));

create policy "Role insert request comments"
  on public.request_comments
  for insert
  to authenticated
  with check (
    public.can_access_request_media(request_id)
    and author_id = auth.uid()
  );

create policy "Role delete request comments"
  on public.request_comments
  for delete
  to authenticated
  using (
    public.can_access_request_media(request_id)
    and (
      public.current_profile_role() in ('admin', 'manager')
      or author_id = auth.uid()
    )
  );

grant select, insert, delete on public.request_comments to authenticated;
revoke all on public.request_comments from anon;

-- =========================
-- Storage policies (bucket must exist: request-attachments, private)
-- Safe to run after bucket creation. If bucket is missing, this section errors —
-- create the bucket first (Dashboard), then re-run from here.
-- =========================

-- storage.objects policies for private bucket request-attachments
-- Path convention: {request_id}/{uuid}.jpg

drop policy if exists "Role read request attachment objects" on storage.objects;
drop policy if exists "Role insert request attachment objects" on storage.objects;
drop policy if exists "Role delete request attachment objects" on storage.objects;
drop policy if exists "Role update request attachment objects" on storage.objects;

create policy "Role read request attachment objects"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'request-attachments'
    and public.can_access_request_media((storage.foldername(name))[1]::uuid)
  );

create policy "Role insert request attachment objects"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'request-attachments'
    and public.can_access_request_media((storage.foldername(name))[1]::uuid)
  );

-- App layer still enforces "mechanic deletes own uploads only" via attachments RLS.
create policy "Role delete request attachment objects"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'request-attachments'
    and public.can_access_request_media((storage.foldername(name))[1]::uuid)
  );
