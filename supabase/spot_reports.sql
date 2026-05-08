-- spot_reports.sql
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
--
-- Stores user-submitted problem reports for individual spots.
-- Anyone (signed in or anonymous) can submit a report.
-- Only admins can read reports (via get_my_role(), defined in rbac.sql).
-- Run rbac.sql before this file.

create table if not exists public.spot_reports (
  id         uuid        primary key default gen_random_uuid(),
  spot_id    text        references public.spots(id) on delete cascade,  -- null = general app report
  user_id    uuid        references auth.users on delete set null,
  message    text        not null,
  created_at timestamptz not null default now()
);

alter table public.spot_reports enable row level security;

drop policy if exists "Anyone can submit a report" on public.spot_reports;
drop policy if exists "Admins read all reports"    on public.spot_reports;

-- Allow anyone (including anon) to insert a report.
create policy "Anyone can submit a report"
  on public.spot_reports for insert
  with check (true);

-- Only admins can read reports.
create policy "Admins read all reports"
  on public.spot_reports for select
  using (public.get_my_role() = 'admin');
