#!/usr/bin/env node
/**
 * scripts/fetch-ratings.mjs
 *
 * Looks up each spot on Google Places and writes rating, review_count, and
 * price_level back to Supabase.  Ratings don't change minute-to-minute, so
 * running this once a week (or on demand) is plenty.
 *
 * Usage
 * ─────
 *   node scripts/fetch-ratings.mjs               # update ALL spots
 *   node scripts/fetch-ratings.mjs --missing      # only spots with no rating yet
 *
 * Required .env variables
 * ───────────────────────
 *   EXPO_PUBLIC_SUPABASE_URL   – your Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY  – service-role key (bypasses RLS)
 *   GOOGLE_PLACES_API_KEY      – Google Places API key (see below)
 *
 * Getting a Google Places API key (free for this scale)
 * ─────────────────────────────────────────────────────
 *   1. Go to https://console.cloud.google.com/
 *   2. Create (or select) a project
 *   3. Go to "APIs & Services" → "Enable APIs" → search "Places API (New)" → Enable
 *   4. Go to "APIs & Services" → "Credentials" → "+ Create Credentials" → API key
 *   5. Copy the key and add it to your .env:
 *        GOOGLE_PLACES_API_KEY=AIza...
 *
 * Cost: Text Search (New) costs $0.032/request.  Google gives $200/month free
 * credit, so ~200 spots costs about $6.40 — completely covered by the credit.
 * You won't be charged unless you exceed $200/month of usage.
 */

import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// ─── Load .env ───────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const env = readFileSync(join(__dirname, "..", ".env"), "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) process.env[m[1]] = m[2].trim();
  }
} catch { /* .env missing — fall through */ }

const SUPABASE_URL       = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY       = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const GOOGLE_API_KEY     = process.env.GOOGLE_PLACES_API_KEY ?? "";
const MARKET             = process.env.EXPO_PUBLIC_MARKET ?? "lafayette";

// Approximate center of the market — used to bias search results locally.
// Lafayette, LA
const MARKET_LAT = 30.2241;
const MARKET_LNG = -92.0198;
// Search radius in metres — 25 km covers the whole Lafayette metro area.
const SEARCH_RADIUS_M = 25000;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}
if (!GOOGLE_API_KEY) {
  console.error(
    "Missing GOOGLE_PLACES_API_KEY in .env\n" +
    "Get one at: https://console.cloud.google.com/\n" +
    "Enable 'Places API (New)', then create an API key under Credentials.\n" +
    "Then add:  GOOGLE_PLACES_API_KEY=AIza..."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

// ─── Price level mapping ──────────────────────────────────────────────────────
// Google Places (New) returns an enum string; map it to dollar signs.
const PRICE_LEVEL_MAP = {
  PRICE_LEVEL_FREE:           "$",    // rarely returned for restaurants
  PRICE_LEVEL_INEXPENSIVE:    "$",
  PRICE_LEVEL_MODERATE:       "$$",
  PRICE_LEVEL_EXPENSIVE:      "$$$",
  PRICE_LEVEL_VERY_EXPENSIVE: "$$$$",
};

// ─── Google Places Text Search (New) ─────────────────────────────────────────

/**
 * Search Google Places for a business by name, biased to the market location.
 * Returns { rating, review_count, price_level, latitude, longitude, matched_name } or null.
 *
 * Docs: https://developers.google.com/maps/documentation/places/web-service/text-search
 */
async function fetchGoogleRating(name) {
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type":    "application/json",
      "X-Goog-Api-Key":  GOOGLE_API_KEY,
      // Only request the fields we need — minimises billable field usage.
      "X-Goog-FieldMask": "places.displayName,places.rating,places.userRatingCount,places.priceLevel,places.location",
    },
    body: JSON.stringify({
      textQuery: `${name} Lafayette LA`,
      maxResultCount: 1,
      locationBias: {
        circle: {
          center: { latitude: MARKET_LAT, longitude: MARKET_LNG },
          radius: SEARCH_RADIUS_M,
        },
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Places API error ${res.status}: ${body}`);
  }

  const json = await res.json();
  const place = json.places?.[0];
  if (!place) return null;

  const matched_name = place.displayName?.text ?? "";

  // Basic sanity check — if the first significant word of the query doesn't
  // appear anywhere in the result name (or vice versa), skip it.
  const firstWord = name.toLowerCase().split(/[\s,&'-]+/).find((w) => w.length > 2) ?? "";
  if (
    firstWord &&
    !matched_name.toLowerCase().includes(firstWord) &&
    !name.toLowerCase().includes(matched_name.toLowerCase().split(/[\s,&'-]+/).find((w) => w.length > 2) ?? "")
  ) {
    return null;
  }

  return {
    rating:       place.rating               ?? null,
    review_count: place.userRatingCount      ?? null,
    price_level:  PRICE_LEVEL_MAP[place.priceLevel] ?? null,
    latitude:     place.location?.latitude   ?? null,
    longitude:    place.location?.longitude  ?? null,
    matched_name,
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const missingOnly = process.argv.includes("--missing");

  console.log(`Fetching spots from Supabase (market: ${MARKET})…`);
  let query = supabase.from("spots").select("id, name, rating, latitude, longitude").eq("market", MARKET);
  if (missingOnly) query = query.is("rating", null);

  const { data: spots, error } = await query;
  if (error) { console.error("Supabase fetch failed:", error.message); process.exit(1); }
  console.log(`  ${spots.length} spot(s) to process.\n`);

  let updated = 0;
  let skipped = 0;
  let failed  = 0;

  for (let i = 0; i < spots.length; i++) {
    const spot = spots[i];
    process.stdout.write(`[${i + 1}/${spots.length}] ${spot.name} … `);

    try {
      const result = await fetchGoogleRating(spot.name);

      if (!result) {
        console.log("not found on Google Places, skipping.");
        skipped++;
      } else {
        // Only write coordinates if the spot doesn't have them yet (lat = 0).
        // This avoids overwriting coordinates you've manually corrected.
        const noCoords = !spot.latitude || spot.latitude === 0;
        const coordsUpdate = (noCoords && result.latitude != null)
          ? { latitude: result.latitude, longitude: result.longitude }
          : {};

        const { error: updateError } = await supabase
          .from("spots")
          .update({
            rating:       result.rating,
            review_count: result.review_count,
            price_level:  result.price_level,
            ...coordsUpdate,
          })
          .eq("id", spot.id);

        if (updateError) {
          console.log(`DB update error: ${updateError.message}`);
          failed++;
        } else {
          const priceStr = result.price_level ? `  ${result.price_level}` : "";
          const countStr = result.review_count != null
            ? ` (${result.review_count >= 1000
                ? `${(result.review_count / 1000).toFixed(1)}k`
                : result.review_count} reviews)`
            : "";
          const coordStr = (noCoords && result.latitude != null)
            ? `  📍 ${result.latitude.toFixed(5)}, ${result.longitude.toFixed(5)}`
            : "";
          console.log(`★ ${result.rating ?? "—"}${countStr}${priceStr}${coordStr} ← "${result.matched_name}"`);
          updated++;
        }
      }
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      failed++;
    }

    // Small delay — Google's Places API has generous rate limits but no need to hammer it.
    if (i < spots.length - 1) await sleep(150);
  }

  console.log(`\nDone!  updated: ${updated}  not-found: ${skipped}  errors: ${failed}`);
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
