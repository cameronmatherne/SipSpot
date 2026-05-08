-- Run this in the Supabase SQL editor to create the spots table.

create table if not exists spots (
  id             text primary key,
  market         text not null default 'lafayette',
  name           text not null,
  latitude       double precision,
  longitude      double precision,
  address        jsonb,
  phone          text,
  website        text,
  opening_hours  text,
  amenity        text,
  cuisine        text,
  daily_deals    jsonb not null default '[]'::jsonb,
  happy_hours    jsonb not null default '[]'::jsonb,
  source         jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists spots_market_idx on spots (market);

-- Enable Row Level Security and allow public reads
alter table spots enable row level security;

create policy "Public read" on spots
  for select using (true);
