#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(new URL(".", import.meta.url).pathname, "..", "..", "..");

function usageAndExit() {
  console.error("Usage: node scripts/lafayette/osm_to_spots.mjs <raw-osm.json> <out.json>");
  process.exit(2);
}

const [, , inFile, outFile] = process.argv;
if (!inFile || !outFile) usageAndExit();

/** @typedef {{type:'node'|'way'|'relation', id:number, lat?:number, lon?:number, center?:{lat:number,lon:number}, tags?:Record<string,string>}} OsmElement */

/** @param {OsmElement} el */
function toLatLon(el) {
  if (typeof el.lat === "number" && typeof el.lon === "number") {
    return { latitude: el.lat, longitude: el.lon };
  }
  if (el.center && typeof el.center.lat === "number" && typeof el.center.lon === "number") {
    return { latitude: el.center.lat, longitude: el.center.lon };
  }
  return null;
}

function normPhone(phone) {
  if (!phone) return null;
  const trimmed = String(phone).trim();
  return trimmed.length ? trimmed : null;
}

function normUrl(url) {
  if (!url) return null;
  const trimmed = String(url).trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function buildAddress(tags = {}) {
  const house = tags["addr:housenumber"];
  const street = tags["addr:street"];
  const city = tags["addr:city"];
  const state = tags["addr:state"];
  const postcode = tags["addr:postcode"];

  if (!house && !street && !city && !state && !postcode) return null;

  return {
    houseNumber: house ?? null,
    street: street ?? null,
    city: city ?? null,
    state: state ?? null,
    postalCode: postcode ?? null,
  };
}

function stableSpotId(el) {
  return `osm-${el.type}-${el.id}`;
}

function parseJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

const payload = parseJson(inFile);
const elements = Array.isArray(payload?.elements) ? payload.elements : [];

const fetchedAt = new Date().toISOString();

const spots = [];
for (const el of elements) {
  const tags = el.tags ?? {};
  const name = tags.name?.trim();
  if (!name) continue;

  const location = toLatLon(el);
  if (!location) continue;

  spots.push({
    id: stableSpotId(el),
    name,
    location,
    address: buildAddress(tags),
    phone: normPhone(tags.phone ?? tags["contact:phone"]),
    website: normUrl(tags.website ?? tags["contact:website"]),
    amenity: tags.amenity ?? null,
    cuisine: tags.cuisine ?? null,
    openingHours: tags.opening_hours ?? null,
    source: {
      provider: "osm",
      fetchedAt,
      osm: {
        type: el.type,
        id: el.id,
      },
    },
    dailyDeals: [],
    happyHours: [],
  });
}

// Dedupe by exact name+lat+lon; keep first.
const seen = new Set();
const deduped = [];
for (const spot of spots) {
  const key = `${spot.name}|${spot.location.latitude.toFixed(6)}|${spot.location.longitude.toFixed(6)}`;
  if (seen.has(key)) continue;
  seen.add(key);
  deduped.push(spot);
}

deduped.sort((a, b) => a.name.localeCompare(b.name));

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify({ fetchedAt, count: deduped.length, spots: deduped }, null, 2));

console.log(`Wrote ${deduped.length} spots -> ${outFile}`);
