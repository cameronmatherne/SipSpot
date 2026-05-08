/**
 * lib/supabase.ts — Supabase client singleton.
 *
 * Used by data/useBusinesses.ts (spot fetching), App.tsx (REST helpers),
 * data/useAuth.ts (authentication), and data/useFavorites.ts.
 *
 * AsyncStorage is used as the session storage backend so auth sessions
 * survive app restarts. autoRefreshToken keeps JWTs fresh automatically.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? "";

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: AsyncStorage,       // persist session across app restarts
    autoRefreshToken: true,      // silently refresh tokens before they expire
    persistSession: true,
    detectSessionInUrl: false,   // not applicable in React Native
  },
});
