#!/usr/bin/env node
/**
 * Discovers bars via Google Places Text Search (Legacy) using city-based queries.
 *
 * Output:
 * - Names-only TXT (deduped case-insensitively, no addresses)
 * - Debug JSON (places + addresses/types so you can audit coverage)
 *
 * Requirements:
 * - GOOGLE_MAPS_API_KEY env var
 *
 * Notes:
 * - Text Search is capped (pagination); multiple queries improve coverage.
 * - You must comply with Google Maps Platform terms, including data storage restrictions.
 */

import fs from "node:fs";
import path from "node:path";

function usage(exitCode) {
  console.log(
    [
      "Usage:",
      "  GOOGLE_MAPS_API_KEY=... ./scripts/lafayette/google_places_bars_by_city_legacy.mjs",
      "",
      "Options:",
      "  --cities <csv>         Override cities list",
      "  --out <file.txt>       Names-only output",
      "  --json-out <file.json> Debug output",
      "  --qps <n>              Approx requests/second (default: 4)",
      "  --help",
      "",
      "Default cities:",
      "  Carencro, Milton, Youngsville, Broussard, Scott, Lafayette, New Iberia, Sunset",
      "",
      "Tip:",
      "  UTC_DATE=2026-03-16 ... to control output filenames.",
    ].join("\n"),
  );
  process.exit(exitCode);
}

