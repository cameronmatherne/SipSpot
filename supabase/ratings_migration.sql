-- ratings_migration.sql
-- Run this once in Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- Adds rating, review_count, and price_level columns to the spots table.

alter table public.spots
  add column if not exists rating       numeric(2, 1),  -- e.g. 4.2  (null = not fetched yet)
  add column if not exists review_count integer,        -- e.g. 312
  add column if not exists price_level  text;           -- "$" | "$$" | "$$$" | "$$$$"
