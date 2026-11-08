// The part the two deep-sky entry points share: what an object is, how a row of the data becomes one, and the lookups. Not an entry point itself.
// Pure: no DOM, no clock, no state beyond the parsed table.

/**
 * The kinds of deep-sky object, a small fixed list.
 *
 * @example
 * ```ts
 * import { DEEP_SKY_TYPES } from "@johnmorrisdotca/hoshi-stars/deep-sky";
 *
 * console.log(DEEP_SKY_TYPES.length, DEEP_SKY_TYPES.includes("galaxy"));
 * ```
 */
export const DEEP_SKY_TYPES = ["other", "galaxy", "globular cluster", "open cluster", "nebula", "planetary nebula", "supernova remnant"] as const;

/**
 * The kind of a deep-sky object: `galaxy`, `globular cluster`, `open cluster`, `nebula` (emission, reflection and dark nebulae and H II regions), `planetary nebula`, `supernova remnant`, or
 * `other` (an asterism, a star cloud, a double star, a source that is not any of those).
 *
 * @example
 * ```ts
 * import { deepSkyObject, type DeepSkyType } from "@johnmorrisdotca/hoshi-stars/deep-sky";
 *
 * const type: DeepSkyType = deepSkyObject("M1")!.type;
 * console.log(type);
 * ```
 */
export type DeepSkyType = (typeof DEEP_SKY_TYPES)[number];

/**
 * One deep-sky object. Positions are J2000 (equator and equinox of 2000), the same frame as `Star`.
 *
 * @example
 * ```ts
 * import { deepSkyObject, type DeepSkyObject } from "@johnmorrisdotca/hoshi-stars/deep-sky";
 *
 * const andromeda: DeepSkyObject = deepSkyObject("M31")!;
 * console.log(andromeda.id, andromeda.ngc, andromeda.name, andromeda.magnitude);
 * ```
 */
export interface DeepSkyObject {
  /** The Messier designation (`M31`) if the object has one, else the NGC (`NGC 7000`), else the IC (`IC 434`). Unique, and a name `deepSkyObject` finds. */
  id: string;
  /** The Messier designation (`M31`), or `undefined`. */
  messier: string | undefined;
  /** The New General Catalogue designation (`NGC 224`), or `undefined`. Where an object has several (a duplicate entry, a component), the lowest plain number. */
  ngc: string | undefined;
  /** The Index Catalogue designation (`IC 434`), or `undefined`. */
  ic: string | undefined;
  /** The object's other NGC and IC designations (`NGC 978A`, `NGC 1051` for the object that is also `NGC 961`), each one found by `deepSkyObject` too. Usually empty. */
  otherIds: string[];
  /** The common name where Wikidata's English label is one (`Andromeda Galaxy`, `Crab Nebula`), else `undefined`. */
  name: string | undefined;
  /** The kind of object. */
  type: DeepSkyType;
  /** The IAU three-letter constellation abbreviation (`And`), or `undefined`. It is the same text as `Star.constellation`. */
  constellation: string | undefined;
  /** Right ascension in degrees at J2000, 0 up to 360. Given to 0.0001 degree (0.36 arc-second). */
  rightAscension: number;
  /** Declination in degrees at J2000, -90 to 90. Given to 0.0001 degree. */
  declination: number;
  /** Visual (V band) magnitude of the whole object, or `undefined` where there is none (for the Messier objects there always is one). Smaller is brighter: M31 is 3.4. */
  magnitude: number | undefined;
  /** The major axis in arc-minutes, or `undefined` where it is not known (most NGC and IC objects). */
  sizeArcmin: number | undefined;
}

/**
 * The catalogue names `deepSky` accepts for its `catalogue` option.
 *
 * @example
 * ```ts
 * import { DEEP_SKY_CATALOGUES, deepSky } from "@johnmorrisdotca/hoshi-stars/deep-sky";
 *
 * console.log(DEEP_SKY_CATALOGUES.map((catalogue) => deepSky({ catalogue }).length));
 * ```
 */
export const DEEP_SKY_CATALOGUES = ["messier", "ngc", "ic"] as const;

/**
 * The options of `deepSky`: all optional, and together they narrow the list.
 *
 * @example
 * ```ts
 * import { deepSky, type DeepSkyOptions } from "@johnmorrisdotca/hoshi-stars/deep-sky";
 *
 * const options: DeepSkyOptions = { type: "globular cluster", magnitude: 6.5 };
 * console.log(deepSky(options).map((o) => o.id));
 * ```
 */
export interface DeepSkyOptions {
  /** Only objects that have a number in that catalogue: `"messier"`, `"ngc"` or `"ic"`. */
  catalogue?: (typeof DEEP_SKY_CATALOGUES)[number];
  /** Only objects as bright as this magnitude (an object of exactly that magnitude is in). An object with no magnitude is never in. */
  magnitude?: number;
  /** Only objects of that kind. */
  type?: DeepSkyType;
}

/**
 * What a table of objects offers: the list, a filtered list and a lookup. Each entry point makes one from its data.
 *
 * @example
 * ```ts
 * import { deepSky } from "@johnmorrisdotca/hoshi-stars/deep-sky";
 *
 * console.log(deepSky({ type: "planetary nebula" }).length);
 * ```
 */
