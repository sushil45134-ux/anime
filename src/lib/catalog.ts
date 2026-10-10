import raw from "@data/catalog.json";
import type { Catalog, Episode, PlayerSource, Series, WatchTarget } from "./types";
import { resolveEpisodeSources } from "./servers";

/**
 * Single seam between "where catalog data lives" and the UI.
 * Day 1: a JSON file. Swap this for Mongo/Postgres later and nothing else moves.
 */
export function getCatalog(): Catalog {
  return raw as unknown as Catalog;
}

export function listSeries(): Series[] {
  return getCatalog().series.slice();
}

export function getSeries(slug: string): Series | null {
  return getCatalog().series.find((s) => s.slug === slug) ?? null;
}

export function sortedEpisodes(series: Series): Episode[] {
  return series.episodes.slice().sort((a, b) => a.season - b.season || a.number - b.number);
}

export function getEpisode(series: Series, episodeId: string): Episode | null {
  return series.episodes.find((e) => e.id === episodeId) ?? null;
}

export function firstEpisode(series: Series): Episode | null {
  return sortedEpisodes(series)[0] ?? null;
}

export function nextEpisode(series: Series, episode: Episode): Episode | null {
  const list = sortedEpisodes(series);
  const i = list.findIndex((e) => e.id === episode.id);
  return i >= 0 && i + 1 < list.length ? list[i + 1] : null;
}

export function playableSources(episode: Episode, series: Series): PlayerSource[] {
  return resolveEpisodeSources(episode, series);
}

export function hasPlayableSource(series: Series, episode: Episode): boolean {
  return playableSources(episode, series).some((s) => s.enabled !== false && s.url !== "about:blank");
}

export function resolveWatchTarget(slug: string, episodeId?: string | null): WatchTarget | null {
  const series = getSeries(slug);
  if (!series) return null;
  const episode = (episodeId ? getEpisode(series, episodeId) : null) ?? firstEpisode(series);
  if (!episode) return null;
  return { series, episode };
}

export function searchSeries(query: string): Series[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return listSeries().filter(
    (s) =>
      s.title.toLowerCase().includes(q) ||
      (s.originalTitle ?? "").toLowerCase().includes(q) ||
      s.slug.includes(q) ||
      s.genres.some((g) => g.toLowerCase().includes(q)),
  );
}

export function trending(): Series[] {
  return listSeries()
    .filter((s) => typeof s.trendingRank === "number")
    .sort((a, b) => (a.trendingRank ?? 99) - (b.trendingRank ?? 99));
}

export function byGenre(genre: string): Series[] {
  return listSeries().filter((s) => s.genres.includes(genre));
}

export function movies(): Series[] {
  return listSeries().filter((s) => s.type === "movie");
}

export function updatedAt(): string {
  return getCatalog().updatedAt;
}

/** TMDB keys everything, so art always comes from their CDN once ids are synced. */
export type TmdbSize = "w154" | "w200" | "w300" | "w500" | "w780" | "w1280" | "original";

export function tmdbImage(path: string | undefined, size: TmdbSize = "w500"): string | null {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

export function seriesPoster(series: Series): string | null {
  return tmdbImage(series.posterPath, "w500");
}

export function seriesBackdrop(series: Series): string | null {
  return tmdbImage(series.backdropPath, "w1280");
}

export function episodeStill(episode: Episode): string | null {
  return tmdbImage(episode.stillPath, "w300");
}
