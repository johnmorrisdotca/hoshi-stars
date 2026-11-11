// The data door of the stars (`@johnmorrisdotca/hoshi-stars/door`, MODULES-831): one way to hand the package outside data, and to see whose data is on the screen. A source is a small typed object that carries its own licence and credit;
// `starSky` draws the faint stars from any number of tile sources (the package's own UCAC4 tiles are one, `ucac4Source`), `withObjects` adds records of deep-sky objects, and `SkyPictureSource` is the shape of a sky picture in tiles.
// The shapes and the four small functions are `./data-door.ts`, the same file in every package of the family (kazoku-ui's templates/data-door.ts). Nothing here is imported by the main entry: a page that never uses the door pays nothing.
// With no outside source this draws what `faintSky` always drew, and the package's own data is a source too, so one path writes the credit line for both. The data of this package is clear to pass on; a caller's source may be non-commercial or
// share-alike, and its credit line says so. Pure: no DOM, no clock; the fetch to use is handed in.
import { DEEP_SKY_TYPES, type DeepSkyObject } from "./deep-sky-core.ts";
import { createTileStore, loadRecords, validateSource, type Credit, type ImageTile, type MapPlace, type RecordSource, type SourceInfo, type TileLoader, type TileSource, type TileStats } from "./data-door.ts";
import { decodeFaintTile, FAINT_LIMIT, FAINT_TILES_URL, faintStarsWithTiles, faintTilePath, faintTilesFor, type FaintField, type FaintStar, type FaintTile } from "./faint-core.ts";

export { createTileStore, creditLine, loadRecords, MAX_IN_FLIGHT, MAX_RECORDS, TILE_BUDGET_BYTES, validateSource } from "./data-door.ts";
export type { BitmapLike, Credit, DataSource, ImageTile, Licence, MapPlace, RecordsRead, RecordSource, SourceInfo, TileLoader, TileSource, TileStats, TileStore, TileStoreOptions } from "./data-door.ts";

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

const NOTICE = "https://github.com/johnmorrisdotca/hoshi-stars/blob/main/NOTICE.md";

function freeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) for (const inner of Object.values(value)) freeze(inner);
  return Object.freeze(value);
}

/**
 * The package's own data, as sources, written from the rows of `NOTICE.md`: the Yale Bright Star Catalogue, UCAC4 and the deep-sky list from Wikidata. A test holds that none is non-commercial or share-alike, so the package can pass all of it on under
 * the MIT licence. The credit of what a view draws is written from these.
 *
 * @example
 * ```ts
 * import { OWN_SOURCES } from "@johnmorrisdotca/hoshi-stars/door";
 *
 * console.log(OWN_SOURCES.map((source) => `${source.id}: ${source.licence.name}`));
 * ```
 */
export const OWN_SOURCES: readonly SourceInfo[] = freeze([
  {
    id: "yale-bsc",
    name: { en: "Yale Bright Star Catalogue", ja: "イェール輝星カタログ" },
    credit: { en: "Bright stars: Yale Bright Star Catalogue, D. Hoffleit and W. H. Warren Jr. (1991), via NASA HEASARC", ja: "明るい星：イェール輝星カタログ（D. Hoffleit、W. H. Warren Jr.、1991年、NASA HEASARC提供）" },
    licence: { name: "Public domain", url: NOTICE },
    url: "https://heasarc.gsfc.nasa.gov/W3Browse/star-catalog/bsc5p.html",
    retrieved: "2026-11-08",
  },
  {
    id: "ucac4",
    name: { en: "UCAC4", ja: "UCAC4" },
    credit: {
      en: "Faint stars: UCAC4, N. Zacharias et al. (2013), U.S. Naval Observatory, via NASA/IPAC IRSA; magnitudes and colours from APASS",
      ja: "暗い星：UCAC4（N. Zacharias ほか、2013年、米国海軍天文台、NASA/IPAC IRSA提供、等級と色はAPASS）",
    },
    licence: { name: "UCAC4 terms of use", nameJa: "UCAC4の利用条件", url: "https://irsa.ipac.caltech.edu/data/USNO/UCAC4/overview.html" },
    url: "https://irsa.ipac.caltech.edu/data/USNO/UCAC4/overview.html",
    retrieved: "2026-11-09",
  },
  {
    id: "wikidata-deep-sky",
    name: { en: "Deep-sky objects from Wikidata", ja: "Wikidataのディープスカイ天体" },
    credit: { en: "Deep-sky objects: Wikidata", ja: "ディープスカイ天体：Wikidata" },
    licence: { name: "CC0 1.0", url: "https://creativecommons.org/publicdomain/zero/1.0/", spdx: "CC0-1.0" },
    url: "https://www.wikidata.org",
    retrieved: "2026-11-08",
  },
]);

