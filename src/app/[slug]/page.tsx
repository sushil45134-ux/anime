import Link from "next/link";
import { notFound } from "next/navigation";
import { getSeries, seriesBackdrop, sortedEpisodes, tmdbImage, trending } from "@/lib/catalog";
import { Poster } from "@/components/Poster";

export const dynamic = "force-dynamic";

interface Props {
  params: { slug: string };
}

/** Series page: poster hero, episode guide, and how many servers each episode row has. */
export default function SeriesPage({ params }: Props) {
  const series = getSeries(params.slug);
  if (!series) notFound();

  const eps = sortedEpisodes(series);
  const backdrop = seriesBackdrop(series);
  const more = trending().filter((s) => s.slug !== series.slug).slice(0, 6);

  return (
    <div className="detail-page">
      <div className="detail-toolbar">
        <div className="detail-toolbar-group">
          <Link href="/" className="detail-back" aria-label="Back" style={{ textDecoration: "none" }}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
        </div>
        <div className="detail-toolbar-group">
          <Link href={`/watch/${series.slug}`} aria-label="Play" style={{ textDecoration: "none" }}>
            <button type="button" aria-label="Play episode 1">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M7 4l13 8-13 8z" fill="currentColor" stroke="none" />
              </svg>
            </button>
          </Link>
        </div>
      </div>

      <section className="detail-hero" style={{ backgroundImage: backdrop ? `url(${backdrop})` : undefined }}>
        <div className="detail-shade" />
        <div className="detail-hero-inner">
          <Poster series={series} />
          <div className="detail-intro">
            <h2>{series.title}</h2>
            <div className="detail-badges">
              {series.rating ? <span className="detail-badge rating">★ {series.rating.toFixed(1)}</span> : null}
              <span className="detail-badge status">{series.status === "airing" ? "Airing" : "Completed"}</span>
              <span className="detail-badge">{series.year}</span>
              <span className="detail-badge">{series.audio}</span>
              {series.tmdbId ? <span className="detail-badge">TMDB {series.tmdbId}</span> : <span className="detail-badge">TMDB id pending</span>}
            </div>
            <p className="detail-genre-line">{series.genres.join(" · ")}</p>
            <div className="detail-cta-row">
              <Link className="primary" href={`/watch/${series.slug}`} style={{ textDecoration: "none" }}>
                Play {series.type === "movie" ? "movie" : "S1:E1"}
              </Link>
              <div className="detail-round-actions">
                <button type="button" aria-label="Add to my list">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="detail-overview">
              <h3>Overview</h3>
              <p className="expanded">{series.synopsis}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="detail-body">
        <section className="episode-guide">
          <div className="episode-head">
            <div className="episode-title-group">
              <h3>{series.type === "movie" ? "Movie" : "Episodes"}</h3>
              <p>· {eps.length}</p>
            </div>
            <span className="season-pill" style={{ fontWeight: 900, fontSize: 11 }}>
              <select defaultValue="1" aria-label="Season">
                {(series.seasons ?? [{ number: 1, episodeCount: eps.length }]).map((s) => (
                  <option key={s.number} value={String(s.number)}>
                    Season {s.number} · {s.episodeCount} eps
                  </option>
                ))}
              </select>
            </span>
          </div>

          <div className="episode-list">
            {eps.map((ep) => {
              const live = ep.sources.filter((s) => s.enabled !== false && s.url !== "about:blank").length;
              const hindiConfirmed = ep.sources.some((s) => s.lang === "hi");
              const still = ep.stillPath ? tmdbImage(ep.stillPath, "w300") : null;
              return (
                <Link key={ep.id} className="episode-card" href={`/watch/${series.slug}?ep=${ep.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                  {still ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={still} alt="" width={138} height={84} />
                  ) : (
                    <span
                      style={{
                        flex: "0 0 138px",
                        height: 84,
                        borderRadius: 10,
                        marginRight: 12,
                        background: "linear-gradient(140deg,#2a2f3a,#0d0f14)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 22,
                        fontWeight: 900,
                        color: "#f47521",
                      }}
                    >
                      {ep.number}
                    </span>
                  )}
                  <span className="episode-card-content">
                    <span className="episode-card-meta">
                      <span className="episode-no">EP {ep.number}</span>
                      {ep.runtimeMinutes ? <span className="episode-runtime">{ep.runtimeMinutes}m</span> : null}
                      <span className="episode-source-count">
                        <i /> {live} server{live === 1 ? "" : "s"}
                      </span>
                      {hindiConfirmed ? <span className="dub-pill">Hindi confirmed</span> : null}
                    </span>
                    <span className="episode-copy">
                      <strong>{ep.title}</strong>
                      {ep.overview ? <span className="episode-desc">{ep.overview}</span> : null}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        {more.length > 0 && (
          <section className="more-like">
            <div className="more-like-head">
              <h3>More like this</h3>
            </div>
            <div className="recommend-track">
              {more.map((s) => (
                <div className="recommend-card" key={s.slug} style={{ flex: "0 0 190px" }}>
                  <Poster series={s} />
                  <div className="recommend-card-copy">
                    <strong>{s.title}</strong>
                    <span style={{ fontSize: 9, color: "#a9abb0" }}>
                      {sortedEpisodes(s).length} eps · {s.audio}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export function generateStaticParams() {
  return trending().map((s) => ({ slug: s.slug }));
}
