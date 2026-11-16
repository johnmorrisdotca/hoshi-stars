// The Sun for "my sky": where it stands among the stars and how far the Earth is from it, from the low-precision formulae of The Astronomical Almanac (section C, "Low precision formulae for the Sun's coordinates"),
// good to about 0.01 degree from 1950 to 2050. Pure: no DOM, no clock; the moment is passed in. It is here, small, so the Moon's phase needs no star table.
import { J2000_MS, moment, type When } from "../when.ts";

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const DAY_MS = 86_400_000;
const AU_KM = 149_597_870.7;

/** An angle in degrees brought to 0 up to but not including 360. */
export function wrap360(angle: number): number {
  const a = angle % 360;
  const r = a < 0 ? a + 360 : a;
  return r >= 360 ? 0 : r;
}

/** The Julian centuries since J2000.0 of a moment (UT taken for the dynamical time: the minute's difference is far below these formulae's reach). */
export function centuriesSince2000(ms: number): number {
  return (ms - J2000_MS) / (DAY_MS * 36525);
}

/** The mean obliquity of the ecliptic in degrees, T Julian centuries after J2000.0 (the Almanac's 23.439 - 0.0130 T). */
export function obliquity(T: number): number {
  return 23.439 - 0.013 * T;
}

/**
 * Where the Sun is: its ecliptic longitude and its right ascension and declination of the date, in degrees, and its distance from the Earth in kilometres (the formulae of The Astronomical Almanac, good to 0.01 degree from 1950 to 2050).
 *
 * @param when - The moment, a `Date` or milliseconds since 1970.
 * @returns `{ eclipticLongitude, rightAscension, declination, distanceKm }`; the angles are of the date's equinox, so give them to `localFrame(...).fromDate`.
 * @throws TypeError or RangeError if `when` is not a valid moment.
 *
 * @example
 * ```ts
 * import { sunPlace } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * // the December solstice of 2026: the Sun is at ecliptic longitude 270 degrees, as far south as it goes (declination -23.4)
 * const sun = sunPlace(Date.UTC(2026, 11, 21, 20, 50));
 * console.log(sun.eclipticLongitude.toFixed(1), sun.declination.toFixed(1)); // 270.0 -23.4
 * ```
 */
export function sunPlace(when: When): { eclipticLongitude: number; rightAscension: number; declination: number; distanceKm: number } {
  const ms = moment(when);
  const d = (ms - J2000_MS) / DAY_MS;
  const meanLongitude = 280.46 + 0.9856474 * d;
  const g = (357.528 + 0.9856003 * d) * RAD;
  const lambda = wrap360(meanLongitude + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g));
  const distanceAu = 1.00014 - 0.01671 * Math.cos(g) - 0.00014 * Math.cos(2 * g);
  const epsilon = obliquity(d / 36525) * RAD;
  const l = lambda * RAD;
  const rightAscension = wrap360(Math.atan2(Math.cos(epsilon) * Math.sin(l), Math.cos(l)) * DEG);
  const declination = Math.asin(Math.sin(epsilon) * Math.sin(l)) * DEG;
  return { eclipticLongitude: lambda, rightAscension, declination, distanceKm: distanceAu * AU_KM };
}
