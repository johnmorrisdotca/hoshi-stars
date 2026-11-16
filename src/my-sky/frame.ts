// The sky of a place at a moment as a turn of directions: a star's right ascension and declination in, how far east, north and up of you it lies out. The whole job is one 3 by 3 turn made once for a place and a moment
// (precession from J2000 to the date, then the Earth's turn by the local sidereal time, then the horizon's own axes), so a page can place five thousand stars with a few multiplications each. It agrees with `horizontal` in `/sky`,
// whose formulae (J. Meeus, "Astronomical Algorithms", 2nd ed., chapters 12, 13 and 21) it is built from. Azimuth runs from north through east. Pure: no DOM, no clock reads.
import { localSiderealTime, precess, type Observer } from "../sky.ts";
import { moment, type When } from "../when.ts";

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

/**
 * A direction as how far it lies east, north and up of the observer (a unit vector): east and north along the ground, up toward the zenith. A star is above the horizon when `up` is above 0.
 *
 * @example
 * ```ts
 * import type { Direction } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * const zenith: Direction = { east: 0, north: 0, up: 1 };
 * console.log(zenith.up);
 * ```
 */
export interface Direction {
  east: number;
  north: number;
  up: number;
}

/**
 * The sky of one place at one moment.
 *
 * @example
 * ```ts
 * import type { LocalFrame } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * const upNow = (frame: LocalFrame, ra: number, dec: number): boolean => frame.fromJ2000(ra, dec, { east: 0, north: 0, up: 0 }).up > 0;
 * console.log(typeof upNow);
 * ```
 */
export interface LocalFrame {
  /** The local mean sidereal time in degrees: the right ascension on the meridian. */
  readonly siderealTime: number;
  /** Write into `out` where a J2000 position (a catalogue star's, or `planetPlaces`') stands in this sky, and return `out`. */
  fromJ2000(rightAscension: number, declination: number, out: Direction): Direction;
  /** The same for a position of the date's equinox (the Sun's and the Moon's, as `sunPlace` and `moonPosition` give). */
  fromDate(rightAscension: number, declination: number, out: Direction): Direction;
}

type Matrix = readonly [number, number, number, number, number, number, number, number, number];

function cartesian(rightAscension: number, declination: number): [number, number, number] {
  const ra = rightAscension * RAD;
  const dec = declination * RAD;
  return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
}

function multiply(a: Matrix, b: Matrix): Matrix {
  const out: number[] = [];
  for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) out.push(a[row * 3]! * b[col]! + a[row * 3 + 1]! * b[3 + col]! + a[row * 3 + 2]! * b[6 + col]!);
  return out as unknown as Matrix;
}

/**
 * The turn from the equator of the date to this place's east, north and up. The Earth has turned by the sidereal time, so the hour angle's cosine and sine are the first two parts of the turned vector (Meeus 13.5 and 13.6).
 */
function horizonMatrix(sidereal: number, latitude: number): Matrix {
  const theta = sidereal * RAD;
  const phi = latitude * RAD;
  const ct = Math.cos(theta);
  const st = Math.sin(theta);
  const cp = Math.cos(phi);
  const sp = Math.sin(phi);
  // x' = x cos(theta) + y sin(theta), y' = x sin(theta) - y cos(theta); east = -y', north = z cos(phi) - x' sin(phi), up = z sin(phi) + x' cos(phi)
  return [-st, ct, 0, -sp * ct, -sp * st, cp, cp * ct, cp * st, sp];
}

function apply(m: Matrix, v: readonly [number, number, number], out: Direction): Direction {
  out.east = m[0] * v[0] + m[1] * v[1] + m[2] * v[2];
  out.north = m[3] * v[0] + m[4] * v[1] + m[5] * v[2];
  out.up = m[6] * v[0] + m[7] * v[1] + m[8] * v[2];
  return out;
}

/**
 * Make the turn for a place and a moment: the same answer as `horizontal` in `/sky` for any position, as east, north and up, ready for a page that places thousands of stars or draws a view in perspective.
 *
 * @param observer - Latitude north and longitude east in degrees.
 * @param when - The moment, a `Date` or milliseconds since 1970.
 * @returns The frame; make a new one when the moment moves on (a minute is about a quarter of a degree of sky).
 * @throws TypeError or RangeError for an observer or moment that is not valid.
 *
 * @example
 * ```ts
 * import { starByName, starPosition } from "@johnmorrisdotca/hoshi-stars";
 * import { localFrame, altitudeAzimuth } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * // Polaris from Vancouver: its altitude is the latitude, to within a degree, and it stands in the north
 * const frame = localFrame({ latitude: 49.28, longitude: -123.12 }, new Date("2026-11-08T06:00:00Z"));
 * const polaris = starPosition(starByName("Polaris")!);
 * const view = altitudeAzimuth(frame.fromJ2000(polaris.rightAscension, polaris.declination, { east: 0, north: 0, up: 0 }));
 * console.log(view.altitude.toFixed(1), view.azimuth < 5 || view.azimuth > 355); // 49.8 true
 * ```
 */
export function localFrame(observer: Observer, when: When): LocalFrame {
  const ms = moment(when);
  const sidereal = localSiderealTime(ms, observer.longitude);
  // precession as a matrix: the three axes of J2000 carried to the date are its columns
  const columns = [precess({ rightAscension: 0, declination: 0 }, ms), precess({ rightAscension: 90, declination: 0 }, ms), precess({ rightAscension: 0, declination: 90 }, ms)].map((p) => cartesian(p.rightAscension, p.declination));
  const precession: Matrix = [columns[0]![0], columns[1]![0], columns[2]![0], columns[0]![1], columns[1]![1], columns[2]![1], columns[0]![2], columns[1]![2], columns[2]![2]];
  const horizon = horizonMatrix(sidereal, observer.latitude);
  const fromJ2000Matrix = multiply(horizon, precession);
  return {
    siderealTime: sidereal,
    fromJ2000: (ra, dec, out) => apply(fromJ2000Matrix, cartesian(ra, dec), out),
    fromDate: (ra, dec, out) => apply(horizon, cartesian(ra, dec), out),
  };
}

/**
 * A direction as an altitude and an azimuth.
 *
 * @param direction - East, north and up of a unit vector.
 * @returns `{ altitude, azimuth }` in degrees: the altitude from -90 to 90, the azimuth from north through east, 0 up to but not including 360 (0 at the zenith and nadir).
 *
 * @example
 * ```ts
 * import { altitudeAzimuth } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * console.log(altitudeAzimuth({ east: 1, north: 0, up: 0 })); // { altitude: 0, azimuth: 90 }
 * ```
 */
export function altitudeAzimuth(direction: Direction): { altitude: number; azimuth: number } {
  const across = Math.hypot(direction.east, direction.north);
  const azimuth = across < 1e-12 ? 0 : (((Math.atan2(direction.east, direction.north) * DEG) % 360) + 360) % 360;
  return { altitude: Math.atan2(direction.up, across) * DEG, azimuth };
}
