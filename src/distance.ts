// The sky out to a distance, in layers: which stars and deep-sky objects lie nearer than a limit (10, 50, 100, 500, 1,000 light-years, or all), each in the band of its distance, and which have no distance known well enough to say.
// The distance-layers tier (`@johnmorrisdotca/hoshi-stars/distance`). Pure: no DOM, no clock, and no data of its own: it takes the stars, nearby stars and galaxies the page already loaded, so a page pays only for the tables it uses.
// Nothing is guessed: a thing with no distance is never placed in a band, and one whose distance is uncertain is kept apart in its own band, with the range its error allows, and never at a false exact place.
import type { NearbyStar } from "./nearby.ts";
import type { GalaxyDistance } from "./galaxy-distance-core.ts";
import type { Star } from "./stars.ts";

/** Light-years in a parsec's thousand-milliarcsecond share: the distance is this divided by the parallax in milliarcseconds. */
const LY_MAS = 3261.563777;

/**
 * The limits the sky map steps through, in light-years: 10, 50, 100, 500 and 1,000. Beyond the last is `all`.
 *
 * @example
 * ```ts
 * import { DISTANCE_LIMITS } from "@johnmorrisdotca/hoshi-stars/distance";
 *
 * console.log(DISTANCE_LIMITS.join(", "));
 * ```
 */
export const DISTANCE_LIMITS: readonly number[] = Object.freeze([10, 50, 100, 500, 1000]);

/**
 * The relative errors that divide a distance's certainty, the same as `QUALITY_LIMITS` of the constellation in 3D: a parallax known to under 5% is `good`, to 20% is `fair`, and worse (or with no error stated) is `rough`.
 *
 * @example
 * ```ts
 * import { CERTAINTY_LIMITS } from "@johnmorrisdotca/hoshi-stars/distance";
 *
 * console.log(CERTAINTY_LIMITS.good, CERTAINTY_LIMITS.rough);
 * ```
 */
export const CERTAINTY_LIMITS = Object.freeze({ good: 0.05, rough: 0.2 });

/**
 * How well a distance is known: `good` (under 5%), `fair` (5% to 20%) or `rough` (over 20%, or no error stated). A rough distance is never drawn at its best value: it is in the `uncertain` band, with its range.
 *
 * @example
 * ```ts
 * import type { Certainty } from "@johnmorrisdotca/hoshi-stars/distance";
 *
 * const how: Certainty = "rough";
 * console.log(how);
 * ```
 */
export type Certainty = "good" | "fair" | "rough";

/**
 * The kind of thing in a layer: a bright star of the Yale catalogue, a nearby star of the Yale parallax catalogue (`/nearby`), or a deep-sky object with a distance (a galaxy).
 *
 * @example
 * ```ts
 * import type { LayerKind } from "@johnmorrisdotca/hoshi-stars/distance";
 *
 * const kind: LayerKind = "deep-sky";
 * console.log(kind);
 * ```
 */
export type LayerKind = "star" | "nearby" | "deep-sky";

/**
 * Something with a place on the sky and perhaps a distance, as `layersByDistance` takes it. Make one with `starInput`, `nearbyInput` or `deepSkyInput`, or write one for your own data.
 *
 * @example
 * ```ts
 * import type { DistanceInput } from "@johnmorrisdotca/hoshi-stars/distance";
 *
 * const proxima: DistanceInput = { id: "proxima", kind: "nearby", name: "Proxima Centauri", rightAscension: 217.43, declination: -62.68, magnitude: 11.1, lightYears: 4.24, low: 4.24, high: 4.24, certainty: "good" };
 * console.log(proxima.name);
 * ```
 */
