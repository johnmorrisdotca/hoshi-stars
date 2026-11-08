// The 110 Messier objects, and the lookups for them. The deep-sky tier (`@johnmorrisdotca/hoshi-stars/deep-sky`): a table of about 3 kB gzipped. The NGC and IC objects, about 150 kB more, are the
// separate `@johnmorrisdotca/hoshi-stars/deep-sky/ngc-ic`, so a page that wants the Messier objects pays for them only. Pure: no DOM, no clock, no state beyond the parsed table.
import { MESSIER_ROWS } from "./data/messier.ts";
import { deepSkyTable, type DeepSkyObject, type DeepSkyOptions } from "./deep-sky-core.ts";

export { DEEP_SKY_CATALOGUES, DEEP_SKY_TYPES, type DeepSkyObject, type DeepSkyOptions, type DeepSkyType } from "./deep-sky-core.ts";

const table = deepSkyTable([MESSIER_ROWS]);

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
