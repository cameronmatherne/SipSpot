#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function usageAndExit() {
  console.error("Usage: node scripts/lafayette/spots_json_to_ts.mjs <spots.json> <out.ts>");
  process.exit(2);
}

const [, , inFile, outFile] = process.argv;
if (!inFile || !outFile) usageAndExit();

const payload = JSON.parse(fs.readFileSync(inFile, "utf8"));
const spots = Array.isArray(payload?.spots) ? payload.spots : [];
const fetchedAt = typeof payload?.fetchedAt === "string" ? payload.fetchedAt : new Date().toISOString();

const header = `// Generated from OpenStreetMap (Overpass) on ${new Date(fetchedAt).toISOString()}\n` +
  `// Do not edit by hand; re-run scripts/lafayette/*\n\n` +
  `import type { Spot } from "./spots";\n\n` +
  `export const LAFAYETTE_FETCHED_AT = ${JSON.stringify(fetchedAt)};\n\n` +
  `export const SPOTS: Spot[] = ${JSON.stringify(spots, null, 2)};\n`;

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, header);
console.log(`Wrote TS -> ${outFile}`);
