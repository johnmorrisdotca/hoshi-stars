// Two filters for any sky: a distance range in light-years and a faintest magnitude. Pure: no DOM, no clock and no data of its own, so a page pays only for what it uses; the elements and the chart apply it to their own stars.
// A star with no known distance is shown only while the distance is not narrowed: a range cannot say that a star of unknown distance is inside it.

/**
 * What to keep. Every field is optional and means "no limit" when it is left out.
 *
 * @example
 * ```ts
 * import type { StarFilter } from "@johnmorrisdotca/hoshi-stars/star-filter";
 *
 * const filter: StarFilter = { distanceMax: 100, magnitudeLimit: 4.5 };
 * console.log(filter.distanceMax);
 * ```
 */
export interface StarFilter {
  /** Only stars at least this far away, in light-years. Left out for no nearest limit. */
  distanceMin?: number | undefined;
  /** Only stars no farther than this, in light-years. Left out for no farthest limit. */
  distanceMax?: number | undefined;
  /** Only stars at least this bright: the faintest apparent magnitude kept (Sirius is -1.46, the faintest star the eye sees about 6). Left out for no limit. */
  magnitudeLimit?: number | undefined;
}

/**
 * The attributes the sky elements read the filter from, and the one that shows the bars: `distance-min` and `distance-max` (light-years), `magnitude-limit` and `filter-bar`.
 *
 * @example
 * ```ts
 * import { STAR_FILTER_ATTRIBUTES } from "@johnmorrisdotca/hoshi-stars/star-filter";
 *
 * console.log(STAR_FILTER_ATTRIBUTES.distanceMax);
 * // distance-max
 * ```
 */
export const STAR_FILTER_ATTRIBUTES = Object.freeze({ distanceMin: "distance-min", distanceMax: "distance-max", magnitudeLimit: "magnitude-limit", bar: "filter-bar" });

/**
 * The distances the bars step through, in light-years. The nearest end's bar takes all but the last; the farthest end's takes all but the first, and past the last it is "any".
 *
 * @example
 * ```ts
 * import { DISTANCE_STOPS } from "@johnmorrisdotca/hoshi-stars/star-filter";
 *
 * console.log(DISTANCE_STOPS.join(" "));
 * ```
 */
export const DISTANCE_STOPS: readonly number[] = Object.freeze([0, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000]);

/**
 * The faintest magnitudes the brightness bar steps through, half a magnitude at a time. Past the last it is "any".
 *
 * @example
 * ```ts
 * import { MAGNITUDE_STOPS } from "@johnmorrisdotca/hoshi-stars/star-filter";
 *
 * console.log(MAGNITUDE_STOPS[0], MAGNITUDE_STOPS.at(-1));
 * ```
 */
export const MAGNITUDE_STOPS: readonly number[] = Object.freeze([1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5]);

/** Words that mean "no limit" in an attribute or an address. */
const NO_LIMIT = /^(any|all|off|none|no|-|)$/i;

const reading = (text: string | null | undefined): number | undefined => {
  if (text === null || text === undefined || NO_LIMIT.test(text.trim())) return undefined;
  const n = Number(text);
  return Number.isFinite(n) ? n : undefined;
};

/** Three significant figures keeps a number short enough for an address. */
const short = (n: number): number => Number(n.toPrecision(3));

/**
 * A filter made well: a distance that is not a number above 0 is dropped (a nearest of 0 is no nearest limit), a magnitude that is not a number is dropped, and numbers are rounded to 3 significant figures. A nearest above the farthest is kept as given, and shows nothing.
 *
 * @param filter - What was asked for.
 * @returns A new, frozen filter with only the limits that apply.
 *
 * @example
 * ```ts
 * import { normaliseStarFilter } from "@johnmorrisdotca/hoshi-stars/star-filter";
 *
 * console.log(normaliseStarFilter({ distanceMin: 0, distanceMax: Infinity, magnitudeLimit: 5.04 }));
 * // { magnitudeLimit: 5.04 }
 * ```
 */
export function normaliseStarFilter(filter: StarFilter = {}): StarFilter {
  const { distanceMin, distanceMax, magnitudeLimit } = filter;
  const out: StarFilter = {};
  if (typeof distanceMin === "number" && Number.isFinite(distanceMin) && distanceMin > 0) out.distanceMin = short(distanceMin);
  if (typeof distanceMax === "number" && Number.isFinite(distanceMax) && distanceMax > 0) out.distanceMax = short(distanceMax);
  if (typeof magnitudeLimit === "number" && Number.isFinite(magnitudeLimit)) out.magnitudeLimit = Math.round(magnitudeLimit * 100) / 100;
  return Object.freeze(out);
}

