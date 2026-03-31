#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function usage(exitCode) {
  console.log(
    [
      "Usage: ./scripts/lafayette/generate_deals_review.mjs --candidates <deal_candidates.json> --out <review.json>",
      "",
      "Defaults:",
      "- candidates: ./data/generated/deal_candidates_2026-03-16.json",
      "- out:        ./data/review/lafayette_deals_review_2026-03-16.json",
    ].join("\n"),
  );
  process.exit(exitCode);
}

function parseArgs(argv) {
  const args = {
    candidates: "./data/generated/deal_candidates_2026-03-16.json",
    out: "./data/review/lafayette_deals_review_2026-03-16.json",
    minSnippets: 1,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--candidates") args.candidates = argv[++i];
    else if (arg === "--out") args.out = argv[++i];
    else if (arg === "--min-snippets") args.minSnippets = Number(argv[++i] ?? "1");
    else if (arg === "--help") return null;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (!args) usage(0);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

const candidates = readJson(args.candidates);
const results = Array.isArray(candidates?.results) ? candidates.results : [];

const entries = results
  .filter((r) => (r.snippetCount ?? 0) >= args.minSnippets)
  .map((r) => {
    const snippets = Array.isArray(r.snippets) ? r.snippets : [];
    const keys = [...new Set(snippets.map((s) => s.key).filter(Boolean))].sort();

    return {
      spotId: r.spotId,
      name: r.name,
      website: r.website,
      finalUrl: r.finalUrl ?? null,
      ok: Boolean(r.ok),
      status: r.status ?? null,
      contentType: r.contentType ?? null,
      snippetCount: r.snippetCount ?? 0,
      snippetKeys: keys,
      snippets,

      // Human workflow:
      // - Fill in dailyDeals/happyHours with structured data you trust.
      // - Set publish=true when you're ready for it to appear in the app.
      publish: false,
      reviewerNotes: "",

      // Keep these in the same shape the app expects (Spot.dailyDeals / Spot.happyHours).
      dailyDeals: [],
      happyHours: [],
    };
  })
  .sort((a, b) => (b.snippetCount ?? 0) - (a.snippetCount ?? 0));

const out = {
  generatedAt: new Date().toISOString(),
  candidatesScrapedAt: candidates?.scrapedAt ?? null,
  inputFetchedAt: candidates?.inputFetchedAt ?? null,
  count: entries.length,
  entries,
};

writeJson(args.out, out);
console.log(`Wrote ${entries.length} review entries -> ${args.out}`);
