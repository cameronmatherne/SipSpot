// ─────────────────────────────────────────────────────────────────────────────
// Supabase REST helpers
//
// These functions call the Supabase REST API directly (no SDK) so they work
// in the React Native bundle without any Node.js polyfills.
//
// Credentials come from .env:
//   EXPO_PUBLIC_SUPABASE_URL  – your project URL
//   EXPO_PUBLIC_SUPABASE_KEY  – the public anon key (safe to ship in the app)
//
// All functions return null on success or an error string on failure.
// The callers (EditSpotModal, DealsScreen, AddSpotModal) handle the error.
// ─────────────────────────────────────────────────────────────────────────────

// Builds the common headers required by every Supabase REST request.
export function supabaseHeaders() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? "";
  return { url, key, headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" } };
}

// Updates a spot's columns by ID. `body` should be a partial column map,
// e.g. { name: "New Name", happy_hours: [...] }.
export async function patchSpot(id: string, body: object): Promise<string | null> {
  const { url, headers } = supabaseHeaders();
  const res = await fetch(`${url}/rest/v1/spots?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { ...headers, Prefer: "return=minimal" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return (await res.text().catch(() => "")) || `HTTP ${res.status}`;
  return null;
}

// Permanently removes a spot from the database by its slug ID.
export async function deleteSpot(id: string): Promise<string | null> {
  const { url, headers } = supabaseHeaders();
  const res = await fetch(`${url}/rest/v1/spots?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) return (await res.text().catch(() => "")) || `HTTP ${res.status}`;
  return null;
}