/**
 * A filter from the text of the three attributes (or of an address). Missing, empty, `any`, `all`, `off` and anything that is not a number mean no limit.
 *
 * @param distanceMin - The nearest distance in light-years, as text.
 * @param distanceMax - The farthest distance in light-years, as text.
 * @param magnitudeLimit - The faintest magnitude, as text.
 * @returns The filter.
 *
 * @example
 * ```ts
 * import { starFilterFromText } from "@johnmorrisdotca/hoshi-stars/star-filter";
 *
 * console.log(starFilterFromText("20", "any", "4.5"));
 * // { distanceMin: 20, magnitudeLimit: 4.5 }
 * ```
 */
export function starFilterFromText(distanceMin: string | null | undefined, distanceMax: string | null | undefined, magnitudeLimit: string | null | undefined): StarFilter {
  return normaliseStarFilter({ distanceMin: reading(distanceMin), distanceMax: reading(distanceMax), magnitudeLimit: reading(magnitudeLimit) });
}

/**
 * A filter as the text of its three attributes: each limit as a short number, or `null` where there is none (take the attribute or the address's key off). The same text `starFilterFromText` reads.
 *
 * @param filter - The filter.
 * @returns The text for `distance-min`, `distance-max` and `magnitude-limit`; `null` where that limit is not set (no limit).
 *
 * @example
 * ```ts
 * import { starFilterToText } from "@johnmorrisdotca/hoshi-stars/star-filter";
 *
 * console.log(starFilterToText({ distanceMax: 100, magnitudeLimit: 4.5 }));
 * // { distanceMin: null, distanceMax: '100', magnitudeLimit: '4.5' }
 * ```
 */
export function starFilterToText(filter: StarFilter): { distanceMin: string | null; distanceMax: string | null; magnitudeLimit: string | null } {
  const { distanceMin, distanceMax, magnitudeLimit } = normaliseStarFilter(filter);
  return { distanceMin: distanceMin === undefined ? null : String(distanceMin), distanceMax: distanceMax === undefined ? null : String(distanceMax), magnitudeLimit: magnitudeLimit === undefined ? null : String(magnitudeLimit) };
}

/**
 * Whether the distance is narrowed: a nearest or a farthest limit is set.
 *
 * @param filter - The filter.
 * @returns `true` when a star with no known distance is hidden.
 *
 * @example
 * ```ts
 * import { distanceNarrowed } from "@johnmorrisdotca/hoshi-stars/star-filter";
 *
 * console.log(distanceNarrowed({ magnitudeLimit: 5 }), distanceNarrowed({ distanceMax: 50 }));
 * // false true
 * ```
 */
export function distanceNarrowed(filter: StarFilter): boolean {
  return filter.distanceMin !== undefined || filter.distanceMax !== undefined;
}

/**
 * Whether the filter takes anything out.
 *
 * @param filter - The filter.
 * @returns `false` for the empty filter.
 *
 * @example
 * ```ts
 * import { starFilterActive } from "@johnmorrisdotca/hoshi-stars/star-filter";
 *
 * console.log(starFilterActive({}), starFilterActive({ magnitudeLimit: 4 }));
 * // false true
 * ```
 */
export function starFilterActive(filter: StarFilter): boolean {
  return distanceNarrowed(filter) || filter.magnitudeLimit !== undefined;
}

/**
 * Whether a star is kept. A star is kept when it is no fainter than the magnitude limit and, if the distance is narrowed, its distance is known and inside the range (both ends included). A star with no known distance is shown only while the distance is not narrowed.
 *
 * @param filter - The filter (made well: `normaliseStarFilter`).
 * @param magnitude - The star's apparent magnitude.
 * @param lightYears - Its distance in light-years, or `undefined` where it has none.
 * @returns Whether to draw it.
 *
 * @example
 * ```ts
 * import { starPasses } from "@johnmorrisdotca/hoshi-stars/star-filter";
 *
 * const near = { distanceMax: 20, magnitudeLimit: 3 };
 * console.log(starPasses(near, -1.46, 8.6), starPasses(near, 0.03, 25), starPasses(near, 1, undefined));
 * // true false false
 * ```
 */
export function starPasses(filter: StarFilter, magnitude: number, lightYears: number | undefined): boolean {
  if (filter.magnitudeLimit !== undefined && !(magnitude <= filter.magnitudeLimit)) return false;
  if (!distanceNarrowed(filter)) return true;
  if (lightYears === undefined || !(lightYears > 0)) return false;
  return lightYears >= (filter.distanceMin ?? 0) && lightYears <= (filter.distanceMax ?? Number.POSITIVE_INFINITY);
}

