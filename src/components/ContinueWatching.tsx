"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { readProgressMap, type ProgressEntry } from "@/lib/progress";
import type { Series } from "@/lib/types";

interface Props {
  series: Series[];
}

/** Resume rail fed by localStorage — no accounts on day 1. */
export function ContinueWatching({ series }: Props) {
  const [entries, setEntries] = useState<ProgressEntry[]>([]);

  useEffect(() => {
    setEntries(Object.values(readProgressMap()).sort((a, b) => b.updatedAt - a.updatedAt));
  }, []);

  if (!entries.length) {
    return <div className="watchlist-empty">Nothing in progress. Press play on any episode and it lands here.</div>;
  }

  return (
    <div className="continue-grid">
      {entries.map((entry) => {
        const s = series.find((x) => x.slug === entry.slug);
        if (!s) return null;
        const pct = entry.duration ? Math.min(100, Math.round((entry.seconds / entry.duration) * 100)) : 0;
        const ep = s.episodes.find((e) => e.id === entry.episodeId);
        return (
          <article className="continue-card" key={entry.episodeId}>
            <Link className="continue-main" href={`/watch/${s.slug}?ep=${entry.episodeId}`} style={{ textDecoration: "none", color: "inherit" }}>
              <div style={{ position: "relative", flex: "0 0 168px" }}>
                {s.backdropPath ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`https://image.tmdb.org/t/p/w300${s.backdropPath}`} alt="" width={168} height={94} style={{ objectFit: "cover" }} />
                ) : (
                  <div style={{ height: 94, background: "linear-gradient(140deg,#f47521,#15171b 75%)" }} />
                )}
                <span className="progress" style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 3, background: "#000" }}>
                  <i style={{ display: "block", height: "100%", width: `${pct}%` }} />
                </span>
              </div>
              <div style={{ padding: "10px 12px", minWidth: 0 }}>
                <strong style={{ display: "block", fontSize: 14, marginBottom: 4 }}>{s.title}</strong>
                <span style={{ color: "#a9abb0", fontSize: 11 }}>
                  {ep ? `Ep ${ep.number} · ${ep.title}` : "Episode"} · {pct}% watched
                </span>
              </div>
            </Link>
          </article>
        );
      })}
    </div>
  );
}
