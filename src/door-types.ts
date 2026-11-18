// The shapes of the data door's own sources and of the star sky: a star source, an object source, a picture source, the tile fetch, the options and the results of ucac4Source, starSky and withObjects. Moved out of door.ts as they were; door.ts re-exports them.
import type { Credit, ImageTile, MapPlace, RecordSource, TileSource, TileStats } from "./data-door.ts";
import type { DeepSkyObject } from "./deep-sky-core.ts";
import type { FaintField, FaintStar, FaintTile } from "./faint-core.ts";

/**
 * A source of stars in tiles: the place is a round patch of sky (`FaintField`), the detail is the faintest magnitude wanted, and a tile is the decoded `FaintTile` (parallel arrays of right ascension, declination, magnitude and B-V).
 *
 * @example
 * ```ts
 * import type { StarSource } from "@johnmorrisdotca/hoshi-stars/door";
 *
 * const names = (sources: StarSource[]): string[] => sources.map((source) => source.info.name.en);
 * console.log(names([]));
 * ```
 */
export type StarSource = TileSource<FaintField, number, FaintTile>;

/**
 * A source of deep-sky objects: a list that fits in memory (at most 200,000 records), read once.
 *
 * @example
 * ```ts
 * import type { ObjectSource } from "@johnmorrisdotca/hoshi-stars/door";
 *
 * const count = async (source: ObjectSource): Promise<number> => (await source.records(new AbortController().signal)).length;
 * console.log(typeof count);
 * ```
 */
export type ObjectSource = RecordSource<DeepSkyObject>;

/**
 * A source of a picture of the sky in tiles (a survey, an all-sky photograph): a map source, which uses the family's one map shape. The place is a `MapPlace` in right ascension and declination, the detail is the pixels across the whole circle
 * of right ascension, and a tile is an `ImageTile`. The package draws no all-sky picture yet; the type is the door the picture will come through, and a source of it already works with `createTileStore`.
 *
 * @example
 * ```ts
 * import type { SkyPictureSource } from "@johnmorrisdotca/hoshi-stars/door";
 *
 * const widest = (source: SkyPictureSource): readonly string[] => source.need({ lonMin: 0, lonMax: 360, latMin: -90, latMax: 90 }, 1024);
 * console.log(typeof widest);
 * ```
 */
export type SkyPictureSource = TileSource<MapPlace, number, ImageTile> & { layer: "sky" };

/**
 * A `fetch` as the loaders use it: the address and, for a stop, a signal. A function that takes only the address fits too.
 *
 * @example
 * ```ts
 * import type { TileFetch } from "@johnmorrisdotca/hoshi-stars/door";
 *
 * const get: TileFetch = (url) => fetch(url);
 * console.log(typeof get);
 * ```
 */
