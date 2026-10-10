"use client";

import { useMemo, useState } from "react";
import { ShowCard } from "./ShowCard";
import type { Series } from "@/lib/types";
import { sortedEpisodes } from "@/lib/catalog";

interface Props {
  series: Series[];
}

type Sort = "trending" | "newest" | "rated" | "az";

/** Browse filters from the mockup: genre / status / type / sort, run over the local catalog. */
export function BrowseGrid({ series }: Props) {
  const [genre, setGenre] = useState("all");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [sort, setSort] = useState<Sort>("trending");
  const [q, setQ] = useState("");

  const genres = useMemo(() => Array.from(new Set(series.flatMap((s) => s.genres))).sort(), [series]);

  const rows = useMemo(() => {
    const list = series.filter(
      (s) =>
        (genre === "all" || s.genres.includes(genre)) &&
        (status === "all" || s.status === status) &&
        (type === "all" || s.type === type) &&
        (!q.trim() || s.title.toLowerCase().includes(q.trim().toLowerCase())),
    );
    const sorted = list.slice();
    if (sort === "newest") sorted.sort((a, b) => b.year - a.year);
    if (sort === "rated") sorted.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    if (sort === "az") sorted.sort((a, b) => a.title.localeCompare(b.title));
    if (sort === "trending") sorted.sort((a, b) => (a.trendingRank ?? 99) - (b.trendingRank ?? 99));
    return sorted;
  }, [series, genre, status, type, sort, q]);

  const select = (label: string, value: string, onChange: (v: string) => void, options: [string, string][]) => (
    <label>
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <>
      <div className="browse-tools">
        {select("Genre", genre, setGenre, [["all", "All genres"], ...genres.map((g) => [g, g] as [string, string])])}
        {select("Status", status, setStatus, [
          ["all", "All status"],
          ["airing", "Airing"],
          ["completed", "Completed"],
          ["upcoming", "Upcoming"],
        ])}
        {select("Type", type, setType, [
          ["all", "All types"],
          ["tv", "TV"],
          ["movie", "Movie"],
          ["ova", "OVA"],
        ])}
        {select("Sort", sort, (v) => setSort(v as Sort), [
          ["trending", "Trending"],
          ["newest", "Newest"],
          ["rated", "Top rated"],
          ["az", "A–Z"],
        ])}
        <label style={{ flex: "1 1 220px" }}>
          Search catalog
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="type a title…"
            style={{ height: 38, border: "1px solid #34363b", background: "#15171b", color: "#f7f7f7", padding: "0 10px" }}
          />
        </label>
      </div>
      {rows.length === 0 ? (
        <div className="watchlist-empty">No title in the local catalog matches those filters.</div>
      ) : (
        <div className="show-grid">
          {rows.map((s) => (
            <ShowCard key={s.slug} series={s} />
          ))}
        </div>
      )}
      <p style={{ color: "#a9abb0", fontSize: 12, marginTop: 14 }}>
        {rows.length} title{rows.length === 1 ? "" : "s"} ·{" "}
        {rows.reduce((a, s) => a + sortedEpisodes(s).length, 0)} episode rows carry sources right now.
      </p>
    </>
  );
}
