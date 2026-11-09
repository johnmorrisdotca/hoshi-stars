// The loader for the faint stars: fetches the tiles of a patch of sky, decodes them, and keeps the last few hundred. It takes the `fetch` to use and reads no clock; a failed tile is simply asked for again the next time.
import { decodeFaintTile, faintStarsIn, faintTilePath, faintTilesFor, FAINT_LIMIT, type FaintField, type FaintStar, type FaintTile, type FaintTileId } from "./faint-core.ts";

/**
 * Where the tiles are by default: the package's GitHub Pages site. Every release's Pages build carries the tiles of that release in `faint-tiles/`, so the address does not change; to pin a version, or to keep the tiles on your own server,
 * pass `baseUrl`.
 *
 * @example
 * ```ts
 * import { FAINT_TILES_URL } from "@johnmorrisdotca/hoshi-stars/faint";
 *
 * console.log(`${FAINT_TILES_URL}L0/9-0.bin`);
 * ```
 */
export const FAINT_TILES_URL = "https://johnmorrisdotca.github.io/hoshi-stars/faint-tiles/";

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
  fetch?: (url: string) => Promise<{ ok: boolean; status: number; arrayBuffer(): Promise<ArrayBuffer> }>;
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
 * Make the loader for the faint stars.
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
  const base = options.baseUrl ?? FAINT_TILES_URL;
  const maxTiles = options.maxTiles ?? 256;
  const get = options.fetch ?? ((url: string) => globalThis.fetch(url));
  const here = new Map<string, FaintTile>();
  const coming = new Map<string, Promise<void>>();
  const keyOf = (tile: FaintTileId): string => faintTilePath(tile);

  function fetchTile(tile: FaintTileId): Promise<void> {
    const key = keyOf(tile);
    let promise = coming.get(key);
    if (promise === undefined) {
      promise = (async () => {
        const response = await get(base + key);
        if (!response.ok) throw new Error(`The faint tile ${key} could not be fetched (${response.status})`);
        const decoded = decodeFaintTile(tile, new Uint8Array(await response.arrayBuffer()));
        here.set(key, decoded);
        while (here.size > maxTiles) here.delete(here.keys().next().value!);
      })().finally(() => coming.delete(key));
      coming.set(key, promise);
    }
    return promise;
  }

  return {
    async load(field, limit = FAINT_LIMIT) {
      const need = faintTilesFor(field, limit).filter((tile) => !here.has(keyOf(tile)));
      const results = await Promise.allSettled(need.map(fetchTile));
      const failed = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
      if (failed !== undefined) throw failed.reason;
    },
    stars(field, limit = FAINT_LIMIT, max = Infinity) {
      const need = faintTilesFor(field, limit);
      const tiles: FaintTile[] = [];
      for (const tile of need) {
        const found = here.get(keyOf(tile));
        if (found !== undefined) {
          tiles.push(found);
          // a tile in use is the newest
          here.delete(keyOf(tile));
          here.set(keyOf(tile), found);
        }
      }
      return { ...faintStarsIn(tiles, field, limit, max), loaded: tiles.length === need.length };
    },
    get size() {
      return here.size;
    },
  };
}
