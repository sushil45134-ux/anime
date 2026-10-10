import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  FORBIDDEN_SANDBOX_TOKENS,
  SANDBOX,
  drivePreviewUrl,
  isAllowedHost,
  isMediaUrl,
  requiresHindiProof,
  rowToSource,
} from "../lib/rules.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");

test("sandbox string keeps the four allowed grants and nothing else", () => {
  const tokens = SANDBOX.split(/\s+/);
  assert.deepEqual(tokens, ["allow-scripts", "allow-same-origin", "allow-forms", "allow-presentation"]);
  for (const banned of FORBIDDEN_SANDBOX_TOKENS) assert.equal(tokens.includes(banned), false, `${banned} must never be granted`);
});

test("app-side policy cannot drift from the tested rules", async () => {
  const src = await readFile(path.join(ROOT, "src/lib/sandbox.ts"), "utf8");
  const m = src.match(/IFRAME_SANDBOX\s*=\s*"([^"]+)"/);
  assert.ok(m, "IFRAME_SANDBOX must be a single literal string");
  assert.equal(m[1], SANDBOX);
});

const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("every iframe in the app is rendered through the shared policy", async () => {
  for (const rel of ["src/components/player/EmbedStage.tsx", "src/components/player/Player.tsx", "src/components/player/VideoStage.tsx"]) {
    const code = stripComments(await readFile(path.join(ROOT, rel), "utf8"));
    assert.doesNotMatch(code, /allow-popups/, `${rel} must not mention or grant allow-popups in code`);
    assert.doesNotMatch(code, /sandbox="[^"]*"/, `${rel} must not hard-code its own sandbox string`);
  }
  const embed = await readFile(path.join(ROOT, "src/components/player/EmbedStage.tsx"), "utf8");
  assert.match(embed, /sandbox=\{IFRAME_SANDBOX\}/, "EmbedStage must use the imported constant, never a literal");
});

test("drive-preview accepts a bare file id or a share link", () => {
  const id = "1ztabxH762nPqr1tyzhSz_3tNBaeyY2Jk".replace(/./g, "x"); // shape only, never a real file
  assert.equal(drivePreviewUrl(id), `https://drive.google.com/file/d/${id}/preview`);
  assert.equal(drivePreviewUrl(`https://drive.google.com/file/d/${id}/view?usp=sharing`), `https://drive.google.com/file/d/${id}/preview`);
  assert.equal(drivePreviewUrl("nope"), null);
  assert.equal(drivePreviewUrl(""), null);
});

test("hosts are rejected unless allowlisted, and http is never enough", () => {
  assert.equal(isAllowedHost("https://drive.google.com/x"), true);
  assert.equal(isAllowedHost("https://evil.test/?to=drive.google.com"), false);
  assert.equal(isAllowedHost("http://youtube-nocookie.com/e"), false, "cleartext embeds must never validate");
  assert.equal(isMediaUrl("https://cdn.mine.test/a/x.m3u8"), true);
  assert.equal(isMediaUrl("https://cdn.mine.test/a/x.mp4"), true);
  assert.equal(isMediaUrl("https://cdn.mine.test/a/x.html"), false);
});

test("rowToSource maps each adapter to the agreed source shape", () => {
  const id = "a".repeat(33);
  assert.deepEqual(
    rowToSource({ slug: "x", adapter: "drive-preview", value: id, label: "Server 1 — HD" }).source,
    { label: "Server 1 — HD", note: undefined, lang: "unknown", provider: "drive-preview", kind: "iframe", url: `https://drive.google.com/file/d/${id}/preview` },
  );
  assert.equal(rowToSource({ adapter: "self-hosted", value: "https://cdn.mine.test/a/x.m3u8" }).source.kind, "video");
  assert.equal(rowToSource({ adapter: "direct-embed", value: "https://random.test/embed" }).error.includes("not embeddable"), true);
  assert.equal(rowToSource({ adapter: "coming-soon" }).source.enabled, false);
  assert.match(rowToSource({ adapter: "nope" }).error, /unknown adapter/);
});

test("Hindi tags are refused without a human EP1 confirmation", () => {
  assert.match(requiresHindiProof({ adapter: "drive-preview", lang: "hi" }), /hindi_confirmed/);
  assert.equal(requiresHindiProof({ adapter: "drive-preview", lang: "hi", hindi_confirmed: "yes" }), null);
  assert.equal(requiresHindiProof({ adapter: "drive-preview", lang: "en" }), null);
});
