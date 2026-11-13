// The names index: one row for each of the 5,080 bright stars and the 110 Messier objects, with their names in English and Japanese, every designation a reader might type, the constellation, a rank weight and where to point; a search box
// can index it. Built from the tables the package already holds (no new data), as its own import so that a page pays only when it searches. The 11,788 other NGC and IC objects are the separate `/names/ngc-ic`. Pure: no DOM, no clock.
import { messier } from "./deep-sky.ts";
import { constellationsByAbbreviation, deepSkyRow, nameIndex, starRow, starSlug, type NameIndex, type NameKind, type NameRow } from "./names-core.ts";
import { stars } from "./stars.ts";

export { NAME_KINDS, nameIndex, nameKey, slugOf, type NameIndex, type NameKind, type NameRow } from "./names-core.ts";
export { deepSkyRow } from "./names-core.ts";

let built: NameRow[] | undefined;
let index: NameIndex | undefined;

function build(): NameIndex {
  if (index !== undefined) return index;
  const byAbbreviation = constellationsByAbbreviation();
  const all = stars();
  const slugs = all.map((star) => starSlug(star, byAbbreviation.get(star.constellation)));
  // a clash (two stars with the same name or designation) is settled by giving each of them its catalogue number
  const count = new Map<string, number>();
  for (const slug of [...slugs, ...messier().map((o) => deepSkyRow(o, byAbbreviation).id)]) count.set(slug, (count.get(slug) ?? 0) + 1);
  const rows = all.map((star, i) => starRow(star, byAbbreviation.get(star.constellation), (count.get(slugs[i]!) ?? 1) > 1 ? `${slugs[i]!}-hr${star.hr}` : slugs[i]!));
  for (const object of messier()) rows.push(deepSkyRow(object, byAbbreviation));
  built = rows;
  index = nameIndex(built);
  return index;
}

/**
 * The rows of the index: the 5,080 bright stars and the 110 Messier objects, brightest and best-known first (by `weight`), as a fresh array of rows. For the NGC and IC objects see `/names/ngc-ic`.
 *
 * @param options - `kinds`: only rows of those kinds.
 * @returns The rows.
 *
 * @example
 * ```ts
 * import { nameRows } from "@johnmorrisdotca/hoshi-stars/names";
 *
 * const rows = nameRows();
 * console.log(rows.length, rows[0].id, nameRows({ kinds: ["galaxy"] }).length);
 * ```
 */
export function nameRows(options: { kinds?: readonly NameKind[] } = {}): NameRow[] {
  return build().rows(options.kinds);
}

/**
 * One row by its id (`betelgeuse`, `alpha-orionis`, `hr-1234`, `m31`): the reverse of the id every row carries.
 *
 * @param id - The id.
 * @returns The row, or `undefined`.
 *
 * @example
 * ```ts
 * import { nameRowById } from "@johnmorrisdotca/hoshi-stars/names";
 *
 * console.log(nameRowById("m31")?.name.en, nameRowById("nothing"));
 * ```
 */
export function nameRowById(id: string): NameRow | undefined {
  return build().byId(id);
}

/**
 * The row a name, a designation or an id names exactly, ignoring case, spacing, accents and the Greek letter's spelling: `Betelgeuse`, `alpha Ori`, `α Orionis`, `HR 2061`, `M31`, `Messier 31`, `NGC 224`, `Andromeda Galaxy`, `ベテルギウス`. A text that two rows share (`Alpha Centauri`) finds none: use `searchNames`.
 *
 * @param text - What was typed.
 * @returns The row, or `undefined`.
 *
 * @example
 * ```ts
 * import { findName } from "@johnmorrisdotca/hoshi-stars/names";
 *
 * console.log(findName("alpha Ori")?.id, findName("HR 2061")?.id, findName("NGC 224")?.id);
 * ```
 */
export function findName(text: string): NameRow | undefined {
  return build().find(text);
}

/**
 * The rows whose names match what was typed: those with a name that starts with it first (an exact name before those), then those that contain it, each by weight (bright and well known first).
 *
 * @param text - What was typed.
 * @param options - `limit` (20 by default) and `kinds`.
 * @returns The rows, best first.
 *
 * @example
 * ```ts
 * import { searchNames } from "@johnmorrisdotca/hoshi-stars/names";
 *
 * console.log(searchNames("andromeda", { limit: 3 }).map((row) => row.id));
 * ```
 */
export function searchNames(text: string, options: { limit?: number; kinds?: readonly NameKind[] } = {}): NameRow[] {
  return build().search(text, options);
}

