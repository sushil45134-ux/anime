import Link from "next/link";
import { notFound } from "next/navigation";
import { Player } from "@/components/player/Player";
import { getSeries, nextEpisode, playableSources, resolveWatchTarget, sortedEpisodes, tmdbImage } from "@/lib/catalog";

export const dynamic = "force-dynamic";

interface Props {
  params: { slug: string };
  searchParams: { ep?: string; s?: string };
}

/** Watch route: /watch/{slug}?ep={episodeId}&s={serverIndex} */
export default function WatchPage({ params, searchParams }: Props) {
  const series = getSeries(params.slug);
  if (!series) notFound();
  const target = resolveWatchTarget(params.slug, searchParams.ep);
  if (!target) notFound();

  const { episode } = target;
  const sources = playableSources(episode, series);
  const upcoming = nextEpisode(series, episode);
  const eps = sortedEpisodes(series);
  const initialSource = Number.isFinite(Number(searchParams.s)) && searchParams.s !== undefined ? Number(searchParams.s) : undefined;

  return (
    <>
      <section className="player-shell" aria-label="Video player" style={{ position: "static", minHeight: "100vh" }}>
        <header className="player-top">
          <Link href={`/${series.slug}`} className="player-close" aria-label="Back to episode guide">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <div className="player-heading">
            <strong>{series.title}</strong>
            <span>
              {series.type === "movie" ? "Movie" : `Episode ${episode.number}`} · {episode.title}
              {episode.runtimeMinutes ? ` · ${episode.runtimeMinutes} min` : ""} · {sources.length} server
              {sources.length === 1 ? "" : "s"}
            </span>
          </div>
          <span style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            <Link className="secondary" style={{ textDecoration: "none", fontSize: 11, padding: "9px 12px" }} href={`/${series.slug}`}>
              Episode list
            </Link>
          </span>
        </header>

        <Player
          slug={series.slug}
          episodeId={episode.id}
          title={`${series.title} — ${episode.title}`}
          subtitle={`S${episode.season}E${episode.number} · ${sources.length} servers`}
          sources={sources}
          poster={episode.stillPath ? tmdbImage(episode.stillPath, "w780") ?? undefined : undefined}
          initialSource={initialSource}
          upNext={
            upcoming ? (
              <aside className="up-next" aria-label="Up next" style={{ flex: "0 0 300px" }}>
                <span className="eyebrow">Up next</span>
                <h2>Episode {upcoming.number}</h2>
                <Link className="up-card" href={`/watch/${series.slug}?ep=${upcoming.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                  {upcoming.stillPath ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={tmdbImage(upcoming.stillPath, "w780") ?? ""} alt="" width={1600} height={900} loading="lazy" decoding="async" />
                  ) : (
                    <span style={{ display: "block", height: 92, background: "linear-gradient(140deg,#3a2413,#0b0c10 72%)" }} />
                  )}
                  <span className="up-card-copy">
                    <strong>{upcoming.title}</strong>
                    <span>{playableSources(upcoming, series).length} server tabs ready · auto-play in 15s when wired up</span>
                  </span>
                </Link>
                <p className="up-next-note">
                  Server tabs are per-episode. If one goes dead, the overlay hands you the next live tab — and remember
                  the popup blocker is the sandbox itself, so no tab can spawn an ad window.
                </p>
              </aside>
            ) : null
          }
        />
      </section>

      <section className="content-section" id="allEpisodes" aria-labelledby="all-eps-title" style={{ background: "#000", paddingBottom: 40 }}>
        <div className="section-head">
          <h2 id="all-eps-title" style={{ fontSize: 26 }}>
            <span className="orange-line" />
            {series.title} — all wired episodes
          </h2>
          <p>Current episode highlighted</p>
        </div>
        <div className="episode-list">
          {eps.map((ep) => {
            const live = playableSources(ep, series).filter((s) => s.enabled !== false).length;
            return (
              <Link
                key={ep.id}
                className="episode-card"
                href={`/watch/${series.slug}?ep=${ep.id}`}
                style={{
                  textDecoration: "none",
                  color: "inherit",
                  borderColor: ep.id === episode.id ? "#f47521" : undefined,
                }}
              >
                <span className="episode-card-content">
                  <span className="episode-card-meta">
                    <span className="episode-no">EP {ep.number}</span>
                    <span className="episode-source-count">
                      <i /> {live} server{live === 1 ? "" : "s"}
                    </span>
                  </span>
                  <span className="episode-copy">
                    <strong>{ep.title}</strong>
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </>
  );
}
