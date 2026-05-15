/**
 * data/useBusinesses.ts — Data-fetching hook for the spot list.
 *
 * Loading strategy (three layers, in order):
 *
 *   1. Bundled data (instant)
 *      A static JSON snapshot baked into the app build. Always available,
 *      never staleness-safe. File: data/businesses.lafayette.ts
 *
 *   2. AsyncStorage cache (fast, ~ms)
 *      The last successful Supabase fetch is persisted locally under
 *      STORAGE_KEY_PAYLOAD. On next launch, the cache is shown immediately
 *      while a fresh fetch runs in the background.
 *
 *   3. Supabase fetch (authoritative, ~100-500 ms)
 *      Queries the `spots` table filtered by EXPO_PUBLIC_MARKET. On success
 *      the result replaces the cache and updates the UI.
 *
 * If the network fetch fails, the hook surfaces an `error` string but keeps
 * showing whatever data was loaded from bundled or cache — the app stays
 * usable offline.
 *
 * Returned state shape
 * ────────────────────
 *   businesses – the current list of Spot objects
 *   updatedAt  – ISO timestamp of when the data was last refreshed
 *   source     – "bundled" | "cache" | "remote" (useful for debugging)
 *   error      – non-null if the Supabase fetch failed
 *   loading    – true only during the very first load before any data is ready
 */

import { useEffect, useMemo, useState } from "react";

import type { Spot } from "./spots";
import { BUSINESSES, BUSINESSES_UPDATED_AT } from "./businesses.lafayette";
import { parseBusinessesPayload, type BusinessesPayload } from "./businessesSchema";
import { supabase } from "../lib/supabase";

type LoadState = {
  businesses: Spot[];
  updatedAt: string;
  source: "bundled" | "cache" | "remote";
  error: string | null;
  loading: boolean;
};

// AsyncStorage key for the cached payload. Bump the version suffix if the
// payload schema changes in a breaking way to avoid parsing stale data.
const STORAGE_KEY_PAYLOAD = "sipspot.businesses.payload.v1";

type AsyncStorageLike = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

// Lazy-load AsyncStorage so the module works in environments where it's
// not available (e.g. web previews or unit tests).
const getAsyncStorage = (): AsyncStorageLike | null => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("@react-native-async-storage/async-storage");
    return (mod?.default ?? mod) as AsyncStorageLike;
  } catch {
    return null;
  }
};

// Reads the cached payload from AsyncStorage and validates its shape.
// Returns null if nothing is cached or if the cached data is malformed.
async function readCachedPayload(): Promise<BusinessesPayload | null> {
  const storage = getAsyncStorage();
  if (!storage) return null;
  const raw = await storage.getItem(STORAGE_KEY_PAYLOAD);
  if (!raw) return null;
  try {
    const validated = parseBusinessesPayload(JSON.parse(raw) as unknown);
    return validated.ok ? validated.payload : null;
  } catch {
    return null;
  }
}

// Persists a successfully-fetched payload so it's available on the next launch.
async function writeCachedPayload(payload: BusinessesPayload) {
  const storage = getAsyncStorage();
  if (!storage) return;
  await storage.setItem(STORAGE_KEY_PAYLOAD, JSON.stringify(payload));
}

// Fetches all spots for the configured market from Supabase and maps the raw
// database rows into typed Spot objects. The market is set via .env:
//   EXPO_PUBLIC_MARKET=lafayette  (default if not set)
async function fetchFromSupabase(): Promise<BusinessesPayload> {
  const market = process.env.EXPO_PUBLIC_MARKET ?? "lafayette";
  const { data, error } = await supabase.from("spots").select("*").eq("market", market);

  if (error) throw new Error(error.message);

  // Map raw Supabase rows → typed Spot objects.
  // The `as` casts are safe because the DB schema enforces the types; we cast
  // rather than validate here to keep this layer thin.
  const businesses: Spot[] = (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    location: {
      latitude: (row.latitude as number | null) ?? 0,
      longitude: (row.longitude as number | null) ?? 0,
    },
    address: (row.address as Spot["address"]) ?? null,
    phone: (row.phone as string | null) ?? null,
    website: (row.website as string | null) ?? null,
    openingHours: (row.opening_hours as string | null) ?? null,
    amenity: (row.amenity as string | null) ?? null,
    cuisine: (row.cuisine as string | null) ?? null,
    dailyDeals: (row.daily_deals as Spot["dailyDeals"]) ?? [],
    happyHours: (row.happy_hours as Spot["happyHours"]) ?? [],
    includesFood: (row.includes_food as boolean | null) ?? false,
    rating: (row.rating as number | null) ?? null,
    reviewCount: (row.review_count as number | null) ?? null,
    priceLevel: (row.price_level as Spot["priceLevel"]) ?? null,
    source: (row.source as Spot["source"]) ?? undefined,
  }));

  return { updatedAt: new Date().toISOString(), businesses };
}

export function useBusinesses() {
  // The bundled snapshot is the absolute fallback — it's always present.
  const bundled = useMemo<BusinessesPayload>(
    () => ({ updatedAt: BUSINESSES_UPDATED_AT, businesses: BUSINESSES }),
    [],
  );

  const [state, setState] = useState<LoadState>(() => ({
    businesses: bundled.businesses,
    updatedAt: bundled.updatedAt,
    source: "bundled",
    error: null,
    loading: true,
  }));

  useEffect(() => {
    // `cancelled` prevents state updates after the component unmounts.
    let cancelled = false;

    const run = async () => {
      // Step 1 — show cached data immediately if available.
      const cached = await readCachedPayload();
      if (!cancelled && cached) {
        setState({
          businesses: cached.businesses,
          updatedAt: cached.updatedAt,
          source: "cache",
          error: null,
          loading: false,
        });
      } else if (!cancelled) {
        setState((s) => ({ ...s, loading: false }));
      }

      // Step 2 — fetch fresh data from Supabase in the background.
      try {
        const payload = await fetchFromSupabase();
        if (cancelled) return;
        setState({
          businesses: payload.businesses,
          updatedAt: payload.updatedAt,
          source: "remote",
          error: null,
          loading: false,
        });
        await writeCachedPayload(payload);
      } catch (err) {
        // Network failure — keep showing cached/bundled data, surface the error.
        if (!cancelled) {
          setState((s) => ({
            ...s,
            error: err instanceof Error ? err.message : "Failed to fetch from Supabase",
          }));
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