const OWN_BY_ID = new Map(OWN_SOURCES.map((source) => [source.id, source]));
/** The source objects this package made itself: only these are its own, whatever id a caller's source gives itself. */
const MADE_HERE = new WeakSet<object>();

/**
 * The credit of one of the package's own sources, for the part of a page the door does not draw: the bright stars of the Yale catalogue are drawn from the main entry, so a page puts `ownCredit("yale-bsc", count)` first in its credit line.
 *
 * @param id - `yale-bsc`, `ucac4` or `wikidata-deep-sky`.
 * @param used - How many marks were drawn from it.
 * @returns The credit, marked as the package's own.
 * @throws RangeError for an id that is not one of `OWN_SOURCES`.
 *
 * @example
 * ```ts
 * import { creditLine, ownCredit } from "@johnmorrisdotca/hoshi-stars/door";
 *
 * console.log(creditLine([ownCredit("yale-bsc", 5080)], "en"));
 * ```
 */
export function ownCredit(id: string, used: number): Credit {
  const source = OWN_BY_ID.get(id);
  if (source === undefined) throw new RangeError(`"${id}" is not one of the package's own sources`);
  return { source, own: true, used };
}

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

const TILE_KEY = /^L(\d+)\/(\d+)-(\d+)\.bin$/;

/** What a decoded tile holds in memory: its parallel arrays, and the optional columns where a source has them. */
const tileBytes = (tile: FaintTile): number =>
  tile.rightAscension.byteLength + tile.declination.byteLength + tile.magnitude.byteLength + tile.colourIndex.byteLength + (tile.parallaxMas?.byteLength ?? 0) + (tile.properMotionRa?.byteLength ?? 0) + (tile.properMotionDec?.byteLength ?? 0);

/**
 * The package's own faint stars, UCAC4 to magnitude 12 in sky tiles, as a source: what `faintSky` has always loaded, through the door. The tiles are files served beside the page (by default from the package's Pages site), so a page that never
 * asks for them pays nothing. A tile that cannot be fetched is an `Error` naming it.
 *
 * @param options - Where the tiles are, and the `fetch` to use.
 * @returns The source: its `id` is `ucac4`, and `starSky` counts it as the package's own.
 *
 * @example
 * ```ts no-run
 * import { starSky, ucac4Source } from "@johnmorrisdotca/hoshi-stars/door";
 *
 * const sky = starSky({ sources: [ucac4Source({ baseUrl: "/faint-tiles/" })] });
 * const orion = { rightAscension: 83.8, declination: -5.4, radius: 1 };
 * await sky.load(orion, 11);
 * console.log(sky.stars(orion, 11, 1000).stars.length, sky.credits().map((credit) => credit.source.id));
 * ```
 */
