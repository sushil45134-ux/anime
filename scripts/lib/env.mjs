import { readFileSync } from "node:fs";
import path from "node:path";

/** Tiny .env loader so CLI scripts work whether or not a .env file exists. */
const file = path.resolve(import.meta.dirname, "../../.env");
try {
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/i);
    if (!m || line.trim().startsWith("#")) continue;
    const value = m[2].trim().replace(/^["']|["']$/g, "");
    if (value && process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
} catch {
  /* no .env — fine */
}
