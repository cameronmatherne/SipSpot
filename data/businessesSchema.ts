import type { Spot, TimeWindow, Weekday } from "./spots";

export type BusinessesPayload = {
  updatedAt: string;
  businesses: Spot[];
};

const WEEKDAYS = new Set<Weekday>(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
const TIME_RE = /^\d{2}:\d{2}$/;

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object";

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((v) => typeof v === "string");

const validateTimeWindow = (window: unknown): window is TimeWindow => {
  if (!isObject(window)) return false;
  if (!Array.isArray(window.days) || window.days.length === 0) return false;
  if (!window.days.every((d) => typeof d === "string" && WEEKDAYS.has(d as Weekday))) return false;
  if (typeof window.start !== "string" || !TIME_RE.test(window.start)) return false;
  if (typeof window.end !== "string" || !TIME_RE.test(window.end)) return false;
  if (!isStringArray(window.items)) return false;
  return true;
};

const validateDailyDeal = (deal: unknown): deal is Spot["dailyDeals"][number] => {
  if (!isObject(deal)) return false;
  if (typeof deal.day !== "string" || !WEEKDAYS.has(deal.day as Weekday)) return false;
  if (deal.start !== undefined || deal.end !== undefined) {
    if (typeof deal.start !== "string" || !TIME_RE.test(deal.start)) return false;
    if (typeof deal.end !== "string" || !TIME_RE.test(deal.end)) return false;
  }
  if (!isStringArray(deal.items)) return false;
  return true;
};

const normalizeBusiness = (value: unknown): Spot | null => {
  if (!isObject(value)) return null;
  if (typeof value.id !== "string" || !value.id) return null;
  if (typeof value.name !== "string" || !value.name) return null;

  const location = value.location;
  if (!isObject(location)) return null;
  if (typeof location.latitude !== "number" || typeof location.longitude !== "number") return null;

  const dailyDeals = Array.isArray(value.dailyDeals)
    ? value.dailyDeals.filter(validateDailyDeal)
    : [];
  const happyHours = Array.isArray(value.happyHours)
    ? value.happyHours.filter(validateTimeWindow)
    : [];

  const spot: Spot = {
    id: value.id,
    name: value.name,
    location: {
      latitude: location.latitude,
      longitude: location.longitude,
    },
    address: isObject(value.address) ? (value.address as Spot["address"]) : null,
    phone: typeof value.phone === "string" ? value.phone : null,
    website: typeof value.website === "string" ? value.website : null,
    openingHours: typeof value.openingHours === "string" ? value.openingHours : null,
    amenity: typeof value.amenity === "string" ? value.amenity : null,
    cuisine: typeof value.cuisine === "string" ? value.cuisine : null,
    dailyDeals,
    happyHours,
    source: isObject(value.source) ? (value.source as Spot["source"]) : undefined,
  };

  return spot;
};

export const parseBusinessesPayload = (
  value: unknown,
): { ok: true; payload: BusinessesPayload } | { ok: false; error: string } => {
  if (!isObject(value)) return { ok: false, error: "Payload must be an object" };
  if (typeof value.updatedAt !== "string" || !value.updatedAt) {
    return { ok: false, error: "Payload.updatedAt must be a string" };
  }
  if (!Array.isArray(value.businesses)) return { ok: false, error: "Payload.businesses must be an array" };

  const businesses = value.businesses.map(normalizeBusiness).filter((b): b is Spot => Boolean(b));
  if (businesses.length !== value.businesses.length) {
    return { ok: false, error: "One or more businesses failed validation" };
  }

  const ids = new Set<string>();
  for (const business of businesses) {
    if (ids.has(business.id)) return { ok: false, error: `Duplicate business id: ${business.id}` };
    ids.add(business.id);
  }

  return { ok: true, payload: { updatedAt: value.updatedAt, businesses } };
};
