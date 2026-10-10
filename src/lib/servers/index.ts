import type { Episode, PlayerSource, Series } from "../types";
import { isAllowedEmbedUrl, isPlayableMediaUrl } from "../sandbox";

/**
 * Server adapters.
 * ---------------------------------------------------------------------------
 * An adapter's only job: turn a row in `data/catalog.json` into a `PlayerSource`
 * (label + kind + url) that the Player can render — or refuse to, if the URL is not
 * something we are willing to embed.
 *
 * This is the extension point for every server tab. A new server = one object here
 * plus rows in the catalog. Player.tsx never changes, sandbox policy never changes.
 *
 * IMPORTANT: adapters only format URLs from data you supply in the catalog. AniRoll
 * does not crawl, scrape, or unpack other players to *discover* media URLs — sources
 * must be things you are authorised to embed or host yourself.
 */

export interface AdapterInput {
  /** raw value from the catalog row (drive file id, media URL, embed URL, ...) */
  value: string;
  series: Pick<Series, "slug" | "tmdbId" | "title">;
  episode?: Pick<Episode, "season" | "number" | "title">;
  label?: string;
  note?: string;
  lang?: PlayerSource["lang"];
}

export interface Adapter {
  id: string;
  /** default tab label if the row doesn't override it */
  label: string;
  kind: PlayerSource["kind"];
  /** human note about reliability, shown in the debug strip */
  hint: string;
  build(input: AdapterInput): PlayerSource | null;
}

/** Google Drive file that YOU own / are authorised to serve -> Drive's own player. */
const DRIVE_ID_RE = /^[a-zA-Z0-9_-]{20,200}$/;
function driveId(raw: string): string | null {
  const direct = raw.trim();
  if (DRIVE_ID_RE.test(direct)) return direct;
  const m = direct.match(/\/file\/d\/([a-zA-Z0-9_-]{20,200})/);
  return m ? m[1] : null;
}

const drivePreview: Adapter = {
  id: "drive-preview",
  label: "Server 1 — HD",
  kind: "iframe",
  hint: "Drive's own player. Zero ad inventory; only the file's default audio track plays.",
  build({ value, label, note, lang }) {
    const id = driveId(value);
    if (!id) return null;
    return {
      label: label ?? this.label,
      kind: "iframe",
      url: `https://drive.google.com/file/d/${id}/preview`,
      note: note ?? "Drive",
      lang: lang ?? "unknown",
      provider: this.id,
    };
  },
};

/** Anything you host yourself: Cloudflare Stream/B2/CDN/S3 signed URL, .m3u8 or .mp4. */
const selfHosted: Adapter = {
  id: "self-hosted",
  label: "Server 2 — Fast",
  kind: "video",
  hint: "Native <video> + hls.js. Best quality control, needs a CDN budget.",
  build({ value, label, note, lang }) {
    const url = value.trim();
    if (!isPlayableMediaUrl(url)) return null;
    return {
      label: label ?? this.label,
      kind: "video",
      url,
      note: note ?? (/\.m3u8(\?|#|$)/i.test(url) ? "HLS" : "MP4"),
      lang: lang ?? "unknown",
      provider: this.id,
    };
  },
};

/** An embed URL you are authorised to frame (allowlisted host, see src/lib/sandbox.ts). */
const directEmbed: Adapter = {
  id: "direct-embed",
  label: "Server 3 — Backup",
  kind: "iframe",
  hint: "Third-party iframe. Popup-blocked by our sandbox; ads on the page still render.",
  build({ value, label, note, lang }) {
    const url = value.trim();
    if (!isAllowedEmbedUrl(url)) return null;
    return {
      label: label ?? this.label,
      kind: "iframe",
      url,
      note: note ?? "Embed",
      lang: lang ?? "unknown",
      provider: this.id,
    };
  },
};

/** Tab that exists in the UI but is not wired yet. Keeps the 4-slot layout stable. */
const comingSoon: Adapter = {
  id: "coming-soon",
  label: "Server 4",
  kind: "iframe",
  hint: "Placeholder. Never auto-selected.",
  build({ label, note }) {
    return {
      label: label ?? this.label,
      kind: "iframe",
      url: "about:blank",
      note: note ?? "Coming soon",
      lang: "unknown",
      enabled: false,
      provider: this.id,
    };
  },
};

export const ADAPTERS: Record<string, Adapter> = {
  [drivePreview.id]: drivePreview,
  [selfHosted.id]: selfHosted,
  [directEmbed.id]: directEmbed,
  [comingSoon.id]: comingSoon,
};

export type CatalogSourceRow = {
  adapter: keyof typeof ADAPTERS | string;
  value?: string;
  label?: string;
  note?: string;
  lang?: PlayerSource["lang"];
  kind?: PlayerSource["kind"];
  url?: string;
  enabled?: boolean;
};

/**
 * Normalise a catalog row into a PlayerSource.
 * Rows may either name an `adapter` (+`value`) or carry the final `kind`/`url` inline.
 */
export function toPlayerSource(
  row: CatalogSourceRow,
  series: Pick<Series, "slug" | "tmdbId" | "title">,
  episode?: Pick<Episode, "season" | "number" | "title">,
): PlayerSource | null {
  if (!row.adapter && row.kind && row.url) {
    // Inline source: still validated, so a hand-typed row can't smuggle a bad host in.
    if (row.kind === "video" && !isPlayableMediaUrl(row.url)) return null;
    if (row.kind === "iframe" && !isAllowedEmbedUrl(row.url)) return null;
    return {
      label: row.label ?? "Server",
      kind: row.kind,
      url: row.url,
      note: row.note,
      lang: row.lang ?? "unknown",
      enabled: row.enabled !== false,
      provider: "inline",
    };
  }
  const adapter = ADAPTERS[row.adapter as string];
  if (!adapter) return null;
  const built = adapter.build({
    value: row.value ?? row.url ?? "",
    series,
    episode,
    label: row.label,
    note: row.note,
    lang: row.lang,
  });
  if (!built) return null;
  return { ...built, enabled: row.enabled !== false && built.enabled !== false };
}

export function resolveEpisodeSources(episode: Episode, series: Series): PlayerSource[] {
  return episode.sources.filter((s) => {
    if (s.enabled === false) return true; // disabled tabs stay visible as "Coming Soon"
    if (s.url === "about:blank") return false;
    return s.kind === "video" ? isPlayableMediaUrl(s.url) : isAllowedEmbedUrl(s.url);
  });
}
