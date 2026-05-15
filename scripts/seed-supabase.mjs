#!/usr/bin/env node
/**
 * Parses lafayette_places.txt and upserts all spots into Supabase.
 *
 * Usage:
 *   node scripts/seed-supabase.mjs                   # full upsert (overwrites everything)
 *   node scripts/seed-supabase.mjs --sync             # insert NEW spots only, skip existing
 *   node scripts/seed-supabase.mjs --sync-deals       # insert new spots AND refresh
 *                                                     # daily_deals/happy_hours for all spots
 *                                                     # that have data in the txt file;
 *                                                     # never touches lat/lng or other fields
 *   node scripts/seed-supabase.mjs --sync [path]      # supply alternate txt file path
 *
 * Use --sync-deals whenever you have added deal/happy-hour data to the txt file
 * for spots that already exist in Supabase (e.g. spots that were previously
 * inserted with name-only and now have deals filled in).
 *
 * Reads EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from your .env
 * file (or from the environment directly). The service role key is required to
 * bypass Row Level Security — find it in Supabase dashboard → Settings → API.
 * Never prefix it with EXPO_PUBLIC_ (it must stay server-side only).
 */

import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";

// ---------------------------------------------------------------------------
// Load .env
// ---------------------------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", ".env");
try {
  const env = readFileSync(envPath, "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) process.env[m[1]] = m[2].trim();
  }
} catch {
  // .env missing — fall through to env vars already in the environment
}

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
// Service role key bypasses RLS — required for seeding.
// Get it from: Supabase dashboard → Settings → API → service_role (secret)
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!SUPABASE_URL || SUPABASE_URL === "<YOUR_SUPABASE_URL>") {
  console.error("Error: EXPO_PUBLIC_SUPABASE_URL is not set. Update your .env file.");
  process.exit(1);
}
if (!SUPABASE_SERVICE_KEY) {
  console.error(
    "Error: SUPABASE_SERVICE_ROLE_KEY is not set.\n" +
    "Find it in Supabase dashboard → Settings → API → service_role key.\n" +
    "Add it to your .env file as:\n" +
    "  SUPABASE_SERVICE_ROLE_KEY=eyJ...",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

const DAY_NAMES = {
  sunday: "Sun", sun: "Sun",
  monday: "Mon", mon: "Mon",
  tuesday: "Tue", tue: "Tue",
  wednesday: "Wed", wed: "Wed",
  thursday: "Thu", thu: "Thu",
  friday: "Fri", fri: "Fri",
  saturday: "Sat", sat: "Sat",
};

const DAY_ORDER = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parseDays(str) {
  const s = str.trim().toLowerCase().replace(/\s+/g, " ");
  if (s === "every day" || s === "daily" || s === "all week") {
    return [...DAY_ORDER];
  }
  // Range: "Monday-Friday"
  const rangeM = s.match(/^([a-z]+)\s*[-–]\s*([a-z]+)$/);
  if (rangeM) {
    const start = DAY_NAMES[rangeM[1]];
    const end = DAY_NAMES[rangeM[2]];
    if (start && end) {
      const si = DAY_ORDER.indexOf(start);
      const ei = DAY_ORDER.indexOf(end);
      if (si <= ei) return DAY_ORDER.slice(si, ei + 1);
      // Wraps around the week (e.g. Wed-Sun then Sun wraps to Sun)
      return [...DAY_ORDER.slice(si), ...DAY_ORDER.slice(0, ei + 1)];
    }
  }
  // Comma/& separated
  const parts = s.split(/[,&]/).map((p) => DAY_NAMES[p.trim()]).filter(Boolean);
  if (parts.length > 0) return parts;
  // Single day
  const single = DAY_NAMES[s];
  if (single) return [single];
  return null;
}

function parseTime(str) {
  const s = str.trim().toLowerCase();
  if (!s || s === "close" || s === "closing" || s === "midnight") return null;
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!m) return null;
  let hours = parseInt(m[1], 10);
  const minutes = m[2] ? parseInt(m[2], 10) : 0;
  const period = m[3];
  if (period === "pm" && hours !== 12) hours += 12;
  else if (period === "am" && hours === 12) hours = 0;
  else if (!period && hours >= 1 && hours <= 7) hours += 12; // assume PM for small ambiguous hours
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function parseTimeRange(str) {
  const m = str
    .trim()
    .match(/^(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*[-–]\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|close)/i);
  if (!m) return null;
  const start = parseTime(m[1]);
  const end = parseTime(m[2]);
  if (!start || !end) return null;
  return { start, end };
}

function parseDaysAndTimeLine(line) {
  // "Monday-Friday 4pm-6pm" or "Every day 3pm-6pm, all day Monday" (take first clause)
  const firstClause = line.trim().split(",")[0].trim();
  const m = firstClause.match(
    /^(.+?)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*[-–]\s*(?:\d{1,2}(?::\d{2})?\s*(?:am|pm)?|close))$/i,
  );
  if (!m) return null;
  const days = parseDays(m[1]);
  const timeRange = parseTimeRange(m[2]);
  if (!days || !timeRange) return null;
  return { days, ...timeRange };
}

function parseDailySpecialLine(line) {
  // "Monday: some text" — the colon is required to distinguish a day header
  // from a continuation line.
  const m = line
    .trim()
    .match(/^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\s*:\s*(.*)$/i);
  if (!m) return null;
  const day = DAY_NAMES[m[1].toLowerCase()];
  const item = m[2].trim();
  return { day, item: item || null }; // item may be empty (day header only)
}

function toSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/, "");
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

