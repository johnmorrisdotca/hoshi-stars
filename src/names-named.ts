// The small first chunk of the names index: the 335 stars that have a common name and the 110 Messier objects, as the same rows `/names` gives (the same ids, names, designations and position), for a search box that should load in about 20 kB gzipped.
// It holds no bright-star table: the 335 stars come from a small table of their own that `scripts/make-names-named.ts` writes. The other 4,745 bright stars are `/names`, the NGC and IC objects `/names/ngc-ic`. Pure: no DOM, no clock.
import { messier } from "./deep-sky.ts";
import { NAMED_STAR_ROWS } from "./data/names-named.ts";
import { constellationsByAbbreviation, deepSkyRow, nameIndex, starRow, type NameIndex, type NameKind, type NameRow } from "./names-core.ts";

export { NAME_KINDS, nameIndex, nameKey, slugOf, type NameIndex, type NameKind, type NameRow } from "./names-core.ts";
export { deepSkyRow } from "./names-core.ts";

let index: NameIndex | undefined;

function build(): NameIndex {
  if (index !== undefined) return index;
  const byAbbreviation = constellationsByAbbreviation();
  const rows: NameRow[] = NAMED_STAR_ROWS.split("\n").map((line) => {
    const [id, hr, name, nameJa, designation, constellation, ra, dec, magnitude, spectralType] = line.split("|") as [string, string, string, string, string, string, string, string, string, string];
    const star = {
      hr: Number(hr),
      name,
      nameJa: nameJa === "" ? undefined : nameJa,
      designation: designation === "" ? undefined : designation,
      constellation,
      rightAscension: Number(ra),
      declination: Number(dec),
      magnitude: Number(magnitude),
      spectralType,
    };
    return starRow(star, byAbbreviation.get(constellation), id);
  });
  for (const object of messier()) rows.push(deepSkyRow(object, byAbbreviation));
  index = nameIndex(rows);
  return index;
}

/**
 * The rows of the small chunk: the 335 stars with a common name and the 110 Messier objects (445), brightest and best-known first (by `weight`), as a fresh array. Each equals the row of the same id in `/names`. For the other bright stars see `/names`, for the NGC and IC objects `/names/ngc-ic`.
 *
 * @param options - `kinds`: only rows of those kinds.
 * @returns The rows.
 *
 * @example
 * ```ts
 * import { nameRows } from "@johnmorrisdotca/hoshi-stars/names/named";
 *
 * const rows = nameRows();
 * console.log(rows.length, rows[0].id, nameRows({ kinds: ["galaxy"] }).length);
 * ```
 */
export function nameRows(options: { kinds?: readonly NameKind[] } = {}): NameRow[] {
  return build().rows(options.kinds);
}

/**
 * One row of the small chunk by its id (`betelgeuse`, `m31`): the same row `/names` gives for that id; `undefined` for a star without a common name (`alpha-centauri`, `hr-1234`), which is in `/names`.
 *
 * @param id - The id.
 * @returns The row, or `undefined`.
 *
 * @example
 * ```ts
 * import { nameRowById } from "@johnmorrisdotca/hoshi-stars/names/named";
 *
 * console.log(nameRowById("m31")?.name.en, nameRowById("hr-1234"));
 * ```
 */
export function nameRowById(id: string): NameRow | undefined {
  return build().byId(id);
}

/**
 * The row of the small chunk that a name, a designation or an id names exactly, ignoring case, spacing, accents and the Greek letter's spelling (`Betelgeuse`, `alpha Ori`, `HR 2061`, `M31`, `NGC 224`, `ベテルギウス`), or `undefined`. A text that two rows share finds none.
 *
 * @param text - What was typed.
 * @returns The row, or `undefined`.
 *
 * @example
 * ```ts
 * import { findName } from "@johnmorrisdotca/hoshi-stars/names/named";
 *
 * console.log(findName("alpha Ori")?.id, findName("HR 2061")?.id, findName("NGC 224")?.id);
 * ```
 */
export function findName(text: string): NameRow | undefined {
  return build().find(text);
}

/**
 * The rows of the small chunk whose names match what was typed: those with a name that starts with it first (an exact name before those), then those that contain it, each by weight. A star without a common name is not here: a page that wants it loads `/names` after this.
 *
 * @param text - What was typed.
 * @param options - `limit` (20 by default) and `kinds`.
 * @returns The rows, best first.
 *
 * @example
 * ```ts
 * import { searchNames } from "@johnmorrisdotca/hoshi-stars/names/named";
 *
 * console.log(searchNames("andromeda", { limit: 3 }).map((row) => row.id));
 * ```
 */
export function searchNames(text: string, options: { limit?: number; kinds?: readonly NameKind[] } = {}): NameRow[] {
  return build().search(text, options);
}
