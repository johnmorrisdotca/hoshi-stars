// The stick figures of the 88 constellations, as pairs of bright stars to join with a line.
// The lines tier (`@johnmorrisdotca/hoshi-stars/lines`): about 2 kB of data gzipped, on top of the constellations table and the bright-star table it points into. Pure: no DOM, no state beyond the parsed table.
// The figures are our own, decided from the stars' positions and brightness; none is copied from a book, an atlas or another program's files.
import { LINE_ROWS } from "./data/lines.ts";
import { constellation, constellations, type Constellation } from "./constellations.ts";
import { starByHr, type Star } from "./stars.ts";
import type { Asterism, Culture } from "./culture.ts";

/**
 * The stick figure of one constellation.
 *
 * @example
 * ```ts
 * import { figureOf, type Figure } from "@johnmorrisdotca/hoshi-stars/lines";
 *
 * const orion: Figure = figureOf("Ori");
 * console.log(orion.constellation.name, orion.stars.length, orion.segments.length);
 * ```
 */
export interface Figure {
  /** The constellation the figure is drawn in. */
  constellation: Constellation;
  /** The stars the figure uses, each once, in the order the figure first reaches them. */
  stars: Star[];
  /** The lines to draw, each a pair of stars of the constellation, no pair twice. Empty where the figure is one star. */
  segments: Array<[Star, Star]>;
}

/**
 * One figure of a sky culture, as stars and lines: the stars of the culture's figure that the catalogue holds.
 *
 * @example
 * ```ts
 * import { figureOf, type CultureFigure } from "@johnmorrisdotca/hoshi-stars/lines";
 * import { japanese } from "@johnmorrisdotca/hoshi-stars/cultures/japanese";
 *
 * const subaru: CultureFigure = figureOf("昴", japanese);
 * console.log(subaru.asterism.names.en, subaru.stars.length, subaru.segments.length);
 * ```
 */
export interface CultureFigure {
  /** The figure: its names, reading, kind and how many of its stars we do not hold (`missing`: fainter than the catalogue goes, or not numbered in the source). */
  asterism: Asterism;
  /** The stars the figure uses, each once, in the order the figure first reaches them. */
  stars: Star[];
  /** The lines to draw, each a pair of stars, no pair twice. Empty where the figure is one star. */
  segments: Array<[Star, Star]>;
}

const stored = new Map<string, Figure>();
const storedCulture = new WeakMap<Asterism, CultureFigure>();

function cultureFigure(asterism: Asterism): CultureFigure {
  let found = storedCulture.get(asterism);
  if (found === undefined) {
    const used = new Map<number, Star>();
    const segments: Array<[Star, Star]> = [];
    const seen = new Set<string>();
    for (const chain of asterism.chains) {
      const members = chain.map((hr) => {
        const star = starByHr(hr)!;
        used.set(hr, star);
        return star;
      });
      for (let i = 1; i < members.length; i++) {
        const name = `${Math.min(members[i - 1]!.hr, members[i]!.hr)}-${Math.max(members[i - 1]!.hr, members[i]!.hr)}`;
        if (seen.has(name)) continue;
        seen.add(name);
        segments.push(Object.freeze([members[i - 1]!, members[i]!]) as [Star, Star]);
      }
    }
    found = Object.freeze({ asterism, stars: Object.freeze([...used.values()]) as Star[], segments: Object.freeze(segments) as Array<[Star, Star]> });
    storedCulture.set(asterism, found);
  }
  return found;
}

function load(): void {
  if (stored.size > 0) return;
  const byAbbreviation = new Map(constellations().map((c) => [c.abbreviation, c]));
  for (const row of LINE_ROWS.split("\n")) {
    const [abbreviation, chains] = row.split("|") as [string, string];
    const used = new Map<number, Star>();
    const segments: Array<[Star, Star]> = [];
    for (const chain of chains.split(";")) {
      const members = chain.split("-").map((hr) => {
        const star = starByHr(Number(hr))!;
        used.set(star.hr, star);
        return star;
      });
      for (let i = 1; i < members.length; i++) segments.push(Object.freeze([members[i - 1]!, members[i]!]) as [Star, Star]);
    }
    stored.set(abbreviation, Object.freeze({ constellation: byAbbreviation.get(abbreviation)!, stars: Object.freeze([...used.values()]) as Star[], segments: Object.freeze(segments) as Array<[Star, Star]> }));
  }
}

/**
 * The stick figures of all 88 constellations, in the order of `constellations()` (alphabetical by Latin name). Given a sky culture, the culture's figures instead, in its order.
 *
 * @param culture - A sky culture (`@johnmorrisdotca/hoshi-stars/cultures/chinese`, `.../japanese` or `.../western`), or leave out for the 88 constellations of the IAU.
 * @returns A fresh array of the shared, frozen figures.
 *
 * @example
 * ```ts
 * import { figures } from "@johnmorrisdotca/hoshi-stars/lines";
 *
 * console.log(figures().length, figures().reduce((sum, f) => sum + f.segments.length, 0));
 * ```
 *
 * @example
 * ```ts
 * import { figures } from "@johnmorrisdotca/hoshi-stars/lines";
 * import { chinese } from "@johnmorrisdotca/hoshi-stars/cultures/chinese";
 *
 * console.log(figures(chinese).length, figures(chinese).filter((f) => f.segments.length > 0).length);
 * ```
 */
export function figures(): Figure[];
export function figures(culture: Culture): CultureFigure[];
export function figures(culture?: Culture): Figure[] | CultureFigure[] {
  if (culture !== undefined) return culture.asterisms().map(cultureFigure);
  load();
  return constellations().map((c) => stored.get(c.abbreviation)!);
}

/**
 * The stick figure of one constellation: the bright stars to join, as pairs. Every star of a pair lies inside the constellation, so a chart can draw one figure without crossing into another.
 *
 * @param text - The constellation, as the IAU abbreviation (`Ori`) or any other name `constellation` accepts.
 * @param culture - A sky culture whose figure of that name to return, found by any of its names in any language; leave out for the 88 constellations of the IAU.
 * @returns The shared, frozen figure.
 * @throws TypeError if `text` is not a string. RangeError if it is not one of the 88 constellations (or a figure of the culture).
 *
 * @example
 * ```ts
 * import { figureOf } from "@johnmorrisdotca/hoshi-stars/lines";
 *
 * for (const [a, b] of figureOf("Great Bear").segments) console.log(a.name ?? a.designation, "to", b.name ?? b.designation);
 * ```
 *
 * @example
 * ```ts
 * import { figureOf } from "@johnmorrisdotca/hoshi-stars/lines";
 * import { chinese } from "@johnmorrisdotca/hoshi-stars/cultures/chinese";
 *
 * const figure = figureOf("北斗", chinese);
 * console.log(figure.asterism.readings.zh, figure.stars.length, figure.asterism.missing);
 * ```
 */
export function figureOf(text: string): Figure;
export function figureOf(text: string, culture: Culture): CultureFigure;
export function figureOf(text: string, culture?: Culture): Figure | CultureFigure {
  if (culture !== undefined) {
    const asterism = culture.find(text);
    if (asterism === undefined) throw new RangeError(`"${text}" is not a figure of the ${culture.names.en} sky`);
    return cultureFigure(asterism);
  }
  const found = constellation(text);
  if (found === undefined) throw new RangeError(`"${text}" is not one of the 88 constellations (use the IAU abbreviation such as "Ori")`);
  load();
  return stored.get(found.abbreviation)!;
}