function parseSpots(text) {
  const lines = text.split("\n");
  const spots = [];

  let current = null;
  let section = null; // "happy_hour" | "daily_deals" | null
  let currentHH = null; // { days, start, end, items[] }

  const flushHH = () => {
    if (currentHH && currentHH.items.length > 0) {
      current.happy_hours.push(currentHH);
    }
    currentHH = null;
  };

  const saveSpot = () => {
    if (!current) return;
    flushHH();
    const name = current.name
      .replace(/\s*[-–]\s*(unfinished|incomplete|wip|tbd)\s*$/i, "")
      .replace(/\s+[&]\s*$/, "")
      .trim();
    if (!name) return;
    // Convert daily_deals map -> array
    const daily_deals = Object.entries(current.daily_deals_map).map(([day, data]) => ({
      day,
      ...(data.start && data.end ? { start: data.start, end: data.end } : {}),
      items: data.items,
    }));
    spots.push({ name, happy_hours: current.happy_hours, daily_deals });
    current = null;
  };

  for (const rawLine of lines) {
    const isIndented = /^[\t ]/.test(rawLine);
    const line = rawLine.trim();
    if (!line) continue;

    if (!isIndented) {
      saveSpot();
      current = { name: line, happy_hours: [], daily_deals_map: {} };
      section = null;
      currentHH = null;
      continue;
    }

    if (!current) continue;

    // Detect section headers
    if (/^happy\s*hour/i.test(line)) {
      flushHH();
      section = "happy_hour";
      continue;
    }
    if (/^(daily|weekly|food)\s*specials?/i.test(line)) {
      section = "daily_deals";
      continue;
    }

    if (section === "happy_hour") {
      const parsed = parseDaysAndTimeLine(line);
      if (parsed) {
        flushHH();
        currentHH = { days: parsed.days, start: parsed.start, end: parsed.end, items: [] };
      } else if (currentHH) {
        // Continuation / deal item line within the current HH window.
        currentHH.items.push(line);
      }
      // Lines that look like section headers or are unparseable before any
      // window header are silently skipped (e.g. bare "Happy hour:" line).
    } else if (section === "daily_deals") {
      const parsed = parseDailySpecialLine(line);
      if (parsed) {
        if (!current.daily_deals_map[parsed.day]) {
          current.daily_deals_map[parsed.day] = { items: [] };
        }
        // An empty item means it was a bare "Monday:" header — skip it.
        if (parsed.item) {
          current.daily_deals_map[parsed.day].items.push(parsed.item);
        }
        // Track the last-seen day so continuation lines can append to it.
        current._lastDealDay = parsed.day;
      } else if (current._lastDealDay) {
        // Continuation line (e.g. a second indented line after "Thursday: …").
        // Append it to the most recent day's items if it has actual content
        // and doesn't look like a new section header.
        if (line && !/^(happy\s*hour|(daily|weekly|food)\s*specials?)/i.test(line)) {
          current.daily_deals_map[current._lastDealDay].items.push(line);
        }
      }
    }
  }

  saveSpot();
  return spots;
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const syncMode = args.includes("--sync");
  const syncDealsMode = args.includes("--sync-deals");
  const fileArg = args.find((a) => !a.startsWith("--"));
  const filePath = fileArg ?? resolve(join(__dirname, "..", "lafayette_places.txt"));

  let text;
  try {
    text = readFileSync(filePath, "utf8");
  } catch (err) {
    console.error(`Could not read file: ${filePath}\n${err.message}`);
    process.exit(1);
  }

  const rawSpots = parseSpots(text);
  console.log(`Parsed ${rawSpots.length} spots from text file.`);

  // Build rows and deduplicate by id.
  const seen = new Set();
  const rows = [];
  for (const spot of rawSpots) {
    const id = toSlug(spot.name);
    if (seen.has(id)) continue;
    seen.add(id);
    rows.push({
      id,
      market: "lafayette",
      name: spot.name,
      latitude: null,
      longitude: null,
      daily_deals: spot.daily_deals,
      happy_hours: spot.happy_hours,
    });
  }

  const CHUNK = 50;

  // ── --sync-deals ────────────────────────────────────────────────────────────
  // Insert brand-new spots AND update daily_deals/happy_hours for existing
  // spots that have deal data in the txt file. Never touches lat/lng.
  if (syncDealsMode) {
    console.log("Sync-deals mode: fetching existing spots from Supabase...");
    const { data: existing, error: fetchError } = await supabase
      .from("spots")
      .select("id")
      .eq("market", "lafayette");
    if (fetchError) {
      console.error(`Failed to fetch existing spots: ${fetchError.message}`);
      process.exit(1);
    }
    const existingIds = new Set((existing ?? []).map((r) => r.id));

    const toInsert = rows.filter((r) => !existingIds.has(r.id));
    const toUpdateDeals = rows.filter(
      (r) =>
        existingIds.has(r.id) &&
        (r.daily_deals.length > 0 || r.happy_hours.length > 0),
    );

    console.log(`  ${existingIds.size} already in database.`);
    console.log(`  ${toInsert.length} new spot(s) to insert.`);
    console.log(`  ${toUpdateDeals.length} existing spot(s) with deals to refresh.`);

    // Insert new spots.
    if (toInsert.length > 0) {
      console.log("\nInserting new spots...");
      for (let i = 0; i < toInsert.length; i += CHUNK) {
        const chunk = toInsert.slice(i, i + CHUNK);
        const { error } = await supabase.from("spots").insert(chunk);
        if (error) {
          console.error(`Insert error at offset ${i}: ${error.message}`);
          process.exit(1);
        }
        console.log(`  ${Math.min(i + CHUNK, toInsert.length)} / ${toInsert.length}`);
      }
    }

    // Update deals/happy_hours only for existing spots.
    if (toUpdateDeals.length > 0) {
      console.log("\nRefreshing deals/happy_hours for existing spots...");
      for (let i = 0; i < toUpdateDeals.length; i += CHUNK) {
        const chunk = toUpdateDeals.slice(i, i + CHUNK);
        // upsert with onConflict:id will update only the supplied columns.
        const { error } = await supabase.from("spots").upsert(
          chunk.map((r) => ({
            id: r.id,
            name: r.name,
            market: "lafayette",
            daily_deals: r.daily_deals,
            happy_hours: r.happy_hours,
          })),
          { onConflict: "id" },
        );
        if (error) {
          console.error(`Update error at offset ${i}: ${error.message}`);
          process.exit(1);
        }
        console.log(`  ${Math.min(i + CHUNK, toUpdateDeals.length)} / ${toUpdateDeals.length}`);
        // Log which spots were updated so you can verify.
        chunk.forEach((r) => console.log(`    ✓ ${r.name}`));
      }
    }

    console.log("\nDone!");
    return;
  }

  // ── --sync ──────────────────────────────────────────────────────────────────
  // Insert NEW spots only; never touch existing rows.
  if (syncMode) {
    console.log("Sync mode: fetching existing spot IDs from Supabase...");
    const { data: existing, error: fetchError } = await supabase
      .from("spots")
      .select("id")
      .eq("market", "lafayette");
    if (fetchError) {
      console.error(`Failed to fetch existing spots: ${fetchError.message}`);
      process.exit(1);
    }
    const existingIds = new Set((existing ?? []).map((r) => r.id));
    const toInsert = rows.filter((r) => !existingIds.has(r.id));
    console.log(
      `  ${existingIds.size} already in database, ${toInsert.length} new spot(s) to insert.`,
    );
    if (toInsert.length === 0) {
      console.log("Nothing to insert. Database is up to date.");
      return;
    }
    for (let i = 0; i < toInsert.length; i += CHUNK) {
      const chunk = toInsert.slice(i, i + CHUNK);
      const { error } = await supabase.from("spots").insert(chunk);
      if (error) {
        console.error(`Error at offset ${i}: ${error.message}`);
        process.exit(1);
      }
      console.log(`  ${Math.min(i + CHUNK, toInsert.length)} / ${toInsert.length}`);
    }
    console.log("Done!");
    const withDeals = toInsert.filter((r) => r.daily_deals.length > 0 || r.happy_hours.length > 0);
    console.log(`  ${withDeals.length} new spot(s) have parsed deals/happy hours.`);
    console.log(
      `  ${toInsert.length - withDeals.length} new spot(s) have name only (add coords + deals in the Supabase dashboard).`,
    );
    return;
  }

  // ── full upsert (default) ───────────────────────────────────────────────────
  console.log(`Upserting ${rows.length} unique spots (full seed, overwrites everything)...`);
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await supabase.from("spots").upsert(chunk, { onConflict: "id" });
    if (error) {
      console.error(`Error at offset ${i}: ${error.message}`);
      process.exit(1);
    }
    console.log(`  ${Math.min(i + CHUNK, rows.length)} / ${rows.length}`);
  }
  console.log("Done!");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
