# SipSpot — Developer Guide

Quick reference for making common changes to the codebase without needing to read everything front-to-back.

---

## Files you'll touch most often

| File | What lives there |
|---|---|
| `App.tsx` | Every screen, component, and style in the app |
| `lafayette_places.txt` | Source-of-truth text file for seeding spot data |
| `data/spots.ts` | TypeScript types (`Spot`, `DailyDeal`, `TimeWindow`, etc.) |
| `data/useBusinesses.ts` | Hook that fetches spots from Supabase and caches them |
| `scripts/seed-supabase.mjs` | CLI script for pushing the text file into the database |
| `app.json` | App name, bundle IDs, permissions, Expo plugin config |
| `.env` | Local secrets — Supabase URL and keys (never commit this) |

---

## Common tasks

### Add a new colour or change the theme

Open `App.tsx` and find the `C` object (search for `Design tokens`). Every colour in the app comes from here. Change the hex value and it propagates to every component that references it.

```ts
const C = {
  accent: "#2dd4bf",  // ← change this to re-theme the whole app
  ...
};
```

---

### Add a new spot or update deal info

**Option A — via the app UI** (no code needed)
Tap the `+` icon in the top-right corner of the Deals tab and enter the spot name. Then go to the Supabase dashboard to add coordinates and deal data.

**Option B — via the text file** (for bulk adds)
1. Add the spot to `lafayette_places.txt` following the existing format.
2. Run `node scripts/seed-supabase.mjs --sync` to insert only new spots without touching existing records.

---

### Change what text appears on deal cards

- **Section heading** (`"Monday Deals Live Now"`) — search for `fullWeekdayLabel(today)} Deals Live Now` in `DealsScreen` in `App.tsx`.
- **Deal item capitalisation** — the `toTitleCase` function near the bottom of `App.tsx` handles this. Edit `LOWERCASE_WORDS` to change which words stay lowercase.
- **Time format** (e.g. `4:00 PM`) — the `formatTime` function in `App.tsx`.

---

### Change card layout or what's shown on a card

Find `DealsCard` in `App.tsx`. This is the component rendered for every spot row.

- To change how many items show before "View full list" appears, edit `maxDealLines` and `maxHappyHourLines` at the top of the component.
- The happy-hour header row (with the Live/Not Live badge) is the `<Pressable>` that toggles `hhVisible`.
- The `⋯` button triggers an `Alert.alert` with Edit and Delete options.

---

### Change map behaviour

Find `ExploreScreen` in `App.tsx`.

- **Initial map region** — the `initialRegion` prop on `<MapView>`. Adjust `latitude`/`longitude` to re-centre the default view.
- **Marker colours** — the `MarkerDot` component just above `ExploreScreen`. The three states are: live (teal), has-deals-today (steel blue), no deals (grey).
- **Dark map style (Android)** — the `DARK_MAP_STYLE` array. Each entry is a Google Maps style override. iOS dark mode is handled by `userInterfaceStyle="dark"` on the `<MapView>`.
- **Detail card content** — the `{selectedSpot ? ...}` block at the bottom of `ExploreScreen`.

---

### Add a new screen / tab

1. Create a new function component in `App.tsx`, e.g. `function FavouritesScreen() { ... }`.
2. Add a `<Tab.Screen>` entry inside the `<Tab.Navigator>` in the root `App()` component.
3. Add the corresponding icon name in the `tabBarIcon` switch inside `screenOptions`.

---

### Change database schema

1. Edit `supabase/spots.sql` to reflect the new column.
2. Run the migration SQL in the Supabase dashboard SQL editor.
3. Update `data/spots.ts` to add the new field to the `Spot` type.
4. Update the `fetchFromSupabase` mapping in `data/useBusinesses.ts` to read the new column from the row.
5. If the column should be seeded, update `scripts/seed-supabase.mjs`.

---

## Environment variables (`.env`)

```
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_KEY=eyJ...          # anon/public key — safe to ship in the app
SUPABASE_SERVICE_ROLE_KEY=eyJ...         # service role — only used by seed script, never in the app
EXPO_PUBLIC_MARKET=lafayette             # controls which rows are fetched
```

---

## Running the app

```bash
npx expo run:ios       # native build (required for maps + location)
npx expo start         # JS-only dev server (maps won't work in Expo Go)
```

## Seeding / syncing spots

```bash
# First time — full seed (overwrites everything)
node scripts/seed-supabase.mjs

# Ongoing — insert only new spots, leave existing records alone
node scripts/seed-supabase.mjs --sync
```

---

## Architecture at a glance

```
App.tsx
  └── useBusinesses()          ← data/useBusinesses.ts
        ├── bundled snapshot   ← data/businesses.lafayette.ts  (baked into build)
        ├── AsyncStorage cache ← persisted from last network fetch
        └── Supabase fetch     ← lib/supabase.ts → supabase.co

  Tabs:
    Explore  → ExploreScreen  (map + location)
    Deals    → DealsScreen    (section list of cards)
    Profile  → ProfileScreen  (placeholder)
```

The app never uses a state-management library — all state lives in component `useState` hooks and is passed down as props. `useBusinesses` is the only hook that touches the network.
