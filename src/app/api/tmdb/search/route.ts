import { NextResponse } from "next/server";
import { searchSeries } from "@/lib/catalog";

export const dynamic = "force-dynamic";

const TMDB = "https://api.themoviedb.org/3";

/**
 * TMDB is the metadata spine of the whole catalogue (and every site in this space keys
 * posters/ids off it). The key stays server-side; the browser only ever sees our route.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const local = q ? searchSeries(q) : [];

  const key = process.env.TMDB_API_KEY_READ;
  if (!key || !q) {
    return NextResponse.json({ tmdbConfigured: Boolean(key), local, remote: [] });
  }

  try {
    const res = await fetch(
      `${TMDB}/search/multi?include_adult=false&language=en-US&page=1&query=${encodeURIComponent(q)}`,
      { headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" }, cache: "no-store" },
    );
    if (!res.ok) return NextResponse.json({ tmdbConfigured: true, local, remote: [], error: `TMDB ${res.status}` });
    const json = (await res.json()) as { results?: unknown[] };
    const remote = (Array.isArray(json.results) ? json.results : [])
      .filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === "object")
      .filter((r) => r.media_type === "tv" || r.media_type === "movie")
      .slice(0, 12)
      .map((r) => ({
        tmdbId: r.id,
        mediaType: r.media_type,
        title: r.title ?? r.name,
        year: String(r.first_air_date ?? r.release_date ?? "").slice(0, 4),
        posterPath: r.poster_path,
        vote: r.vote_average,
      }));
    return NextResponse.json({ tmdbConfigured: true, local, remote });
  } catch (err) {
    return NextResponse.json({ tmdbConfigured: true, local, remote: [], error: String(err) });
  }
}
