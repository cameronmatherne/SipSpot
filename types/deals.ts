import type { Spot, TimeWindow, Weekday } from "../data/spots";

// ─────────────────────────────────────────────────────────────────────────────
// Deals screen types
// These are internal view-model types — they extend Spot with computed fields
// that are derived once per render in DealsScreen and passed down to cards.
// ─────────────────────────────────────────────────────────────────────────────

// A Spot enriched with today's filtered deal/HH data and live-status flags.
export type DealsAndHappyHourItem = Spot & {
  day: Weekday;
  dailySpecials: Spot["dailyDeals"];       // today's daily deals only
  dailySpecialItems: string[];             // flat list of all deal item strings
  happyHourWindows: TimeWindow[];          // today's HH windows only
  activeHappyHourWindow?: TimeWindow;      // the currently-active HH window, if any
  activeDailySpecial: boolean;             // true if any daily deal is live right now
};

// One row in the SectionList — wraps a DealsAndHappyHourItem with a stable key.
export type DealsAndHappyHourRow = {
  id: string;
  item: DealsAndHappyHourItem;
};

// A section in the SectionList — either "live" (something active now) or "not_live".
export type DealsAndHappyHourSection = {
  key: "live" | "not_live";
  title: string;
  subtitle?: string;
  data: DealsAndHappyHourRow[];
};

// Spot enriched with map-specific computed fields.
export type MapSpot = Spot & {
  hasActiveDailyDeal: boolean;
  hasActiveHappyHour: boolean;
  todayDeals: Spot["dailyDeals"];
  todayHappyHours: Spot["happyHours"];
};
