// What can I see tonight: the stars that are above the horizon of a place at a moment, with the sky dark enough and the star bright enough once the air has dimmed it.
// Pure maths on top of `horizontal` (./sky.ts): no DOM, no clock reads (the moment is passed in) and no dependencies. The tonight tier (`@johnmorrisdotca/hoshi-stars/tonight`) imports the star list, so it is as large as the
// main entry; a page that does not import it does not pay for it.
// The Sun: the low-precision formula of The Astronomical Almanac (U.S. Naval Observatory and HM Nautical Almanac Office, section C), good to 0.01 degree from 1950 to 2050, a position of the date.
// The air: the airmass of Kasten and Young (1989), X = 1 / (sin h + 0.50572 (h + 6.07995)^-1.6364) with h the altitude in degrees, and an extinction of 0.20 magnitude per airmass in V (a clear, low-altitude site).
// The sky's limit: the naked-eye limiting magnitude of the Bortle dark-sky scale, rounded to presets; the twilight's limit is our own rough line through what an observer sees (see `TWILIGHT_LIMITS`), not a measurement.
import { horizontal, type Observer } from "./sky.ts";
import { starPosition, stars, type Star } from "./stars.ts";
import { J2000_MS, moment, type When } from "./when.ts";

const DAY = 86_400_000;
const RAD = Math.PI / 180;

/**
 * The darkness of the site, as a preset or a limiting magnitude: the faintest star seen at the zenith in the dark.
 *
 * @example
 * ```ts
 * import type { SkyLimit } from "@johnmorrisdotca/hoshi-stars/tonight";
 *
 * const limit: SkyLimit = "suburb"; // or a number, such as 5.2
 * console.log(limit);
 * ```
 */
export type SkyLimit = "city" | "suburb" | "rural" | "dark" | number;

/**
 * The naked-eye limiting magnitude of each preset, at the zenith with the Sun well down: a city centre (Bortle 8), a suburb (Bortle 6), a country site (Bortle 4) and a dark site (Bortle 2).
 *
 * @example
 * ```ts
 * import { SKY_LIMITS } from "@johnmorrisdotca/hoshi-stars/tonight";
 *
 * console.log(SKY_LIMITS.city, SKY_LIMITS.dark); // 4 6.5
 * ```
 */
export const SKY_LIMITS: Readonly<Record<"city" | "suburb" | "rural" | "dark", number>> = { city: 4, suburb: 5, rural: 6, dark: 6.5 };

/**
 * How dark the sky is by the Sun's altitude: `"day"` (the Sun's upper edge up, -0.833 degrees or higher), `"civil"` twilight (down to -6), `"nautical"` (down to -12), `"astronomical"` (down to -18) and `"night"`.
 *
 * @example
 * ```ts
 * import type { Twilight } from "@johnmorrisdotca/hoshi-stars/tonight";
 *
 * const now: Twilight = "astronomical";
 * console.log(now);
 * ```
 */
export type Twilight = "day" | "civil" | "nautical" | "astronomical" | "night";

/**
 * How easy a star is to see: `"easy"` (at least a magnitude brighter than the sky's limit), `"needs dark adaptation"` (within a magnitude of the limit: give the eyes twenty minutes without a light)
 * or `"not tonight"` (above the horizon but fainter than the limit, or in the day).
 *
 * @example
 * ```ts
 * import type { Ease } from "@johnmorrisdotca/hoshi-stars/tonight";
 *
 * const how: Ease = "easy";
 * console.log(how);
 * ```
 */
export type Ease = "easy" | "needs dark adaptation" | "not tonight";

/**
 * What the sky is like: all of it optional.
 *
 * @example
 * ```ts
 * import type { TonightOptions } from "@johnmorrisdotca/hoshi-stars/tonight";
 *
 * const sky: TonightOptions = { limit: "suburb", minAltitude: 10, extinction: 0.25, moonPenalty: 1 };
 * console.log(sky.limit);
 * ```
 */
