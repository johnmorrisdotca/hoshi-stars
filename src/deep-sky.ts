// The 110 Messier objects, and the lookups for them. The deep-sky tier (`@johnmorrisdotca/hoshi-stars/deep-sky`): a table of about 3 kB gzipped. The NGC and IC objects, about 150 kB more, are the
// separate `@johnmorrisdotca/hoshi-stars/deep-sky/ngc-ic`, so a page that wants the Messier objects pays for them only. Pure: no DOM, no clock, no state beyond the parsed table.
import { MESSIER_ROWS } from "./data/messier.ts";
import { MESSIER_DISTANCES } from "./data/galaxy-distances-messier.ts";
import { deepSkyTable, type DeepSkyObject, type DeepSkyOptions } from "./deep-sky-core.ts";
import { distanceTable, type GalaxyDistance } from "./galaxy-distance-core.ts";

export { DEEP_SKY_CATALOGUES, DEEP_SKY_TYPES, type DeepSkyObject, type DeepSkyOptions, type DeepSkyType } from "./deep-sky-core.ts";

export { COMPILED_METHOD, type DistanceValue, type GalaxyDistance, type GalaxyDistanceSource } from "./galaxy-distance-core.ts";

const table = deepSkyTable([MESSIER_ROWS]);
const distances = distanceTable([MESSIER_DISTANCES]);

/**
 * The 110 Messier objects, M1 first and M110 last. M102 is the one the literature disagrees about: Messier's own description matches M101 (a repeat of it), and the modern lists take it for the
 * lenticular galaxy NGC 5866, which is what this table does (a note on M102 is in `NOTICE.md`). M40 (Winnecke 4, a double star) and M73 (four stars) are in the list as `other`, since Messier
 * listed them.
 *
 * @returns A fresh array of the shared, frozen objects.
 *
 * @example
 * ```ts
 * import { messier } from "@johnmorrisdotca/hoshi-stars/deep-sky";
 *
 * console.log(messier().length, messier()[30]?.name);
 * ```
 */
export function messier(): DeepSkyObject[] {
  return table.all();
}

/**
 * The Messier objects that meet the options, in Messier order. For the NGC and IC objects too, use `deepSky` from `@johnmorrisdotca/hoshi-stars/deep-sky/ngc-ic`.
 *
 * @param options - `catalogue`: only objects with a number in `"messier"`, `"ngc"` or `"ic"` (here 110, 106 and 3: M24 and M25 have only an IC number, and M40 and M45 have none). `magnitude`: only objects as
 * bright as that. `type`: only that kind (`"galaxy"`, `"globular cluster"`, `"open cluster"`, `"nebula"`, `"planetary nebula"`, `"supernova remnant"` or `"other"`).
 * @returns A fresh array of the shared, frozen objects.
 * @throws RangeError if `catalogue` or `type` is not one of those. TypeError if `magnitude` is not a number.
 *
 * @example
 * ```ts
 * import { deepSky } from "@johnmorrisdotca/hoshi-stars/deep-sky";
 *
 * console.log(deepSky({ type: "globular cluster", magnitude: 6.5 }).map((o) => o.id));
 * ```
 */
export function deepSky(options: DeepSkyOptions = {}): DeepSkyObject[] {
  return table.select(options);
}

/**
 * A Messier object by any of its names, ignoring case, spacing and the accent on a letter: the Messier designation (`M31`, `m 31`, `Messier 31`), its NGC or IC designation (`NGC 224`, `ngc224`) or its
 * common name in English (`Andromeda Galaxy`, `Andromeda Nebula`). A name that two objects share finds neither, except that a Messier object keeps its name.
 *
 * @param text - The designation or name.
 * @returns The object, or `undefined` if the text names none of the Messier objects.
 * @throws TypeError if `text` is not a string.
 *
 * @example
 * ```ts
 * import { deepSkyObject } from "@johnmorrisdotca/hoshi-stars/deep-sky";
 *
 * console.log(deepSkyObject("M31")?.ngc, deepSkyObject("Crab Nebula")?.id, deepSkyObject("NGC 1976")?.name);
 * ```
 */
export function deepSkyObject(text: string): DeepSkyObject | undefined {
  return table.find(text);
}

/**
 * The distance to a Messier galaxy: the median of the distances Wikidata (CC0) gives, in light-years and parsecs, with the error where a statement has one, the lowest and highest statement, how
 * many there are and whether they disagree (the highest more than 1.2 times the lowest). The method is always "compiled, method not stated": Wikidata gathers published values and names no method.
 * This table holds the Messier galaxies only; for the NGC and IC galaxies use `galaxyDistance` from `@johnmorrisdotca/hoshi-stars/deep-sky/ngc-ic`.
 *
 * @param object - A deep-sky object.
 * @returns The distance, frozen, or `null` for an object that is not a galaxy, one the source has no distance for, or one that is not a Messier object.
 *
 * @example
 * ```ts
 * import { deepSkyObject, galaxyDistance } from "@johnmorrisdotca/hoshi-stars/deep-sky";
 *
 * const m31 = galaxyDistance(deepSkyObject("M31")!);
 * console.log(m31?.lightYears, m31?.parsecs, m31?.method, m31?.disagree);
 * ```
 */
export function galaxyDistance(object: DeepSkyObject): GalaxyDistance | null {
  return distances.distanceOf(object);
}
