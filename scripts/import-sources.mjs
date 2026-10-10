#!/usr/bin/env node
/**
 * Bulk episode-source importer. Replaces hand-typing sources into catalog.json.
 *
 *   node scripts/import-sources.mjs --input data/import/sources.csv [--dry-run] [--create-missing]
 *   node scripts/import-sources.mjs --input data/import/sources.json
 *
 * CSV header (all columns optional except slug/season/episode/adapter/value):
 *   slug,season,episode,series_title,tmdb_id,type,label,adapter,value,note,lang,hindi_confirmed
 *
 * `value` depends on the adapter:
 *   drive-preview -> a Drive file id you own/are licensed to serve (or a full /file/d/<id>/view link)
 *   self-hosted   -> https URL to your .m3u8 / .mp4
 *   direct-embed  -> https embed URL on an allowlisted host
 *   coming-soon   -> (no value) renders a disabled "Coming Soon" tab
 *
 * This tool only formats URLs from the list you hand it. It never crawls or unpacks
 * anyone else's player to discover media.
 */
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { requiresHindiProof, rowToSource } from "./lib/rules.mjs";
import "./lib/env.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const CATALOG = path.join(ROOT, "data/catalog.json");

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const next = process.argv[i + 1];
  return next && !next.startsWith("--") ? next : true;
}

/** minimal CSV reader: commas, double-quoted fields, CRLF */
export function parseCsv(text) {
  // `#` lines are comments in our .sample files — drop them before parsing.
  text = text
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("#"))
    .join("\n");
  const rows = [];
  let field = "";
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (c === '"') inQuotes = false;
      else field += c;
      continue;
    }
    if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  row.push(field);
  if (row.some((v) => v !== "")) rows.push(row);
  const [header, ...body] = rows;
  if (!header) return [];
  const keys = header.map((h) => h.trim().toLowerCase());
  return body.map((cells) => Object.fromEntries(keys.map((k, idx) => [k, (cells[idx] ?? "").trim()])));
}

function epId(slug, season, number) {
  return `${slug}-s${season}e${number}`;
}

async function loadRows(inputPath) {
  const text = await readFile(inputPath, "utf8");
  if (inputPath.endsWith(".json")) {
    const json = JSON.parse(text);
    // JSON shape: [{ slug, season, episode, sources:[{label,adapter,value,...}] }]
    const flat = [];
    for (const entry of Array.isArray(json) ? json : json.rows ?? []) {
      for (const src of entry.sources ?? []) flat.push({ ...entry, ...src });
    }
    return flat;
  }
  return parseCsv(text);
}

