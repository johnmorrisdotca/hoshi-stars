// Which parallax data the package is built with (MODULES-779): the Yale GCTP data in src/data/ (what ships today) or the fallback for the day that catalogue has to come out, in data-no-gctp/.
//
// THE ONE CHANGE THAT SWAPS THE FALLBACK IN is the line `DEFAULT_NO_GCTP = false` below: set it to `true` and the build, the demo, the tests and the data export all read data-no-gctp/ instead of
// src/data/stars.ts and src/data/nearby.ts. `HOSHI_NO_GCTP=1` (or `=0`) overrides it for one run, which is how the fallback is tried without changing the default.
//
// How the swap reaches each tool: the tsc build (scripts/build.mjs) writes the fallback tables over dist/data/stars.js and nearby.js; the demo's esbuild bundle (scripts/site.ts) resolves the two
// imports to the fallback files; node (the tests, the data export) gets the same through the resolve hook that scripts/data-source-hook.mjs registers (`node --import ./scripts/data-source-hook.mjs`).
// Nothing in src/ knows about any of this: src/stars.ts and src/nearby.ts import the same two files as ever.
import { fileURLToPath } from "node:url";

/** The default: false ships the Yale GCTP parallaxes and the nearby layer, true ships the fallback. Flip this and nothing else. */
export const DEFAULT_NO_GCTP = false;

/** Whether this run reads the fallback tables: `HOSHI_NO_GCTP=1` says yes, `HOSHI_NO_GCTP=0` says no, anything else leaves it to `DEFAULT_NO_GCTP`. */
export function noGctp(env = process.env) {
  if (env.HOSHI_NO_GCTP === "1") return true;
  if (env.HOSHI_NO_GCTP === "0") return false;
  return DEFAULT_NO_GCTP;
}

const root = new URL("..", import.meta.url);

/** The two tables the fallback replaces, by name: where the shipped one is and where the fallback is (file URLs and paths). */
export const SWAPPED = ["stars", "nearby"].map((name) => ({
  name,
  shipped: new URL(`src/data/${name}.ts`, root).href,
  fallback: new URL(`data-no-gctp/${name}.ts`, root).href,
  shippedPath: fileURLToPath(new URL(`src/data/${name}.ts`, root)),
  fallbackPath: fileURLToPath(new URL(`data-no-gctp/${name}.ts`, root)),
}));
