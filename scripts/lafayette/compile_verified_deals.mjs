#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function usage(exitCode) {
  console.log(
    [
      "Usage: ./scripts/lafayette/compile_verified_deals.mjs --review <review.json> --out <out.ts>",
      "",
      "Defaults:",
      "- review: ./data/review/lafayette_deals_review_2026-03-16.json",
      "- out:    ./data/deals.lafayette.verified.ts",
      "",
      "Compiles only entries with publish=true.",
    ].join("\n"),
  );
  process.exit(exitCode);
}

function parseArgs(argv) {
  const args = {
    review: "./data/review/lafayette_deals_review_2026-03-16.json",
    out: "./data/deals.lafayette.verified.ts",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--review") args.review = argv[++i];
    else if (arg === "--out") args.out = argv[++i];
    else if (arg === "--help") return null;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (!args) usage(0);

const WEEKDAYS = new Set(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
const TIME_RE = /^\d{2}:\d{2}$/;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function validateHappyHours(spotId, happyHours) {
  const errors = [];
  if (!Array.isArray(happyHours)) return [`${spotId}: happyHours must be an array`];

  for (const [index, window] of happyHours.entries()) {
    if (!window || typeof window !== "object") {
      errors.push(`${spotId}: happyHours[${index}] must be an object`);
      continue;
    }

    const days = window.days;
    if (!Array.isArray(days) || days.length === 0 || !days.every((d) => WEEKDAYS.has(d))) {
      errors.push(`${spotId}: happyHours[${index}].days must be Weekday[]`);
    }

    if (typeof window.start !== "string" || !TIME_RE.test(window.start)) {
      errors.push(`${spotId}: happyHours[${index}].start must be HH:MM`);
    }
    if (typeof window.end !== "string" || !TIME_RE.test(window.end)) {
      errors.push(`${spotId}: happyHours[${index}].end must be HH:MM`);
    }

    if (!Array.isArray(window.items) || window.items.some((x) => typeof x !== "string")) {
      errors.push(`${spotId}: happyHours[${index}].items must be string[]`);
    }
  }

  return errors;
}

function validateDailyDeals(spotId, dailyDeals) {
  const errors = [];
  if (!Array.isArray(dailyDeals)) return [`${spotId}: dailyDeals must be an array`];

  for (const [index, deal] of dailyDeals.entries()) {
    if (!deal || typeof deal !== "object") {
      errors.push(`${spotId}: dailyDeals[${index}] must be an object`);
      continue;
    }

    if (typeof deal.day !== "string" || !WEEKDAYS.has(deal.day)) {
      errors.push(`${spotId}: dailyDeals[${index}].day must be Weekday`);
    }
    if (!Array.isArray(deal.items) || deal.items.some((x) => typeof x !== "string")) {
      errors.push(`${spotId}: dailyDeals[${index}].items must be string[]`);
    }
  }

  return errors;
}

const review = readJson(args.review);
const entries = Array.isArray(review?.entries) ? review.entries : [];

const dealsBySpotId = {};
const errors = [];

for (const entry of entries) {
  if (!entry?.publish) continue;
  const spotId = entry.spotId;
  if (typeof spotId !== "string" || !spotId) {
    errors.push("Entry missing spotId");
    continue;
  }

  const dailyDeals = Array.isArray(entry.dailyDeals) ? entry.dailyDeals : [];
  const happyHours = Array.isArray(entry.happyHours) ? entry.happyHours : [];

  errors.push(...validateDailyDeals(spotId, dailyDeals));
  errors.push(...validateHappyHours(spotId, happyHours));

  dealsBySpotId[spotId] = { dailyDeals, happyHours };
}

if (errors.length > 0) {
  console.error("Validation failed:");
  for (const err of errors) console.error(`- ${err}`);
  process.exit(1);
}

const compiledAt = new Date().toISOString();

const ts = `// Generated from human-verified deal review\n` +
  `// Compiled at: ${compiledAt}\n\n` +
  `import type { Spot } from "./spots";\n\n` +
  `export const DEALS_VERIFIED_AT = ${JSON.stringify(compiledAt)};\n\n` +
  `export const DEALS_BY_SPOT_ID: Record<string, Pick<Spot, "dailyDeals" | "happyHours">> = ${JSON.stringify(
    dealsBySpotId,
    null,
    2,
  )};\n`;

fs.mkdirSync(path.dirname(args.out), { recursive: true });
fs.writeFileSync(args.out, ts);
console.log(`Wrote ${Object.keys(dealsBySpotId).length} spots with deals -> ${args.out}`);
