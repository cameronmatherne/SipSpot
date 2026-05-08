-- rbac.sql — Role-Based Access Control
-- Run this entire file in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
--
-- Roles
-- ──────
--   admin  – full access: add, edit, delete spots, manage all user roles
--            Can only be assigned manually (see "Promoting the first admin" below)
--   owner  – can add and edit spots; cannot delete
--   user   – read-only; can save favourites but cannot modify spot data
--
-- Every new sign-up automatically gets the 'user' role via the trigger below.
-- Admins are the only ones who can promote accounts to 'owner' or 'admin'.
--
-- Promoting the first admin
-- ──────────────────────────
--   After running this file, go to Supabase Dashboard → Table Editor →
--   user_profiles, find your account row, and set role = 'admin'.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. user_profiles table
--    Must exist before get_my_role() is defined (Postgres validates SQL
--    function bodies against live relations at creation time).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.user_profiles (
  id         uuid  primary key references auth.users on delete cascade,
  role       text  not null default 'user'
               check (role in ('admin', 'owner', 'user')),
  created_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Helper function — returns the current user's role (used in RLS policies)
--    Returns 'user' as a safe default if the profile row doesn't exist yet.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.get_my_role()
returns text
language sql
security definer
stable
as $$
  select coalesce(
    (select role from public.user_profiles where id = auth.uid()),
    'user'
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RLS policies for user_profiles
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "Users read own profile"   on public.user_profiles;
drop policy if exists "Admins read all profiles" on public.user_profiles;
drop policy if exists "Admins update profiles"   on public.user_profiles;

-- Users can read their own profile (needed to load their role in the app).
create policy "Users read own profile"
  on public.user_profiles for select
  using (auth.uid() = id);

-- Admins can read every profile (for a future user-management screen).
create policy "Admins read all profiles"
  on public.user_profiles for select
  using (public.get_my_role() = 'admin');

-- Only admins can change roles.
create policy "Admins update profiles"
  on public.user_profiles for update
  using  (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Auto-create a 'user' profile row on every new sign-up
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.user_profiles (id, role)
  values (new.id, 'user')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Spots table — role-gated write policies
--    (The public SELECT policy already exists in spots.sql.)
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "Public insert spots"              on public.spots;
drop policy if exists "Public update spots"              on public.spots;
drop policy if exists "Public delete spots"              on public.spots;
drop policy if exists "Admins and owners can add spots"  on public.spots;
drop policy if exists "Admins and owners can edit spots" on public.spots;
drop policy if exists "Admins can delete spots"          on public.spots;

create policy "Admins and owners can add spots"
  on public.spots for insert
  with check (public.get_my_role() in ('admin', 'owner'));

create policy "Admins and owners can edit spots"
  on public.spots for update
  using  (public.get_my_role() in ('admin', 'owner'));

create policy "Admins can delete spots"
  on public.spots for delete
  using (public.get_my_role() = 'admin');
