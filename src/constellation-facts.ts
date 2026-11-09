// What a gallery or a list of the 88 constellations needs beyond the star tables: what the name means, the hemisphere, the best month to look, who made the constellation and when, how easy it is to find, its
// asterisms and the meteor showers that seem to come from it. The facts tier (`@johnmorrisdotca/hoshi-stars/constellation-facts`): a table of about 3 kB gzipped, on top of the constellations, lines and boundaries tiers.
// The month, the hemisphere and the difficulty are worked out from this package's own data; the rest is typed by hand in `./data/constellation-facts.ts` with its sources in NOTICE.md. Pure: no DOM, no clock.
import { boundaryOf } from "./boundaries.ts";
import { constellation, constellations, starsIn, type Constellation } from "./constellations.ts";
import { ASTERISM_ROWS, FACT_ROWS, ORIGINS, SHOWER_ROWS } from "./data/constellation-facts.ts";
import { skyForLatitude } from "./sheets/region.ts";

/**
 * A text in English and in Japanese.
 *
 * @example
 * ```ts
 * import { constellationFacts, type Words } from "@johnmorrisdotca/hoshi-stars/constellation-facts";
 *
 * const meaning: Words = constellationFacts("Ori").meaning;
 * console.log(meaning.en, meaning.ja);
 * ```
 */
export interface Words {
  en: string;
  ja: string;
}

/**
 * Where a constellation lies: `north` (wholly in the northern half of the sky), `south`, or `both` (it crosses the celestial equator, by more than a degree).
 *
 * @example
 * ```ts
 * import { type Hemisphere } from "@johnmorrisdotca/hoshi-stars/constellation-facts";
 *
 * const sides: Hemisphere[] = ["north", "south", "both"];
 * console.log(sides.length);
 * ```
 */
export type Hemisphere = "north" | "south" | "both";

/**
 * Who first drew the constellation, in four groups: `ancient` (Ptolemy's 48, in the second century; Argo Navis is now Carina, Puppis and Vela), `voyages` (the southern sky mapped on the Dutch voyages of the 1590s),
 * `early` (added in the 1500s and 1600s) and `modern` (Lacaille's, in the 1750s).
 *
 * @example
 * ```ts
 * import { type Origin } from "@johnmorrisdotca/hoshi-stars/constellation-facts";
 *
 * const origin: Origin = "ancient";
 * console.log(origin);
 * ```
 */
export type Origin = "ancient" | "voyages" | "early" | "modern";

/**
 * How easy a constellation is to find, from the brightness of its stars alone: `easy` (its third-brightest star is brighter than magnitude 3, or it holds a star as bright as 0.5 and its third is brighter than 3.3),
 * `medium` (third star brighter than 3.8) or `hard`.
 *
 * @example
 * ```ts
 * import { type Difficulty } from "@johnmorrisdotca/hoshi-stars/constellation-facts";
 *
 * const level: Difficulty = "easy";
 * console.log(level);
 * ```
 */
export type Difficulty = "easy" | "medium" | "hard";

/**
 * One meteor shower whose radiant lies in a constellation.
 *
 * @example
 * ```ts
 * import { constellationFacts, type MeteorShower } from "@johnmorrisdotca/hoshi-stars/constellation-facts";
 *
 * const shower: MeteorShower = constellationFacts("Per").meteorShowers[0]!;
 * console.log(shower.name.en, shower.peak);
 * ```
 */
export interface MeteorShower {
  /** The IAU name, in English and Japanese. */
  name: Words;
  /** The usual night of the peak as `MM-DD`; it moves by a day or so from year to year. */
  peak: string;
}

/**
 * The facts about one constellation.
 *
 * @example
 * ```ts
 * import { constellationFacts, type ConstellationFacts } from "@johnmorrisdotca/hoshi-stars/constellation-facts";
 *
 * const orion: ConstellationFacts = constellationFacts("Ori");
 * console.log(orion.constellation.name, orion.hemisphere, orion.bestMonth, orion.difficulty);
 * ```
 */
export interface ConstellationFacts {
  /** The constellation. */
  constellation: Constellation;
  /** What the name means: the English name is the one in `constellation.english`; the Japanese is a short everyday phrase. */
  meaning: Words;
  /** The half of the sky it lies in. */
  hemisphere: Hemisphere;
  /** The month, 1 to 12, in which it is highest in the evening sky (about 21:00 by the Sun, the 15th). */
  bestMonth: number;
  /** The group it was made in. */
  origin: Origin;
  /** Who made it. */
  designer: Words;
  /** The year it was made (about 150 for Ptolemy's). */
  year: number;
  /** How easy it is to find. */
  difficulty: Difficulty;
  /** Patterns of stars that use it and are not constellations (the Big Dipper, the Summer Triangle). */
  asterisms: Words[];
  /** The meteor showers whose radiant lies in it, in date order. */
  meteorShowers: MeteorShower[];
}

