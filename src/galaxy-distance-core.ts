// The part the two deep-sky entry points share: what a galaxy's distance is, how a row of the data becomes one, and the lookup. Not an entry point itself.
// Pure: no DOM, no clock, no state beyond the parsed tables.
import type { DeepSkyObject } from "./deep-sky-core.ts";

/**
 * A length in the two units the package gives distances in.
 *
 * @example
 * ```ts
 * import { galaxyDistance, type DistanceValue } from "@johnmorrisdotca/hoshi-stars/deep-sky";
 * import { deepSkyObject } from "@johnmorrisdotca/hoshi-stars/deep-sky";
 *
 * const away: DistanceValue = galaxyDistance(deepSkyObject("M31")!)!.spread.low;
 * console.log(away.lightYears, away.parsecs);
 * ```
 */
export interface DistanceValue {
  /** The length in light-years. */
  lightYears: number;
  /** The length in parsecs. */
  parsecs: number;
}

/**
 * Where a galaxy's distance was read: a database, its licence, the items of it that were read and how many statements they held.
 *
 * @example
 * ```ts
 * import { deepSkyObject, galaxyDistance, type GalaxyDistanceSource } from "@johnmorrisdotca/hoshi-stars/deep-sky";
 *
 * const source: GalaxyDistanceSource = galaxyDistance(deepSkyObject("M31")!)!.sources[0]!;
 * console.log(source.name, source.licence, source.items, source.values);
 * ```
 */
export interface GalaxyDistanceSource {
  /** The database: `Wikidata`. */
  name: string;
  /** The licence the values are given under: `CC0 1.0`. */
  licence: string;
  /** The database's item numbers for the galaxy (`Q2469`), so each value can be looked up. Usually one. */
  items: string[];
  /** How many distance statements the median is of (deprecated ones are not counted). */
  values: number;
}

/**
 * The distance to a galaxy, with what is known of where it came from. The headline is the median of the distances the source gives; no value is averaged with a different method's, because none states a method.
 *
 * @example
 * ```ts
 * import { deepSkyObject, galaxyDistance, type GalaxyDistance } from "@johnmorrisdotca/hoshi-stars/deep-sky";
 *
 * const distance: GalaxyDistance | null = galaxyDistance(deepSkyObject("M31")!);
 * console.log(distance?.lightYears, distance?.method);
 * ```
 */
export interface GalaxyDistance {
  /** The distance in light-years (the median of the statements). */
  lightYears: number;
  /** The distance in parsecs (the median of the statements). */
  parsecs: number;
  /** The error, or `null` where no statement states one. It is the half-width of the bounds the source gives, not a total error: the values that disagree with each other (see `spread`) often differ by more. */
  error: DistanceValue | null;
  /** How the distance was measured. For every distance here it is `"compiled, method not stated"`: the source gathers published values and names no method. */
  method: string;
  /** Where the values were read, for the credit line and the trace back. */
  sources: GalaxyDistanceSource[];
  /** The number of statements the distance is the median of. */
  count: number;
  /** The lowest and highest of the statements. The same value twice where there is one statement. */
  spread: { low: DistanceValue; high: DistanceValue };
  /** True where the highest statement is more than 1.2 times the lowest: the sources disagree and the distance is good to less than the headline's digits. */
  disagree: boolean;
}

/** The method every Wikidata distance carries. */
export const COMPILED_METHOD = "compiled, method not stated";

/** The factor beyond which the highest value and the lowest are said to disagree. */
const DISAGREE_RATIO = 1.2;
/** Light-years in a parsec (648000 / pi astronomical units, the IAU's exact parsec, over the Julian year's light-year). */
const LIGHT_YEARS_PER_PARSEC = 3.261563777167433;

const parsedRows = new Map<string, Map<string, GalaxyDistance>>();

function value(parsecs: number): DistanceValue {
  return Object.freeze({ lightYears: parsecs * LIGHT_YEARS_PER_PARSEC, parsecs });
}

/** The distances of a string of rows, parsed once however many tables use it. */
function parsed(rows: string): Map<string, GalaxyDistance> {
  const found = parsedRows.get(rows);
  if (found !== undefined) return found;
  const map = new Map<string, GalaxyDistance>();
  for (const row of rows === "" ? [] : rows.split("\n")) {
    const p = row.split("|") as [string, string, string, string, string, string, string];
    const [median, low, high] = [Number(p[2]), Number(p[3]), Number(p[4])];
    map.set(
      p[0],
      Object.freeze({
        ...value(median),
        error: p[6] === "" ? null : value(Number(p[6])),
        method: COMPILED_METHOD,
        sources: Object.freeze([Object.freeze({ name: "Wikidata", licence: "CC0 1.0", items: Object.freeze(p[1].split(",").map((n) => `Q${n}`)) as string[], values: Number(p[5]) })]) as GalaxyDistanceSource[],
        count: Number(p[5]),
        spread: Object.freeze({ low: value(low), high: value(high) }),
        disagree: high > DISAGREE_RATIO * low,
      }),
    );
  }
  parsedRows.set(rows, map);
  return map;
}

/** The short id the rows use: `M31`, `N7000` for NGC 7000 and `I434` for IC 434. */
function shortId(object: DeepSkyObject): string {
  return object.messier ?? (object.ngc !== undefined ? object.ngc.replace("NGC ", "N") : object.ic!.replace("IC ", "I"));
}

/**
 * Make a lookup from rows of the data, as `scripts/make-galaxy-distances.py` writes them: `id | Wikidata item numbers | median parsecs | lowest | highest | count | median error or empty`.
 *
 * @param rowSets - One or more strings of rows, one galaxy a line.
 * @returns The lookup, and the list of the galaxies it holds in the order of the rows.
 *
 * @example
 * ```ts
 * import { distanceTable } from "../src/galaxy-distance-core.ts";
 * import { deepSkyObject } from "../src/deep-sky.ts";
 *
 * console.log(distanceTable(["M31|2469|820000|820000|820000|1|"]).distanceOf(deepSkyObject("M31")!)?.parsecs);
 * ```
 */
export function distanceTable(rowSets: string[]): { distanceOf(object: DeepSkyObject): GalaxyDistance | null } {
  return {
    distanceOf: (object) => {
      const id = shortId(object);
      for (const rows of rowSets) {
        const found = parsed(rows).get(id);
        if (found !== undefined) return found;
      }
      return null;
    },
  };
}
