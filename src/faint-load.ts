// The loader for the faint stars: fetches the tiles of a patch of sky, decodes them, and keeps the last few hundred. It takes the `fetch` to use and reads no clock; a failed tile is asked for again the next time `load` is called.
// It is the data door (`./door.ts`) with one source, UCAC4's own tiles: a thin wrapper that keeps every option and every answer it always had.
import { starSky, ucac4Source, type TileFetch } from "./door.ts";
import { FAINT_LIMIT, FAINT_TILES_URL, type FaintField, type FaintStar } from "./faint-core.ts";

/**
 * What `faintSky` takes.
 *
 * @example
 * ```ts
 * import type { FaintSkyOptions } from "@johnmorrisdotca/hoshi-stars/faint";
 *
 * const options: FaintSkyOptions = { baseUrl: "/faint-tiles/", maxTiles: 128 };
 * console.log(options.baseUrl);
 * ```
 */
export interface FaintSkyOptions {
  /** The folder the tiles are in, with a closing slash: `FAINT_TILES_URL` where left out. */
  baseUrl?: string;
  /** The `fetch` to use: the global one where left out. */
  fetch?: TileFetch;
  /** How many decoded tiles to keep before the oldest is let go: 256 where left out (about 40 MB at the most). */
  maxTiles?: number;
}

/**
 * The faint stars of a page: loads the tiles a patch of sky needs, and answers from the ones it has.
 *
 * @example
 * ```ts no-run
 * import { faintSky } from "@johnmorrisdotca/hoshi-stars/faint";
 *
 * const sky = faintSky();
 * const orion = { rightAscension: 83.8, declination: -5.4, radius: 1 };
 * await sky.load(orion, 11);
 * console.log(sky.stars(orion, 11, 1000).stars.length);
 * ```
 */
export interface FaintSky {
  /** Fetch the tiles the patch needs for stars to `limit` that are not here yet. Resolves when they are all here, and rejects if one could not be fetched (the others stay). */
  load(field: FaintField, limit?: number): Promise<void>;
  /** The stars of the patch from the tiles that are here (see `faintStarsIn`), and `loaded`: whether every tile the patch needs is here, so that nothing is missing. */
  stars(field: FaintField, limit?: number, max?: number): { stars: FaintStar[]; depth: number; loaded: boolean };
  /** How many tiles are here. */
  readonly size: number;
}

/**
 * Make the loader for the faint stars. It is `starSky` with the package's own UCAC4 source (`ucac4Source`); to add a source of your own, or to see the credits of what is drawn, use `starSky` from `@johnmorrisdotca/hoshi-stars/door`.
 *
 * @param options - Where the tiles are, and the `fetch` to use.
 * @returns The loader.
 *
 * @example
 * ```ts no-run
 * import { faintSky } from "@johnmorrisdotca/hoshi-stars/faint";
 *
 * const sky = faintSky({ baseUrl: "https://cdn.jsdelivr.net/gh/johnmorrisdotca/hoshi-stars/faint-tiles/" });
 * await sky.load({ rightAscension: 299, declination: 40, radius: 2 }, 12);
 * ```
 */
export function faintSky(options: FaintSkyOptions = {}): FaintSky {
  const sky = starSky({
    sources: [ucac4Source({ baseUrl: options.baseUrl ?? FAINT_TILES_URL, ...(options.fetch === undefined ? {} : { fetch: options.fetch }) })],
    maxTiles: options.maxTiles ?? 256,
  });
  return {
    load: (field, limit = FAINT_LIMIT) => sky.load(field, limit),
    stars: (field, limit = FAINT_LIMIT, max = Infinity) => sky.stars(field, limit, max),
    get size() {
      return sky.size;
    },
  };
}