export interface TonightOptions {
  /** The site's darkness: `"city"`, `"suburb"`, `"rural"` (the default), `"dark"` or a limiting magnitude at the zenith. */
  limit?: SkyLimit;
  /** The lowest altitude counted, in degrees (default 0, the horizon). Extinction takes the stars close to the horizon out whatever this is. */
  minAltitude?: number;
  /** Magnitudes lost per airmass (default 0.2, the V band at a good low site; 0.3 to 0.4 in haze). Only the part above the zenith's one airmass is taken off, since a site's limit already holds the zenith's. */
  extinction?: number;
  /** Magnitudes the limit falls by, passed in by the caller: the Moon's glare (about 0.5 at a crescent, 2 at the full Moon, 0 when it is down). */
  moonPenalty?: number;
  /** The Sun's altitude in degrees, if you already know it; otherwise it is worked out from the moment. */
  sunAltitude?: number;
  /** Return every star above the horizon, with `"not tonight"` for those you cannot see, instead of only the ones you can (default false). */
  all?: boolean;
}

/**
 * A star above the horizon and how it looks from there.
 *
 * @example
 * ```ts
 * import { visibleStars, type VisibleStar } from "@johnmorrisdotca/hoshi-stars/tonight";
 *
 * const first: VisibleStar | undefined = visibleStars({ observer: { latitude: 49.28, longitude: -123.12 }, when: Date.UTC(2026, 10, 8, 6) }).stars[0];
 * console.log(first?.star.name, first?.altitude);
 * ```
 */
export interface VisibleStar {
  /** The catalogue star. */
  star: Star;
  /** Degrees above the horizon (geometric, no refraction). */
  altitude: number;
  /** Degrees from north through east. */
  azimuth: number;
  /** The airmass along the line of sight: 1 at the zenith, about 38 at the horizon. */
  airmass: number;
  /** The magnitude after the air has dimmed it: `star.magnitude` plus the extinction's share above the zenith's. */
  apparentMagnitude: number;
  /** How easy it is to see. */
  ease: Ease;
}

/**
 * The answer to "what can I see from here, now".
 *
 * @example
 * ```ts
 * import { visibleStars, type TonightSky } from "@johnmorrisdotca/hoshi-stars/tonight";
 *
 * const sky: TonightSky = visibleStars({ observer: { latitude: 49.28, longitude: -123.12 }, when: Date.UTC(2026, 10, 8, 6) });
 * console.log(sky.twilight, sky.stars.length);
 * ```
 */
export interface TonightSky {
  /** The Sun's altitude in degrees, geometric. */
  sunAltitude: number;
  /** The kind of darkness that gives. */
  twilight: Twilight;
  /** The faintest apparent magnitude seen now: the site's limit lowered by twilight and the Moon. Below -5 when it is day, so nothing but Venus and the Moon would show. */
  limitingMagnitude: number;
  /** The stars, brightest first (by apparent magnitude). Only the visible ones unless `all` was asked for. */
  stars: VisibleStar[];
}

/**
 * The Sun's right ascension and declination of date, in degrees, from the Almanac's low-precision formula (0.01 degree from 1950 to 2050). No clock is read: the moment is passed in.
 *
 * @param when - The moment, a `Date` or milliseconds since 1970.
 * @returns `{ rightAscension, declination }` of the equinox of the date, in degrees.
 * @throws TypeError or RangeError for a moment that is not valid.
 *
 * @example
 * ```ts
 * import { sunPosition } from "@johnmorrisdotca/hoshi-stars/tonight";
 *
 * // the June solstice: the Sun is as far north as it gets, 23.4 degrees
 * console.log(sunPosition(Date.UTC(2026, 5, 21, 8, 24)).declination.toFixed(1)); // 23.4
 * ```
 */