const EQUATOR_SLACK = 1;
const stored = new Map<string, ConstellationFacts>();

function hemisphereOf(abbreviation: string): Hemisphere {
  const declinations = boundaryOf(abbreviation, { step: 90 }).outlines.flat().map((point) => point.declination);
  if (Math.min(...declinations) >= -EQUATOR_SLACK) return "north";
  if (Math.max(...declinations) <= EQUATOR_SLACK) return "south";
  return "both";
}

function difficultyOf(abbreviation: string): Difficulty {
  const magnitudes = starsIn(abbreviation).map((star) => star.magnitude).sort((a, b) => a - b);
  const brightest = magnitudes[0] ?? 9;
  const third = magnitudes[2] ?? 9;
  return third <= 3 || (brightest <= 0.5 && third <= 3.3) ? "easy" : third <= 3.8 ? "medium" : "hard";
}

function load(): void {
  if (stored.size > 0) return;
  const origins = new Map(ORIGINS.split("\n").map((row) => {
    const [code, group, year, en, ja] = row.split("|") as [string, Origin, string, string, string];
    return [code, { group, year: Number(year), designer: { en, ja } }] as const;
  }));
  const months = new Map(skyForLatitude(0).map((entry) => [entry.constellation.abbreviation, entry.bestMonth]));
  const asterisms = ASTERISM_ROWS.split("\n").map((row) => {
    const [en, ja, members] = row.split("|") as [string, string, string];
    return { words: { en, ja }, members: members.split(",") };
  });
  const showers = SHOWER_ROWS.split("\n").map((row) => {
    const [en, ja, peak, where] = row.split("|") as [string, string, string, string];
    return { shower: { name: { en, ja }, peak }, where };
  });
  const byAbbreviation = new Map(constellations().map((c) => [c.abbreviation, c]));
  for (const row of FACT_ROWS.split("\n")) {
    const [abbreviation, code, ja] = row.split("|") as [string, string, string];
    const c = byAbbreviation.get(abbreviation)!;
    const origin = origins.get(code)!;
    stored.set(
      abbreviation,
      Object.freeze({
        constellation: c,
        meaning: Object.freeze({ en: c.english, ja }),
        hemisphere: hemisphereOf(abbreviation),
        bestMonth: months.get(abbreviation) ?? 0,
        origin: origin.group,
        designer: Object.freeze(origin.designer),
        year: origin.year,
        difficulty: difficultyOf(abbreviation),
        asterisms: Object.freeze(asterisms.filter((a) => a.members.includes(abbreviation)).map((a) => Object.freeze(a.words))) as Words[],
        meteorShowers: Object.freeze(showers.filter((s) => s.where === abbreviation).map((s) => Object.freeze(s.shower)).sort((a, b) => a.peak.localeCompare(b.peak))) as MeteorShower[],
      }),
    );
  }
}

/**
 * The facts about all 88 constellations, alphabetical by Latin name like `constellations()`.
 *
 * @returns A fresh array of the shared, frozen facts.
 *
 * @example
 * ```ts
 * import { allConstellationFacts } from "@johnmorrisdotca/hoshi-stars/constellation-facts";
 *
 * const easy = allConstellationFacts().filter((facts) => facts.difficulty === "easy" && facts.hemisphere === "north");
 * console.log(easy.map((facts) => facts.constellation.name));
 * ```
 */
export function allConstellationFacts(): ConstellationFacts[] {
  load();
  return constellations().map((c) => stored.get(c.abbreviation)!);
}

/**
 * The facts about one constellation.
 *
 * @param text - The constellation, as the IAU abbreviation (`Ori`) or any other name `constellation` accepts.
 * @returns The shared, frozen facts.
 * @throws TypeError if `text` is not a string. RangeError if it is not one of the 88 constellations.
 *
 * @example
 * ```ts
 * import { constellationFacts } from "@johnmorrisdotca/hoshi-stars/constellation-facts";
 *
 * const facts = constellationFacts("Orion");
 * console.log(facts.meaning.en, facts.asterisms.map((a) => a.en), facts.meteorShowers.map((s) => s.name.en));
 * ```
 */
export function constellationFacts(text: string): ConstellationFacts {
  const found = constellation(text);
  if (found === undefined) throw new RangeError(`"${text}" is not one of the 88 constellations (use the IAU abbreviation such as "Ori")`);
  load();
  return stored.get(found.abbreviation)!;
}
