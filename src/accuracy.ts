// How well each value of a star is known: for a star of the bright tier or the nearby tier, which catalogue each of its position, magnitude, colour, parallax and proper motion is from, the error that catalogue
// states (or the size of the last digit it prints, where it states none), and one grade, A, B or C, by a rule written down here.
// The accuracy tier (`@johnmorrisdotca/hoshi-stars/accuracy`): it holds no table and imports no data, only the types of the two tiers it reads and the distance bands, so a page pays for a few kilobytes. Pure: no DOM, no clock.
// An error is only ever one the source states or one the package works out from the source's own figures. Where there is none the field says so (`error` is `undefined`) and gives the resolution: the size of the last printed digit,
// which is a floor on the error and not an estimate of it.
import { distanceQuality, QUALITY_LIMITS, type DistanceQuality } from "./distance-quality.ts";
import type { NearbyStar } from "./nearby.ts";
import type { Star } from "./stars.ts";

export type { DistanceQuality };

/**
 * Where a value is from: `BSC` the Yale Bright Star Catalogue, `GCTP` the Yale General Catalogue of Trigonometric Stellar Parallaxes, `2MASS` the Two Micron All Sky Survey, `dynamical` the Bright Star Catalogue's parallax from the orbit of a binary,
 * `literature` a distance typed from a published paper (Betelgeuse, Rigel, Polaris).
 *
 * @example
 * ```ts
 * import { type AccuracySource } from "@johnmorrisdotca/hoshi-stars/accuracy";
 *
 * const sources: AccuracySource[] = ["BSC", "GCTP", "2MASS", "dynamical", "literature"];
 * console.log(sources.length);
 * ```
 */
export type AccuracySource = "BSC" | "GCTP" | "2MASS" | "dynamical" | "literature";

/**
 * The grade of a star: `A` a distance known to under 5% and a modern position, `B` a distance known to 20% or better (or one known to under 5% with a coarse position), `C` anything else: a position and a rough or missing distance.
 *
 * @example
 * ```ts
 * import { type StarGrade } from "@johnmorrisdotca/hoshi-stars/accuracy";
 *
 * const best: StarGrade = "A";
 * console.log(best);
 * ```
 */
export type StarGrade = "A" | "B" | "C";

/**
 * The grades, best first.
 *
 * @example
 * ```ts
 * import { STAR_GRADES } from "@johnmorrisdotca/hoshi-stars/accuracy";
 *
 * console.log(STAR_GRADES.join(" > "));
 * ```
 */
export const STAR_GRADES: readonly StarGrade[] = ["A", "B", "C"];

/**
 * The numbers the grade is decided by: a distance is `good` under `distance.good` of the parallax and `fair` up to `distance.fair` (the same bands as `distanceQuality`), and a position is modern when its error, or its resolution where it has no stated error, is at most `modernPositionArcsec`.
 *
 * @example
 * ```ts
 * import { GRADE_RULES } from "@johnmorrisdotca/hoshi-stars/accuracy";
 *
 * console.log(GRADE_RULES.distance.good * 100, GRADE_RULES.distance.fair * 100, GRADE_RULES.modernPositionArcsec); // 5 20 2
 * ```
 */
export const GRADE_RULES = { distance: { good: QUALITY_LIMITS.good, fair: QUALITY_LIMITS.rough }, modernPositionArcsec: 2 } as const;

/**
 * What is known about one value of a star.
 *
 * @example
 * ```ts
 * import { starByName } from "@johnmorrisdotca/hoshi-stars";
 * import { starAccuracy, type FieldAccuracy } from "@johnmorrisdotca/hoshi-stars/accuracy";
 *
 * const parallax: FieldAccuracy = starAccuracy(starByName("Sirius")!).parallax;
 * console.log(parallax.source, parallax.error, parallax.unit);
 * ```
 */
export interface FieldAccuracy {
  /** Where the value is from, or `undefined` where the star has no such value (no parallax, no colour, no proper motion). */
  source: AccuracySource | undefined;
  /** The standard error in `unit`, as the source states it or as the package works it out from the source's figures (`note` says which); `undefined` where there is none. */
  error: number | undefined;
  /** The size of the last digit the source prints, in `unit`. A floor on the error, never an estimate of it; `undefined` where there is no value. */
  resolution: number | undefined;
  /** The unit of `error` and `resolution`: `arcsec`, `mag`, `mas` or `mas/yr`. */
  unit: "arcsec" | "mag" | "mas" | "mas/yr";
  /** One plain sentence on what to be careful about, or `undefined` where there is nothing to add. */
  note: string | undefined;
}

