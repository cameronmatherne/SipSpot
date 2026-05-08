// Words that stay lowercase in title case unless they're the first or last word.
// This follows the Chicago Manual of Style convention.
export const LOWERCASE_WORDS = new Set([
  "a", "an", "the",
  "and", "but", "for", "nor", "or", "so", "yet",
  "at", "by", "in", "of", "on", "to", "up", "with",
]);

// Capitalises each significant word in a deal item string.
// e.g. "half off all draft beer" → "Half Off All Draft Beer"
export const toTitleCase = (str: string): string => {
  const words = str.toLowerCase().split(" ");
  return words
    .map((word, i) => {
      if (!word) return word;
      if (i !== 0 && i !== words.length - 1 && LOWERCASE_WORDS.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
};

// Converts a spot name into a URL-safe slug used as the Supabase primary key.
// e.g. "Pamplona Tapas Bar" → "pamplona-tapas-bar"
// Must match the toSlug() function in scripts/seed-supabase.mjs so that
// manually added spots don't conflict with seeded ones.
export const toSpotId = (name: string) => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/, "");
};
