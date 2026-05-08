import { createContext } from "react";
import type { AuthState } from "../data/useAuth";
import type { FavoritesState } from "../data/useFavorites";

// ─────────────────────────────────────────────────────────────────────────────
// Contexts
// AuthContext  — user identity + auth actions, consumed by ProfileScreen
// FavoritesContext — saved spot IDs + toggle, consumed by DealsCard + ProfileScreen
// ThemeProvider / useTheme — light/dark mode, consumed by all screens
// ─────────────────────────────────────────────────────────────────────────────

export const AuthContext = createContext<AuthState>({
  user: null,
  role: null,
  loading: true,
  signIn: async () => null,
  signUp: async () => null,
  signOut: async () => {},
});

export const FavoritesContext = createContext<FavoritesState>({
  favoriteIds: new Set(),
  toggleFavorite: async () => {},
});

export { ThemeProvider, useTheme } from "./ThemeContext";