export type TileFetch = (url: string, init?: { signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; arrayBuffer(): Promise<ArrayBuffer> }>;

/**
 * What `ucac4Source` takes.
 *
 * @example
 * ```ts
 * import type { Ucac4Options } from "@johnmorrisdotca/hoshi-stars/door";
 *
 * const options: Ucac4Options = { baseUrl: "/faint-tiles/" };
 * console.log(options.baseUrl);
 * ```
 */
export interface Ucac4Options {
  /** The folder the tiles are in, with a closing slash: `FAINT_TILES_URL` where left out. */
  baseUrl?: string;
  /** The `fetch` to use: the global one where left out. */
  fetch?: TileFetch;
}

/**
 * What `starSky` takes.
 *
 * @example
 * ```ts
 * import { ucac4Source, type StarSkyOptions } from "@johnmorrisdotca/hoshi-stars/door";
 *
 * const options: StarSkyOptions = { sources: [ucac4Source()], budgetBytes: 24 * 1024 * 1024 };
 * console.log(options.sources?.length);
 * ```
 */
export interface StarSkyOptions {
  /** The sources to start with. Each is checked by `validateSource` at once. */
  sources?: readonly StarSource[];
  /** The bytes of decoded tiles held, all sources together: 48 MB where left out. */
  budgetBytes?: number;
  /** The most tiles held, all sources together: no limit where left out. */
  maxTiles?: number;
  /** The most loads in flight for one source: 6 where left out. */
  maxInFlight?: number;
  /** Called when tiles have arrived, failed, or a source was added, removed or switched, so that the page draws again. */
  onChange?: () => void;
  /** Called when the set of sources that contributed to the last drawn stars changes (not at each draw), with the new credits. */
  onCredits?: (credits: Credit[]) => void;
}

/**
 * The faint stars of a page from any number of sources: loads the tiles a patch needs from each and answers from the ones it has. With only `ucac4Source` it is `faintSky`.
 *
 * @example
 * ```ts no-run
 * import { creditLine, starSky, ucac4Source, type StarSource } from "@johnmorrisdotca/hoshi-stars/door";
 *
 * declare const mySource: StarSource;
 * const sky = starSky({ sources: [ucac4Source()] });
 * const remove = sky.addSource(mySource); // checked at once; returns the way to take it away
 * await sky.load({ rightAscension: 83.8, declination: -5.4, radius: 1 }, 12);
 * console.log(creditLine(sky.credits(), "en"));
 * remove();
 * ```
 */
export interface StarSky {
  /** The sources now in the view, in the order added. */
  readonly sources: readonly StarSource[];
  /** Adds a source. It throws a `TypeError` at once for a source `validateSource` refuses, an id already in the view or a source that is not a tile source. Returns the function that removes it. */
  addSource(source: StarSource): () => void;
  /** Removes a source by id: aborts its loads, frees its tiles, drops its credit. Returns whether there was one. */
  removeSource(id: string): boolean;
  /** Switches a source off (`false`) or on: off aborts its loads, frees its tiles and drops its credit, and the source stays in the view. */
  enable(id: string, on: boolean): void;
  /** `true` ignores every source that is not the package's own, at once (the same as `data="own"` on an element). */
  ownOnly(on: boolean): void;
  /** Fetch the tiles the patch needs for stars to `limit` from every source in use. Resolves when they are all here or refused for room, and rejects with the first error if a tile could not be fetched (the others stay). Asking again tries what is missing once more. */
  load(field: FaintField, limit?: number): Promise<void>;
  /** The stars of the patch from the tiles that are here, brightest first, from all sources together (see `faintStarsIn`), and `loaded`: whether every tile the patch needs is here. Sends nothing. */
  stars(field: FaintField, limit?: number, max?: number): { stars: FaintStar[]; depth: number; loaded: boolean };
  /** The sources that gave at least one star to the last `stars` call, the package's own first (`creditLine` writes them). */
  credits(): Credit[];
  /** How many tiles are here. */
  readonly size: number;
  /** What the store has done (loads started, failed, refused, held bytes), and `skipped`: the stars the last `stars` call left out for a number that is not finite. */
  stats(): TileStats & { skipped: number };
}

/**
 * What `withObjects` found.
 *
 * @example
 * ```ts
 * import type { ObjectsRead } from "@johnmorrisdotca/hoshi-stars/door";
 *
 * const names = (read: ObjectsRead): string[] => read.objects.map((object) => object.id);
 * console.log(typeof names);
 * ```
 */
export interface ObjectsRead {
  /** The objects: the page's own first, then each source's, none with an id already used, none with a position that is not on the sky. */
  objects: DeepSkyObject[];
  /** The credits, the package's own first: one for each source that gave at least one object. */
  credits: Credit[];
  /** Records left out: a position or magnitude that is not a finite number, a position off the sky, no id, a kind that is not a `DeepSkyType`, or an id already used. */
  skipped: number;
  /** Sources that could not be read (they threw, or sent too many records), with why. */
  failed: Array<{ id: string; reason: string }>;
}
