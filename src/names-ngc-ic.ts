// The names index for the 11,788 NGC and IC objects that are not Messier objects: the same rows as `/names`, in a chunk of their own so that a page loads it only when it wants them (it holds the large deep-sky table, about 150 kB gzipped).
// Pure: no DOM, no clock.
import { constellations } from "./constellations.ts";
import { deepSky } from "./deep-sky-ngc-ic.ts";
import { deepSkyRow, nameIndex, type NameIndex, type NameKind, type NameRow } from "./names-core.ts";

export { NAME_KINDS, nameIndex, nameKey, slugOf, type NameIndex, type NameKind, type NameRow } from "./names-core.ts";

let index: NameIndex | undefined;
function build(): NameIndex {
  if (index !== undefined) return index;
  const byAbbreviation = new Map(constellations().map((c) => [c.abbreviation, c]));
  index = nameIndex(deepSky().filter((o) => o.messier === undefined).map((o) => deepSkyRow(o, byAbbreviation)));
  return index;
}

/**
 * The rows of the NGC and IC objects that are not Messier objects (11,788), brightest first (an object with no magnitude comes after those with one), as a fresh array. The ids are `ngc7000`, `ic434`; the Messier objects are in `/names`.
 *
 * @param options - `kinds`: only rows of those kinds.
 * @returns The rows.
 *
 * @example
 * ```ts
 * import { ngcIcRows } from "@johnmorrisdotca/hoshi-stars/names/ngc-ic";
 *
 * console.log(ngcIcRows().length, ngcIcRows({ kinds: ["nebula"] }).length);
 * ```
 */
export function ngcIcRows(options: { kinds?: readonly NameKind[] } = {}): NameRow[] {
  return build().rows(options.kinds);
}

/**
 * One NGC or IC row by its id (`ngc7000`, `ic434`).
 *
 * @param id - The id.
 * @returns The row, or `undefined`.
 *
 * @example
 * ```ts
 * import { ngcIcRowById } from "@johnmorrisdotca/hoshi-stars/names/ngc-ic";
 *
 * console.log(ngcIcRowById("ngc7000")?.name.en);
 * ```
 */
export function ngcIcRowById(id: string): NameRow | undefined {
  return build().byId(id);
}

/**
 * The NGC or IC row a name or number names exactly (`NGC 7000`, `North America Nebula`, `ic 434`), or `undefined`.
 *
 * @param text - What was typed.
 * @returns The row, or `undefined`.
 *
 * @example
 * ```ts
 * import { findNgcIc } from "@johnmorrisdotca/hoshi-stars/names/ngc-ic";
 *
 * console.log(findNgcIc("North America Nebula")?.id);
 * ```
 */
export function findNgcIc(text: string): NameRow | undefined {
  return build().find(text);
}

/**
 * The NGC and IC rows whose names match what was typed, best first (see `searchNames`).
 *
 * @param text - What was typed.
 * @param options - `limit` (20 by default) and `kinds`.
 * @returns The rows.
 *
 * @example
 * ```ts
 * import { searchNgcIc } from "@johnmorrisdotca/hoshi-stars/names/ngc-ic";
 *
 * console.log(searchNgcIc("horsehead").map((row) => row.id));
 * ```
 */
export function searchNgcIc(text: string, options: { limit?: number; kinds?: readonly NameKind[] } = {}): NameRow[] {
  return build().search(text, options);
}
