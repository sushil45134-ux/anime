import Link from "next/link";
import { searchSeries, listSeries } from "@/lib/catalog";
import { ShowCard } from "@/components/ShowCard";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: { q?: string };
}

export default function SearchPage({ searchParams }: Props) {
  const q = (searchParams.q ?? "").trim();
  const hits = q ? searchSeries(q) : [];

  return (
    <section className="content-section" style={{ paddingTop: 34 }} aria-labelledby="search-title">
      <form className="search-top" action="/search" method="get" style={{ maxWidth: 980 }}>
        <div className="search-box">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-4-4" />
          </svg>
          <label className="sr-only" htmlFor="q">
            Search anime
          </label>
          <input id="q" name="q" defaultValue={q} placeholder="Search the catalog…" autoComplete="off" />
          <button className="close-search" type="submit">
            Search
          </button>
        </div>
      </form>

      {q ? (
        hits.length ? (
          <div className="show-grid" style={{ marginTop: 26, maxWidth: 980, marginLeft: "auto", marginRight: "auto" }}>
            {hits.map((s) => (
              <ShowCard key={s.slug} series={s} />
            ))}
          </div>
        ) : (
          <div className="empty">
            Nothing in the local catalog for “{q}”.{" "}
            <Link href="/#browse">Browse everything</Link> ·{" "}
            <code style={{ color: "#f47521" }}>GET /api/tmdb/search?q={encodeURIComponent(q)}</code> to see the TMDB side.
          </div>
        )
      ) : (
        <div className="search-discovery" id="searchDiscovery" style={{ marginTop: 26, maxWidth: 980 }}>
          <section>
            <h2>Start here</h2>
            <div className="search-chips" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {listSeries()
                .slice(0, 8)
                .map((s) => (
                  <a key={s.slug} href={`/search?q=${encodeURIComponent(s.title)}`} className="chip" style={{ textDecoration: "none" }}>
                    {s.title}
                  </a>
                ))}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