export interface DistanceInput {
  /** A key that stays the same: `hr-2491` for a bright star, `gctp-3278` for a nearby star, `M31` for a deep-sky object. */
  id: string;
  kind: LayerKind;
  name: string | undefined;
  /** J2000 right ascension and declination in degrees. */
  rightAscension: number;
  declination: number;
  /** Visual magnitude, or `undefined`. */
  magnitude: number | undefined;
  /** The best distance in light-years, or `undefined` where there is none: the thing is then counted as having no distance, and never placed. */
  lightYears: number | undefined;
  /** The nearest and farthest the distance can be within one standard error, in light-years; `Infinity` for no upper limit. The distance itself where no error is stated. */
  low: number | undefined;
  high: number | undefined;
  certainty: Certainty | undefined;
}

/**
 * A thing in a layer: where it is, how far, and which band it is in.
 *
 * @example
 * ```ts
 * import type { LayeredThing } from "@johnmorrisdotca/hoshi-stars/distance";
 *
 * const far = (thing: LayeredThing): boolean => thing.band >= 4;
 * console.log(typeof far);
 * ```
 */
export interface LayeredThing extends Omit<DistanceInput, "lightYears" | "low" | "high" | "certainty"> {
  /** The best distance in light-years. For an `uncertain` thing it is the catalogue's value, not a place to draw it at. */
  lightYears: number;
  /** The nearest and the farthest it can be, in light-years. */
  low: number;
  high: number;
  certainty: Certainty;
  /** The band of `lightYears`: 0 under 10 light-years, 1 under 50, 2 under 100, 3 under 500, 4 under 1,000, 5 beyond. */
  band: number;
  /** True when the distance is rough (`certainty`): the thing belongs to the `uncertain` band, not to `band`, and is drawn as a mark with no exact place, or as a streak along its line of sight from `low` to `high`. */
  uncertain: boolean;
}

/**
 * What `layersByDistance` gives back.
 *
 * @example
 * ```ts
 * import type { DistanceLayers } from "@johnmorrisdotca/hoshi-stars/distance";
 *
 * const total = (layers: DistanceLayers): number => layers.counts.reduce((sum, n) => sum + n, 0) + layers.uncertain;
 * console.log(typeof total);
 * ```
 */
export interface DistanceLayers {
  /** The limit the layers were made for, in light-years; `Infinity` for all. */
  limit: number;
  /** The things within the limit, nearest first: the certain ones by their best distance, the uncertain ones by the nearest their error allows. */
  things: LayeredThing[];
  /** How many certain things are in each of the six bands. */
  counts: number[];
  /** How many things are in the `uncertain` band: those whose distance is rough and whose range reaches inside the limit. */
  uncertain: number;
  /** How many things were given with no distance at all. They are never drawn once a limit is set. */
  unknown: number;
}

/**
 * The band of a distance: 0 under 10 light-years, 1 under 50, 2 under 100, 3 under 500, 4 under 1,000 and 5 beyond (a distance of exactly the edge is in the nearer band).
 *
 * @param lightYears - A distance in light-years.
 * @returns A number from 0 to 5.
 *
 * @example
 * ```ts
 * import { bandOf } from "@johnmorrisdotca/hoshi-stars/distance";
 *
 * console.log(bandOf(4.2), bandOf(10), bandOf(444), bandOf(2_500_000));
 * ```
 */
export function bandOf(lightYears: number): number {
  for (let i = 0; i < DISTANCE_LIMITS.length; i += 1) if (lightYears <= DISTANCE_LIMITS[i]!) return i;
  return DISTANCE_LIMITS.length;
}

/**
 * The certainty of a parallax known to a relative error (the error over the parallax): `good` under 5%, `fair` up to 20%, `rough` over it. With no error stated it is `rough`.
 *
 * @param relativeError - The parallax's error divided by the parallax, or `undefined`.
 * @returns The certainty.
 *
 * @example
 * ```ts
 * import { certaintyOf } from "@johnmorrisdotca/hoshi-stars/distance";
 *
 * console.log(certaintyOf(0.01), certaintyOf(0.1), certaintyOf(0.5), certaintyOf(undefined));
 * ```
 */
export function certaintyOf(relativeError: number | undefined): Certainty {
  if (relativeError === undefined || !(relativeError >= 0)) return "rough";
  return relativeError < CERTAINTY_LIMITS.good ? "good" : relativeError <= CERTAINTY_LIMITS.rough ? "fair" : "rough";
}

