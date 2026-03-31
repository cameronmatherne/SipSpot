#!/usr/bin/env node
/**
 * Discovers bars/restaurants via Google Places Text Search (Legacy) using city-based queries.
 *
 * Outputs:
 * - Names+address TXT (tab-separated):  data/generated/google_places_food_drink_by_cities_<date>.txt
 * - Names-only TXT (deduped):          data/generated/google_places_food_drink_by_cities_names_only_<date>.txt
 * - Debug JSON:                        data/generated/google_places_food_drink_by_cities_debug_<date>.json
 *
 * Requirements:
 * - GOOGLE_MAPS_API_KEY env var (Places API enabled, billing on)
 *
 * Notes:
 * - Text Search is capped; multiple queries improve coverage.
 * - Filters results by the city in formatted_address before "LA".
 * - Dedupe by place_id for debug; names-only is deduped by name ignoring case.
 * - You must comply with Google Maps Platform terms.
 */

import fs from "node:fs";
import path from "node:path";

function usage(exitCode) {
  console.log(
    [
      "Usage:",
      "  GOOGLE_MAPS_API_KEY=... ./scripts/lafayette/google_places_food_drink_by_cities_legacy.mjs",
      "",
      "Options:",
      "  --cities <csv>       Override cities list",
      "  --qps <n>            Approx requests/second (default: 4)",
      "  --out <file.txt>     Names+address output",
      "  --names-out <file>   Names-only output",
      "  --json-out <file>    Debug JSON output",
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
    qps: 4,
    out: "",
    namesOut: "",
    jsonOut: "",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--cities") {
      args.cities = String(argv[++i] ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (arg === "--qps") args.qps = Number(argv[++i] ?? "4");
    else if (arg === "--out") args.out = String(argv[++i] ?? "");
    else if (arg === "--names-out") args.namesOut = String(argv[++i] ?? "");
    else if (arg === "--json-out") args.jsonOut = String(argv[++i] ?? "");
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
  path.join(rootDir, "data", "generated", `google_places_food_drink_by_cities_${stamp}.txt`);
const namesOutFile =
  args.namesOut ||
  path.join(
    rootDir,
    "data",
    "generated",
    `google_places_food_drink_by_cities_names_only_${stamp}.txt`,
  );
const jsonOutFile =
  args.jsonOut ||
  path.join(
    rootDir,
    "data",
    "generated",
    `google_places_food_drink_by_cities_debug_${stamp}.json`,
  );

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

function requireOkStatus(json, context) {
  const status = json?.status;
  if (!status) return;
  if (status === "REQUEST_DENIED") {
    const msg = json?.error_message ? `: ${json.error_message}` : "";
    throw new Error(`Google Places REQUEST_DENIED${msg} (${context})`);
  }
  if (status === "INVALID_REQUEST" && json?.error_message) {
    throw new Error(`Google Places INVALID_REQUEST: ${json.error_message} (${context})`);
  }
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

  // Retry a bit for transient OVER_QUERY_LIMIT.
  let first;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    first = await fetchJson(firstUrl);
    const status = first.json?.status;
    if (status === "OVER_QUERY_LIMIT") {
      await sleep(attempt * 1500);
      continue;
    }
    requireOkStatus(first.json, `query="${query}"`);
    break;
  }

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
      if (status === "OVER_QUERY_LIMIT") {
        await sleep(tries * 1500);
        continue;
      }
      requireOkStatus(res.json, `query="${query}" page=${page}`);
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

// Query variety helps coverage; keep this list short enough to avoid runaway costs.
const queryTemplates = [
  (city) => `bar in ${city}, LA`,
  (city) => `pub in ${city}, LA`,
  (city) => `cocktail bar in ${city}, LA`,
  (city) => `sports bar in ${city}, LA`,
  (city) => `nightclub in ${city}, LA`,
  (city) => `lounge in ${city}, LA`,
  (city) => `brewery in ${city}, LA`,
  (city) => `restaurant in ${city}, LA`,
];

const startedAt = new Date().toISOString();
const placeById = new Map();
const queryStats = [];

let requestsAttempted = 0;
let pagesFetched = 0;

const totalQueries = args.cities.length * queryTemplates.length;
console.log(`Cities: ${args.cities.join(", ")}`);
console.log(`Queries: ${totalQueries} (templates=${queryTemplates.length} per city)`);
console.log(`Outputs:`);
console.log(`- Names+address: ${outFile}`);
console.log(`- Names only:    ${namesOutFile}`);
console.log(`- Debug JSON:    ${jsonOutFile}`);

let queryIndex = 0;
for (const city of args.cities) {
  for (const template of queryTemplates) {
    queryIndex += 1;
    const query = template(city);
    await sleep(1100 / Math.max(1, args.qps));
    requestsAttempted += 1;

    let pages;
    try {
      pages = await fetchAllPages({ query, qps: args.qps });
    } catch (err) {
      console.warn(`Fetch failed: query="${query}": ${String(err)}`);
      continue;
    }

    pagesFetched += pages.length;
    const statuses = {};
    for (const page of pages) {
      const st = page?.status ?? "UNKNOWN";
      statuses[st] = (statuses[st] ?? 0) + 1;

      const results = Array.isArray(page?.results) ? page.results : [];
      for (const r of results) {
        const placeId = r.place_id;
        const name = r.name;
        if (!placeId || !name) continue;
        if (placeById.has(placeId)) continue;

        placeById.set(placeId, {
          place_id: placeId,
          name,
          formatted_address: r.formatted_address ?? null,
          types: r.types ?? [],
          business_status: r.business_status ?? null,
          query,
        });
      }
    }

    queryStats.push({ query, statuses });

    const uniqueSoFar = placeById.size;
    const statusSummary = Object.entries(statuses)
      .map(([k, v]) => `${k}:${v}`)
      .join(" ");
    console.log(`[${queryIndex}/${totalQueries}] uniquePlaces=${uniqueSoFar} ${statusSummary} :: ${query}`);
  }
}

const allPlaces = [...placeById.values()];

const placesInAllowedCities = allPlaces.filter((p) => {
  const city = cityFromFormattedAddress(p.formatted_address);
  if (!city) return false;
  return allowedCityKeys.has(normKey(city));
});

// Write the requested "names + addresses" list. Dedupe by place_id.
placesInAllowedCities.sort((a, b) =>
  String(a.name).localeCompare(String(b.name), undefined, { sensitivity: "base" }),
);

const linesWithAddr = placesInAllowedCities.map((p) => {
  const addr = p.formatted_address ?? "";
  return addr ? `${p.name}\t${addr}` : p.name;
});

// Names-only, deduped by name ignoring case.
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

const finishedAt = new Date().toISOString();

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, linesWithAddr.join("\n") + "\n");

fs.mkdirSync(path.dirname(namesOutFile), { recursive: true });
fs.writeFileSync(namesOutFile, uniqueNames.join("\n") + "\n");

fs.mkdirSync(path.dirname(jsonOutFile), { recursive: true });
fs.writeFileSync(
  jsonOutFile,
  JSON.stringify(
    {
      startedAt,
      finishedAt,
      cities: args.cities,
      allowedCities: args.cities,
      queries: queryTemplates.map((t) => args.cities.map((c) => t(c))).flat(),
      queryStats,
      requestsAttempted,
      pagesFetched,
      uniquePlacesAll: allPlaces.length,
      uniquePlacesInAllowedCities: placesInAllowedCities.length,
      uniqueNamesInAllowedCities: uniqueNames.length,
      places: placesInAllowedCities,
    },
    null,
    2,
  ),
);

console.log(`Wrote ${placesInAllowedCities.length} places (with addresses) -> ${outFile}`);
console.log(`Wrote ${uniqueNames.length} unique names (no addresses) -> ${namesOutFile}`);
console.log(`Wrote debug JSON -> ${jsonOutFile}`);
