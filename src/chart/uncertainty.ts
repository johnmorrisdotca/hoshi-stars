// What the chart says of how well a star is known: the grade and the ± on a pick, and which stars the "show uncertainty" look draws dimmer. Pure: no DOM, no clock; it reads the grade from `/accuracy`.
import { starAccuracy, starGrade, type StarGrade } from "../accuracy.ts";
import { starDistance, type Star } from "../stars.ts";

/**
 * The grade and the ± of a picked star: what `hoshi-pick` carries in `accuracy` for a star.
 *
 * @example
 * ```ts
 * import { starByName } from "@johnmorrisdotca/hoshi-stars";
 * import { pickAccuracy, type PickAccuracy } from "@johnmorrisdotca/hoshi-stars/chart";
 *
 * const sirius: PickAccuracy = pickAccuracy(starByName("Sirius")!);
 * console.log(sirius.grade, sirius.lightYearsRange, sirius.positionResolutionArcsec);
 * ```
 */
export interface PickAccuracy {
  /** The star's grade, A, B or C, by the rule in `/accuracy`. */
  grade: StarGrade;
  /** The nearest and the farthest the distance can be, in light-years, within one standard error of the parallax (the farthest is `Infinity` where the error is as large as the parallax); `null` where the star has no distance or the parallax has no stated error. */
  lightYearsRange: readonly [number, number] | null;
  /** The size of the last digit of the star's position, in arc-seconds: a floor on its error, not an estimate of it. */
  positionResolutionArcsec: number;
}

/**
 * The grade and the ± of a star, for a pick: the grade, the distance range and the position resolution.
 *
 * @param star - A bright star.
 * @returns The grade, the distance range in light-years (or `null`) and the position resolution in arc-seconds.
 *
 * @example
 * ```ts
 * import { starByName } from "@johnmorrisdotca/hoshi-stars";
 * import { pickAccuracy } from "@johnmorrisdotca/hoshi-stars/chart";
 *
 * console.log(pickAccuracy(starByName("Rigel")!).grade); // C
 * ```
 */
export function pickAccuracy(star: Star): PickAccuracy {
  const { grade, position } = starAccuracy(star);
  return { grade, lightYearsRange: starDistance(star)?.lightYearsRange ?? null, positionResolutionArcsec: position.resolution ?? 0 };
}

/**
 * How much of its own strength a grade C star is drawn at when the uncertainty is shown (its `fill-opacity`).
 *
 * @example
 * ```ts
 * import { UNCERTAIN_OPACITY } from "@johnmorrisdotca/hoshi-stars/chart";
 *
 * console.log(UNCERTAIN_OPACITY);
 * ```
 */
export const UNCERTAIN_OPACITY = 0.45;

/**
 * Whether the "show uncertainty" look draws a star dimmer: a grade C star (a rough or missing distance) is, grades A and B are not.
 *
 * @param star - A bright star.
 * @returns `true` for grade C.
 *
 * @example
 * ```ts
 * import { starByName } from "@johnmorrisdotca/hoshi-stars";
 * import { dimsForUncertainty } from "@johnmorrisdotca/hoshi-stars/chart";
 *
 * console.log(dimsForUncertainty(starByName("Sirius")!), dimsForUncertainty(starByName("Rigel")!)); // false true
 * ```
 */
export function dimsForUncertainty(star: Star): boolean {
  return starGrade(star) === "C";
}
