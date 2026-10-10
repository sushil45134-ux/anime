import Link from "next/link";
import { BrowseGrid } from "@/components/BrowseGrid";
import { ContinueWatching } from "@/components/ContinueWatching";
import { ShowCard } from "@/components/ShowCard";
import { listSeries, movies, sortedEpisodes, tmdbImage, trending, updatedAt } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const all = listSeries();
  const top = trending();
  const hero = top[0] ?? all[0];
  const airing = all.filter((s) => s.status === "airing");
  const film = movies();
  const heroBackdrop = hero ? tmdbImage(hero.backdropPath, "w1280") : null;

  return (
    <>
      {hero && (
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-media">
            {heroBackdrop ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={heroBackdrop} alt="" width={1280} height={720} />
            ) : (
              <div style={{ width: "100%", height: "100%", background: "radial-gradient(120% 90% at 78% 40%,#45200c,#050505 62%)" }} />
            )}
          </div>
          <div className="hero-content">
            <p className="hero-kicker">#1 on AniRoll this week</p>
            <h1 id="hero-title">{hero.title}</h1>
            <div className="meta">
              <span className="age">{hero.rating ? `${hero.rating.toFixed(1)} TMDB` : "NR"}</span>
              <span>{hero.year}</span>
              <span>{hero.genres.slice(0, 3).join(" · ")}</span>
              <span className="dub-pill">{hero.audio}</span>
              <span>{sortedEpisodes(hero).length} episodes wired</span>
            </div>
            <p>{hero.synopsis}</p>
            <div className="hero-actions">
              <Link className="primary" href={`/watch/${hero.slug}`} style={{ textDecoration: "none" }}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M7 4l13 8-13 8z" fill="currentColor" stroke="none" />
                </svg>
                Play S{hero.type === "movie" ? "0" : "1"}E1 · 4 servers
              </Link>
              <Link className="secondary" href={`/${hero.slug}`} style={{ textDecoration: "none" }}>
                Episode guide
              </Link>
            </div>
          </div>
        </section>
      )}

      <section className="content-section continue-section" id="continueWatching" aria-labelledby="continue-title">
        <div className="section-head">
          <h2 id="continue-title">
            <span className="orange-line" />
            Continue watching
          </h2>
          <p>Pick up where you left off</p>
        </div>
        <ContinueWatching series={all} />
      </section>

      <section className="content-section home-rails" id="homeRows" aria-label="Anime collections">
        {[
          { title: "Top 10 in India this week", rows: top },
          { title: "Airing right now", rows: airing },
        ].map((rail) =>
          rail.rows.length ? (
            <div className="anime-rail" key={rail.title}>
              <div className="rail-head">
                <h2>{rail.title}</h2>
                <p style={{ margin: 0, color: "#a9abb0", fontSize: 12 }}>{rail.rows.length} titles with server tabs</p>
              </div>
              <div className="rail-track">
                {rail.rows.map((s) => (
                  <div className="rail-card" key={s.slug} style={{ display: "block", flex: "0 0 210px" }}>
                    <ShowCard series={s} frame="rail-poster" />
                  </div>
                ))}
              </div>
            </div>
          ) : null,
        )}
      </section>

      <section className="content-section" id="browse" aria-labelledby="browse-title">
        <div className="section-head">
          <h2 id="browse-title">
            <span className="orange-line" />
            Browse all anime
          </h2>
          <p>Catalog synced {updatedAt()}</p>
        </div>
        <BrowseGrid series={all} />
      </section>

      {film.length > 0 && (
        <section className="content-section movie-section" id="movies" aria-labelledby="movies-title">
          <div className="section-head">
            <h2 id="movies-title">
              <span className="orange-line" />
              Anime Movies
            </h2>
            <p>Feature-length, one source set instead of an episode list</p>
          </div>
          <div className="show-grid">
            {film.map((s) => (
              <ShowCard key={s.slug} series={s} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