function fromParallax(parallaxMas: number, errorMas: number | undefined): Pick<DistanceInput, "lightYears" | "low" | "high" | "certainty"> {
  if (!(parallaxMas > 0)) return { lightYears: undefined, low: undefined, high: undefined, certainty: undefined };
  const lightYears = LY_MAS / parallaxMas;
  if (errorMas === undefined) return { lightYears, low: lightYears, high: lightYears, certainty: "rough" };
  return { lightYears, low: LY_MAS / (parallaxMas + errorMas), high: errorMas < parallaxMas ? LY_MAS / (parallaxMas - errorMas) : Number.POSITIVE_INFINITY, certainty: certaintyOf(errorMas / parallaxMas) };
}

/**
 * A bright star of the Yale catalogue as a thing with a distance, from its parallax and its error. A star with no parallax has no distance.
 *
 * @param star - A star from `stars()`.
 * @returns The input for `layersByDistance`.
 *
 * @example
 * ```ts
 * import { starByName } from "@johnmorrisdotca/hoshi-stars";
 * import { starInput } from "@johnmorrisdotca/hoshi-stars/distance";
 *
 * const sirius = starInput(starByName("Sirius")!);
 * console.log(sirius.id, sirius.lightYears?.toFixed(1), sirius.certainty);
 * ```
 */
export function starInput(star: Pick<Star, "hr" | "name" | "rightAscension" | "declination" | "magnitude" | "parallaxMas" | "parallaxErrorMas">): DistanceInput {
  return { id: `hr-${star.hr}`, kind: "star", name: star.name, rightAscension: star.rightAscension, declination: star.declination, magnitude: star.magnitude, ...fromParallax(star.parallaxMas, star.parallaxErrorMas) };
}

/**
 * A nearby star (`/nearby`) as a thing with a distance. A star whose parallax is 0 or less has no distance.
 *
 * @param star - A star from `nearbyStars()`.
 * @returns The input for `layersByDistance`.
 *
 * @example
 * ```ts
 * import { nearbyStarByName } from "@johnmorrisdotca/hoshi-stars/nearby";
 * import { nearbyInput } from "@johnmorrisdotca/hoshi-stars/distance";
 *
 * const proxima = nearbyInput(nearbyStarByName("Proxima Centauri")!);
 * console.log(proxima.id, proxima.lightYears?.toFixed(2), proxima.certainty);
 * ```
 */
export function nearbyInput(star: Pick<NearbyStar, "id" | "name" | "rightAscension" | "declination" | "magnitude" | "parallaxMas" | "parallaxErrorMas">): DistanceInput {
  return { id: star.id, kind: "nearby", name: star.name, rightAscension: star.rightAscension, declination: star.declination, magnitude: star.magnitude, ...fromParallax(star.parallaxMas, star.parallaxErrorMas) };
}

/**
 * A deep-sky object with a galaxy's distance (`galaxyDistance` of `/deep-sky`) as a thing with a distance. The range is the lowest and highest statement the source holds; the distance is `fair` where the statements agree and `rough` where they disagree by more than 1.2 times. An object with no distance (`null`) has none.
 *
 * @param object - A deep-sky object.
 * @param distance - Its distance, or `null`.
 * @returns The input for `layersByDistance`.
 *
 * @example
 * ```ts
 * import { deepSkyObject, galaxyDistance } from "@johnmorrisdotca/hoshi-stars/deep-sky";
 * import { deepSkyInput } from "@johnmorrisdotca/hoshi-stars/distance";
 *
 * const m31 = deepSkyObject("M31")!;
 * const andromeda = deepSkyInput(m31, galaxyDistance(m31));
 * console.log(andromeda.id, Math.round(andromeda.lightYears! / 1000), andromeda.certainty);
 * ```
 */
