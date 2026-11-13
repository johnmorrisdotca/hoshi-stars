// The names index: one row for each of the 5,080 bright stars and the 110 Messier objects, with their names in English and Japanese, every designation a reader might type, the constellation, a rank weight and where to point; a search box
// can index it. Built from the tables the package already holds (no new data), as its own import so that a page pays only when it searches. The 11,788 other NGC and IC objects are the separate `/names/ngc-ic`. Pure: no DOM, no clock.
import { constellations, type Constellation } from "./constellations.ts";
import { messier } from "./deep-sky.ts";
import { greekName, greekShort, nameIndex, deepSkyRow, slugOf, starWeight, type NameIndex, type NameKind, type NameRow } from "./names-core.ts";
import { stars, type Star } from "./stars.ts";

export { NAME_KINDS, nameIndex, nameKey, slugOf, type NameIndex, type NameKind, type NameRow } from "./names-core.ts";
export { deepSkyRow } from "./names-core.ts";

const BAYER = /^(\D+?)(\d*) (\S+)$/u;
const FLAMSTEED = /^(\d+) (\S+)$/u;

/** The slug a star would have before any clash is settled. */
function starSlug(star: Star, c: Constellation | undefined): string {
  if (star.name !== undefined) return slugOf(star.name);
  const text = star.designation;
  if (text !== undefined && c !== undefined) {
    const bayer = BAYER.exec(text);
    if (bayer !== null) return slugOf(`${greekName(bayer[1]!)}${bayer[2]!} ${c.genitive}`);
    const flamsteed = FLAMSTEED.exec(text);
    if (flamsteed !== null) return slugOf(`${flamsteed[1]!} ${c.genitive}`);
  }
  return `hr-${star.hr}`;
}

function starRow(star: Star, c: Constellation | undefined, id: string): NameRow {
  const others = new Set<string>();
  const designations: string[] = [];
  let ja = star.nameJa;
  const text = star.designation;
  if (text !== undefined) designations.push(text);
  designations.push(`HR ${star.hr}`);
  if (text !== undefined && c !== undefined) {
    const bayer = BAYER.exec(text);
    const flamsteed = FLAMSTEED.exec(text);
    if (bayer !== null) {
      const letter = bayer[1]!;
      const number = bayer[2]!;
      for (const place of [c.abbreviation, c.genitive]) {
        others.add(`${letter}${number} ${place}`);
        others.add(`${greekName(letter)}${number} ${place}`);
        others.add(`${greekShort(greekName(letter))}${number} ${place}`);
        // a component of a pair (α1 Cen) is also what people mean by the pair's letter (alpha Centauri): the text then names two rows, and `findName` gives none
        if (number !== "") others.add(`${greekName(letter)} ${place}`);
      }
      ja ??= `${c.japanese}${letter}${number}星`;
    } else if (flamsteed !== null) {
      for (const place of [c.abbreviation, c.genitive]) others.add(`${flamsteed[1]!} ${place}`);
    }
  }
  const shown = star.name ?? text ?? `HR ${star.hr}`;
  for (const one of designations) others.add(one);
  if (star.name !== undefined && text !== undefined) others.add(text);
  others.delete(shown);
  if (ja !== undefined) others.delete(ja);
  return {
    id,
    kind: "star",
    detail: star.spectralType,
    name: { en: shown, ja },
    otherNames: [...others],
    designations,
    constellation: star.constellation,
    constellationName: c === undefined ? undefined : { en: c.name, ja: c.japanese },
    magnitude: star.magnitude,
    weight: starWeight(star.magnitude, star.name !== undefined),
    rightAscension: star.rightAscension,
    declination: star.declination,
    pick: `S:${star.hr}`,
    hr: star.hr,
  };
}

let built: NameRow[] | undefined;
let index: NameIndex | undefined;

function build(): NameIndex {
  if (index !== undefined) return index;
  const byAbbreviation = new Map(constellations().map((c) => [c.abbreviation, c]));
  const all = stars();
  const slugs = all.map((star) => starSlug(star, byAbbreviation.get(star.constellation)));
  // a clash (two stars with the same name or designation) is settled by giving each of them its catalogue number
  const count = new Map<string, number>();
  for (const slug of [...slugs, ...messier().map((o) => slugOf(o.id.replace(/\s+/g, "")))]) count.set(slug, (count.get(slug) ?? 0) + 1);
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

