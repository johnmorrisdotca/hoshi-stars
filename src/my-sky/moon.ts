// The Moon for "my sky": where it is, what shape it shows and when it rises and sets, in a few lines of maths. The position is the low-precision lunar series of The Astronomical Almanac (section D, "Low precision formulae for the Moon",
// ecliptic longitude and latitude and the horizontal parallax, a few terms each), good to about 0.3 degree in position, a few minutes in a rise or set and 0.3 percent in the lit part of the disc. The Sun is `sunPlace` (./sun.ts).
// The phase angle is Meeus's (Astronomical Algorithms, 2nd ed., chapter 48, equation 48.3); the rise and set are found by looking for the Moon's altitude crossing the standard horizon (0.7275 times its parallax, less 34 arc-minutes of refraction).
// Pure: no DOM, no clock reads; the moment and the place are arguments.
import { horizontal, type Observer } from "../sky.ts";
import { moment, type When } from "../when.ts";
import { centuriesSince2000, obliquity, sunPlace, wrap360 } from "./sun.ts";

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const EARTH_RADIUS_KM = 6378.14;
const SYNODIC_DAYS = 29.530588;
const HOUR_MS = 3_600_000;

/**
 * Where the Moon is, seen from the middle of the Earth.
 *
 * @example
 * ```ts
 * import type { MoonPosition } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * const where: MoonPosition = { eclipticLongitude: 133.2, eclipticLatitude: -3.2, rightAscension: 134.7, declination: 13.8, distanceKm: 368_400, parallax: 0.9915 };
 * console.log(where.distanceKm);
 * ```
 */
export interface MoonPosition {
  /** Ecliptic longitude in degrees (0 up to but not including 360), of the date's equinox. */
  eclipticLongitude: number;
  /** Ecliptic latitude in degrees, up to about 5.3 either way. */
  eclipticLatitude: number;
  /** Right ascension in degrees (0 up to but not including 360), of the date's equinox: give it to `localFrame(...).fromDate`. */
  rightAscension: number;
  /** Declination in degrees, of the date's equinox. */
  declination: number;
  /** The distance from the Earth's centre in kilometres (356,000 to 407,000). */
  distanceKm: number;
  /** The horizontal parallax in degrees (about 0.9 to 1.0): how far the Moon on your horizon sits lower than it would seen from the Earth's centre. */
  parallax: number;
}

/**
 * Where the Moon is at a moment, from the Astronomical Almanac's low-precision series (about 0.3 degree).
 *
 * @param when - The moment, a `Date` or milliseconds since 1970.
 * @returns The ecliptic and equatorial position of the date, the distance and the parallax.
 * @throws TypeError or RangeError if `when` is not a valid moment.
 *
 * @example
 * ```ts
 * import { moonPosition } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * // Meeus example 47.a, 12 April 1992: right ascension 134.69, declination +13.77, 368,410 km away
 * const moon = moonPosition(Date.UTC(1992, 3, 12));
 * console.log(moon.rightAscension.toFixed(1), moon.declination.toFixed(1), Math.round(moon.distanceKm / 1000)); // 134.7 13.8 368
 * ```
 */
export function moonPosition(when: When): MoonPosition {
  const T = centuriesSince2000(moment(when));
  const sin = (a: number, b: number): number => Math.sin((a + b * T) * RAD);
  const cos = (a: number, b: number): number => Math.cos((a + b * T) * RAD);
  const longitude = wrap360(218.32 + 481267.881 * T + 6.29 * sin(135.0, 477198.87) - 1.27 * sin(259.3, -413335.36) + 0.66 * sin(235.7, 890534.22) + 0.21 * sin(269.9, 954397.74) - 0.19 * sin(357.5, 35999.05) - 0.11 * sin(186.5, 966404.03));
  const latitude = 5.13 * sin(93.3, 483202.02) + 0.28 * sin(228.2, 960400.89) - 0.28 * sin(318.3, 6003.15) - 0.17 * sin(217.6, -407332.21);
  const parallax = 0.9508 + 0.0518 * cos(135.0, 477198.87) + 0.0095 * cos(259.3, -413335.36) + 0.0078 * cos(235.7, 890534.22) + 0.0028 * cos(269.9, 954397.74);
  const l = longitude * RAD;
  const b = latitude * RAD;
  const e = obliquity(T) * RAD;
  const x = Math.cos(b) * Math.cos(l);
  const y = Math.cos(b) * Math.sin(l) * Math.cos(e) - Math.sin(b) * Math.sin(e);
  const z = Math.cos(b) * Math.sin(l) * Math.sin(e) + Math.sin(b) * Math.cos(e);
  return {
    eclipticLongitude: longitude,
    eclipticLatitude: latitude,
    rightAscension: wrap360(Math.atan2(y, x) * DEG),
    declination: Math.asin(z) * DEG,
    distanceKm: EARTH_RADIUS_KM / Math.sin(parallax * RAD),
    parallax,
  };
}