export function deepSkyInput(object: { id: string; name: string | undefined; rightAscension: number; declination: number; magnitude: number | undefined }, distance: Pick<GalaxyDistance, "lightYears" | "spread" | "disagree"> | null): DistanceInput {
  const base = { id: object.id, kind: "deep-sky" as const, name: object.name, rightAscension: object.rightAscension, declination: object.declination, magnitude: object.magnitude };
  if (distance === null) return { ...base, lightYears: undefined, low: undefined, high: undefined, certainty: undefined };
  return { ...base, lightYears: distance.lightYears, low: distance.spread.low.lightYears, high: distance.spread.high.lightYears, certainty: distance.disagree ? "rough" : "fair" };
}

/**
 * The things out to a limit, each in the band of its distance. With no limit (or `Infinity`) every thing that has a distance is kept. A thing with no distance is counted and never placed. A thing whose distance is rough is kept apart as `uncertain` when
 * the nearest its error allows is inside the limit, and is counted in `uncertain`, not in a band.
 *
 * @param inputs - The things: from `starInput`, `nearbyInput` and `deepSkyInput`, in any mix.
 * @param options - `limit`: the farthest in light-years; left out for all.
 * @returns The things within the limit, nearest first, with the counts.
 *
 * @example
 * ```ts
 * import { stars } from "@johnmorrisdotca/hoshi-stars";
 * import { layersByDistance, starInput } from "@johnmorrisdotca/hoshi-stars/distance";
 *
 * const layers = layersByDistance(stars().map(starInput), { limit: 50 });
 * console.log(layers.things.length, layers.counts.slice(0, 2), layers.unknown);
 * ```
 */
export function layersByDistance(inputs: readonly DistanceInput[], options: { limit?: number } = {}): DistanceLayers {
  const limit = options.limit !== undefined && options.limit > 0 ? options.limit : Number.POSITIVE_INFINITY;
  const things: LayeredThing[] = [];
  const counts = new Array<number>(DISTANCE_LIMITS.length + 1).fill(0);
  let uncertain = 0;
  let unknown = 0;
  for (const input of inputs) {
    const { lightYears, low, high, certainty } = input;
    if (lightYears === undefined || low === undefined || high === undefined || certainty === undefined || !(lightYears > 0)) {
      unknown += 1;
      continue;
    }
    const rough = certainty === "rough";
    if (rough ? low > limit : lightYears > limit) continue;
    things.push({ ...input, lightYears, low, high, certainty, band: bandOf(lightYears), uncertain: rough });
    if (rough) uncertain += 1;
    else counts[bandOf(lightYears)] = counts[bandOf(lightYears)]! + 1;
  }
  things.sort((a, b) => (a.uncertain ? a.low : a.lightYears) - (b.uncertain ? b.low : b.lightYears));
  return { limit, things, counts, uncertain, unknown };
}

/**
 * The next limit up or down the steps (10, 50, 100, 500, 1,000, then all). From `all` a step down is 1,000; from 10 a step down stays at 10; a limit between two steps goes to the nearer step in that direction.
 *
 * @param limit - The limit now, in light-years (`Infinity` for all).
 * @param direction - 1 for farther, -1 for nearer.
 * @returns The new limit.
 *
 * @example
 * ```ts
 * import { stepLimit } from "@johnmorrisdotca/hoshi-stars/distance";
 *
 * console.log(stepLimit(10, 1), stepLimit(1000, 1), stepLimit(Infinity, -1), stepLimit(70, 1), stepLimit(70, -1));
 * ```
 */
export function stepLimit(limit: number, direction: 1 | -1): number {
  const steps = [...DISTANCE_LIMITS, Number.POSITIVE_INFINITY];
  if (direction === 1) return steps.find((step) => step > limit) ?? Number.POSITIVE_INFINITY;
  return [...steps].reverse().find((step) => step < limit) ?? DISTANCE_LIMITS[0]!;
}

/**
 * The nearest and farthest limits a free slider reaches, in light-years: from Alpha Centauri's neighbourhood to past the Andromeda Galaxy; beyond the last is `all`.
 *
 * @example
 * ```ts
 * import { SLIDER_RANGE } from "@johnmorrisdotca/hoshi-stars/distance";
 *
 * console.log(SLIDER_RANGE[0], SLIDER_RANGE[1]);
 * ```
 */
