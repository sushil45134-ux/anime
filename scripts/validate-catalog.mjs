#!/usr/bin/env node
/**
 * Catalog + player-policy validator. Run after every import/sync step.
 *
 *   node scripts/validate-catalog.mjs [--strict]
 *
 * --strict turns "episode has no live source" from a warning into an error (use before deploy).
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { FORBIDDEN_SANDBOX_TOKENS, SANDBOX, allowlist, hostOf, isAllowedHost, isMediaUrl } from "./lib/rules.mjs";
import "./lib/env.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const CATALOG = path.join(ROOT, "data/catalog.json");
const strict = process.argv.includes("--strict");
const errors = [];
const warnings = [];

const fail = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

async function readIf(p) {
  try {
    return await readFile(p, "utf8");
  } catch {
    return "";
  }
}

async function walk(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(p, out);
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) out.push(p);
  }
  return out;
}

const catalog = JSON.parse(await readFile(CATALOG, "utf8"));
if (catalog.schemaVersion !== 1) fail("catalog", `schemaVersion must be 1, got ${catalog.schemaVersion}`);
if (!Array.isArray(catalog.series) || !catalog.series.length) fail("catalog", "series[] missing or empty");

const slugs = new Set();
const stats = { series: 0, episodes: 0, episodesWired: 0, live: 0, disabled: 0, byProvider: new Map(), hindi: 0, missingTmdb: 0 };

for (const series of catalog.series ?? []) {
  stats.series += 1;
  const where = (extra = "") => `${series.slug}${extra}`;
  if (!series.slug || typeof series.slug !== "string") fail(where(), "slug required");
  if (slugs.has(series.slug)) fail(where(), "duplicate slug");
  slugs.add(series.slug);
  if (!Number.isFinite(series.tmdbId) || series.tmdbId === 0) {
    stats.missingTmdb += 1;
    warn(where(), "tmdbId = 0 → run `npm run sync:tmdb` (metadata + art unresolved)");
  }
  if (!["tv", "movie", "ova"].includes(series.type)) fail(where(), `bad type "${series.type}"`);
  if (!Array.isArray(series.episodes) || !series.episodes.length) fail(where(), "no episodes[]");

  const epIds = new Set();
  for (const ep of series.episodes ?? []) {
    stats.episodes += 1;
    const at = `${series.slug} s${ep.season}e${ep.number}`;
    if (!ep.id) fail(at, "episode id required");
    if (epIds.has(ep.id)) fail(at, `duplicate episode id ${ep.id}`);
    epIds.add(ep.id);
    if (!Number.isFinite(ep.season) || !Number.isFinite(ep.number)) fail(at, "season/number must be integers");
    if (!ep.title) warn(at, "episode has no title (run sync:tmdb --episodes)");
    if (!Array.isArray(ep.sources) || !ep.sources.length) {
      (strict ? fail : warn)(at, "no sources[] — tab bar will be empty");
      continue;
    }

    const labels = new Set();
    let live = 0;
    let hindiRow = false;
    for (const src of ep.sources) {
      if (!src.label) fail(at, "source.label required");
      if (labels.has(src.label)) fail(at, `duplicate tab label "${src.label}"`);
      labels.add(src.label);
      if (!["iframe", "video"].includes(src.kind)) fail(at, `${src.label}: kind must be "iframe" | "video"`);
      if (!src.url) fail(at, `${src.label}: url required`);

      if (src.enabled === false) {
        stats.disabled += 1;
        if (src.url !== "about:blank" && !isAllowedHost(src.url)) fail(at, `${src.label}: disabled but URL host not allowlisted`);
        continue;
      }
      if (src.url === "about:blank") {
        fail(at, `${src.label}: enabled source cannot point at about:blank — set enabled:false for a Coming Soon tab`);
        continue;
      }
      if (src.kind === "video" && !isMediaUrl(src.url)) fail(at, `${src.label}: video url must be an https .m3u8/.mp4/.webm`);
      if (src.kind === "iframe" && !isAllowedHost(src.url)) {
        fail(at, `${src.label}: host "${hostOf(src.url)}" is not in the embed allowlist (${allowlist().length} hosts)`);
        continue;
      }
      live += 1;
      stats.live += 1;
      stats.byProvider.set(src.provider ?? "inline", (stats.byProvider.get(src.provider ?? "inline") ?? 0) + 1);

      // The Drive rule: default audio track only, so a Hindi label needs a human confirmation.
      if (src.lang === "hi" && src.hindiCheck?.confirmed !== true) {
        fail(at, `${src.label}: lang="hi" without hindiCheck.confirmed — watch EP1 and confirm the Hindi track first`);
      } else if (src.lang === "hi") {
        stats.hindi += 1;
      }
    }
    if (live) stats.episodesWired += 1;
    else (strict ? fail : warn)(at, "all sources disabled — nothing will play");
  }
}

// ---- player policy -------------------------------------------------------
const sandboxFile = await readIf(path.join(ROOT, "src/lib/sandbox.ts"));
if (!sandboxFile) {
  fail("policy", "src/lib/sandbox.ts not found");
} else {
  const m = sandboxFile.match(/IFRAME_SANDBOX\s*=\s*"([^"]+)"/);
  if (!m) fail("policy", "IFRAME_SANDBOX constant not found");
  else if (m[1] !== SANDBOX) fail("policy", `sandbox drift: app "${m[1]}" vs rules "${SANDBOX}"`);
  else if (m[1].includes("allow-popups")) fail("policy", "allow-popups present — popup blocking is the product");
}

const files = await walk(path.join(ROOT, "src"));
for (const f of files) {
  const text = await readFile(f, "utf8");
  for (const token of FORBIDDEN_SANDBOX_TOKENS) {
    // the ban list itself legitimately mentions the tokens; only flag real usage
    const usage = new RegExp(`sandbox(?:\\?|\\s*=)[^\\n]*"?[^"\\n]*${token}`).test(text);
    if (usage) fail(path.relative(ROOT, f), `sandbox widens policy with ${token}`);
  }
  if (/<iframe(?![^>]*sandbox=)[^>]*>/s.test(text)) fail(path.relative(ROOT, f), "found an <iframe> without the sandbox attribute");
}

// ---- report --------------------------------------------------------------
const pct = stats.episodes ? Math.round((stats.episodesWired / stats.episodes) * 100) : 0;
console.log(`
AniRoll catalog report
──────────────────────────────────────────────
 series                 ${stats.series}
 episode rows           ${stats.episodes}  · ${pct}% have ≥1 live server
 total live sources     ${stats.live}  (avg ${(stats.live / Math.max(1, stats.episodesWired)).toFixed(1)} per wired episode)
 disabled/coming-soon   ${stats.disabled}
 series without tmdbId  ${stats.missingTmdb}
 sources tagged Hindi   ${stats.hindi}  (all EP1-confirmed)
 sandbox string         ${SANDBOX}
 sources by provider:
${[...stats.byProvider].map(([k, v]) => `   ${k.padEnd(16)} ${v}`).join("\n") || "   (none)"}
`);

if (warnings.length) {
  console.log(`${warnings.length} warning(s):`);
  for (const w of warnings.slice(0, 25)) console.log(`  ~ ${w}`);
  if (warnings.length > 25) console.log(`  … ${warnings.length - 25} more (json: node scripts/validate-catalog.mjs --json)`);
}
if (errors.length) {
  console.log(`\n${errors.length} error(s):`);
  for (const e of errors.slice(0, 40)) console.log(`  × ${e}`);
  console.log(`\nBuild is not deploy-ready. Fix the rows above (npm run validate re-checks).`);
  process.exit(1);
}
console.log(`\nOK — catalog schema + sandbox policy valid${strict ? " (strict)" : ""}.`);
