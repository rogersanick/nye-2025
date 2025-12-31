-- Create Storage bucket for Greg videos.
-- Migration created in Supabase CLI style (timestamped filename).
-- Run in Supabase SQL editor. Requires storage schema available.

begin;

-- Create bucket if it doesn't exist.
insert into storage.buckets (id, name, public)
values ('greg-videos', 'greg-videos', true)
on conflict (id) do update set public = excluded.public;

-- Policies are only relevant if you enable RLS on storage.objects.
-- This project is intentionally not using RLS for simplicity.
-- If you do enable RLS later, add a policy like:
--   create policy "Public read greg videos"
--     on storage.objects for select
--     to public
--     using (bucket_id = 'greg-videos');

commit;


