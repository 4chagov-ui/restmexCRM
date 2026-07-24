-- Minimal MVP migration for the Locations section.
-- Run once in Supabase SQL Editor before using location phone fields.

alter table public.locations
add column if not exists phone text;
