// The part of a target that needs the star tables: a star's or a constellation's id turned into where it is among the stars (and, for a constellation, its stick figure), with its name in both languages. The element reads this; the rest of
// the target maths (`target.ts`) needs no table. A star by id is looked up in the names index, which is loaded the first time one is needed and not before.
import { constellation, starsIn } from "../constellations.ts";
import { figureOf } from "../lines.ts";
import { starByHr, type Star } from "../stars.ts";
import { parseTarget, type SkyLocator, type SkyTarget } from "./target.ts";
import { mySkyWords } from "./words.ts";

/**
 * A target worked out: where to find it, its name in English and Japanese and, for a constellation, its stars and the lines of its figure.
 *
 * @example
 * ```ts
 * import { resolveTarget } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * const found = resolveTarget("constellation:Ori");
 * console.log(found !== "later" && found?.label.en, found !== "later" && found?.figure?.stars.length);
 * ```
 */
export interface ResolvedTarget {
  /** What the target is: `star` (a star or a deep-sky object by id), `constellation`, `planet`, `moon`, `sun` or `point`. */
  kind: "star" | "constellation" | "planet" | "moon" | "sun" | "point";
  /** Its name to show, in each language (a point's label is the same in both). */
  label: { en: string; ja: string };
  /** Where to find it. A constellation's is the middle of its stars. */
  locator: SkyLocator;
  /** A constellation's stars (J2000 right ascension and declination) and the lines of its figure, each line as the right ascension and declination of both ends. */
  figure?: { stars: Array<{ rightAscension: number; declination: number }>; lines: Array<[number, number, number, number]> };
}

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

/** The middle of some places on the sphere, as a right ascension and a declination. */
function middleOf(places: ReadonlyArray<{ rightAscension: number; declination: number }>): { rightAscension: number; declination: number } {
  let x = 0;
  let y = 0;
  let z = 0;
  for (const p of places) {
    x += Math.cos(p.declination * RAD) * Math.cos(p.rightAscension * RAD);
    y += Math.cos(p.declination * RAD) * Math.sin(p.rightAscension * RAD);
    z += Math.sin(p.declination * RAD);
  }
  return { rightAscension: (((Math.atan2(y, x) * DEG) % 360) + 360) % 360, declination: Math.atan2(z, Math.hypot(x, y)) * DEG };
}

const starOf = (label: { en: string; ja: string }, rightAscension: number, declination: number): ResolvedTarget => ({ kind: "star", label, locator: { kind: "star", rightAscension, declination } });

function ofConstellation(name: string): ResolvedTarget | undefined {
  const found = constellation(name);
  if (found === undefined) return undefined;
  const figure = figureOf(found.abbreviation);
  const members: Star[] = figure.stars.length > 0 ? figure.stars : starsIn(found.abbreviation);
  if (members.length === 0) return undefined;
  const places = members.map((s) => ({ rightAscension: s.rightAscension, declination: s.declination }));
  const middle = middleOf(places);
  return {
    kind: "constellation",
    label: { en: found.name, ja: found.japanese },
    locator: { kind: "star", ...middle },
    figure: { stars: places, lines: figure.segments.map(([a, b]): [number, number, number, number] => [a.rightAscension, a.declination, b.rightAscension, b.declination]) },
  };
}

/** `hr-1234`, `hr1234` or `HR 1234`: a star by its catalogue number, which needs no index. */
function ofCatalogueNumber(match: RegExpExecArray): ResolvedTarget | undefined {
  const star = starByHr(Number(match[1]));
  if (star === undefined) return undefined;
  return starOf({ en: star.name ?? star.designation ?? `HR ${star.hr}`, ja: star.nameJa ?? star.name ?? star.designation ?? `HR ${star.hr}` }, star.rightAscension, star.declination);
}

/**
 * Work out a target that needs nothing loaded: a planet, the Moon, the Sun, a point, a constellation and a star by catalogue number (`hr-2061`). Any other text is a star's or an object's id, which waits for the names index: `"later"`.
 *
 * @param target - The text or the point.
 * @returns The target worked out; `"later"` for an id that `resolveStarId` has to look up; `undefined` for a target that is nothing (an empty text, a planet that does not exist, a constellation that is not one of the 88, a catalogue number that is not in the catalogue).
 *
 * @example
 * ```ts
 * import { resolveTarget } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * const mars = resolveTarget("planet:mars");
 * console.log(mars !== "later" && mars?.label, resolveTarget("betelgeuse"), resolveTarget("constellation:nowhere"));
 * ```
 */
export function resolveTarget(target: SkyTarget): ResolvedTarget | "later" | undefined {
  const parsed = parseTarget(target);
  if (parsed === undefined) return undefined;
  switch (parsed.kind) {
    case "moon":
      return { kind: "moon", label: { en: mySkyWords("en").moon, ja: mySkyWords("ja").moon }, locator: { kind: "moon" } };
    case "sun":
      return { kind: "sun", label: { en: mySkyWords("en").sun, ja: mySkyWords("ja").sun }, locator: { kind: "sun" } };
    case "planet":
      return { kind: "planet", label: { en: mySkyWords("en").planet[parsed.id], ja: mySkyWords("ja").planet[parsed.id] }, locator: { kind: "planet", id: parsed.id } };
    case "point":
      return { kind: "point", label: { en: parsed.point.label ?? "", ja: parsed.point.label ?? "" }, locator: { kind: "point", azimuth: parsed.point.azimuth, altitude: parsed.point.altitude } };
    case "constellation":
      return ofConstellation(parsed.name);
    case "star": {
      const number = /^hr[- ]?(\d{1,6})$/.exec(parsed.id);
      return number === null ? "later" : ofCatalogueNumber(number);
    }
  }
}

/**
 * Look up a star's or an object's id in the names index (`betelgeuse`, `hr-2061`, `m31`; the same ids `nameRows` gives, and any name or designation `findName` finds by that text: `alpha-orionis`, `sirius`). The index is loaded the first time this is called.
 *
 * @param id - The id.
 * @returns The target, or `undefined` when no star or object has that id.
 *
 * @example
 * ```ts
 * import { resolveStarId } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * const found = await resolveStarId("betelgeuse");
 * console.log(found?.label.en, found?.label.ja, await resolveStarId("nothing"));
 * ```
 */
export async function resolveStarId(id: string): Promise<ResolvedTarget | undefined> {
  const { findName, nameRowById } = await import("../names.ts");
  const text = id.trim().toLowerCase();
  // the id itself, else a name or a designation the index knows it by (`alpha-orionis` for Betelgeuse, whose id is its name)
  const row = nameRowById(text) ?? findName(text.replace(/-/g, " "));
  if (row === undefined) return undefined;
  return starOf({ en: row.name.en, ja: row.name.ja ?? row.name.en }, row.rightAscension, row.declination);
}