export function ucac4Source(options: Ucac4Options = {}): StarSource {
  const base = options.baseUrl ?? FAINT_TILES_URL;
  const get: TileFetch = options.fetch ?? ((url, init) => globalThis.fetch(url, init));
  const source: StarSource = {
    kind: "tiles",
    info: OWN_BY_ID.get("ucac4")!,
    need: (field, limit) => faintTilesFor(field, limit).map(faintTilePath),
    async load(key, signal) {
      const found = TILE_KEY.exec(key);
      if (found === null) throw new RangeError(`"${key}" is not the name of a faint tile`);
      const response = await get(base + key, { signal });
      if (!response.ok) throw new Error(`The faint tile ${key} could not be fetched (${response.status})`);
      return decodeFaintTile({ level: Number(found[1]), band: Number(found[2]), column: Number(found[3]) }, new Uint8Array(await response.arrayBuffer()));
    },
    bytes: tileBytes,
  };
  MADE_HERE.add(source);
  return source;
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

const isFaintTile = (tile: unknown): tile is FaintTile => {
  if (typeof tile !== "object" || tile === null) return false;
  const one = tile as Record<string, unknown>;
  const count = one["count"];
  if (typeof count !== "number" || !Number.isInteger(count) || count < 0) return false;
  return ["rightAscension", "declination", "magnitude", "colourIndex"].every((name) => one[name] instanceof Float64Array && (one[name] as Float64Array).length >= count);
};

/**
 * The faint stars of a page, from any number of tile sources: the door's view of the sky. Each source is checked when it is added; tiles load only when the view asks (`load`), under one byte budget, at most six at a time per source, and
 * nothing is sent at rest; a source switched off or removed has its loads aborted and its tiles freed; a tile that fails, is not a faint tile or holds a number that is not finite is counted and never drawn; and `credits()` names the sources
 * that drew something in the last `stars` call.
 *
 * @param options - The sources to start with, the budget, and the two callbacks.
 * @returns The sky.
 * @throws TypeError at once for a starting source that `validateSource` refuses.
 *
 * @example
 * ```ts no-run
 * import { starSky, ucac4Source } from "@johnmorrisdotca/hoshi-stars/door";
 *
 * const sky = starSky({ sources: [ucac4Source()], onChange: () => console.log("draw again") });
 * await sky.load({ rightAscension: 299, declination: 40, radius: 2 }, 12);
 * console.log(sky.stars({ rightAscension: 299, declination: 40, radius: 2 }, 12, 500).stars.length);
 * ```
 */
export function starSky(options: StarSkyOptions = {}): StarSky {
  const list: StarSource[] = [];
  const off = new Set<string>();
  const loaders = new Map<string, TileLoader<FaintTile>>();
  const errors = new Map<string, Error>();
  let onlyOwn = false;
  let skipped = 0;
  let used = new Map<string, number>();
  let shown = "";
  const store = createTileStore<FaintTile>({
    ...(options.budgetBytes === undefined ? {} : { budgetBytes: options.budgetBytes }),
    ...(options.maxTiles === undefined ? {} : { maxTiles: options.maxTiles }),
    ...(options.maxInFlight === undefined ? {} : { maxInFlight: options.maxInFlight }),
    onChange: () => options.onChange?.(),
  });

  const isOwn = (source: StarSource): boolean => MADE_HERE.has(source);
  const inUse = (): StarSource[] => list.filter((source) => !off.has(source.info.id) && !(onlyOwn && !isOwn(source)));
  const keyOf = (id: string, key: string): string => `${id}\u0000${key}`;

  /** The source as the store sees it: a failure is remembered by its message, and a tile that is not a faint tile is a failure. */
  function loaderOf(source: StarSource): TileLoader<FaintTile> {
    let loader = loaders.get(source.info.id);
    if (loader === undefined || (loader as { source?: StarSource }).source !== source) {
      const id = source.info.id;
      loader = {
        info: source.info,
        async load(key, signal) {
          try {
            const tile = await source.load(key, signal);
            if (!isFaintTile(tile)) throw new TypeError(`Source "${id}" gave a tile "${key}" that is not a faint tile`);
            errors.delete(keyOf(id, key));
            return tile;
          } catch (error) {
            if (!signal.aborted) errors.set(keyOf(id, key), error instanceof Error ? error : new Error(String(error)));
            throw error;
          }
        },
        bytes: (tile) => source.bytes(tile),
      };
      Object.defineProperty(loader, "source", { value: source, enumerable: false });
      loaders.set(id, loader);
    }
    return loader;
  }

  const needOf = (source: StarSource, field: FaintField, limit: number): readonly string[] => {
    try {
      const keys = source.need(field, limit);
      return Array.isArray(keys) ? keys.filter((key): key is string => typeof key === "string") : [];
    } catch (error) {
      errors.set(keyOf(source.info.id, "need"), error instanceof Error ? error : new Error(String(error)));
      return [];
    }
  };

  const release = (id: string): void => {
    store.drop(id);
    loaders.delete(id);
    for (const key of [...errors.keys()]) if (key.startsWith(`${id}\u0000`)) errors.delete(key);
    used.delete(id);
  };
  const credits = (): Credit[] => {
    const own = inUse().filter(isOwn);
    const rest = inUse().filter((source) => !isOwn(source));
    return [...own, ...rest].filter((source) => (used.get(source.info.id) ?? 0) > 0).map((source) => ({ source: source.info, own: isOwn(source), used: used.get(source.info.id) ?? 0 }));
  };
  const announce = (): void => {
    const now = credits();
    const signature = now.map((credit) => credit.source.id).join(",");
    if (signature === shown) return;
    shown = signature;
    options.onCredits?.(now);
  };
  const check = (source: unknown): StarSource => {
    validateSource(source, list.map((one) => one.info.id));
    if ((source as { kind: string }).kind !== "tiles") throw new TypeError(`source "${(source as StarSource).info.id}": starSky takes tile sources; deep-sky records go through withObjects`);
    return source as StarSource;
  };
  const add = (source: StarSource): (() => void) => {
    list.push(check(source));
    options.onChange?.();
    return () => void remove(source.info.id);
  };
  const remove = (id: string): boolean => {
    const at = list.findIndex((source) => source.info.id === id);
    if (at < 0) return false;
    list.splice(at, 1);
    off.delete(id);
    release(id);
    announce();
    options.onChange?.();
    return true;
  };

  for (const source of options.sources ?? []) add(source);

  return {
    get sources() {
      return [...list];
    },
    addSource: add,
    removeSource: remove,
    enable(id, on) {
      if (!list.some((source) => source.info.id === id)) return;
      if (on) off.delete(id);
      else {
        off.add(id);
        release(id);
        announce();
      }
      options.onChange?.();
    },
    ownOnly(on) {
      onlyOwn = on;
      if (on) for (const source of list) if (!isOwn(source)) release(source.info.id);
      announce();
      options.onChange?.();
    },
    async load(field, limit = FAINT_LIMIT) {
      const wanted = inUse().map((source) => ({ source, keys: needOf(source, field, limit) }));
      for (const { source, keys } of wanted) store.want(loaderOf(source), keys, true);
      await store.idle();
      for (const { source, keys } of wanted) {
        for (const key of keys) {
          if (store.get(source.info.id, key) !== undefined) continue;
          const error = errors.get(keyOf(source.info.id, key));
          if (error !== undefined) throw error;
        }
        const broken = errors.get(keyOf(source.info.id, "need"));
        if (broken !== undefined) throw broken;
      }
    },
    stars(field, limit = FAINT_LIMIT, max = Infinity) {
      const owners = new Map<FaintTile, string>();
      const tiles: FaintTile[] = [];
      let loaded = true;
      for (const source of inUse()) {
        for (const key of needOf(source, field, limit)) {
          const tile = store.get(source.info.id, key);
          if (tile === undefined) loaded = false;
          else {
            tiles.push(tile);
            owners.set(tile, source.info.id);
          }
        }
      }
      const found = faintStarsWithTiles(tiles, field, limit, max);
      skipped = found.skipped;
      used = new Map();
      for (const tile of found.from) used.set(owners.get(tile)!, (used.get(owners.get(tile)!) ?? 0) + 1);
      announce();
      return { stars: found.stars, depth: found.depth, loaded };
    },
    credits,
    get size() {
      return store.stats().held;
    },
    stats: () => ({ ...store.stats(), skipped }),
  };
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

/**
 * Adds the deep-sky objects of outside sources to the page's own. Each source is checked by `validateSource` (a `TypeError` at once for an empty credit, no licence or a clashing id), read once, and every record is checked: a position that is not on
 * the sky, a number that is not finite, no id, an unknown kind or an id that is taken is left out and counted, never returned. A source that throws or holds more than 200,000 records is `failed` and adds nothing.
 * To switch a source off, leave it out of the next call.
 *
 * @param sources - The object sources.
 * @param options - `own`: the objects the page already draws (for example `messier()`), which come first and keep their ids; `signal`: stops the reads.
 * @returns The objects, their credits, and what was left out.
 * @throws TypeError for a source that `validateSource` refuses.
 *
 * @example
 * ```ts no-run
 * import { messier } from "@johnmorrisdotca/hoshi-stars/deep-sky";
 * import { creditLine, withObjects, type ObjectSource } from "@johnmorrisdotca/hoshi-stars/door";
 *
 * declare const myObjects: ObjectSource;
 * const read = await withObjects([myObjects], { own: messier() });
 * console.log(read.objects.length, read.skipped, creditLine(read.credits, "en"));
 * ```
 */
export async function withObjects(sources: readonly ObjectSource[], options: { own?: readonly DeepSkyObject[]; signal?: AbortSignal } = {}): Promise<ObjectsRead> {
  const taken: string[] = [];
  for (const source of sources) {
    validateSource(source, taken);
    if (source.kind !== "records") throw new TypeError(`source "${source.info.id}": withObjects takes record sources; stars in tiles go through starSky`);
    taken.push(source.info.id);
  }
  const signal = options.signal ?? new AbortController().signal;
  const objects: DeepSkyObject[] = [...(options.own ?? [])];
  const ids = new Set(objects.map((object) => object.id));
  const credits: Credit[] = objects.length > 0 ? [ownCredit("wikidata-deep-sky", objects.length)] : [];
  const failed: ObjectsRead["failed"] = [];
  let skipped = 0;
  const kinds = new Set<string>(DEEP_SKY_TYPES);
  for (const source of sources) {
    const read = await loadRecords(source, signal, (record) => [record.rightAscension, record.declination, ...(record.magnitude === undefined ? [] : [record.magnitude])]);
    if (read.status !== "ok") {
      if (read.status === "failed") failed.push({ id: source.info.id, reason: read.reason ?? "the read failed" });
      continue;
    }
    skipped += read.skipped;
    let given = 0;
    for (const record of read.records) {
      const sound =
        typeof record.id === "string" && record.id.trim() !== "" && !ids.has(record.id) && kinds.has(record.type) && record.rightAscension >= 0 && record.rightAscension < 360 && record.declination >= -90 && record.declination <= 90;
      if (!sound) {
        skipped += 1;
        continue;
      }
      ids.add(record.id);
      objects.push(Object.freeze({ ...record, otherIds: [...(record.otherIds ?? [])] }));
      given += 1;
    }
    if (given > 0) credits.push({ source: source.info, own: false, used: given });
  }
  return { objects, credits, skipped, failed };
}
