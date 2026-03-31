#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function usage(exitCode) {
  console.log(
    [
      "Usage: node scripts/businesses/publish.mjs [options]",
      "",
      "Options:",
      "  --in <file>                 Input JSON (default: ./data/businesses.lafayette.json)",
      "  --out <file>                Output JSON (default: ./dist/businesses.lafayette.json)",
      "  --no-update-timestamp       Keep input updatedAt",
      "  --upload-supabase           Upload to Supabase Storage (requires env vars)",
      "",
      "Supabase env vars for upload:",
      "  SUPABASE_URL",
      "  SUPABASE_SERVICE_ROLE_KEY",
      "  SUPABASE_STORAGE_BUCKET",
      "  SUPABASE_STORAGE_PATH       e.g. businesses/lafayette.json",
    ].join("\n"),
  );
  process.exit(exitCode);
}

function parseArgs(argv) {
  const args = {
    inFile: "./data/businesses.lafayette.json",
    outFile: "./dist/businesses.lafayette.json",
    updateTimestamp: true,
    uploadSupabase: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--in") args.inFile = String(argv[++i] ?? "");
    else if (arg === "--out") args.outFile = String(argv[++i] ?? "");
    else if (arg === "--no-update-timestamp") args.updateTimestamp = false;
    else if (arg === "--upload-supabase") args.uploadSupabase = true;
    else if (arg === "--help") return null;
  }

  if (!args.inFile || !args.outFile) return null;
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (!args) usage(0);

const WEEKDAYS = new Set(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
const TIME_RE = /^\d{2}:\d{2}$/;

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

function validateBusiness(b, index) {
  const errors = [];
  const ctx = `businesses[${index}]`;

  if (!isObject(b)) return [`${ctx} must be an object`];
  if (typeof b.id !== "string" || !b.id) errors.push(`${ctx}.id must be a non-empty string`);
  if (typeof b.name !== "string" || !b.name) errors.push(`${ctx}.name must be a non-empty string`);

  if (!isObject(b.location)) {
    errors.push(`${ctx}.location must be an object`);
  } else {
    if (typeof b.location.latitude !== "number") errors.push(`${ctx}.location.latitude must be number`);
    if (typeof b.location.longitude !== "number") errors.push(`${ctx}.location.longitude must be number`);
  }

  if (b.dailyDeals !== undefined) {
    if (!Array.isArray(b.dailyDeals)) errors.push(`${ctx}.dailyDeals must be an array`);
    else {
      b.dailyDeals.forEach((d, di) => {
        const dctx = `${ctx}.dailyDeals[${di}]`;
        if (!isObject(d)) errors.push(`${dctx} must be an object`);
        else {
          if (typeof d.day !== "string" || !WEEKDAYS.has(d.day)) errors.push(`${dctx}.day must be Weekday`);
          if (d.start !== undefined || d.end !== undefined) {
            if (typeof d.start !== "string" || !TIME_RE.test(d.start)) errors.push(`${dctx}.start must be HH:MM`);
            if (typeof d.end !== "string" || !TIME_RE.test(d.end)) errors.push(`${dctx}.end must be HH:MM`);
          }
          if (!isStringArray(d.items)) errors.push(`${dctx}.items must be string[]`);
        }
      });
    }
  }

  if (b.happyHours !== undefined) {
    if (!Array.isArray(b.happyHours)) errors.push(`${ctx}.happyHours must be an array`);
    else {
      b.happyHours.forEach((w, wi) => {
        const wctx = `${ctx}.happyHours[${wi}]`;
        if (!isObject(w)) errors.push(`${wctx} must be an object`);
        else {
          if (!Array.isArray(w.days) || w.days.length === 0 || !w.days.every((d) => WEEKDAYS.has(d))) {
            errors.push(`${wctx}.days must be Weekday[]`);
          }
          if (typeof w.start !== "string" || !TIME_RE.test(w.start)) errors.push(`${wctx}.start must be HH:MM`);
          if (typeof w.end !== "string" || !TIME_RE.test(w.end)) errors.push(`${wctx}.end must be HH:MM`);
          if (!isStringArray(w.items)) errors.push(`${wctx}.items must be string[]`);
        }
      });
    }
  }

  return errors;
}

function validatePayload(payload) {
  const errors = [];
  if (!isObject(payload)) return ["Payload must be an object"];
  if (typeof payload.updatedAt !== "string" || !payload.updatedAt) errors.push("payload.updatedAt must be a string");
  if (!Array.isArray(payload.businesses)) errors.push("payload.businesses must be an array");

  const seenIds = new Set();
  if (Array.isArray(payload.businesses)) {
    payload.businesses.forEach((b, i) => {
      errors.push(...validateBusiness(b, i));
      const id = b?.id;
      if (typeof id === "string" && id) {
        const key = id.trim();
        if (seenIds.has(key)) errors.push(`Duplicate business id: ${key}`);
        seenIds.add(key);
      }
    });
  }

  return errors;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n");
}

const input = readJson(args.inFile);
const payload = {
  ...input,
  updatedAt: args.updateTimestamp ? new Date().toISOString() : input.updatedAt,
};

const errors = validatePayload(payload);
if (errors.length > 0) {
  console.error("Validation failed:");
  for (const err of errors) console.error(`- ${err}`);
  process.exit(1);
}

writeJson(args.outFile, payload);
console.log(`Wrote ${payload.businesses.length} businesses -> ${args.outFile}`);

if (!args.uploadSupabase) process.exit(0);

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.SUPABASE_STORAGE_BUCKET;
const objectPath = process.env.SUPABASE_STORAGE_PATH;

if (!supabaseUrl || !serviceRoleKey || !bucket || !objectPath) {
  console.error("Missing one or more required env vars for --upload-supabase");
  process.exit(2);
}

const baseUrl = supabaseUrl.replace(/\/$/, "");
const uploadUrl = `${baseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${objectPath
  .split("/")
  .map(encodeURIComponent)
  .join("/")}`;

const res = await fetch(uploadUrl, {
  method: "PUT",
  headers: {
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
    "x-upsert": "true",
  },
  body: JSON.stringify(payload),
});

if (!res.ok) {
  const text = await res.text().catch(() => "");
  throw new Error(`Supabase upload failed: HTTP ${res.status}${text ? `\n${text}` : ""}`);
}

const publicUrl = `${baseUrl}/storage/v1/object/public/${encodeURIComponent(bucket)}/${objectPath
  .split("/")
  .map(encodeURIComponent)
  .join("/")}`;

console.log(`Uploaded -> ${publicUrl}`);