/**
 * The distance of a star in numbers: what the parallax's error makes of it.
 *
 * @example
 * ```ts
 * import { starByName } from "@johnmorrisdotca/hoshi-stars";
 * import { starAccuracy, type DistanceAccuracy } from "@johnmorrisdotca/hoshi-stars/accuracy";
 *
 * const distance: DistanceAccuracy = starAccuracy(starByName("Sirius")!).distance;
 * console.log(distance.quality, distance.relativeError);
 * ```
 */
export interface DistanceAccuracy {
  /** The parallax's error divided by the parallax (0.05 is 5%), or `undefined` where there is no parallax or no stated error. */
  relativeError: number | undefined;
  /** The band the distance falls in: the same as `distanceQuality`. */
  quality: DistanceQuality;
}

/**
 * Everything `starAccuracy` says of one star.
 *
 * @example
 * ```ts
 * import { starByName } from "@johnmorrisdotca/hoshi-stars";
 * import { starAccuracy, type StarAccuracy } from "@johnmorrisdotca/hoshi-stars/accuracy";
 *
 * const sirius: StarAccuracy = starAccuracy(starByName("Sirius")!);
 * console.log(sirius.layer, sirius.grade);
 * ```
 */
export interface StarAccuracy {
  /** The tier the star is from: `bright` (the 5,080, `@johnmorrisdotca/hoshi-stars`) or `nearby` (`/nearby`). */
  layer: "bright" | "nearby";
  /** The grade, by `GRADE_RULES`. */
  grade: StarGrade;
  /** Whether the position is modern by `GRADE_RULES.modernPositionArcsec`: the one thing that keeps a well-measured distance from grade A. */
  modernPosition: boolean;
  /** The J2000 position, in arc-seconds. */
  position: FieldAccuracy;
  /** The V magnitude, in magnitudes. */
  magnitude: FieldAccuracy;
  /** The B-V colour index, in magnitudes. Only the bright tier has one. */
  colour: FieldAccuracy;
  /** The parallax, in milliarcseconds. */
  parallax: FieldAccuracy;
  /** The distance the parallax makes. */
  distance: DistanceAccuracy;
  /** The proper motion, in milliarcseconds a year. */
  properMotion: FieldAccuracy;
}

/** The sky-angle step of a right ascension printed to a tenth of a second of time, at a declination: 1.5 arc-seconds at the equator, less toward the poles. */
function raStepArcsec(declination: number): number {
  return 1.5 * Math.cos((declination * Math.PI) / 180);
}

const PARALLAX_STEP: Readonly<Record<AccuracySource, number>> = { GCTP: 0.1, BSC: 1, dynamical: 1, literature: 0.01, "2MASS": 0.1 };

function brightParallaxNote(star: Star): string | undefined {
  if (star.parallaxNote !== undefined) return star.parallaxNote;
  if (star.parallaxSource === undefined) return "The catalogue has no parallax for this star, so its distance is unknown.";
  if (star.parallaxSource === "BSC") return "The Bright Star Catalogue's own parallax, to a whole milliarcsecond, with no stated error.";
  if (star.parallaxSource === "dynamical") return "A dynamical parallax from the orbit of a binary, to a whole milliarcsecond, with no stated error.";
  return undefined;
}

function brightAccuracy(star: Star): Omit<StarAccuracy, "layer" | "grade" | "modernPosition"> {
  const step = Math.max(raStepArcsec(star.declination), 1);
  return {
    position: { source: "BSC", error: undefined, resolution: step, unit: "arcsec", note: "J2000, as the Bright Star Catalogue prints it (0.1 second of time, 1 arc-second); the catalogue states no error." },
    magnitude: { source: "BSC", error: undefined, resolution: 0.01, unit: "mag", note: "The V magnitude to a hundredth; the catalogue states no error." },
    colour: star.colourIndex === undefined ? { source: undefined, error: undefined, resolution: undefined, unit: "mag", note: "The catalogue gives this star no B-V." } : { source: "BSC", error: undefined, resolution: 0.01, unit: "mag", note: "B-V to a hundredth; the catalogue states no error." },
    parallax: { source: star.parallaxSource, error: star.parallaxErrorMas, resolution: star.parallaxSource === undefined ? undefined : PARALLAX_STEP[star.parallaxSource], unit: "mas", note: brightParallaxNote(star) },
    distance: { relativeError: star.parallaxMas > 0 && star.parallaxErrorMas !== undefined ? star.parallaxErrorMas / star.parallaxMas : undefined, quality: distanceQuality(star) },
    properMotion: { source: "BSC", error: undefined, resolution: 1, unit: "mas/yr", note: "To a whole milliarcsecond a year; the catalogue states no error." },
  };
}

