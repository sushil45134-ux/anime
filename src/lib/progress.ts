"use client";

/** localStorage-backed resume points + per-series server preference. */

const PROGRESS_KEY = "aniroll.progress.v1";
const SERVER_PREF_KEY = "aniroll.server-pref.v1";

export type ProgressEntry = {
  episodeId: string;
  slug: string;
  seconds: number;
  duration: number;
  updatedAt: number;
};

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode — progress is a nice-to-have */
  }
}

export function readProgressMap(): Record<string, ProgressEntry> {
  return read<Record<string, ProgressEntry>>(PROGRESS_KEY, {});
}

export function saveProgress(entry: Omit<ProgressEntry, "updatedAt">): void {
  const map = readProgressMap();
  map[entry.slug] = { ...entry, updatedAt: Date.now() };
  write(PROGRESS_KEY, map);
}

export function continueWatching(limit = 12): ProgressEntry[] {
  return Object.values(readProgressMap())
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit);
}

export function preferredServerIndex(slug: string): number | null {
  const map = read<Record<string, number>>(SERVER_PREF_KEY, {});
  const v = map[slug];
  return typeof v === "number" ? v : null;
}

export function rememberServerIndex(slug: string, index: number): void {
  const map = read<Record<string, number>>(SERVER_PREF_KEY, {});
  map[slug] = index;
  write(SERVER_PREF_KEY, map);
}
