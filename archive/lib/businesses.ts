import { useEffect, useMemo, useState } from "react";

export type Weekday = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

export type TimeWindow = {
  days: Weekday[];
  start: string; // 24h format, e.g. "16:00"
  end: string; // 24h format, e.g. "18:30"
  items: string[];
};

export type DailyDeal = {
  day: Weekday;
  start?: string; // 24h format, e.g. "15:00" (optional)
  end?: string; // 24h format, e.g. "18:00" (optional)
  items: string[];
};

export type Address = {
  houseNumber: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
};

export type SpotSource =
  | {
      provider: "osm";
      fetchedAt: string; // ISO
      osm: { type: "node" | "way" | "relation"; id: number };
    }
  | {
      provider: "manual";
      fetchedAt: string; // ISO
      note?: string;
    };

export type Spot = {
  id: string;
  name: string;
  location: {
    latitude: number;
    longitude: number;
  };

  // Optional metadata (useful for linking a user to the source of truth).
  address?: Address | null;
  phone?: string | null;
  website?: string | null;
  openingHours?: string | null; // OSM "opening_hours" syntax when available
  amenity?: string | null;
  cuisine?: string | null;
  source?: SpotSource;

  // Core app data
  dailyDeals: DailyDeal[];
  happyHours: TimeWindow[];
};

export type BusinessesPayload = {
  updatedAt: string;
  businesses: Spot[];
};

const WEEKDAYS = new Set<Weekday>([
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
]);
const TIME_RE = /^\d{2}:\d{2}$/;

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object";

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((v) => typeof v === "string");

const validateTimeWindow = (window: unknown): window is TimeWindow => {
  if (!isObject(window)) return false;
  if (!Array.isArray(window.days) || window.days.length === 0) return false;
  if (
    !window.days.every(
      (d) => typeof d === "string" && WEEKDAYS.has(d as Weekday),
    )
  )
    return false;
  if (typeof window.start !== "string" || !TIME_RE.test(window.start))
    return false;
  if (typeof window.end !== "string" || !TIME_RE.test(window.end)) return false;
  if (!isStringArray(window.items)) return false;
  return true;
};

const validateDailyDeal = (
  deal: unknown,
): deal is Spot["dailyDeals"][number] => {
  if (!isObject(deal)) return false;
  if (typeof deal.day !== "string" || !WEEKDAYS.has(deal.day as Weekday))
    return false;
  if (deal.start !== undefined || deal.end !== undefined) {
    if (typeof deal.start !== "string" || !TIME_RE.test(deal.start))
      return false;
    if (typeof deal.end !== "string" || !TIME_RE.test(deal.end)) return false;
  }
  if (!isStringArray(deal.items)) return false;
  return true;
};

type LoadState = {
  businesses: Spot[];
  updatedAt: string;
  source: "cache" | "remote";
  error: string | null;
  loading: boolean;
};

const STORAGE_KEY_PAYLOAD = "sipspot.spots.payload.v1";

type AsyncStorageLike = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

const getAsyncStorage = (): AsyncStorageLike | null => {
  try {
    // Avoid crashing if the native module isn't available (e.g. Expo Go mismatch / web).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("@react-native-async-storage/async-storage");
    return (mod?.default ?? mod) as AsyncStorageLike;
  } catch {
    return null;
  }
};

async function readCachedPayload(): Promise<BusinessesPayload | null> {
  const storage = getAsyncStorage();
  if (!storage) return null;

  const payloadRaw = await storage.getItem(STORAGE_KEY_PAYLOAD);
  if (!payloadRaw) return null;
  try {
    const json = JSON.parse(payloadRaw);
    if (!isObject(json)) return null;
    if (typeof json.updatedAt !== "string") return null;
    if (!Array.isArray(json.businesses)) return null;
    return json as BusinessesPayload;
  } catch {
    return null;
  }
}

async function writeCachedPayload(payload: BusinessesPayload) {
  const storage = getAsyncStorage();
  if (!storage) return;

  await storage.setItem(STORAGE_KEY_PAYLOAD, JSON.stringify(payload));
}