function nearbyMagnitudeNote(star: NearbyStar): string | undefined {
  if (star.magnitude === undefined) return undefined;
  if (star.magnitudeKind === "blue") return "A photographic blue magnitude, not a V; it reads fainter than V for a red star.";
  if (star.magnitudeKind === "visual") return "A visual or other magnitude the Yale catalogue marks as less accurate than a photoelectric V.";
  return "A photoelectric V to a hundredth; the catalogue states no error.";
}

function nearbyAccuracy(star: NearbyStar): Omit<StarAccuracy, "layer" | "grade" | "modernPosition"> {
  const hasParallax = star.parallaxMas > 0;
  return {
    position: {
      source: star.positionSource,
      error: star.positionErrorArcsec,
      resolution: 0.01,
      unit: "arcsec",
      note: star.positionSource === "2MASS" ? "A 2MASS position; the error is 2MASS's own plus the star's motion over the gap to 2000, as the package works it out." : "The Yale catalogue's own position carried from 1900 to 2000: good to arc-seconds at best.",
    },
    magnitude: star.magnitude === undefined ? { source: undefined, error: undefined, resolution: undefined, unit: "mag", note: "The catalogue gives this star no magnitude." } : { source: "GCTP", error: undefined, resolution: 0.01, unit: "mag", note: nearbyMagnitudeNote(star) },
    colour: { source: undefined, error: undefined, resolution: undefined, unit: "mag", note: "The nearby tier holds no colour index." },
    parallax: { source: "GCTP", error: star.parallaxErrorMas, resolution: PARALLAX_STEP.GCTP, unit: "mas", note: hasParallax ? undefined : "The parallax is 0 or less (a measurement with an error), so the star has no distance." },
    distance: { relativeError: hasParallax ? star.relativeError : undefined, quality: distanceQuality({ parallaxMas: star.parallaxMas, parallaxErrorMas: star.parallaxErrorMas, parallaxSource: "GCTP" }) },
    properMotion: star.properMotionSource === undefined ? { source: undefined, error: undefined, resolution: undefined, unit: "mas/yr", note: "The catalogue has no proper motion for this star." } : { source: "GCTP", error: undefined, resolution: 1, unit: "mas/yr", note: "From the Yale parallax catalogue, to a whole milliarcsecond a year; no error is kept." },
  };
}

/**
 * How well each value of a star is known, and its grade. The grade is a rule on the stated figures, not a verdict on the star: **A** a distance known to under 5% and a modern position (an error, or where none is stated a resolution, of 2 arc-seconds or less),
 * **B** a distance known to 20% or better, **C** anything else (a position and a rough distance, or no distance). A parallax with no stated error is never better than rough, except a dynamical one, which is fair. Sirius is grade A, Betelgeuse (a paper's distance, known to about 14%) is grade B and Rigel (a range of 590 to 1,480 light-years) is grade C.
 *
 * @param star - A bright star (from `stars()`) or a nearby star (from `/nearby`).
 * @returns The record: the tier, the grade and, for position, magnitude, colour, parallax and proper motion, the source, the error and the resolution.
 *
 * @example
 * ```ts
 * import { starByName } from "@johnmorrisdotca/hoshi-stars";
 * import { starAccuracy } from "@johnmorrisdotca/hoshi-stars/accuracy";
 *
 * const sirius = starAccuracy(starByName("Sirius")!);
 * console.log(sirius.grade, sirius.parallax.source, sirius.distance.quality, starAccuracy(starByName("Rigel")!).grade);
 * ```
 */
export function starAccuracy(star: Star | NearbyStar): StarAccuracy {
  const layer = "hr" in star ? "bright" : "nearby";
  const fields = "hr" in star ? brightAccuracy(star) : nearbyAccuracy(star);
  const modernPosition = (fields.position.error ?? fields.position.resolution ?? Number.POSITIVE_INFINITY) <= GRADE_RULES.modernPositionArcsec;
  const { quality } = fields.distance;
  const grade: StarGrade = quality === "good" && modernPosition ? "A" : quality === "good" || quality === "fair" ? "B" : "C";
  return { layer, grade, modernPosition, ...fields };
}

/**
 * Whether a grade is at least as good as another: `A` is at least `B`, and `B` is at least `B`, but `C` is not at least `B`.
 *
 * @param grade - The grade to test.
 * @param minimum - The worst grade that is accepted.
 * @returns `true` when `grade` is `minimum` or better.
 *
 * @example
 * ```ts
 * import { gradeAtLeast } from "@johnmorrisdotca/hoshi-stars/accuracy";
 *
 * console.log(gradeAtLeast("A", "B"), gradeAtLeast("C", "B")); // true false
 * ```
 */
export function gradeAtLeast(grade: StarGrade, minimum: StarGrade): boolean {
  return STAR_GRADES.indexOf(grade) <= STAR_GRADES.indexOf(minimum);
}
