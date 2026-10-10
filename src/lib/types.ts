/**
 * AniRoll data model.
 *
 * Everything the player needs is stored per-episode in `sources[]` — the player itself
 * never knows which website a stream came from. It only knows "iframe" or "video".
 * Adding/removing a server = editing catalog.json (or an adapter), not editing Player.tsx.
 */

export type SourceKind = "iframe" | "video";

/** The single source object the player renders. Matches the shape agreed for AniRoll. */
export interface PlayerSource {
  label: string;
  kind: SourceKind;
  /** iframe src for kind=iframe, media URL (.m3u8/.mp4/.webm) for kind=video */
  url: string;
  /** extra UI hint under the tab, e.g. "Hindi · 1080p" */
  note?: string;
  /** audio language actually confirmed on this source */
  lang?: "hi" | "en" | "unknown";
  /** false -> tab is rendered but disabled ("Coming Soon") */
  enabled?: boolean;
  /** which adapter produced it — used for debug + failure stats */
  provider?: string;
}

export interface Episode {
  id: string;
  number: number;
  season: number;
  title: string;
  overview?: string;
  runtimeMinutes?: number;
  stillPath?: string;
  airDate?: string;
  /** ordered exactly as it should appear in the tabs */
  sources: PlayerSource[];
}

export interface Series {
  slug: string;
  /** TMDB mapping — every site in this space keys off TMDB ids/posters */
  tmdbId: number;
  tmdbMediaType: "tv" | "movie";
  title: string;
  originalTitle?: string;
  year: number;
  type: "tv" | "movie" | "ova";
  status: "airing" | "completed" | "upcoming";
  genres: string[];
  synopsis: string;
  rating?: number;
  posterPath?: string;
  backdropPath?: string;
  /** audio availability we have actually verified ourselves, never guessed */
  audio: "Hindi Dub" | "Sub & Dub" | "Subtitled";
  trendingRank?: number;
  seasons?: { number: number; episodeCount: number }[];
  episodes: Episode[];
}

export interface Catalog {
  schemaVersion: 1;
  updatedAt: string;
  series: Series[];
}

export interface WatchTarget {
  series: Series;
  episode: Episode;
}
