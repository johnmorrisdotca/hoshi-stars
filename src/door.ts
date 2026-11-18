// The data door of the stars (`@johnmorrisdotca/hoshi-stars/door`, MODULES-831): one way to hand the package outside data, and to see whose data is on the screen. A source is a small typed object that carries its own licence and credit;
// `starSky` draws the faint stars from any number of tile sources (the package's own UCAC4 tiles are one, `ucac4Source`), `withObjects` adds records of deep-sky objects, and `SkyPictureSource` is the shape of a sky picture in tiles.
// The shapes and the four small functions are `./data-door.ts`, the same file in every package of the family (kazoku-ui's templates/data-door.ts). Nothing here is imported by the main entry: a page that never uses the door pays nothing.
// With no outside source this draws what `faintSky` always drew, and the package's own data is a source too, so one path writes the credit line for both. The data of this package is clear to pass on; a caller's source may be non-commercial or
// share-alike, and its credit line says so. Pure: no DOM, no clock; the fetch to use is handed in.
import { DEEP_SKY_TYPES, type DeepSkyObject } from "./deep-sky-core.ts";
import type { ObjectSource, ObjectsRead, SkyPictureSource, StarSky, StarSkyOptions, StarSource, TileFetch, Ucac4Options } from "./door-types.ts";
import { createTileStore, loadRecords, validateSource, type Credit, type SourceInfo, type TileLoader } from "./data-door.ts";
import { decodeFaintTile, FAINT_LIMIT, FAINT_TILES_URL, faintStarsWithTiles, faintTilePath, faintTilesFor, type FaintField, type FaintTile } from "./faint-core.ts";

export { createTileStore, creditLine, loadRecords, MAX_IN_FLIGHT, MAX_RECORDS, TILE_BUDGET_BYTES, validateSource } from "./data-door.ts";
export type { ObjectSource, ObjectsRead, SkyPictureSource, StarSky, StarSkyOptions, StarSource, TileFetch, Ucac4Options };
export type { BitmapLike, Credit, DataSource, ImageTile, Licence, MapPlace, RecordsRead, RecordSource, SourceInfo, TileLoader, TileSource, TileStats, TileStore, TileStoreOptions } from "./data-door.ts";

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
    licence: { name: "UCAC4 terms of use", url: "https://irsa.ipac.caltech.edu/data/USNO/UCAC4/overview.html" },
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
