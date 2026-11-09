// Which Milky Way brightness grid a run reads (MODULES-780): the shipped one, src/data/milky-way.ts (SAO star counts, IRAS and COBE DIRBE dust, our own bulge and disk), or the fallback,
// data-no-sao/milky-way.ts (COBE DIRBE 1.25 micron starlight, the same dust, our own bulge and disk, and no star catalogue), written by `scripts/make-milky-way-data.py --no-sao`.
//
// `HOSHI_NO_SAO=1` makes one run read the fallback: the tests (`node --import ./scripts/milky-source-hook.mjs`) and the demo build (`pnpm site`) follow it, so the pictures and the checks are
// of the fallback without anything in src/ changing. It is for trying the fallback and does not change what `pnpm build` publishes.
//
// THE ONE CHANGE THAT SWAPS THE FALLBACK IN is to put the fallback's file over the shipped one: `cp data-no-sao/milky-way.ts src/data/milky-way.ts` (or
// `python3 -I scripts/make-milky-way-data.py --no-sao --out src/data/milky-way.ts`, which writes the same bytes). Nothing in src/ knows about either; the NOTICE.md paragraph on the Milky Way
// then names the fallback's sources (docs/research/milky-no-sao.md says what to change in it).
import { fileURLToPath } from "node:url";

/** Whether this run reads the fallback grid: `HOSHI_NO_SAO=1` says yes, anything else says no. */
export function noSao(env = process.env) {
  return env.HOSHI_NO_SAO === "1";
}

const root = new URL("..", import.meta.url);

/** The one table the fallback replaces: where the shipped grid is and where the fallback is (file URLs and paths). */
export const MILKY_SWAPPED = {
  shipped: new URL("src/data/milky-way.ts", root).href,
  fallback: new URL("data-no-sao/milky-way.ts", root).href,
  shippedPath: fileURLToPath(new URL("src/data/milky-way.ts", root)),
  fallbackPath: fileURLToPath(new URL("data-no-sao/milky-way.ts", root)),
};