type SupabaseSpotRow = {
  id: string;
  market: string;
  name: string;
  latitude: number;
  longitude: number;
  address_house_number: string | null;
  address_street: string | null;
  address_city: string | null;
  address_state: string | null;
  address_postal_code: string | null;
  website: string | null;
  phone: string | null;
  opening_hours: string | null;
  amenity: string | null;
  cuisine: string | null;
  daily_deals: unknown;
  happy_hours: unknown;
  payload_updated_at: string;
};

const selectColumns = [
  "id",
  "market",
  "name",
  "latitude",
  "longitude",
  "address_house_number",
  "address_street",
  "address_city",
  "address_state",
  "address_postal_code",
  "website",
  "phone",
  "opening_hours",
  "amenity",
  "cuisine",
  "daily_deals",
  "happy_hours",
  "payload_updated_at",
] as const;

function normalizeSpotFromRow(row: SupabaseSpotRow): Spot {
  const address: Address = {
    houseNumber: row.address_house_number,
    street: row.address_street,
    city: row.address_city,
    state: row.address_state,
    postalCode: row.address_postal_code,
  };

  const hasAnyAddressField =
    address.houseNumber !== null ||
    address.street !== null ||
    address.city !== null ||
    address.state !== null ||
    address.postalCode !== null;

  const dailyDeals = Array.isArray(row.daily_deals)
    ? row.daily_deals.filter(validateDailyDeal)
    : [];
  const happyHours = Array.isArray(row.happy_hours)
    ? row.happy_hours.filter(validateTimeWindow)
    : [];

  return {
    id: row.id,
    name: row.name,
    location: { latitude: row.latitude, longitude: row.longitude },
    address: hasAnyAddressField ? address : null,
    phone: row.phone,
    website: row.website,
    openingHours: row.opening_hours,
    amenity: row.amenity,
    cuisine: row.cuisine,
    dailyDeals,
    happyHours,
  };
}

function getSupabaseEnv(): { url: string; anonKey: string } | null {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

async function fetchSpotsFromSupabase(
  market: string,
): Promise<
  { ok: true; payload: BusinessesPayload } | { ok: false; error: string }
> {
  const env = getSupabaseEnv();
  if (!env) {
    return {
      ok: false,
      error:
        "Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_KEY in .env",
    };
  }

  const endpoint = new URL("/rest/v1/spots", env.url);
  endpoint.searchParams.set("select", selectColumns.join(","));
  endpoint.searchParams.set("market", `eq.${market}`);
  endpoint.searchParams.set("order", "name.asc");

  const res = await fetch(endpoint.toString(), {
    headers: {
      apikey: env.anonKey,
      Authorization: `Bearer ${env.anonKey}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return {
      ok: false,
      error: `Supabase HTTP ${res.status}${text ? `: ${text}` : ""}`,
    };
  }

  const json = (await res.json()) as unknown;
  if (!Array.isArray(json)) {
    return { ok: false, error: "Unexpected Supabase response shape" };
  }

  const rows = json as SupabaseSpotRow[];
  const businesses = rows.map(normalizeSpotFromRow);

  const updatedAt =
    rows.reduce<string | null>((max, row) => {
      if (!row.payload_updated_at) return max;
      if (!max) return row.payload_updated_at;
      return Date.parse(row.payload_updated_at) > Date.parse(max)
        ? row.payload_updated_at
        : max;
    }, null) ?? new Date().toISOString();

  return { ok: true, payload: { updatedAt, businesses } };
}

export function useBusinesses() {
  const empty = useMemo<BusinessesPayload>(
    () => ({ updatedAt: new Date().toISOString(), businesses: [] }),
    [],
  );

  const [state, setState] = useState<LoadState>(() => ({
    businesses: empty.businesses,
    updatedAt: empty.updatedAt,
    source: "remote",
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

      const market = process.env.EXPO_PUBLIC_MARKET ?? "lafayette";

      const fetched = await fetchSpotsFromSupabase(market);
      if (cancelled) return;

      if (fetched.ok) {
        setState({
          businesses: fetched.payload.businesses,
          updatedAt: fetched.payload.updatedAt,
          source: "remote",
          error: null,
          loading: false,
        });
        await writeCachedPayload(fetched.payload);
      } else {
        setState((s) => ({ ...s, error: fetched.error, loading: false }));
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
