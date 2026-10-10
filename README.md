# AniRoll — multi-server anime player

AniRoll ka Day-1 build: aapke `UI Demo.html` ka theme (colors, topbar, hero, rails, episode
guide, player shell) Next.js + TypeScript me port kiya gaya hai, plus the **4-server-tab player
shell** with the exact sandbox policy, failover overlay aur catalog tooling jo aapne maanga tha.

```
src/lib/types.ts          # data model: sources[] = { label, kind: "iframe"|"video", url }
src/lib/sandbox.ts        # THE sandbox policy (single source of truth) + embed host allowlist
src/lib/servers/index.ts  # server adapters: drive-preview | self-hosted | direct-embed | coming-soon
src/lib/catalog.ts        # JSON catalog seam (swap for Mongo later, UI doesn't move)
src/lib/progress.ts         # localStorage resume + last-used server per series
src/components/player/    # ServerTabs · EmbedStage · VideoStage(hls.js) · Player · DnsNotice
data/catalog.json         # catalog (demo sources are public CC-licensed test media)
data/import/sources.csv   # ← your bulk source import (see sources.csv.sample)
scripts/                  # tmdb-sync · import-sources · validate-catalog  (+ unit tests)
```

## Commands

```bash
npm run dev            # http://localhost:3000  (preview: port 3000)
npm run build          # production build — verify after every step
npm run validate       # catalog schema + sandbox policy checks (use --strict before deploy)
npm test               # node:test unit tests for the rules/policy
npm run sync:tmdb      # TMDB → tmdbId, poster/backdrop, genres (needs TMDB_API_TOKEN)
npm run sync:tmdb -- --create "Blue Box" --season 1 --episodes   # add a show, no manual typing
npm run import:sources # data/import/sources.csv → catalog sources (bulk)
```

## Player rules (implemented exactly as specified)

* every embed renders as
  `sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"` — **`allow-popups` is
  never granted**, so popup ads are blocked by the browser. `assertSandboxPolicy()` throws in dev if
  somebody widens it, and `npm test` + `npm run validate` fail the build if it drifts.
* tabs above the player: `Server 1 … Server 4` (from `episode.sources`, `1`–`4` keys also switch).
* a dead server → **"Try another server" overlay**: pick a tab, `Retry this server`, or let the 6s
  countdown auto-switch to the next live tab. Dead tabs get a red dot on the tab bar.
* data model per episode is `sources: [{ label: "Server 1 — HD", kind: "iframe" | "video", url }]`.
* DNS notice ("Server not loading? Use the 1.1.1.1 app") is baked into the shell, dismissible.

## What Day 1 covers

| Requested | Status |
| --- | --- |
| Your UI + player shell with 4 server tabs (dummy data) | ✅ ported: hero, rails, browse filters, continue-watching, episode guide, player shell |
| Data model `sources[]` + tab switching + failover overlay + popup blocking | ✅ |
| `<video>` + hls.js stage (for direct files) | ✅ lazy-loads hls.js only for `.m3u8` |
| TMDB metadata mapping | ✅ `npm run sync:tmdb` (+ `/api/tmdb/search` proxy, key never ships to the browser) |
| Bulk ingest instead of manual entry | ✅ `npm run import:sources` (CSV/JSON → catalog) |
| Build verified | ✅ `npm run build` + `npm run validate` + `npm test` |
| Scraping AnimaHD's base64 `p=` links, anidisk/nxsha/hindianime embed templating, and the packed-JS `/api/extract` stream-sniffer | ❌ not built — see below |

Those last ones are unlicensed re-hosts of copyrighted episodes (and `p.a.c.k.e.r` unpacking is
specifically there to stop hotlinking), so AniRoll doesn't include that harvesting/extraction
pipeline. What you *do* get is the whole chassis around it: a show row, its episode rows, and a
`sources[]` array you can fill with anything you're allowed to serve — your own CDN files, your own
Drive uploads, licensed embeds. Adding a server later is one object in `src/lib/servers/index.ts`
plus rows in the CSV; the Player, tabs, sandbox and failover code never change.

## Adding an episode source (the actual workflow)

1. `npm run sync:tmdb -- --create "<title>" --season 1 --episodes` → show + episode rows with TMDB art.
2. Put rows in `data/import/sources.csv` (see `sources.csv.sample`) → `npm run import:sources -- --dry-run`, then drop the flag.
3. `npm run validate` — it enforces:
   * no `about:blank` enabled tab, no duplicate tab labels,
   * iframe URLs must be https **and** on an allowlisted host (`EMBED_HOST_ALLOWLIST` to extend),
   * `lang=hi` is rejected unless the row carries `hindi_confirmed=yes` → your "Drive only plays the
     default track, confirm Hindi on EP1 first" rule is now a build error, not a memory.
4. `npm run build && npm run start` (or `npm run dev`).

Merge/deploy: nothing is pushed to `main` from here — this branch (`arena/…`) only.