export const SLIDER_RANGE: readonly [number, number] = Object.freeze([4, 3_000_000]);

/**
 * The limit at a slider's position, 0 to 1, on a scale where each step is the same ratio (4 light-years to 3 million). Position 1 is `all` (`Infinity`).
 *
 * @param position - 0 to 1.
 * @returns The limit in light-years.
 *
 * @example
 * ```ts
 * import { limitAtSlider } from "@johnmorrisdotca/hoshi-stars/distance";
 *
 * console.log(Math.round(limitAtSlider(0)), Math.round(limitAtSlider(0.5)), limitAtSlider(1));
 * ```
 */
export function limitAtSlider(position: number): number {
  if (!(position < 1)) return Number.POSITIVE_INFINITY;
  const [low, high] = SLIDER_RANGE;
  return low * (high / low) ** Math.max(0, position);
}

/**
 * Where a limit sits on the slider, 0 to 1; `all` is 1 and a limit under the slider's start is 0. The inverse of `limitAtSlider`.
 *
 * @param limit - The limit in light-years.
 * @returns A position from 0 to 1.
 *
 * @example
 * ```ts
 * import { sliderOfLimit } from "@johnmorrisdotca/hoshi-stars/distance";
 *
 * console.log(sliderOfLimit(100).toFixed(3), sliderOfLimit(Infinity));
 * ```
 */
export function sliderOfLimit(limit: number): number {
  if (!(limit < Number.POSITIVE_INFINITY)) return 1;
  const [low, high] = SLIDER_RANGE;
  return Math.max(0, Math.min(1, Math.log(Math.max(limit, low) / low) / Math.log(high / low)));
}

/**
 * The attribute a page offers for the limit, as a settings panel sets it: `distance-limit`.
 *
 * @example
 * ```ts
 * import { DISTANCE_ATTRIBUTE } from "@johnmorrisdotca/hoshi-stars/distance";
 *
 * console.log(DISTANCE_ATTRIBUTE);
 * ```
 */
export const DISTANCE_ATTRIBUTE = "distance-limit";

/**
 * The limit from the attribute `distance-limit` (and the address's `dist`), read as text: a number of light-years, or `all`. Off (`undefined`) when the attribute is missing, `off`, or not a number: nothing is limited and the sky is as it was, drawn with no layers.
 *
 * @param value - The text, or `null` when the attribute is missing.
 * @returns The limit in light-years (`Infinity` for `all`), or `undefined` for no layers.
 *
 * @example
 * ```ts
 * import { limitFromText } from "@johnmorrisdotca/hoshi-stars/distance";
 *
 * console.log(limitFromText("100"), limitFromText("all"), limitFromText(null), limitFromText("far"), limitFromText("-5"));
 * ```
 */
export function limitFromText(value: string | null | undefined): number | undefined {
  if (value === null || value === undefined) return undefined;
  const text = value.trim().toLowerCase();
  if (text === "all") return Number.POSITIVE_INFINITY;
  if (text === "") return undefined;
  const n = Number(text);
  return Number.isFinite(n) && n > 0 ? Math.min(n, SLIDER_RANGE[1]) : undefined;
}

/**
 * A limit as the text the address keeps: `all`, or the light-years rounded (to the step where it is a step, else to 2 significant figures).
 *
 * @param limit - The limit in light-years, `Infinity` for all.
 * @returns The text.
 *
 * @example
 * ```ts
 * import { limitText } from "@johnmorrisdotca/hoshi-stars/distance";
 *
 * console.log(limitText(100), limitText(Infinity), limitText(137.9));
 * ```
 */
export function limitText(limit: number): string {
  if (!(limit < Number.POSITIVE_INFINITY)) return "all";
  if (DISTANCE_LIMITS.includes(limit)) return String(limit);
  return String(Number(limit.toPrecision(2)));
}
