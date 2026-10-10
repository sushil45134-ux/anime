/**
 * Pure, dependency-free rules shared by the CLI scripts and the unit tests.
 * The app-side copy lives in src/lib/sandbox.ts; `rules.test.mjs` asserts the two
 * never drift apart, because the sandbox string is a security control.
 */

export const SANDBOX = "allow-scripts allow-same-origin allow-forms allow-presentation";

export const FORBIDDEN_SANDBOX_TOKENS = [
  "allow-popups",
  "allow-popups-to-escape-sandbox",
  "allow-top-navigation",
  "allow-top-navigation-by-user-activation",
  "allow-downloads",
];

export const DRIVE_ID_RE = /^[a-zA-Z0-9_-]{20,200}$/;

export const DEFAULT_ALLOWLIST = [
  "drive.google.com",
  "www.googleapis.com",
  "youtube.com",
  "www.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
  "player.vimeo.com",
  "test-streams.mux.dev",
  "commondatastorage.googleapis.com",
  "media.w3.org",
];

export function allowlist(envExtra = process.env.EMBED_HOST_ALLOWLIST ?? "") {
  const extra = String(envExtra)
    .split(",")
    .map((s) => s.trim().toLowerCase().replace(/^\*\./, ""))
    .filter(Boolean);
  return [...DEFAULT_ALLOWLIST, ...extra];
}

export function driveIdOf(raw) {
  const v = String(raw ?? "").trim();
  if (DRIVE_ID_RE.test(v)) return v;
  const m = v.match(/\/file\/d\/([a-zA-Z0-9_-]{20,200})/);
  return m ? m[1] : null;
}

export function drivePreviewUrl(raw) {
  const id = driveIdOf(raw);
  return id ? `https://drive.google.com/file/d/${id}/preview` : null;
}

export function isHttpUrl(url) {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

export function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function isAllowedHost(url, list = allowlist()) {
  if (!isHttpUrl(url)) return false; // https only: no mixed-content / cleartext embeds
  const host = hostOf(url);
  if (!host) return false;
  return list.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

// hoisted so isAllowedHost can use it


export function isMediaUrl(url) {
  if (!/^https:\/\//i.test(String(url ?? ""))) return false;
  return /\.(m3u8|mp4|webm|ogg|mov)(\?|#|$)/i.test(url) || /format=m3u8/i.test(url);
}

/** Turn one import row into a catalog source object, or return { error }. */
export function rowToSource(row) {
  const adapter = String(row.adapter ?? "").trim();
  const value = String(row.value ?? row.url ?? "").trim();
  const lang = String(row.lang ?? "unknown").trim() || "unknown";
  const base = {
    label: String(row.label ?? `Server ${adapter || "?"}`).trim(),
    note: row.note ? String(row.note).trim() : undefined,
    lang,
    provider: adapter || "inline",
  };

  if (adapter === "drive-preview" || row.kind === "drive") {
    const url = drivePreviewUrl(value);
    if (!url) return { error: `drive-preview needs a valid Drive file id (got "${value}")` };
    return { source: { ...base, kind: "iframe", url } };
  }

  if (adapter === "self-hosted") {
    if (!isMediaUrl(value)) return { error: `self-hosted needs an https .m3u8/.mp4/.webm URL (got "${value}")` };
    return { source: { ...base, kind: "video", url: value } };
  }

  if (adapter === "direct-embed") {
    if (!isHttpUrl(value)) return { error: "direct-embed needs a full https:// URL" };
    if (!isAllowedHost(value)) return { error: `host "${hostOf(value)}" is not embeddable — add it to EMBED_HOST_ALLOWLIST only if you are authorised to frame it` };
    return { source: { ...base, kind: "iframe", url: value } };
  }

  if (adapter === "coming-soon") {
    return { source: { ...base, kind: "iframe", url: "about:blank", enabled: false } };
  }

  if (!adapter && row.kind && row.url) {
    if (row.kind === "video" && !isMediaUrl(row.url)) return { error: `inline video url rejected: ${row.url}` };
    if (row.kind === "iframe" && !isAllowedHost(row.url)) return { error: `inline iframe host not allowlisted: ${row.url}` };
    return { source: { ...base, kind: row.kind, url: row.url, provider: "inline" } };
  }

  return { error: `unknown adapter "${adapter}" (drive-preview | self-hosted | direct-embed | coming-soon)` };
}

/**
 * The Hindi rule from the spec: a Drive file only ever plays its default audio track,
 * so nobody may tag a Drive source as Hindi until a human actually watched EP1 of that
 * show and confirmed the track. The importer refuses to write lang=hi without it.
 */
export function requiresHindiProof(row) {
  const lang = String(row.lang ?? "").trim();
  const provider = String(row.adapter ?? row.provider ?? "").trim();
  if (lang !== "hi") return null;
  const proof = String(row.hindi_confirmed ?? row.hindiConfirmed ?? "").trim().toLowerCase();
  if (["yes", "y", "true", "1"].includes(proof)) return null;
  return `lang=hi on a ${provider || "source"} row needs hindi_confirmed=yes (someone must watch EP1 and check the audio track)`;
}
