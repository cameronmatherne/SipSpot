begin;

create table if not exists public.spots (
  id text primary key,
  market text not null default 'lafayette',
  name text not null,
  latitude double precision not null,
  longitude double precision not null,
  address_house_number text,
  address_street text,
  address_city text,
  address_state text,
  address_postal_code text,
  website text,
  phone text,
  opening_hours text,
  amenity text,
  cuisine text,
  daily_deals jsonb not null default '[]'::jsonb,
  happy_hours jsonb not null default '[]'::jsonb,
  includes_food boolean not null default false,
  payload_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- If the table already existed before this column was added, run:
--   alter table public.spots add column if not exists includes_food boolean not null default false;

create index if not exists spots_market_idx on public.spots (market);
create index if not exists spots_name_idx on public.spots (name);

alter table public.spots enable row level security;

drop policy if exists "Public read spots" on public.spots;
create policy "Public read spots"
on public.spots
for select
using (true);

commit;