function parseArgs(argv) {
  const args = {
    cities: [
      "Carencro",
      "Milton",
      "Youngsville",
      "Broussard",
      "Scott",
      "Lafayette",
      "New Iberia",
      "Sunset",
    ],
    out: "",
    jsonOut: "",
    qps: 4,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--cities") {
      args.cities = String(argv[++i] ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (arg === "--out") args.out = String(argv[++i] ?? "");
    else if (arg === "--json-out") args.jsonOut = String(argv[++i] ?? "");
    else if (arg === "--qps") args.qps = Number(argv[++i] ?? "4");
    else if (arg === "--help") return null;
  }

  return args;
}

const args = parseArgs(process.argv.slice(2));
if (!args) usage(0);

const apiKey = process.env.GOOGLE_MAPS_API_KEY;
if (!apiKey) {
  console.error("Missing env var GOOGLE_MAPS_API_KEY");
  process.exit(1);
}

const stamp = process.env.UTC_DATE ?? new Date().toISOString().slice(0, 10);
const rootDir = path.resolve(new URL(".", import.meta.url).pathname, "..", "..", "..");

const outFile =
  args.out ||
  path.join(rootDir, "data", "generated", `google_places_bars_by_city_names_${stamp}.txt`);
const jsonOutFile =
  args.jsonOut ||
  path.join(rootDir, "data", "generated", `google_places_bars_by_city_debug_${stamp}.json`);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJson(url) {
  const res = await fetch(url);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON response (${res.status}) from Google`);
  }
  return { status: res.status, json };
}

function buildTextSearchUrl({ query, pagetoken }) {
  const base = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
  if (pagetoken) {
    base.searchParams.set("pagetoken", pagetoken);
    base.searchParams.set("key", apiKey);
    return base.toString();
  }
  base.searchParams.set("query", query);
  base.searchParams.set("region", "us");
  base.searchParams.set("key", apiKey);
  return base.toString();
}

async function fetchAllPages({ query, qps }) {
  const pages = [];
  const firstUrl = buildTextSearchUrl({ query });
  const first = await fetchJson(firstUrl);
  pages.push(first.json);

  let nextToken = first.json?.next_page_token ?? null;
  for (let page = 2; page <= 3 && nextToken; page += 1) {
    // next_page_token has a short delay before it becomes valid.
    let tries = 0;
    while (tries < 6) {
      tries += 1;
      await sleep(1100 / Math.max(1, qps));
      await sleep(1800);
      const url = buildTextSearchUrl({ pagetoken: nextToken });
      const res = await fetchJson(url);
      const status = res.json?.status;
      if (status === "INVALID_REQUEST") continue;
      pages.push(res.json);
      nextToken = res.json?.next_page_token ?? null;
      break;
    }
  }

  return pages;
}

function normKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function cityFromFormattedAddress(address) {
  // Typical: "123 Main St, Lafayette, LA 70501, USA"
  if (!address) return null;
  const m = String(address).match(/,\s*([^,]+),\s*LA\b/i);
  if (!m) return null;
  return m[1].trim();
}

const allowedCityKeys = new Set(args.cities.map((c) => normKey(c)));

const queryTemplates = [
  (city) => `bar in ${city}, LA`,
  (city) => `bars in ${city}, LA`,
  (city) => `pub in ${city}, LA`,
  (city) => `sports bar in ${city}, LA`,
  (city) => `cocktail bar in ${city}, LA`,
  (city) => `wine bar in ${city}, LA`,
  (city) => `brewery in ${city}, LA`,
  (city) => `tavern in ${city}, LA`,
];

const startedAt = new Date().toISOString();

const placeById = new Map();
const debug = {
  startedAt,
  finishedAt: null,
  cities: args.cities,
  queries: [],
  pagesFetched: 0,
  requestsAttempted: 0,
  uniquePlacesAll: 0,
  uniquePlacesInAllowedCities: 0,
  uniqueNamesInAllowedCities: 0,
};

for (const city of args.cities) {
  for (const template of queryTemplates) {
    const query = template(city);
    debug.queries.push(query);

    await sleep(1100 / Math.max(1, args.qps));
    debug.requestsAttempted += 1;

    let pages;
    try {
      pages = await fetchAllPages({ query, qps: args.qps });
    } catch (err) {
      console.warn(`Fetch failed: query="${query}": ${String(err)}`);
      continue;
    }

    debug.pagesFetched += pages.length;

    for (const page of pages) {
      const results = Array.isArray(page?.results) ? page.results : [];
      for (const r of results) {
        const placeId = r.place_id;
        const name = r.name;
        if (!placeId || !name) continue;

        if (!placeById.has(placeId)) {
          placeById.set(placeId, {
            place_id: placeId,
            name,
            formatted_address: r.formatted_address ?? null,
            types: r.types ?? [],
            business_status: r.business_status ?? null,
          });
        }
      }
    }
  }
}

const allPlaces = [...placeById.values()];
debug.uniquePlacesAll = allPlaces.length;

const placesInAllowedCities = allPlaces.filter((p) => {
  const city = cityFromFormattedAddress(p.formatted_address);
  if (!city) return false;
  return allowedCityKeys.has(normKey(city));
});
debug.uniquePlacesInAllowedCities = placesInAllowedCities.length;

// Names-only output, deduped by name ignoring case (user request).
const seenNames = new Set();
const uniqueNames = [];
for (const p of placesInAllowedCities) {
  const key = normKey(p.name);
  if (!key) continue;
  if (seenNames.has(key)) continue;
  seenNames.add(key);
  uniqueNames.push(p.name.trim());
}
uniqueNames.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
debug.uniqueNamesInAllowedCities = uniqueNames.length;

debug.finishedAt = new Date().toISOString();

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, uniqueNames.join("\n") + "\n");

fs.mkdirSync(path.dirname(jsonOutFile), { recursive: true });
fs.writeFileSync(
  jsonOutFile,
  JSON.stringify(
    {
      ...debug,
      places: placesInAllowedCities.sort((a, b) =>
        String(a.name).localeCompare(String(b.name), undefined, { sensitivity: "base" }),
      ),
    },
    null,
    2,
  ),
);

console.log(`Wrote ${uniqueNames.length} unique names -> ${outFile}`);
console.log(`Wrote debug JSON (${placesInAllowedCities.length} places) -> ${jsonOutFile}`);
