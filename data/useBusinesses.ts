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

const STORAGE_KEY_PAYLOAD = "sipspot.businesses.payload.v1";

type AsyncStorageLike = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

const getAsyncStorage = (): AsyncStorageLike | null => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("@react-native-async-storage/async-storage");
    return (mod?.default ?? mod) as AsyncStorageLike;
  } catch {
    return null;
  }
};

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

async function writeCachedPayload(payload: BusinessesPayload) {
  const storage = getAsyncStorage();
  if (!storage) return;
  await storage.setItem(STORAGE_KEY_PAYLOAD, JSON.stringify(payload));
}

async function fetchFromSupabase(): Promise<BusinessesPayload> {
  const market = process.env.EXPO_PUBLIC_MARKET ?? "lafayette";
  const { data, error } = await supabase.from("spots").select("*").eq("market", market);

  if (error) throw new Error(error.message);

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
    source: (row.source as Spot["source"]) ?? undefined,
  }));

  return { updatedAt: new Date().toISOString(), businesses };
}

export function useBusinesses() {
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
    let cancelled = false;

    const run = async () => {
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
