import { useEffect, useMemo, useState } from "react";

import type { Spot, TimeWindow, Weekday } from "./spots";
import { BUSINESSES, BUSINESSES_UPDATED_AT } from "./businesses.lafayette";
import { parseBusinessesPayload, type BusinessesPayload } from "./businessesSchema";

type LoadState = {
  businesses: Spot[];
  updatedAt: string;
  source: "bundled" | "cache" | "remote";
  error: string | null;
  loading: boolean;
};

const STORAGE_KEY_PAYLOAD = "sipspot.businesses.payload.v1";
const STORAGE_KEY_ETAG = "sipspot.businesses.etag.v1";

const WEEKDAYS = new Set<Weekday>(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
const TIME_RE = /^\d{2}:\d{2}$/;

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object";

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((v) => typeof v === "string");

const validateTimeWindow = (window: unknown): window is TimeWindow => {
  if (!isObject(window)) return false;
  if (!Array.isArray(window.days) || window.days.length === 0) return false;
  if (!window.days.every((d) => typeof d === "string" && WEEKDAYS.has(d as Weekday))) return false;
  if (typeof window.start !== "string" || !TIME_RE.test(window.start)) return false;
  if (typeof window.end !== "string" || !TIME_RE.test(window.end)) return false;
  if (!isStringArray(window.items)) return false;
  return true;
};

const validatePayload = parseBusinessesPayload;

type AsyncStorageLike = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

const getAsyncStorage = (): AsyncStorageLike | null => {
  try {
    // Avoid crashing if the native module isn't available (e.g. Expo Go mismatch / web).
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("@react-native-async-storage/async-storage");
    return (mod?.default ?? mod) as AsyncStorageLike;
  } catch {
    return null;
  }
};

async function readCachedPayload(): Promise<{ payload: BusinessesPayload; etag: string | null } | null> {
  const storage = getAsyncStorage();
  if (!storage) return null;

  const [payloadRaw, etag] = await Promise.all([
    storage.getItem(STORAGE_KEY_PAYLOAD),
    storage.getItem(STORAGE_KEY_ETAG),
  ]);

  if (!payloadRaw) return null;
  try {
    const json = JSON.parse(payloadRaw);
    const validated = validatePayload(json as unknown);
    if (!validated.ok) return null;
    return { payload: validated.payload, etag };
  } catch {
    return null;
  }
}

async function writeCachedPayload(payload: BusinessesPayload, etag: string | null) {
  const storage = getAsyncStorage();
  if (!storage) return;

  await Promise.all([
    storage.setItem(STORAGE_KEY_PAYLOAD, JSON.stringify(payload)),
    etag ? storage.setItem(STORAGE_KEY_ETAG, etag) : storage.removeItem(STORAGE_KEY_ETAG),
  ]);
}

async function fetchRemotePayload(url: string, etag: string | null) {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (etag) headers["If-None-Match"] = etag;

  const res = await fetch(url, { headers });
  if (res.status === 304) return { type: "not_modified" as const };
  if (!res.ok) return { type: "error" as const, error: `HTTP ${res.status}` };

  const json = (await res.json()) as unknown;
  const validated = validatePayload(json);
  if (!validated.ok) return { type: "error" as const, error: validated.error };

  const newEtag = res.headers.get("etag");
  return { type: "ok" as const, payload: validated.payload, etag: newEtag };
}

export function useBusinesses() {
  const bundled = useMemo<BusinessesPayload>(() => {
    return { updatedAt: BUSINESSES_UPDATED_AT, businesses: BUSINESSES };
  }, []);

  const [state, setState] = useState<LoadState>(() => ({
    businesses: bundled.businesses,
    updatedAt: bundled.updatedAt,
    source: "bundled",
    error: null,
    loading: true,
  }));

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const remoteUrl = process.env.EXPO_PUBLIC_BUSINESSES_JSON_URL;

      const cached = await readCachedPayload();
      if (!cancelled && cached) {
        setState({
          businesses: cached.payload.businesses,
          updatedAt: cached.payload.updatedAt,
          source: "cache",
          error: null,
          loading: false,
        });
      } else if (!cancelled) {
        setState((s) => ({ ...s, loading: false }));
      }

      if (!remoteUrl) return;

      const etag = cached?.etag ?? null;
      const fetched = await fetchRemotePayload(remoteUrl, etag);
      if (cancelled) return;

      if (fetched.type === "ok") {
        setState({
          businesses: fetched.payload.businesses,
          updatedAt: fetched.payload.updatedAt,
          source: "remote",
          error: null,
          loading: false,
        });
        await writeCachedPayload(fetched.payload, fetched.etag ?? null);
      } else if (fetched.type === "error") {
        setState((s) => ({ ...s, error: fetched.error }));
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
