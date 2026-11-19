// A star's distance with its uncertainty, from its parallax and the parallax's error. Its own small file so that `/catalogue`'s layers can work out a distance without loading the bright-star table;
// the main entry point exports it from `./stars.ts` as before. Pure: no DOM, no clock, no data.
import type { Star } from "./stars.ts";

/**
 * A star's distance with its uncertainty: what `starDistance` returns.
 *
 * @example
 * ```ts
 * import { starByName, starDistance, type StarDistance } from "@johnmorrisdotca/hoshi-stars";
 *
 * const distance: StarDistance | undefined = starDistance(starByName("Betelgeuse")!);
 * console.log(distance?.lightYearsRange);
 * ```
 */
export interface StarDistance {
  /** The distance in light-years: 3,261.56 divided by the parallax in milliarcseconds. */
  lightYears: number;
  /** The error of `lightYears`: the distance times the parallax's relative error (a first-order figure, good while that is small), or `undefined` where the parallax has no error. */
  lightYearsError: number | undefined;
  /** The nearest and the farthest the distance can be within one standard error of the parallax, or `undefined` where the parallax has no error. The farthest is `Infinity` where the error is as large as the parallax (the distance has no upper limit). */
  lightYearsRange: readonly [number, number] | undefined;
}

/**
 * A star's distance with its uncertainty, from the parallax and its error. Sirius is 8.5 light-years, to within 0.05; Betelgeuse's distance is a published paper's (168 parsecs, 548 light-years), so it is anywhere from 480 to 640 light-years. Rigel is rougher: from 590 to 1,480 light-years.
 *
 * @param star - A star, or anything with a parallax in milliarcseconds and its error (a nearby star from `/nearby`).
 * @returns The distance, its error and its range in light-years, or `undefined` where there is no parallax (or a non-positive one).
 *
 * @example
 * ```ts
 * import { starByName, starDistance } from "@johnmorrisdotca/hoshi-stars";
 *
 * const sirius = starDistance(starByName("Sirius")!)!;
 * console.log(sirius.lightYears.toFixed(2), sirius.lightYearsError?.toFixed(2), sirius.lightYearsRange?.map((ly) => ly.toFixed(2)));
 * ```
 */
export function starDistance(star: Pick<Star, "parallaxMas" | "parallaxErrorMas">): StarDistance | undefined {
  const { parallaxMas: parallax, parallaxErrorMas: error } = star;
  if (!(parallax > 0)) return undefined;
  const lightYears = 3261.563777 / parallax;
  if (error === undefined) return { lightYears, lightYearsError: undefined, lightYearsRange: undefined };
  return { lightYears, lightYearsError: (lightYears * error) / parallax, lightYearsRange: [3261.563777 / (parallax + error), error < parallax ? 3261.563777 / (parallax - error) : Number.POSITIVE_INFINITY] };
}
