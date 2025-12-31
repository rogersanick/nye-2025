-- Virtual New Year's 2025
-- Migration created in Supabase CLI style (timestamped filename).
-- Fresh Supabase instance schema (NO RLS). Trust-based for a small party site.

begin;

-- UUID helper
create extension if not exists pgcrypto;

-- Goals: public wall shows title + name + time; full text is only hidden in the UI.
create table if not exists public.goals_2025 (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  title text not null,
  goal_text text not null,
  created_at timestamp with time zone not null default now()
);

-- Greg updates: latest update is shown on the landing page (trust-based inserts if no RLS).
create table if not exists public.greg_updates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  video_path text not null,
  created_at timestamp with time zone not null default now()
);

-- Privileges (instead of RLS)
-- NOTE: In Supabase, the API uses Postgres roles like `anon` and `authenticated`.
grant usage on schema public to anon;
grant usage on schema public to authenticated;

grant select, insert on table public.goals_2025 to anon, authenticated;
revoke update, delete on table public.goals_2025 from anon, authenticated;

grant select, insert on table public.greg_updates to anon, authenticated;
revoke update, delete on table public.greg_updates from anon, authenticated;

commit;


