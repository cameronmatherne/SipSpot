#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const DEFAULT_IN = "./data/generated/spots_lafayette_2026-03-16.json";
const DEFAULT_OUT = "./data/generated/deal_candidates_2026-03-16.json";

function parseArgs(argv) {
  const args = { in: DEFAULT_IN, out: DEFAULT_OUT, concurrency: 6, limit: 0 };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--in") args.in = argv[++i];
    else if (arg === "--out") args.out = argv[++i];
    else if (arg === "--concurrency") args.concurrency = Number(argv[++i] ?? "6");
    else if (arg === "--limit") args.limit = Number(argv[++i] ?? "0");
    else if (arg === "--help") return null;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (!args) {
  console.log(
    [
      "Usage: ./scripts/lafayette/scrape_deals.mjs [--in <spots.json>] [--out <out.json>]",
      "       [--concurrency <n>] [--limit <n>]",
      "",
      "Notes:",
      "- Best-effort keyword scan; results need validation.",
      "- Respects normal HTTP behavior; does not bypass bot protection.",
    ].join("\n"),
  );
  process.exit(0);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function stripHtmlToText(html) {
  // Remove scripts/styles and tags; keep it dependency-free.
  const withoutScripts = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ");
  const withoutTags = withoutScripts.replace(/<[^>]+>/g, " ");
  return withoutTags
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function findSnippets(text) {
  const patterns = [
    { key: "happy hour", re: /\bhappy\s*hour\b/gi },
    { key: "specials", re: /\bspecials?\b/gi },
    { key: "weekly", re: /\bweekly\b/gi },
    { key: "daily", re: /\bdaily\b/gi },
    { key: "deal", re: /\bdeals?\b/gi },
    { key: "monday", re: /\bmonday\b/gi },
    { key: "tuesday", re: /\btuesday\b/gi },
    { key: "wednesday", re: /\bwednesday\b/gi },
    { key: "thursday", re: /\bthursday\b/gi },
    { key: "friday", re: /\bfriday\b/gi },
    { key: "saturday", re: /\bsaturday\b/gi },
    { key: "sunday", re: /\bsunday\b/gi },
    { key: "bogo", re: /\bbogo\b/gi },
    { key: "2 for 1", re: /\b2\s*for\s*1\b/gi },
    { key: "percent off", re: /\b\d{1,3}\s*%+\s*off\b/gi },
    { key: "time", re: /\b\d{1,2}(:\d{2})?\s*(am|pm)\b/gi },
    { key: "dollars", re: /\$\s*\d/gi },
  ];

  const snippets = [];
  const windowSize = 90;
  const maxSnippets = 30;
  for (const { key, re } of patterns) {
    let match;
    while ((match = re.exec(text)) !== null) {
      const start = Math.max(0, match.index - windowSize);
      const end = Math.min(text.length, match.index + match[0].length + windowSize);
      const snippet = text.slice(start, end).trim();
      snippets.push({ key, snippet });
      if (snippets.length >= maxSnippets) return snippets;
    }
  }
  return snippets;
}

async function fetchWithTimeout(url, { timeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        // Keep a clear UA for basic logging; some sites will still block.
        "user-agent": "SipSpotDataBot/0.1 (+contact: data@sipspot.local)",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    const contentType = res.headers.get("content-type") ?? "";
    const body = await res.text();
    return { ok: res.ok, status: res.status, url: res.url, contentType, body };
  } finally {
    clearTimeout(timer);
  }
}

async function runPool(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runner() {
    while (true) {
      const current = nextIndex;
      nextIndex += 1;
      if (current >= items.length) return;
      results[current] = await worker(items[current], current);
    }
  }

  const runners = [];
  for (let i = 0; i < concurrency; i += 1) runners.push(runner());
  await Promise.all(runners);
  return results;
}

const inPayload = readJson(args.in);
const spots = Array.isArray(inPayload?.spots) ? inPayload.spots : [];

const spotsWithWebsites = spots
  .filter((s) => typeof s.website === "string" && s.website.length > 0)
  .slice(0, args.limit > 0 ? args.limit : undefined);

const scrapedAt = new Date().toISOString();

console.log(`Scraping ${spotsWithWebsites.length} sites (concurrency=${args.concurrency})`);

const results = await runPool(spotsWithWebsites, Math.max(1, args.concurrency), async (spot) => {
  const website = spot.website;
  const base = {
    spotId: spot.id,
    name: spot.name,
    website,
    scrapedAt,
  };

  try {
    const res = await fetchWithTimeout(website, { timeoutMs: 12_000 });
    const isHtml = /text\/html/i.test(res.contentType) || res.body.includes("<html");
    const text = isHtml ? stripHtmlToText(res.body) : "";
    const snippets = text ? findSnippets(text) : [];

    return {
      ...base,
      ok: res.ok,
      status: res.status,
      finalUrl: res.url,
      contentType: res.contentType,
      snippetCount: snippets.length,
      snippets,
    };
  } catch (err) {
    return {
      ...base,
      ok: false,
      error: String(err?.message ?? err),
    };
  }
});

const out = {
  scrapedAt,
  inputFetchedAt: inPayload?.fetchedAt ?? null,
  count: results.length,
  results,
};

writeJson(args.out, out);
console.log(`Wrote -> ${args.out}`);
