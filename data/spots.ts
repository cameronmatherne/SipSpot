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
