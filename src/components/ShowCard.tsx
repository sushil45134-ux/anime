import Link from "next/link";
import { Poster } from "./Poster";
import type { Series } from "@/lib/types";
import { sortedEpisodes } from "@/lib/catalog";

interface Props {
  series: Series;
  frame?: "poster" | "rail-poster";
  showCount?: boolean;
}

export function ShowCard({ series, frame = "poster", showCount = true }: Props) {
  const eps = sortedEpisodes(series);
  const epLabel =
    series.type === "movie"
      ? "Movie"
      : `${eps.length} episode${eps.length === 1 ? "" : "s"}${series.seasons?.length ? ` · S${series.seasons[0].number}` : ""}`;

  return (
    <Link className="show-card" href={`/${series.slug}`} style={{ textDecoration: "none" }}>
      <div style={{ position: "relative" }}>
        {series.type === "movie" && <span className="movie-badge">Movie</span>}
        <Poster series={series} frame={frame} />
      </div>
      <div className="card-copy">
        <h3>{series.title}</h3>
        <p>
          {series.rating ? `★ ${series.rating.toFixed(1)} · ` : ""}
          {series.year}
          {showCount ? ` · ${epLabel}` : ""}
          {series.audio === "Hindi Dub" ? " · Hindi" : ""}
        </p>
      </div>
    </Link>
  );
}