/**
 * The eight names of the Moon's shape: `new`, `waxing-crescent`, `first-quarter`, `waxing-gibbous`, `full`, `waning-gibbous`, `last-quarter` and `waning-crescent`.
 *
 * @example
 * ```ts
 * import type { MoonPhaseName } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * const name: MoonPhaseName = "waxing-crescent";
 * console.log(name);
 * ```
 */
export type MoonPhaseName = "new" | "waxing-crescent" | "first-quarter" | "waxing-gibbous" | "full" | "waning-gibbous" | "last-quarter" | "waning-crescent";

/**
 * The Moon's shape at a moment.
 *
 * @example
 * ```ts
 * import type { MoonPhase } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * const now: MoonPhase = { illuminated: 0.5, phaseAngle: 90, waxing: true, elongation: 90, age: 7.4, name: "first-quarter" };
 * console.log(Math.round(now.illuminated * 100));
 * ```
 */
export interface MoonPhase {
  /** The part of the disc that is lit, 0 (new) to 1 (full). */
  illuminated: number;
  /** The angle Sun-Moon-Earth in degrees: 0 at the full Moon, 90 at a quarter, 180 at the new Moon. */
  phaseAngle: number;
  /** True while the Moon is growing (the lit side faces east, so the evening Moon is lit on the right in the north), false while it shrinks. */
  waxing: boolean;
  /** How far east of the Sun the Moon is along the ecliptic, 0 up to but not including 360 degrees: 0 new, 90 first quarter, 180 full, 270 last quarter. */
  elongation: number;
  /** Days since the new Moon on the mean month (29.53 days), 0 up to 29.53. About a day either way of the true age. */
  age: number;
  name: MoonPhaseName;
}

/**
 * What shape the Moon shows at a moment: the lit part of the disc, the phase angle, whether it is waxing, and the name of the phase.
 * The names are `new` and `full` within 10 degrees of the Sun's or the opposite side of the sky (about a day), a quarter within 10 degrees of the half Moon, otherwise a crescent (under half lit) or a gibbous Moon (over half).
 *
 * @param when - The moment, a `Date` or milliseconds since 1970.
 * @returns The shape.
 * @throws TypeError or RangeError if `when` is not a valid moment.
 *
 * @example
 * ```ts
 * import { moonPhase } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * // the full Moon of 24 November 2026 (22:53 UTC) and the new Moon of 9 November (13:02 UTC)
 * console.log(Math.round(moonPhase(Date.UTC(2026, 10, 24, 22, 53)).illuminated * 100), Math.round(moonPhase(Date.UTC(2026, 10, 9, 13, 2)).illuminated * 100)); // 100 0
 * ```
 */
export function moonPhase(when: When): MoonPhase {
  const ms = moment(when);
  const moon = moonPosition(ms);
  const sun = sunPlace(ms);
  const difference = wrap360(moon.eclipticLongitude - sun.eclipticLongitude);
  const cosPsi = Math.cos(moon.eclipticLatitude * RAD) * Math.cos(difference * RAD);
  const psi = Math.acos(Math.max(-1, Math.min(1, cosPsi)));
  const phaseAngle = Math.atan2(sun.distanceKm * Math.sin(psi), moon.distanceKm - sun.distanceKm * Math.cos(psi)) * DEG;
  const illuminated = (1 + Math.cos(phaseAngle * RAD)) / 2;
  const waxing = difference < 180;
  const near = (target: number): boolean => Math.abs(difference - target) < 10;
  let name: MoonPhaseName;
  if (difference < 10 || difference > 350) name = "new";
  else if (near(180)) name = "full";
  else if (near(90)) name = "first-quarter";
  else if (near(270)) name = "last-quarter";
  else if (waxing) name = illuminated < 0.5 ? "waxing-crescent" : "waxing-gibbous";
  else name = illuminated < 0.5 ? "waning-crescent" : "waning-gibbous";
  return { illuminated, phaseAngle, waxing, elongation: difference, age: (difference / 360) * SYNODIC_DAYS, name };
}

