// The filter applied to the Bright Star Catalogue table, once per filter and not once per star per frame: a mask over the table in its own order, kept for the last few filters asked for.
// Its own file so that `/star-filter` itself loads no table. Pure: no DOM, no clock.
import { starDistance } from "./star-distance.ts";
import type { StarFilterCount } from "./star-filter-bar.ts";
import { starFilterActive, starFilterKey, starPasses, type StarFilter } from "./star-filter.ts";
import { stars } from "./stars.ts";

/**
 * The bright stars a filter keeps: `mask[i]` is 1 for the table's star `i` (the order of `stars()`) when it is kept.
 *
 * @example
 * ```ts
 * import { brightShown } from "@johnmorrisdotca/hoshi-stars/star-filter/bright";
 *
 * const kept = brightShown({ distanceMax: 20 });
 * console.log(kept?.shown, kept?.total);
 * ```
 */
export interface BrightShown {
  mask: Uint8Array;
  /** Whether the star with this Bright Star Catalogue number is kept. */
  has(hr: number): boolean;
  /** How many are kept. */
  shown: number;
  /** How many there are. */
  total: number;
}

let distances: Float32Array | undefined;
let noDistance = 0;
const kept = new Map<string, BrightShown>();
const KEEP = 6;

/** Each star's distance in light-years, 0 for none, worked out once. */
function lightYears(): Float32Array {
  if (distances === undefined) {
    const list = stars();
    distances = new Float32Array(list.length);
    list.forEach((star, i) => {
      const found = starDistance(star);
      distances![i] = found === undefined ? 0 : found.lightYears;
      if (found === undefined) noDistance += 1;
    });
  }
  return distances;
}

/**
 * How many bright stars have no known distance, and so are hidden while the distance is narrowed.
 *
 * @returns The count.
 *
 * @example
 * ```ts
 * import { brightWithoutDistance } from "@johnmorrisdotca/hoshi-stars/star-filter/bright";
 *
 * console.log(brightWithoutDistance() > 0);
 * // true
 * ```
 */
export function brightWithoutDistance(): number {
  lightYears();
  return noDistance;
}

/**
 * The bright stars a filter keeps, as a mask over the table; the answer for a filter is kept, so asking again for the same one (every frame) costs a lookup.
 *
 * @param filter - The filter (made well: `normaliseStarFilter`).
 * @returns The stars kept, or `undefined` where the filter takes nothing out (draw every star).
 *
 * @example
 * ```ts
 * import { starByName } from "@johnmorrisdotca/hoshi-stars";
 * import { brightShown } from "@johnmorrisdotca/hoshi-stars/star-filter/bright";
 *
 * const kept = brightShown({ distanceMax: 20, magnitudeLimit: 3 });
 * console.log(kept?.has(starByName("Sirius")!.hr), kept?.has(starByName("Betelgeuse")!.hr));
 * // true false
 * ```
 */
export function brightShown(filter: StarFilter): BrightShown | undefined {
  if (!starFilterActive(filter)) return undefined;
  const key = starFilterKey(filter);
  const found = kept.get(key);
  if (found !== undefined) return found;
  const list = stars();
  const far = lightYears();
  const mask = new Uint8Array(list.length);
  const hrs = new Set<number>();
  for (let i = 0; i < list.length; i += 1) {
    const star = list[i]!;
    if (starPasses(filter, star.magnitude, far[i]! > 0 ? far[i]! : undefined)) {
      mask[i] = 1;
      hrs.add(star.hr);
    }
  }
  const made: BrightShown = { mask, has: (hr) => hrs.has(hr), shown: hrs.size, total: list.length };
  if (kept.size >= KEEP) kept.delete(kept.keys().next().value!);
  kept.set(key, made);
  return made;
}

/**
 * How many bright stars a filter keeps, of how many, and how many have no known distance: the line under the filter bars.
 *
 * @param filter - The filter (made well: `normaliseStarFilter`).
 * @returns The three counts.
 *
 * @example
 * ```ts
 * import { brightCount } from "@johnmorrisdotca/hoshi-stars/star-filter/bright";
 *
 * const { shown, total } = brightCount({ magnitudeLimit: 3 });
 * console.log(shown < total);
 * // true
 * ```
 */
export function brightCount(filter: StarFilter): StarFilterCount {
  const found = brightShown(filter);
  return { shown: found === undefined ? stars().length : found.shown, total: stars().length, noDistance: brightWithoutDistance() };
}