async function main() {
  const inputRel = arg("input", "data/import/sources.csv");
  const inputPath = path.resolve(ROOT, inputRel);
  if (!existsSync(inputPath)) {
    console.error(`No import file at ${inputRel}. Create one (see the header comment in this script).`);
    process.exit(1);
  }
  const dryRun = Boolean(arg("dry-run", false));
  const createMissing = Boolean(arg("create-missing", false));

  const catalog = JSON.parse(await readFile(CATALOG, "utf8"));
  const rows = await loadRows(inputPath);
  if (!rows.length) {
    console.error("Import file has no rows.");
    process.exit(1);
  }

  const errors = [];
  const touched = new Map(); // episodeId -> { added: [], skipped: [] }
  const seriesIndex = new Map(catalog.series.map((s) => [s.slug, s]));

  for (const [n, row] of rows.entries()) {
    const line = `row ${n + 1}`;
    const slug = String(row.slug ?? "").trim();
    const season = Number(row.season ?? 1);
    const number = Number(row.episode ?? row.number ?? 1);
    if (!slug) {
      errors.push(`${line}: slug is required`);
      continue;
    }
    if (!Number.isFinite(season) || !Number.isFinite(number)) {
      errors.push(`${line}: season/episode must be numbers`);
      continue;
    }

    const proofError = requiresHindiProof(row);
    if (proofError) {
      errors.push(`${line}: ${proofError}`);
      continue;
    }

    const built = rowToSource(row);
    if (built.error) {
      errors.push(`${line}: ${built.error}`);
      continue;
    }

    let series = seriesIndex.get(slug);
    if (!series) {
      if (!createMissing || !row.series_title) {
        errors.push(`${line}: unknown slug "${slug}" (use --create-missing with series_title to add it)`);
        continue;
      }
      series = {
        slug,
        tmdbId: Number(row.tmdb_id ?? 0) || 0,
        tmdbMediaType: row.type === "movie" ? "movie" : "tv",
        title: row.series_title,
        originalTitle: row.original_title || undefined,
        year: Number(row.year ?? new Date().getFullYear()) || new Date().getFullYear(),
        type: row.type === "movie" ? "movie" : row.type === "ova" ? "ova" : "tv",
        status: row.status === "airing" ? "airing" : "completed",
        genres: String(row.genres ?? "").split("|").filter(Boolean),
        synopsis: String(row.synopsis ?? "Metadata pending — run `npm run sync:tmdb`."),
        audio: row.lang === "hi" ? "Hindi Dub" : "Sub & Dub",
        episodes: [],
      };
      catalog.series.push(series);
      seriesIndex.set(slug, series);
    }

    series.episodes ??= [];
    let episode = series.episodes.find((e) => e.season === season && e.number === number);
    if (!episode) {
      episode = {
        id: epId(slug, season, number),
        season,
        number,
        title: row.episode_title || `Episode ${number}`,
        sources: [],
      };
      series.episodes.push(episode);
    }
    episode.sources ??= [];

    const incoming = built.source;
    if (row.hindi_confirmed && String(row.hindi_confirmed).toLowerCase().match(/^(y|yes|true|1)$/)) {
      incoming.hindiCheck = { confirmed: true, confirmedOn: row.hindi_confirmed_on || new Date().toISOString().slice(0, 10) };
    }

    const existingIdx = episode.sources.findIndex((s) => s.label === incoming.label);
    const record = touched.get(episode.id) ?? { added: 0, replaced: 0 };
    if (existingIdx >= 0) {
      if (row.replace === "no" || row.replace === "false") {
        record.skipped = (record.skipped ?? 0) + 1;
      } else {
        episode.sources[existingIdx] = incoming;
        record.replaced += 1;
      }
    } else {
      episode.sources.push(incoming);
      record.added += 1;
    }
    touched.set(episode.id, record);
  }

  const total = [...touched.values()].reduce((a, r) => a + r.added + r.replaced + (r.skipped ?? 0), 0);
  console.log(`\nParsed ${rows.length} rows → ${total} source change(s) across ${touched.size} episode(s).`);
  for (const [ep, r] of touched) console.log(`  ${ep}: +${r.added} new, ${r.replaced} replaced, ${r.skipped ?? 0} kept`);

  if (errors.length) {
    console.log(`\n${errors.length} row(s) rejected:`);
    for (const e of errors.slice(0, 40)) console.log(`  ! ${e}`);
    if (errors.length > 40) console.log(`  … ${errors.length - 40} more`);
  }

  if (dryRun) {
    console.log("\n--dry-run: catalog.json untouched.");
    process.exit(errors.length ? 1 : 0);
  }
  if (total === 0) {
    console.log("\nNothing to write.");
    process.exit(errors.length ? 1 : 0);
  }

  catalog.updatedAt = new Date().toISOString().slice(0, 10);
  catalog.series.forEach((s) => {
    s.episodes = (s.episodes ?? []).slice().sort((a, b) => a.season - b.season || a.number - b.number);
    s.seasons = Object.entries(
      s.episodes.reduce((acc, e) => {
        acc[e.season] = (acc[e.season] ?? 0) + 1;
        return acc;
      }, {}),
    ).map(([number, episodeCount]) => ({ number: Number(number), episodeCount }));
  });

  await writeFile(CATALOG, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  console.log(`\nWrote ${path.relative(ROOT, CATALOG)}. Now: npm run validate`);
  process.exit(errors.length ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e); process.exit(1); });