/** The Moon's altitude above its own standard horizon at a place: positive when it is up. */
function aboveHorizon(observer: Observer, ms: number): number {
  const moon = moonPosition(ms);
  const view = horizontal({ rightAscension: moon.rightAscension, declination: moon.declination }, observer, ms, { equinox: "date" });
  return view.altitude - (0.7275 * moon.parallax - 34 / 60);
}

/**
 * The Moon's altitude seen from a place, taking its parallax into account: the geocentric altitude lowered by the parallax times the cosine of the altitude (the Moon is near enough that your place on the Earth moves it by up to a degree).
 *
 * @param observer - Latitude north and longitude east in degrees.
 * @param when - The moment, a `Date` or milliseconds since 1970.
 * @returns `{ altitude, azimuth }` in degrees, the azimuth from north through east, without refraction.
 * @throws TypeError or RangeError for an observer or moment that is not valid.
 *
 * @example
 * ```ts
 * import { moonHorizontal } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * const view = moonHorizontal({ latitude: 49.28, longitude: -123.12 }, new Date("2026-11-12T04:00:00Z"));
 * console.log(view.altitude > 0, view.azimuth >= 0 && view.azimuth < 360);
 * ```
 */
export function moonHorizontal(observer: Observer, when: When): { altitude: number; azimuth: number } {
  const ms = moment(when);
  const moon = moonPosition(ms);
  const view = horizontal({ rightAscension: moon.rightAscension, declination: moon.declination }, observer, ms, { equinox: "date" });
  return { altitude: view.altitude - moon.parallax * Math.cos(view.altitude * RAD), azimuth: view.azimuth };
}

/**
 * When the Moon rises and sets next: the first rising and the first setting after a moment, within the next 26 hours (a Moon can go a whole day without either, since it rises about 50 minutes later each day).
 * The rise and set are at the standard horizon (the Moon's upper edge touching it, with the air's bending of the light). The times are found to the second; the Moon's position is good to a fraction of a degree, so they are good to a few minutes.
 *
 * @param observer - Latitude north and longitude east in degrees.
 * @param when - The moment, a `Date` or milliseconds since 1970.
 * @returns `{ rise, set, up }`: the moments (milliseconds since 1970) or `null` when there is none in the next 26 hours (near the poles, or on the day with no rise), and whether the Moon is up at `when`.
 * @throws TypeError or RangeError for an observer or moment that is not valid.
 *
 * @example
 * ```ts
 * import { moonRiseSet } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * const next = moonRiseSet({ latitude: 49.28, longitude: -123.12 }, Date.UTC(2026, 10, 12, 12));
 * console.log(next.rise !== null && next.set !== null, typeof next.up);
 * ```
 */
export function moonRiseSet(observer: Observer, when: When): { rise: number | null; set: number | null; up: boolean } {
  const start = moment(when);
  const step = 10 * 60_000;
  const end = start + 26 * HOUR_MS;
  let rise: number | null = null;
  let set: number | null = null;
  let before = aboveHorizon(observer, start);
  const up = before > 0;
  for (let t = start + step; t <= end + step && (rise === null || set === null); t += step) {
    const now = aboveHorizon(observer, t);
    if ((before <= 0) !== (now <= 0)) {
      let low = t - step;
      let high = t;
      let lowValue = before;
      for (let i = 0; i < 24; i++) {
        const mid = (low + high) / 2;
        const value = aboveHorizon(observer, mid);
        if ((value <= 0) === (lowValue <= 0)) {
          low = mid;
          lowValue = value;
        } else high = mid;
      }
      const found = Math.round((low + high) / 2);
      if (found <= end) {
        if (now > 0 && rise === null) rise = found;
        if (now <= 0 && set === null) set = found;
      }
    }
    before = now;
  }
  return { rise, set, up };
}
