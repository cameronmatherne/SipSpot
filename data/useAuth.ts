/**
 * data/useAuth.ts — Supabase authentication hook.
 *
 * Restores an existing session on mount, subscribes to auth state changes,
 * and fetches the signed-in user's role from user_profiles.
 *
 * Returned shape
 * ──────────────
 *   user    – the logged-in Supabase User, or null
 *   role    – 'admin' | 'owner' | 'user' | null (null = not signed in)
 *   loading – true while the initial session + role check is in flight
 *   signIn  – email + password login; returns an error string or null
 *   signUp  – email + password registration; returns an error string or null
 *   signOut – ends the session and clears storage
 *
 * Role meanings
 * ─────────────
 *   admin  – full access (add / edit / delete spots, manage roles)
 *   owner  – can add and edit spots; cannot delete
 *   user   – read-only; can save favourites
 *
 * See supabase/rbac.sql for the database-side enforcement.
 */

import { useState, useEffect } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

export type UserRole = "admin" | "owner" | "user";

export type AuthState = {
  user: User | null;
  role: UserRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
};

async function fetchRole(userId: string): Promise<UserRole> {
  const { data } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", userId)
    .single();
  return (data?.role as UserRole) ?? "user";
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore session from AsyncStorage on app start, then fetch role.
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) setRole(await fetchRole(u.id));
      setLoading(false);
    });

    // Keep state in sync with any auth event (sign in, sign out, token refresh).
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const u = session?.user ?? null;
        setUser(u);
        if (u) {
          setRole(await fetchRole(u.id));
        } else {
          setRole(null);
        }
      },
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string): Promise<string | null> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  };

  const signUp = async (email: string, password: string): Promise<string | null> => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: "sipspot://" },
    });
    return error?.message ?? null;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { user, role, loading, signIn, signUp, signOut };
}
