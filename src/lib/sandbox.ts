/**
 * The non-negotiable player rules live here, in ONE place, so no component can
 * accidentally invent its own iframe flags.
 */

/**
 * Pinned sandbox policy.
 *
 * `allow-popups` is deliberately absent — that is the product's USP (popup ads from
 * embedded players are 100% blocked by the browser, not by us trying to catch them).
 * Do not add `allow-popups`, `allow-top-navigation` or `allow-downloads`.
 */
export const IFRAME_SANDBOX = "allow-scripts allow-same-origin allow-forms allow-presentation";

/** Fullscreen/autoplay only, scoped to the frame. No popups, no camera/mic. */
export const IFRAME_ALLOW = "fullscreen; autoplay; encrypted-media; picture-in-picture";

export const FORBIDDEN_SANDBOX_TOKENS = [
  "allow-popups",
  "allow-popups-to-escape-sandbox",
  "allow-top-navigation",
  "allow-top-navigation-by-user-activation",
  "allow-downloads",
] as const;

/** Guard-rail for future edits: fails loudly in dev if someone widens the policy. */
export function assertSandboxPolicy(sandbox: string = IFRAME_SANDBOX): void {
  const tokens = sandbox.split(/\s+/).filter(Boolean);
  const bad = FORBIDDEN_SANDBOX_TOKENS.filter((t) => tokens.includes(t));
  if (bad.length) {
    throw new Error(`[AniRoll] sandbox policy widened: ${bad.join(", ")} is not allowed.`);
  }
  if (!tokens.includes("allow-scripts")) {
    throw new Error("[AniRoll] sandbox must keep allow-scripts or players won't boot.");
  }
}

const ALLOWED_EMBED_PROTOCOLS = new Set(["https:"]);

export function isEmbeddableUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return ALLOWED_EMBED_PROTOCOLS.has(u.protocol) && !!u.hostname;
  } catch {
    return false;
  }
}

/**
 * Hosts we are willing to put inside the frame. catalog.json is hand-authored, but we
 * still treat it as untrusted input so a bad row can never turn the site into an ad
 * redirector. Extend via EMBED_HOST_ALLOWLIST (comma separated).
 */
export function embedHostAllowlist(): Set<string> {
  const base = [
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
  const extra = (process.env.EMBED_HOST_ALLOWLIST ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return new Set([...base, ...extra].map((h) => h.replace(/^\*\./, "")));
}

export function isAllowedEmbedUrl(raw: string, allow: Set<string> = embedHostAllowlist()): boolean {
  if (!isEmbeddableUrl(raw)) return false;
  try {
    const host = new URL(raw).hostname.toLowerCase();
    for (const allowed of allow) {
      if (host === allowed || host.endsWith(`.${allowed}`)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function isPlayableMediaUrl(raw: string): boolean {
  if (!/^https:\/\//i.test(raw)) return false;
  return /\.(m3u8|mp4|webm|ogg|mov)(\?|#|$)/i.test(raw) || /format=m3u8/i.test(raw);
}

/** Human-readable reason shown in the player's debug strip. */
export function rejectReason(raw: string): string | null {
  if (!isEmbeddableUrl(raw)) return "Not an https URL";
  if (!isAllowedEmbedUrl(raw)) return `Host "${hostOf(raw)}" is not in the embed allowlist`;
  return null;
}

export function hostOf(raw: string): string {
  try {
    return new URL(raw).hostname;
  } catch {
    return "?";
  }
}
