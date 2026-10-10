import type { Series } from "@/lib/types";

interface Props {
  series: Series;
  ratio?: "poster" | "still";
  /** "poster" for the grid, "rail-poster" for rails */
  frame?: "poster" | "rail-poster";
}

/**
 * TMDB art when `npm run sync:tmdb` has filled the row, deterministic orange tile before that,
 * so a fresh clone still looks like a catalogue instead of a wall of broken images.
 */
export function Poster({ series, ratio = "poster", frame = "poster" }: Props) {
  const src = ratio === "still" ? series.backdropPath : series.posterPath;
  const url = src ? `https://image.tmdb.org/t/p/${ratio === "still" ? "w780" : "w500"}${src}` : null;
  const initials = series.title
    .replace(/[^A-Za-z ]/g, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  const hue = [...series.slug].reduce((a, c) => a + c.charCodeAt(0), 0) % 40;

  return (
    <div className={frame} style={{ background: url ? "#24262b" : `linear-gradient(160deg,hsl(${20 + hue} 90% 46%),#141519 70%)` }}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={`${series.title} artwork`} width={ratio === "still" ? 780 : 500} loading="lazy" decoding="async" />
      ) : (
        <span
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: 12,
            textAlign: "center",
          }}
        >
          <strong style={{ fontSize: 34, fontFamily: '"Roboto Condensed",Arial,sans-serif', letterSpacing: "-.03em" }}>{initials}</strong>
          <span style={{ fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: ".06em", color: "#ffe3d1" }}>
            {series.year}
          </span>
        </span>
      )}
    </div>
  );
}