/**
 * One short text for a filter, the same for the same filter: what a cache keys on and a test compares.
 *
 * @param filter - The filter.
 * @returns For example `20-100|4.5`; an empty text for no limits.
 *
 * @example
 * ```ts
 * import { starFilterKey } from "@johnmorrisdotca/hoshi-stars/star-filter";
 *
 * console.log(starFilterKey({ distanceMax: 100, magnitudeLimit: 4.5 }), starFilterKey({}) === "");
 * // 0-100|4.5 true
 * ```
 */
export function starFilterKey(filter: StarFilter): string {
  const { distanceMin, distanceMax, magnitudeLimit } = filter;
  const distance = distanceNarrowed(filter) ? `${distanceMin ?? 0}-${distanceMax ?? ""}` : "";
  return distance === "" && magnitudeLimit === undefined ? "" : `${distance}|${magnitudeLimit ?? ""}`;
}

/**
 * A position of a distance bar for a distance. The nearest end's bar has the positions 0 to the last but one stop (a position 0 is no nearest limit); the farthest end's has 1 to the last stop (the last is no farthest limit). A distance between two stops takes the nearer one.
 *
 * @param lightYears - The limit in light-years, or `undefined` for none.
 * @param end - `min` for the nearest end's bar, `max` for the farthest end's.
 * @returns A whole number for a range input.
 *
 * @example
 * ```ts
 * import { distanceStep } from "@johnmorrisdotca/hoshi-stars/star-filter";
 *
 * console.log(distanceStep(undefined, "min"), distanceStep(100, "max"), distanceStep(undefined, "max"));
 * // 0 5 10
 * ```
 */
export function distanceStep(lightYears: number | undefined, end: "min" | "max"): number {
  const last = DISTANCE_STOPS.length - 1;
  if (lightYears === undefined) return end === "min" ? 0 : last;
  let step = 0;
  for (let i = 0; i <= last; i += 1) if (DISTANCE_STOPS[i]! <= lightYears) step = i;
  return end === "min" ? Math.min(step, last - 1) : Math.max(step, 1);
}

/**
 * The distance a position of a distance bar means, the inverse of `distanceStep`: `undefined` for no limit.
 *
 * @param step - The range input's value.
 * @param end - `min` or `max`.
 * @returns The limit in light-years, or `undefined`.
 *
 * @example
 * ```ts
 * import { distanceOfStep } from "@johnmorrisdotca/hoshi-stars/star-filter";
 *
 * console.log(distanceOfStep(5, "max"), distanceOfStep(0, "min"), distanceOfStep(10, "max"));
 * // 100 undefined undefined
 * ```
 */
export function distanceOfStep(step: number, end: "min" | "max"): number | undefined {
  const last = DISTANCE_STOPS.length - 1;
  const at = Math.max(0, Math.min(last, Math.round(step)));
  if (end === "min") return at === 0 ? undefined : DISTANCE_STOPS[at];
  return at >= last ? undefined : DISTANCE_STOPS[Math.max(1, at)];
}

/**
 * A position of the brightness bar for a magnitude limit: 0 to the last stop, and one past the last for no limit. A limit between two stops takes the nearer one above it.
 *
 * @param magnitude - The faintest magnitude kept, or `undefined` for none.
 * @returns A whole number for a range input.
 *
 * @example
 * ```ts
 * import { magnitudeStep } from "@johnmorrisdotca/hoshi-stars/star-filter";
 *
 * console.log(magnitudeStep(1), magnitudeStep(4.5), magnitudeStep(undefined));
 * // 0 7 12
 * ```
 */
export function magnitudeStep(magnitude: number | undefined): number {
  if (magnitude === undefined) return MAGNITUDE_STOPS.length;
  const found = MAGNITUDE_STOPS.findIndex((stop) => stop >= magnitude);
  return found === -1 ? MAGNITUDE_STOPS.length : found;
}

/**
 * The magnitude a position of the brightness bar means, the inverse of `magnitudeStep`: `undefined` for no limit.
 *
 * @param step - The range input's value.
 * @returns The faintest magnitude kept, or `undefined`.
 *
 * @example
 * ```ts
 * import { magnitudeOfStep } from "@johnmorrisdotca/hoshi-stars/star-filter";
 *
 * console.log(magnitudeOfStep(7), magnitudeOfStep(12));
 * // 4.5 undefined
 * ```
 */
export function magnitudeOfStep(step: number): number | undefined {
  const at = Math.round(step);
  return at < 0 ? MAGNITUDE_STOPS[0] : at >= MAGNITUDE_STOPS.length ? undefined : MAGNITUDE_STOPS[at];
}
