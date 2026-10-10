#!/usr/bin/env node
/**
 * TMDB metadata sync — the only metadata source for the whole site.
 *
 *   TMDB_API_TOKEN=... node scripts/tmdb-sync.mjs                 # fill ids+art for every row
 *   TMDB_API_TOKEN=... node scripts/tmdb-sync.mjs --episodes       # + episode titles/stills/runtime
 *   TMDB_API_TOKEN=... node scripts/tmdb-sync.mjs --create "Blue Box" --season 1 --episodes
 *
 * It maps TMDB ids/posters into data/catalog.json. It never touches any playback host.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import "./lib/env.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const CATALOG = path.join(ROOT, "data/catalog.json");
const BASE = "https://api.themoviedb.org/3";

const token = process.env.TMDB_API_TOKEN || process.env.TMDB_API_KEY_READ || "";
const isV4 = token.startsWith("eyJ") || token.length > 60;
if (!token) {
  console.error(
    "Set TMDB_API_TOKEN (v4 read access token) or TMDB_API_KEY_READ (v3 key) in .env first.\n" +
      "Free key: https://www.themoviedb.org/settings/api",
  );
  process.exit(1);
}

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const next = process.argv[i + 1];
  return next && !next.startsWith("--") ? next : true;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function tmdb(p, params = {}) {
  const url = new URL(BASE + p);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  const headers = { accept: "application/json" };
  if (isV4) headers.Authorization = `Bearer ${token}`;
  else url.searchParams.set("api_key", token);
  await sleep(260);
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`TMDB ${res.status} for ${p}`);
  return res.json();
}

const GENRE_SLUG = {
  Action: "action",
  Adventure: "adventure",
  Animation: "animation",
  Comedy: "comedy",
  Crime: "crime",
  Drama: "drama",
  "Science-Fiction": "science-fiction",
  "Sci-Fi & Fantasy": "fantasy",
  Fantasy: "fantasy",
  Horror: "horror",
  Mystery: "mystery",
  Romance: "romance",
  "Kids & Family": "family",
  Music: "music",
  "Reality TV": "reality",
  War: "war",
  "War & Politics": "war",
  Western: "western",
  Family: "family",
  History: "history",
  Sports: "sports",
};

function slugify(t) {
  return String(t)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function mapDetails(meta, existing) {
  const title = meta.title || meta.name || existing?.title;
  const original = meta.original_title || meta.original_name;
  const year = Number(String(meta.first_air_date || meta.release_date || "").slice(0, 4)) || existing?.year;
  return {
    tmdbId: meta.id,
    tmdbMediaType: meta.title ? "movie" : "tv",
    title,
    originalTitle: original && original !== title ? original : undefined,
    year,
    synopsis: (meta.overview || existing?.synopsis || "").trim(),
    rating: meta.vote_average ? Number(Number(meta.vote_average).toFixed(1)) : existing?.rating,
    posterPath: meta.poster_path ?? existing?.posterPath,
    backdropPath: meta.backdrop_path ?? existing?.backdropPath,
    genres: [...new Set((meta.genres ?? []).map((g) => GENRE_SLUG[g.name] ?? slugify(g.name)).filter(Boolean))],
    status:
      meta.status === "Currently Airing"
        ? "airing"
        : meta.status === "Planned" || meta.status === "Post Production"
          ? "upcoming"
          : "completed",
  };
}

async function findSeries(query, year) {
  const data = await tmdb("/search/multi", { query, include_adult: false, language: "en-US", year, first_air_date_year: year });
  const hit = (data.results ?? []).find((r) => (r.media_type === "tv" || r.media_type === "movie") && (!year || String(r.first_air_date ?? r.release_date ?? "").startsWith(String(year))));
  return hit ?? (data.results ?? [])[0] ?? null;
}

async function main() {
  const catalog = JSON.parse(await readFile(CATALOG, "utf8"));
  const wantedEpisodes = Boolean(arg("episodes", false));
  const createTitle = arg("create", null);

  if (createTitle) {
    const found = await findSeries(createTitle, arg("year", undefined));
    if (!found) {
      console.error(`Nothing on TMDB for "${createTitle}".`);
      process.exit(1);
    }
    const detail = await tmdb(`/${found.media_type === "movie" ? "movie" : "tv"}/${found.id}`, { language: "en-US", append_to_response: "aggregate_credits" });
    const slug = arg("slug", null) || slugify(detail.title || detail.name);
    if (catalog.series.some((s) => s.slug === slug)) {
      console.error(`slug "${slug}" already in the catalog.`);
      process.exit(1);
    }
    const isMovie = found.media_type === "movie";
    const season = Number(arg("season", 1));
    const seasonData = isMovie ? { episodes: [] } : await tmdb(`/tv/${detail.id}/season/${season}`, { language: "en-US" });
    const eps = isMovie
      ? [{ id: `${slug}-m1`, season: 1, number: 1, title: detail.title || "Movie", runtimeMinutes: detail.runtime || undefined, sources: [] }]
      : (seasonData.episodes ?? [])
          .filter((e) => {
            const max = Number(arg("limit", Infinity));
            return Number.isFinite(max) ? e.episode_number <= max : true;
          })
          .map((e) => ({
            id: `${slug}-s${season}e${e.episode_number}`,
            season,
            number: e.episode_number,
            title: e.name || `Episode ${e.episode_number}`,
            overview: e.overview || undefined,
            airDate: e.air_date || undefined,
            runtimeMinutes: e.runtime || undefined,
            stillPath: e.still_path || undefined,
            sources: [],
          }));
    catalog.series.push({
      slug,
      ...mapDetails(detail, {}),
      type: isMovie ? "movie" : "tv",
      audio: arg("audio", "Sub & Dub"),
      trendingRank: undefined,
      seasons: isMovie ? undefined : [{ number: season, episodeCount: eps.length }],
      episodes: eps,
    });
    console.log(`Added ${slug} (tmdb ${detail.id}) with ${eps.length} episode row(s). Sources still empty — import them next.`);
  }

  for (const series of catalog.series) {
    try {
      let id = series.tmdbId;
      if (!id) {
        const found = await findSeries(series.title, series.year);
        if (!found) {
          console.log(`? ${series.slug}: no TMDB match`);
          continue;
        }
        id = found.id;
        series.tmdbMediaType = found.media_type;
      }
      const kind = series.tmdbMediaType === "movie" ? "movie" : "tv";
      const detail = await tmdb(`/${kind}/${id}`, { language: "en-US" });
      Object.assign(series, mapDetails(detail, series), { tmdbMediaType: kind, type: kind === "movie" ? "movie" : series.type || "tv" });
      const parts = [`✓ ${series.slug}: tmdb ${series.tmdbId}`, series.posterPath ? "art" : "no art"];

      if (wantedEpisodes && kind === "tv") {
        const seasons = detail.seasons ?? [];
        series.seasons = seasons
          .filter((s) => s.season_number > 0)
          .map((s) => ({ number: s.season_number, episodeCount: s.episode_count }));
        const wanted = Number(arg("season", 0)) || null;
        for (const s of seasons) {
          if (s.season_number === 0) continue;
          if (wanted && s.season_number !== wanted) continue;
          const season = await tmdb(`/tv/${id}/season/${s.season_number}`, { language: "en-US" });
          series.episodes ??= [];
          for (const e of season.episodes ?? []) {
            let row = series.episodes.find((x) => x.season === s.season_number && x.number === e.episode_number);
            if (!row) {
              row = { id: `${series.slug}-s${s.season_number}e${e.episode_number}`, season: s.season_number, number: e.episode_number, title: "", sources: [] };
              series.episodes.push(row);
            }
            row.title = e.name || row.title || `Episode ${e.episode_number}`;
            if (e.overview) row.overview = e.overview;
            if (e.air_date) row.airDate = e.air_date;
            if (e.runtime) row.runtimeMinutes = e.runtime;
            if (e.still_path) row.stillPath = e.still_path;
          }
          parts.push(`S${s.season_number}:${(season.episodes ?? []).length} eps`);
        }
        series.episodes = series.episodes.filter((e) => e.title || (e.sources ?? []).length);
      }
      console.log(parts.join(" · "));
    } catch (err) {
      console.error(`! ${series.slug}: ${err.message}`);
    }
  }

  catalog.updatedAt = new Date().toISOString().slice(0, 10);
  await writeFile(CATALOG, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  console.log(`\nSaved ${path.relative(ROOT, CATALOG)} — art is now TMDB-served. Next: npm run validate`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
