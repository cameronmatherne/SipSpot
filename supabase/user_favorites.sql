-- user_favorites.sql
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).
--
-- Creates a join table between auth.users and public.spots so users can
-- save (favourite) spots. RLS restricts every operation to the row owner.

create table if not exists public.user_favorites (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users  on delete cascade,
  spot_id    text        not null references public.spots(id) on delete cascade,
  created_at timestamptz not null default now(),

  -- Prevent duplicate saves of the same spot per user.
  unique(user_id, spot_id)
);

create index if not exists user_favorites_user_idx on public.user_favorites (user_id);

alter table public.user_favorites enable row level security;

-- Users can read, insert, and delete only their own rows.
drop policy if exists "Users manage own favorites" on public.user_favorites;
create policy "Users manage own favorites"
  on public.user_favorites for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
