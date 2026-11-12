// How well a star's distance is known: the four qualities and the relative errors that divide them. Its own small file so that `/accuracy` can grade a star without loading the bright-star table;
// `/constellation-3d` re-exports all of it. Pure: no DOM, no clock, no data.
import type { Star } from "./stars.ts";

/**
 * How well a star's distance is known, from its parallax and the error the catalogue states:
 * `good` (the error is under 5% of the parallax), `fair` (5% to 20%, or a dynamical parallax from a binary's orbit), `rough` (over 20%, or a parallax with no stated error) and `none` (no parallax: the distance is unknown).
 *
 * @example
 * ```ts
 * import { type DistanceQuality } from "@johnmorrisdotca/hoshi-stars/constellation-3d";
 *
 * const kinds: DistanceQuality[] = ["good", "fair", "rough", "none"];
 * console.log(kinds.join(", "));
 * ```
 */
export type DistanceQuality = "good" | "fair" | "rough" | "none";

/**
 * The qualities in order, best first.
 *
 * @example
 * ```ts
 * import { DISTANCE_QUALITIES } from "@johnmorrisdotca/hoshi-stars/constellation-3d";
 *
 * console.log(DISTANCE_QUALITIES.join(" > "));
 * ```
 */
export const DISTANCE_QUALITIES: readonly DistanceQuality[] = ["good", "fair", "rough", "none"];

/**
 * The relative errors that divide the qualities: under `good` is good, up to `rough` is fair, over it is rough.
 *
 * @example
 * ```ts
 * import { QUALITY_LIMITS } from "@johnmorrisdotca/hoshi-stars/constellation-3d";
 *
 * console.log(QUALITY_LIMITS.good * 100, QUALITY_LIMITS.rough * 100); // 5 20
 * ```
 */
export const QUALITY_LIMITS = { good: 0.05, rough: 0.2 } as const;

/**
 * How well a star's distance is known (see `DistanceQuality`).
 *
 * @param star - A star, or anything with a parallax in milliarcseconds, its error and its source.
 * @returns The quality.
 *
 * @example
 * ```ts
 * import { starByName } from "@johnmorrisdotca/hoshi-stars";
 * import { distanceQuality } from "@johnmorrisdotca/hoshi-stars/constellation-3d";
 *
 * console.log(distanceQuality(starByName("Alnilam")!), distanceQuality(starByName("Rigel")!)); // none rough
 * ```
 */
export function distanceQuality(star: Pick<Star, "parallaxMas" | "parallaxErrorMas" | "parallaxSource">): DistanceQuality {
  if (!(star.parallaxMas > 0)) return "none";
  if (star.parallaxErrorMas === undefined) return star.parallaxSource === "dynamical" ? "fair" : "rough";
  const share = star.parallaxErrorMas / star.parallaxMas;
  return share < QUALITY_LIMITS.good ? "good" : share <= QUALITY_LIMITS.rough ? "fair" : "rough";
}
