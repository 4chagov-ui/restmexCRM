-- RestMex CRM: add mechanic workflow statuses to request_status enum.
-- Run manually in Supabase SQL Editor. Do not auto-apply from the app.
--
-- CURRENT enum values (from DATABASE.sql):
--   needs_planning, needs_review, planned, in_progress, waiting_client,
--   specialist_on_way, postponed, done, cancelled, duplicate, not_actual
--
-- MISSING for mechanic UX (this migration adds):
--   waiting_parts  → UI label «Заказ запчастей»
--   outsource      → UI label «Аутсорс»
--
-- Existing columns already support comments:
--   executor_comment, outsource_comment (optional legacy), closed_at
--
-- After this migration, update the app TypeScript RequestStatus union
-- (already prepared in code once this SQL is applied).

do $$
begin
  if not exists (
    select 1
    from pg_enum
    where enumtypid = 'public.request_status'::regtype
      and enumlabel = 'waiting_parts'
  ) then
    alter type public.request_status add value 'waiting_parts';
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_enum
    where enumtypid = 'public.request_status'::regtype
      and enumlabel = 'outsource'
  ) then
    alter type public.request_status add value 'outsource';
  end if;
end;
$$;

-- Verification:
-- select enumlabel
-- from pg_enum
-- where enumtypid = 'public.request_status'::regtype
-- order by enumsortorder;
