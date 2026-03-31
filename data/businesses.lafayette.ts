import type { Spot } from "./spots";
import payload from "./businesses.lafayette.json";
import { parseBusinessesPayload, type BusinessesPayload } from "./businessesSchema";

const parsed = parseBusinessesPayload(payload as unknown);

const fallback: BusinessesPayload = {
  updatedAt: new Date().toISOString(),
  businesses: [],
};

if (!parsed.ok) {
  console.warn(`Invalid bundled businesses payload: ${parsed.error}`);
}

export const BUSINESSES_UPDATED_AT = parsed.ok ? parsed.payload.updatedAt : fallback.updatedAt;
export const BUSINESSES: Spot[] = (parsed.ok ? parsed.payload.businesses : fallback.businesses) as Spot[];