export function sunPosition(when: When): { rightAscension: number; declination: number } {
  const n = (moment(when) - J2000_MS) / DAY;
  const mean = 280.46 + 0.9856474 * n;
  const anomaly = (357.528 + 0.9856003 * n) * RAD;
  const longitude = (mean + 1.915 * Math.sin(anomaly) + 0.02 * Math.sin(2 * anomaly)) * RAD;
  const obliquity = (23.439 - 0.0000004 * n) * RAD;
  const rightAscension = Math.atan2(Math.cos(obliquity) * Math.sin(longitude), Math.cos(longitude)) / RAD;
  const declination = Math.asin(Math.sin(obliquity) * Math.sin(longitude)) / RAD;
  return { rightAscension: ((rightAscension % 360) + 360) % 360, declination };
}

/**
 * The Sun's altitude over a place at a moment, in degrees (geometric: the centre of the disc, no refraction).
 *
 * @param observer - Latitude north and longitude east in degrees.
 * @param when - The moment, a `Date` or milliseconds since 1970.
 * @returns Degrees above the horizon, negative when the Sun is down.
 * @throws TypeError or RangeError, as `horizontal` does.
 *
 * @example
 * ```ts
 * import { sunAltitude } from "@johnmorrisdotca/hoshi-stars/tonight";
 *
 * // midnight in Vancouver in November: the Sun is far below the horizon
 * console.log(sunAltitude({ latitude: 49.28, longitude: -123.12 }, Date.UTC(2026, 10, 8, 8)) < -18);
 * ```
 */
export function sunAltitude(observer: Observer, when: When): number {
  return horizontal(sunPosition(when), observer, when, { equinox: "date" }).altitude;
}

/**
 * The kind of twilight for a Sun altitude: `"day"` above -0.833 degrees (the upper edge on the horizon, with refraction), `"civil"` to -6, `"nautical"` to -12, `"astronomical"` to -18, then `"night"`.
 *
 * @param altitude - The Sun's altitude in degrees.
 * @returns The twilight.
 * @throws RangeError for a number that is not finite.
 *
 * @example
 * ```ts
 * import { twilightOf } from "@johnmorrisdotca/hoshi-stars/tonight";
 *
 * console.log(twilightOf(10), twilightOf(-9), twilightOf(-30)); // day nautical night
 * ```
 */
export function twilightOf(altitude: number): Twilight {
  finite("altitude", altitude);
  if (altitude > -0.833) return "day";
  if (altitude > -6) return "civil";
  if (altitude > -12) return "nautical";
  if (altitude > -18) return "astronomical";
  return "night";
}

/**
 * The airmass of the line of sight at an altitude, by Kasten and Young (1989): 1 at the zenith, 2 at 30 degrees, about 38 at the horizon. Good to the horizon, which a plane-parallel secant is not.
 *
 * @param altitude - Degrees above the horizon, 0 to 90.
 * @returns The airmass.
 * @throws RangeError for an altitude that is not a number from 0 to 90.
 *
 * @example
 * ```ts
 * import { airmass } from "@johnmorrisdotca/hoshi-stars/tonight";
 *
 * console.log(airmass(90).toFixed(2), airmass(30).toFixed(2)); // 1.00 2.00
 * ```
 */
export function airmass(altitude: number): number {
  if (!(finite("altitude", altitude) >= 0 && altitude <= 90)) throw new RangeError(`altitude must be from 0 to 90 degrees, got ${altitude}`);
  return 1 / (Math.sin(altitude * RAD) + 0.50572 * Math.pow(altitude + 6.07995, -1.6364));
}

/** The faintest magnitude seen, by the Sun's altitude: our own rough line through what a watcher sees (Venus in the day, the brightest stars in civil twilight, the Plough's stars in nautical, all in astronomical). Past the last point the sky is dark and the site's own limit rules. */
const TWILIGHT_LIMITS: readonly (readonly [number, number])[] = [[-0.833, -5], [-6, 1.5], [-12, 4.5], [-18, 7]];

/** The limit twilight puts on the sky: -5 or lower in the day, rising to 7 (past any site's own limit) at -18 degrees. */
function twilightLimit(sun: number): number {
  if (sun > -0.833) return -5.5;
  for (let i = 1; i < TWILIGHT_LIMITS.length; i += 1) {
    const [a, ma] = TWILIGHT_LIMITS[i - 1]!;
    const [b, mb] = TWILIGHT_LIMITS[i]!;
    if (sun >= b) return ma + ((mb - ma) * (sun - a)) / (b - a);
  }
  return 7;
}

