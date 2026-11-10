// The Messier, NGC and IC objects that Wikidata gives a position: 11,898 in all. The large deep-sky tier (`@johnmorrisdotca/hoshi-stars/deep-sky/ngc-ic`): the table is about 150 kB gzipped, so it is its own
// import and the Messier-only `@johnmorrisdotca/hoshi-stars/deep-sky` stays small. Pure: no DOM, no clock, no state beyond the parsed table.
import { MESSIER_ROWS } from "./data/messier.ts";
import { MESSIER_DISTANCES } from "./data/galaxy-distances-messier.ts";
import { NGC_IC_DISTANCES } from "./data/galaxy-distances-ngc-ic.ts";
import { NGC_IC_ROWS } from "./data/ngc-ic.ts";
import { deepSkyTable, type DeepSkyObject, type DeepSkyOptions } from "./deep-sky-core.ts";
import { distanceTable, type GalaxyDistance } from "./galaxy-distance-core.ts";

export { DEEP_SKY_CATALOGUES, DEEP_SKY_TYPES, type DeepSkyObject, type DeepSkyOptions, type DeepSkyType } from "./deep-sky-core.ts";

export { type DistanceValue, type GalaxyDistance, type GalaxyDistanceSource } from "./galaxy-distance-core.ts";

const table = deepSkyTable([MESSIER_ROWS, NGC_IC_ROWS]);
const distances = distanceTable([MESSIER_DISTANCES, NGC_IC_DISTANCES]);

/**
 * The Messier, NGC and IC objects that meet the options: the Messier objects first in Messier order, then the others by NGC number and then IC number. The NGC and IC objects are those Wikidata gives a
 * position (11,788 besides the 110 Messier objects, about nine in ten of the two catalogues), and their magnitudes and types are Wikidata's as well. Magnitude is missing for about four in ten.
 *
 * @param options - `catalogue`: only objects with a number in `"messier"`, `"ngc"` or `"ic"`. `magnitude`: only objects as bright as that (an object with no magnitude is never in). `type`: only that kind.
 * @returns A fresh array of the shared, frozen objects.
 * @throws RangeError if `catalogue` or `type` is not one of the listed values. TypeError if `magnitude` is not a number.
 *
 * @example
 * ```ts
 * import { deepSky } from "@johnmorrisdotca/hoshi-stars/deep-sky/ngc-ic";
 *
 * console.log(deepSky({ catalogue: "ngc", type: "planetary nebula", magnitude: 10 }).length);
 * ```
 */
export function deepSky(options: DeepSkyOptions = {}): DeepSkyObject[] {
  return table.select(options);
}

/**
 * An object by any of its names, ignoring case, spacing and the accent on a letter: `M31`, `Messier 31`, `NGC 224`, `IC 434`, an object's other NGC or IC number (`NGC 1051` for `NGC 961`) or its common
 * name in English (`North America Nebula`). A name that two objects share finds neither, except that a Messier object keeps its name.
 *
 * @param text - The designation or name.
 * @returns The object, or `undefined` if the text names none.
 * @throws TypeError if `text` is not a string.
 *
 * @example
 * ```ts
 * import { deepSkyObject } from "@johnmorrisdotca/hoshi-stars/deep-sky/ngc-ic";
 *
 * console.log(deepSkyObject("IC 434")?.type, deepSkyObject("NGC 7000")?.name, deepSkyObject("Andromeda Galaxy")?.id);
 * ```
 */
export function deepSkyObject(text: string): DeepSkyObject | undefined {
  return table.find(text);
}

/**
 * The distance to a Messier, NGC or IC galaxy: the median of the distances Wikidata (CC0) gives, in light-years and parsecs, with the error where a statement has one, the lowest and highest statement,
 * how many there are and whether they disagree (the highest more than 1.2 times the lowest). The method is always "compiled, method not stated": Wikidata gathers published values and names no method.
 * About six in ten of the galaxies have one. Statements Wikidata marks deprecated are not used, and neither is any under 20 kiloparsecs (the nearest galaxy in the lists is the Small Magellanic Cloud, at 60).
 *
 * @param object - A deep-sky object from `deep-sky` or `deep-sky/ngc-ic`.
 * @returns The distance, frozen, or `null` for an object that is not a galaxy or one the source has no distance for.
 *
 * @example
 * ```ts
 * import { deepSkyObject, galaxyDistance } from "@johnmorrisdotca/hoshi-stars/deep-sky/ngc-ic";
 *
 * const ngc253 = galaxyDistance(deepSkyObject("NGC 253")!);
 * console.log(ngc253?.lightYears, ngc253?.error, ngc253?.sources[0]?.items, ngc253?.disagree);
 * ```
 */
export function galaxyDistance(object: DeepSkyObject): GalaxyDistance | null {
  return distances.distanceOf(object);
}