export interface DeepSkyTable {
  /** All the objects in catalogue order, as a fresh array. */
  all(): DeepSkyObject[];
  /** The objects that meet the options, in catalogue order. */
  select(options: DeepSkyOptions): DeepSkyObject[];
  /** One object by any of its names, or `undefined`. */
  find(text: string): DeepSkyObject | undefined;
}

function fold(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

/** The lookup key of a text: `M 31`, `m31` and `Messier 31` all give `m31`; `ngc 0224` gives `ngc224`; any other text is its folded self. */
function key(text: string): string {
  const folded = fold(text);
  const designation = /^(m|messier|ngc|ic) ?0*(\d+) ?([a-z]?)$/.exec(folded);
  return designation === null ? folded : `${designation[1] === "messier" ? "m" : designation[1]}${designation[2]}${designation[3]}`;
}

function designations(prefix: string, list: string): string[] {
  return list === "" ? [] : list.split(",").map((number) => `${prefix}${number}`);
}

const parsedRows = new Map<string, DeepSkyObject[]>();
const aliasesOf = new WeakMap<DeepSkyObject, string[]>();

/** The objects of a string of rows, parsed once however many tables use it (the large table's Messier objects are the small table's). */
function parsed(rows: string): DeepSkyObject[] {
  const found = parsedRows.get(rows);
  if (found !== undefined) return found;
  const list: DeepSkyObject[] = [];
  for (const row of rows.split("\n")) {
    const p = row.split("|") as [string, string, string, string, string, string, string, string, string, string, string];
    const messier = p[0] === "" ? undefined : `M${p[0]}`;
    const ngc = designations("NGC ", p[1]);
    const ic = designations("IC ", p[2]);
    const object: DeepSkyObject = Object.freeze({
      id: messier ?? ngc[0] ?? ic[0]!,
      messier,
      ngc: ngc[0],
      ic: ic[0],
      otherIds: Object.freeze([...ngc.slice(1), ...ic.slice(1)]) as string[],
      name: p[9] === "" ? undefined : p[9],
      type: DEEP_SKY_TYPES[Number(p[3])]!,
      constellation: p[8] === "" ? undefined : p[8],
      rightAscension: Number(p[4]) / 10000,
      declination: Number(p[5]) / 10000,
      magnitude: p[6] === "" ? undefined : Number(p[6]) / 100,
      sizeArcmin: p[7] === "" ? undefined : Number(p[7]) / 10,
    });
    if (p[10] !== "") aliasesOf.set(object, p[10].split(";"));
    list.push(object);
  }
  parsedRows.set(rows, list);
  return list;
}

/**
 * Parse rows of the data into a table. A row is `Messier | NGC numbers | IC numbers | type | RA | Dec | magnitude | size | constellation | name | other names`, as `scripts/make-deep-sky-data.py` writes them.
 *
 * @param rowSets - One or more strings of rows, one object a line, in catalogue order.
 * @returns The table.
 *
 * @example
 * ```ts
 * import { deepSkyTable } from "../src/deep-sky-core.ts";
 *
 * console.log(deepSkyTable(["31|224||1|106847|412688|344||And|Andromeda Galaxy|"]).all()[0]?.id);
 * ```
 */
export function deepSkyTable(rowSets: string[]): DeepSkyTable {
  const stored: DeepSkyObject[] = [];
  const byKey = new Map<string, DeepSkyObject>();
  const ambiguous = new Set<string>();
  let loaded = false;

  function add(text: string | undefined, object: DeepSkyObject): void {
    if (text === undefined || text === "") return;
    const k = key(text);
    const other = byKey.get(k);
    if (other !== undefined && other !== object) {
      // A Messier object keeps a name that a fainter object also carries (Wikidata calls a part of Barnard's Galaxy "Ring Nebula" too).
      if (other.messier !== undefined && object.messier === undefined) return;
      ambiguous.add(k);
    }
    byKey.set(k, object);
  }

  function load(): void {
    if (loaded) return;
    loaded = true;
    for (const rows of rowSets) {
      for (const object of parsed(rows)) {
        stored.push(object);
        for (const text of [object.messier, object.ngc, object.ic, ...object.otherIds, object.name, ...(aliasesOf.get(object) ?? [])]) add(text, object);
      }
    }
    for (const k of ambiguous) byKey.delete(k);
  }

  return {
    all: () => {
      load();
      return [...stored];
    },
    select: (options) => {
      load();
      const { catalogue, magnitude, type } = options;
      if (catalogue !== undefined && !DEEP_SKY_CATALOGUES.includes(catalogue)) throw new RangeError(`catalogue must be "messier", "ngc" or "ic", got ${JSON.stringify(catalogue)}`);
      if (magnitude !== undefined && (typeof magnitude !== "number" || Number.isNaN(magnitude))) throw new TypeError(`magnitude must be a number, got ${String(magnitude)}`);
      if (type !== undefined && !DEEP_SKY_TYPES.includes(type)) throw new RangeError(`type must be one of ${DEEP_SKY_TYPES.join(", ")}, got ${JSON.stringify(type)}`);
      return stored.filter(
        (o) => (catalogue === undefined || o[catalogue] !== undefined) && (type === undefined || o.type === type) && (magnitude === undefined || (o.magnitude !== undefined && o.magnitude <= magnitude)),
      );
    },
    find: (text) => {
      if (typeof text !== "string") throw new TypeError(`text must be a string, got ${typeof text}`);
      load();
      return byKey.get(key(text));
    },
  };
}
