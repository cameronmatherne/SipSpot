/**
 * data/spots.ts — Core data types for SipSpot.
 *
 * These types are the shared contract between:
 *   - the Supabase database (columns map 1-to-1 via useBusinesses.ts)
 *   - the UI components in App.tsx
 *   - the seed script in scripts/seed-supabase.mjs
 *
 * If you add a new column to the `spots` table in Supabase you will likely
 * need to add a field here and update the mapping in data/useBusinesses.ts.
 */

// The three-letter abbreviations used throughout the app and stored in the DB.
export type Weekday = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

/**
 * TimeWindow — a recurring happy-hour block.
 *
 * A single spot can have multiple windows (e.g. Mon-Fri 4-6 PM and Sat 2-5 PM).
 * `days` lists which weekdays the window applies on.
 * `start` / `end` are 24-hour "HH:MM" strings, e.g. "16:00" / "18:30".
 * `items` is the list of deal descriptions for that window.
 */
export type TimeWindow = {
  days: Weekday[];
  start: string; // 24h format, e.g. "16:00"
  end: string;   // 24h format, e.g. "18:30"
  items: string[];
};

/**
 * DailyDeal — a deal that recurs on a specific day of the week.
 *
 * `start` and `end` are optional — omit them for an all-day special.
 * When omitted, isDealActive() in App.tsx treats the deal as always live.
 */
export type DailyDeal = {
  day: Weekday;
  start?: string; // 24h format, e.g. "15:00" (omit for all-day)
  end?: string;   // 24h format, e.g. "18:00" (omit for all-day)
  items: string[];
};

/**
 * Address — structured mailing address.
 * Populated for spots sourced from OpenStreetMap; usually null for
 * manually-added spots until you fill it in via the Supabase dashboard.
 */
export type Address = {
  houseNumber: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
};

/**
 * SpotSource — tracks where this spot's record originated.
 * Not displayed in the UI but useful for data auditing.
 */
export type SpotSource =
  | {
      provider: "osm";
      fetchedAt: string; // ISO timestamp
      osm: { type: "node" | "way" | "relation"; id: number };
    }
  | {
      provider: "manual";
      fetchedAt: string; // ISO timestamp
      note?: string;
    };

/**
 * Spot — the primary entity in SipSpot.
 *
 * Each row in the Supabase `spots` table maps to one of these.
 * `id` is a URL-safe slug derived from the name (e.g. "tsunami-sushi").
 * `location` defaults to { latitude: 0, longitude: 0 } for unseeded spots —
 * those are hidden from the map until real coordinates are added.
 */
export type Spot = {
  id: string;
  name: string;
  location: {
    latitude: number;
    longitude: number;
  };

  // Optional metadata (populated from OSM or the Supabase dashboard)
  address?: Address | null;
  phone?: string | null;
  website?: string | null;
  openingHours?: string | null; // OSM "opening_hours" format when available
  amenity?: string | null;      // OSM amenity tag, e.g. "bar", "restaurant"
  cuisine?: string | null;      // OSM cuisine tag, e.g. "cajun"
  source?: SpotSource;

  includesFood?: boolean;

  // Core deal data — what the app actually displays
  dailyDeals: DailyDeal[];
  happyHours: TimeWindow[];
};
