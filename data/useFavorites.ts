/**
 * data/useFavorites.ts — Saved spots hook.
 *
 * Fetches the user's saved spot IDs from `user_favorites` and exposes a
 * toggleFavorite function that updates the DB and applies an optimistic
 * local update so the UI feels instant.
 *
 * When userId is null (not logged in), favoriteIds is always an empty Set
 * and toggleFavorite is a no-op.
 *
 * Requires the `user_favorites` table to exist in Supabase.
 * See supabase/user_favorites.sql for the schema and RLS policies.
 */

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export type FavoritesState = {
  favoriteIds: Set<string>;
  toggleFavorite: (spotId: string) => Promise<void>;
};

export function useFavorites(userId: string | null): FavoritesState {
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  // Re-fetch whenever the logged-in user changes.
  useEffect(() => {
    if (!userId) {
      setFavoriteIds(new Set());
      return;
    }
    supabase
      .from("user_favorites")
      .select("spot_id")
      .eq("user_id", userId)
      .then(({ data }) => {
        setFavoriteIds(new Set(data?.map((r) => r.spot_id as string) ?? []));
      });
  }, [userId]);

  const toggleFavorite = async (spotId: string): Promise<void> => {
    if (!userId) return;

    const isFav = favoriteIds.has(spotId);

    // Apply optimistic update immediately so the bookmark icon flips instantly.
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (isFav) next.delete(spotId);
      else next.add(spotId);
      return next;
    });

    if (isFav) {
      await supabase
        .from("user_favorites")
        .delete()
        .eq("user_id", userId)
        .eq("spot_id", spotId);
    } else {
      await supabase
        .from("user_favorites")
        .insert({ user_id: userId, spot_id: spotId });
    }
  };

  return { favoriteIds, toggleFavorite };
}
