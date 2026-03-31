#!/usr/bin/env node
/**
 * Best-effort "get everything" discovery using Places Nearby Search (Legacy).
 *
 * Notes:
 * - Nearby Search is capped at 60 results per request (3 pages).
 * - To increase coverage, we scan a grid of overlapping circles and dedupe by place_id.
 * - You must comply with Google Maps Platform terms, including restrictions on storing Place data.
 */

import fs from "node:fs";
import path from "node:path";

function usage(exitCode) {
  console.log(
    [
      "Usage:",
      "  GOOGLE_MAPS_API_KEY=... ./scripts/lafayette/google_places_nearby_legacy.mjs",
      "",
      "Options:",
      "  --center <lat,lon>         (default: 30.2241,-92.0198)",
      "  --radius-miles <n>         (default: 25)",
      "  --cell-radius-m <n>        Per-query radius (default: 5000)",
      "  --step-m <n>               Grid step size (default: 7000)",
      "  --types <csv>              (default: restaurant,bar)",
      "  --out <file.json>          (default: data/generated/google_places_lafayette_<date>.json)",
      "  --names-out <file.txt>     (default: data/generated/google_places_lafayette_names_<date>.txt)",
      "  --max-points <n>           Safety cap (default: 500)",
      "  --qps <n>                  Approx requests/second (default: 5)",
      "  --help",
      "",
      "Tip:",
      "  UTC_DATE=2026-03-16 ... to control output filenames.",
    ].join("\n"),
  );
  process.exit(exitCode);
}

function parseArgs(argv) {
  const args = {
    center: { lat: 30.2241, lon: -92.0198 },
    radiusMiles: 25,
    cellRadiusM: 5000,
    stepM: 7000,
    types: ["restaurant", "bar"],
    out: "",
    namesOut: "",
    maxPoints: 500,
    qps: 5,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--center") {
      const [lat, lon] = String(argv[++i] ?? "").split(",").map(Number);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) usage(2);
      args.center = { lat, lon };
    } else if (arg === "--radius-miles") args.radiusMiles = Number(argv[++i] ?? "25");
    else if (arg === "--cell-radius-m") args.cellRadiusM = Number(argv[++i] ?? "5000");
    else if (arg === "--step-m") args.stepM = Number(argv[++i] ?? "7000");
    else if (arg === "--types")
      args.types = String(argv[++i] ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    else if (arg === "--out") args.out = String(argv[++i] ?? "");
    else if (arg === "--names-out") args.namesOut = String(argv[++i] ?? "");
    else if (arg === "--max-points") args.maxPoints = Number(argv[++i] ?? "500");
    else if (arg === "--qps") args.qps = Number(argv[++i] ?? "5");
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
  args.out || path.join(rootDir, "data", "generated", `google_places_lafayette_${stamp}.json`);
const namesOutFile =
  args.namesOut ||
  path.join(rootDir, "data", "generated", `google_places_lafayette_names_${stamp}.txt`);

const EARTH_R = 6371000;
const milesToMeters = (miles) => miles * 1609.344;

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function haversineMeters(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function gridPoints(center, radiusM, stepM) {
  const degLatStep = stepM / 111320;
  const degLonStep = stepM / (111320 * Math.cos(toRad(center.lat)));

  const degLatRadius = radiusM / 111320;
  const degLonRadius = radiusM / (111320 * Math.cos(toRad(center.lat)));

  const points = [];
  for (let lat = center.lat - degLatRadius; lat <= center.lat + degLatRadius; lat += degLatStep) {
    for (
      let lon = center.lon - degLonRadius;
      lon <= center.lon + degLonRadius;
      lon += degLonStep
    ) {
      const p = { lat, lon };
      // Include points whose query circle intersects the target circle.
      if (haversineMeters(center, p) <= radiusM + args.cellRadiusM) points.push(p);
    }
  }
  return points;
}

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

function buildNearbyUrl({ location, radius, type, pagetoken }) {
  const base = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
  if (pagetoken) {
    base.searchParams.set("pagetoken", pagetoken);
    base.searchParams.set("key", apiKey);
    return base.toString();
  }
  base.searchParams.set("location", `${location.lat},${location.lon}`);
  base.searchParams.set("radius", String(radius));
  base.searchParams.set("type", type);
  base.searchParams.set("key", apiKey);
  return base.toString();
}

async function fetchAllPages({ location, radius, type, qps }) {
  const pages = [];
  let nextToken = null;

  // Page 1
  const firstUrl = buildNearbyUrl({ location, radius, type });
  const first = await fetchJson(firstUrl);
  pages.push(first.json);
  nextToken = first.json?.next_page_token ?? null;

  // Up to 2 more pages
  for (let page = 2; page <= 3 && nextToken; page += 1) {
    // next_page_token has a short delay before it becomes valid.
    let tries = 0;
    while (tries < 6) {
      tries += 1;
      await sleep(1100 / Math.max(1, qps)); // basic throttling
      await sleep(1800); // token warm-up delay

      const url = buildNearbyUrl({ pagetoken: nextToken });
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

const radiusM = milesToMeters(args.radiusMiles);
const points = gridPoints(args.center, radiusM, args.stepM).slice(0, args.maxPoints);

console.log(
  `Grid points=${points.length}, types=${args.types.join(",")}, cellRadius=${args.cellRadiusM}m`,
);

const startedAt = new Date().toISOString();
const placeById = new Map();
let requestCount = 0;
let pageCount = 0;

for (let i = 0; i < points.length; i += 1) {
  const point = points[i];

  for (const type of args.types) {
    // Basic pacing to avoid bursts.
    await sleep(1100 / Math.max(1, args.qps));
    requestCount += 1;

    let pages;
    try {
      pages = await fetchAllPages({
        location: point,
        radius: args.cellRadiusM,
        type,
        qps: args.qps,
      });
    } catch (err) {
      console.warn(`Fetch failed (point ${i + 1}/${points.length}, type=${type}): ${String(err)}`);
      continue;
    }

    pageCount += pages.length;
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
            types: r.types ?? [],
            business_status: r.business_status ?? null,
            permanently_closed: r.permanently_closed ?? null,
            location: r.geometry?.location ?? null,
            vicinity: r.vicinity ?? null,
          });
        }
      }
    }
  }

  if ((i + 1) % 10 === 0) {
    console.log(`Progress: ${i + 1}/${points.length} points, uniquePlaces=${placeById.size}`);
  }
}

const finishedAt = new Date().toISOString();
const places = [...placeById.values()].sort((a, b) => String(a.name).localeCompare(String(b.name)));

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(
  outFile,
  JSON.stringify(
    {
      startedAt,
      finishedAt,
      center: args.center,
      radiusMiles: args.radiusMiles,
      cellRadiusM: args.cellRadiusM,
      stepM: args.stepM,
      types: args.types,
      gridPoints: points.length,
      requestsAttempted: requestCount,
      pagesFetched: pageCount,
      uniquePlaces: places.length,
      places,
    },
    null,
    2,
  ),
);

fs.mkdirSync(path.dirname(namesOutFile), { recursive: true });
fs.writeFileSync(
  namesOutFile,
  places
    .map((p) => {
      // Name + vicinity helps you distinguish multiple locations of the same chain.
      const vicinity = p.vicinity ? `\t${p.vicinity}` : "";
      return `${p.name}${vicinity}`;
    })
    .join("\n") + "\n",
);

console.log(`Wrote ${places.length} unique places -> ${outFile}`);
console.log(`Wrote names list -> ${namesOutFile}`);

