// The Messier, NGC and IC objects that Wikidata gives a position: 11,898 in all. The large deep-sky tier (`@johnmorrisdotca/hoshi-stars/deep-sky/ngc-ic`): the table is about 150 kB gzipped, so it is its own
// import and the Messier-only `@johnmorrisdotca/hoshi-stars/deep-sky` stays small. Pure: no DOM, no clock, no state beyond the parsed table.
import { MESSIER_ROWS } from "./data/messier.ts";
import { NGC_IC_ROWS } from "./data/ngc-ic.ts";
import { deepSkyTable, type DeepSkyObject, type DeepSkyOptions } from "./deep-sky-core.ts";

export { DEEP_SKY_CATALOGUES, DEEP_SKY_TYPES, type DeepSkyObject, type DeepSkyOptions, type DeepSkyType } from "./deep-sky-core.ts";

const table = deepSkyTable([MESSIER_ROWS, NGC_IC_ROWS]);

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