function finite(name: string, value: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new RangeError(`${name} must be a finite number, got ${String(value)}`);
  return value;
}

/**
 * The stars you can see from a place at a moment: above the horizon (or `minAltitude`), with the Sun low enough, and brighter than the sky's limit once the air has dimmed them (`airmass`, 0.2 magnitude an airmass above the zenith's one).
 * Each star carries its altitude, azimuth, airmass, apparent magnitude and how easy it is to see; the list is brightest first. The star's proper motion is added. Accurate to a few arc-minutes in position; the limit is an
 * approximation (see the guide), good for "will I see Orion", not for the faintest star at the threshold. No clock is read: the moment is passed in.
 *
 * @param query - `observer` (latitude north, longitude east, degrees), `when` (a `Date` or milliseconds since 1970) and `sky` (`TonightOptions`, all optional).
 * @returns The Sun's altitude, the twilight, the limiting magnitude and the stars.
 * @throws TypeError or RangeError, naming the argument and the value, for an observer, moment or option that is not valid.
 *
 * @example
 * ```ts
 * import { visibleStars } from "@johnmorrisdotca/hoshi-stars/tonight";
 *
 * const vancouver = { latitude: 49.28, longitude: -123.12 };
 * const sky = visibleStars({ observer: vancouver, when: new Date("2026-11-08T08:00:00Z"), sky: { limit: "suburb" } });
 * console.log(sky.twilight, sky.stars[0]?.star.name); // night Sirius
 * ```
 */
export function visibleStars(query: { observer: Observer; when: When; sky?: TonightOptions }): TonightSky {
  const sky = query.sky ?? {};
  const ms = moment(query.when);
  const limit = typeof sky.limit === "number" ? finite("sky.limit", sky.limit) : sky.limit === undefined ? SKY_LIMITS.rural : SKY_LIMITS[sky.limit];
  if (limit === undefined) throw new RangeError(`sky.limit must be "city", "suburb", "rural", "dark" or a number, got ${String(sky.limit)}`);
  const minAltitude = sky.minAltitude === undefined ? 0 : finite("sky.minAltitude", sky.minAltitude);
  const k = sky.extinction === undefined ? 0.2 : finite("sky.extinction", sky.extinction);
  if (k < 0) throw new RangeError(`sky.extinction must be 0 or more, got ${k}`);
  const penalty = sky.moonPenalty === undefined ? 0 : finite("sky.moonPenalty", sky.moonPenalty);
  if (penalty < 0) throw new RangeError(`sky.moonPenalty must be 0 or more, got ${penalty}`);
  const sun = sky.sunAltitude === undefined ? sunAltitude(query.observer, ms) : finite("sky.sunAltitude", sky.sunAltitude);
  const limitingMagnitude = Math.min(limit, twilightLimit(sun)) - penalty;
  const list: VisibleStar[] = [];
  for (const star of stars()) {
    const at = horizontal(starPosition(star, ms), query.observer, ms);
    if (at.altitude <= 0 || at.altitude < minAltitude) continue;
    const mass = airmass(at.altitude);
    const apparentMagnitude = star.magnitude + k * (mass - 1);
    const ease: Ease = apparentMagnitude > limitingMagnitude ? "not tonight" : apparentMagnitude <= limitingMagnitude - 1 ? "easy" : "needs dark adaptation";
    if (ease === "not tonight" && sky.all !== true) continue;
    list.push({ star, altitude: at.altitude, azimuth: at.azimuth, airmass: mass, apparentMagnitude, ease });
  }
  list.sort((a, b) => a.apparentMagnitude - b.apparentMagnitude || a.star.hr - b.star.hr);
  return { sunAltitude: sun, twilight: twilightOf(sun), limitingMagnitude, stars: list };
}
