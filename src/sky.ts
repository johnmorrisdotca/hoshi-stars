// Your sky: where a star stands over your head at a place and a moment, and where it would stand over another planet's surface.
// Pure maths, no DOM, no clock reads and no dependencies. The formulas are written from J. Meeus, "Astronomical Algorithms", 2nd ed. (Willmann-Bell, 1998):
// chapter 12 (Greenwich mean sidereal time, the IAU 1982 expression), chapter 13 (equatorial to horizontal), chapter 16 (refraction, Saemundsson's formula) and chapter 21 (precession, the IAU 1976 constants).
// For another planet the sky turns about that planet's pole: the pole and prime meridian are the IAU Working Group on Cartographic Coordinates and Rotational Elements (WGCCRE) quantities, passed in, so the planet data stays with the caller.
// Azimuth runs from north through east (north 0, east 90, south 180, west 270), the compass way, not Meeus's way from south.
import { J2000_MS, moment, type When } from "./when.ts";
import type { SkyPoint } from "./projection.ts";

export type { SkyPoint };

/**
 * Where a star or a planet is in your sky: degrees above the horizon (negative below it) and degrees round from north through east.
 *
 * @example
 * ```ts
 * import type { Horizontal } from "@johnmorrisdotca/hoshi-stars/sky";
 *
 * const view: Horizontal = { altitude: 45, azimuth: 90 };
 * console.log(view.altitude, view.azimuth); // 45 degrees up, due east
 * ```
 */
export interface Horizontal {
  /** Degrees above the horizon, -90 (straight down) to 90 (the zenith). Negative means below the horizon. */
  altitude: number;
  /** Degrees from north through east: 0 north, 90 east, 180 south, 270 west. 0 up to but not including 360; 0 at the zenith and nadir, where it has no meaning. */
  azimuth: number;
}

/**
 * Where you stand on Earth, in degrees.
 *
 * @example
 * ```ts
 * import type { Observer } from "@johnmorrisdotca/hoshi-stars/sky";
 *
 * const vancouver: Observer = { latitude: 49.28, longitude: -123.12 };
 * console.log(vancouver.latitude);
 * ```
 */
export interface Observer {
  /** Degrees north of the equator, -90 to 90. */
  latitude: number;
  /** Degrees east of Greenwich (west is negative). Any finite number; it wraps at 360. */
  longitude: number;
  /** Metres above sea level; checked but not used, because a star is so far away that height changes its direction by nothing you could measure, and the horizon dip is left out. */
  heightM?: number;
}

/**
 * How to read the position and whether to bend the light.
 *
 * @example
 * ```ts
 * import type { HorizontalOptions } from "@johnmorrisdotca/hoshi-stars/sky";
 *
 * const options: HorizontalOptions = { refraction: true, pressureHpa: 900, temperatureC: -5 };
 * console.log(options.refraction);
 * ```
 */
export interface HorizontalOptions {
  /** `"J2000"` (the default) when the position is a catalogue position, which is turned to the equinox of the date first; `"date"` when it is already the mean equator and equinox of the moment (planets are, from an almanac). */
  equinox?: "J2000" | "date";
  /** True to lift the altitude by the air's bending of light (Saemundsson's formula, Meeus 16.4): about 0.48 degrees at the horizon, 0.02 at 45 degrees up. Default false, the geometric altitude. Not applied below -1 degree, where the formula stops being true. */
  refraction?: boolean;
  /** Air pressure in hectopascals for the refraction; default 1010 (a standard sea-level day). Only used with `refraction`. */
  pressureHpa?: number;
  /** Air temperature in degrees Celsius for the refraction; default 10. Only used with `refraction`. */
  temperatureC?: number;
}

/**
 * The spin of another planet, as the IAU WGCCRE gives it: where its north pole points, and how far its prime meridian has turned.
 *
 * The pole is a right ascension and declination in the ICRF (the same J2000 frame as the star positions). The prime meridian is `W = w0 + rate * d`, with `d` the days since J2000.0 (2000 January 1.5): `w0` is W at J2000 in degrees and `rate` the degrees a day (negative for a planet that turns backwards, such as Venus). W is the angle, east, from the point where the planet's equator crosses the ICRF equator going north (the right ascension of the pole plus 90 degrees) to its prime meridian.
 *
 * @example
 * ```ts
 * import type { PlanetSpin } from "@johnmorrisdotca/hoshi-stars/sky";
 *
 * // Mars, IAU 2015 values at J2000 (the slow drift of the pole is left out)
 * const mars: PlanetSpin = { pole: { rightAscension: 317.269202, declination: 54.432516 }, primeMeridian: { w0: 176.049863, rate: 350.891982443297 } };
 * console.log(mars.pole.declination);
 * ```
 */
export interface PlanetSpin {
  /** The direction of the planet's north pole at J2000, in degrees. */
  pole: SkyPoint;
  /** The prime meridian: `w0` degrees at J2000 and `rate` degrees a day. */
  primeMeridian: { w0: number; rate: number };
}

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const DAY_MS = 86_400_000;
const ARCSEC = RAD / 3600;

function finite(name: string, value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new RangeError(`${name} must be a finite number, got ${String(value)}`);
  return value;
}

function point(name: string, value: unknown): SkyPoint {
  if (typeof value !== "object" || value === null) throw new TypeError(`${name} must be an object with rightAscension and declination, got ${String(value)}`);
  const p = value as SkyPoint;
  finite(`${name}.rightAscension`, p.rightAscension);
  const declination = finite(`${name}.declination`, p.declination);
  if (declination < -90 || declination > 90) throw new RangeError(`${name}.declination must be between -90 and 90 degrees, got ${declination}`);
  return p;
}

function place(name: string, value: unknown): Observer {
  if (typeof value !== "object" || value === null) throw new TypeError(`${name} must be an object with latitude and longitude, got ${String(value)}`);
  const o = value as Observer;
  const latitude = finite(`${name}.latitude`, o.latitude);
  if (latitude < -90 || latitude > 90) throw new RangeError(`${name}.latitude must be between -90 and 90 degrees, got ${latitude}`);
  finite(`${name}.longitude`, o.longitude);
  if (o.heightM !== undefined) finite(`${name}.heightM`, o.heightM);
  return o;
}

/** An angle in degrees brought to 0 up to but not including 360. */
function wrap360(angle: number): number {
  const a = angle % 360;
  const r = a < 0 ? a + 360 : a;
  return r >= 360 ? 0 : r;
}

/** Julian centuries since J2000.0, taking the moment as UT (the seconds between UT and the dynamical time are far below what these formulas can see). */
function centuries(ms: number): number {
  return (ms - J2000_MS) / (DAY_MS * 36525);
}

function siderealDegrees(ms: number): number {
  const days = (ms - J2000_MS) / DAY_MS;
  const T = days / 36525;
  return 280.46061837 + 360.98564736629 * days + 0.000387933 * T * T - (T * T * T) / 38_710_000;
}

/**
 * The Greenwich mean sidereal time: how far the Earth has turned against the stars, as the right ascension on the meridian of Greenwich, in degrees (Meeus 12.4, the IAU 1982 expression). It uses UT, which is UTC to under a second, and is the mean time, without the nutation term (at most about 1.1 seconds of time, 17 arc-seconds).
 *
 * @param when - The moment, a `Date` or milliseconds since 1970.
 * @returns Degrees, 0 up to but not including 360. Divide by 15 for hours.
 * @throws TypeError if `when` is not a Date or a number, RangeError if it is an invalid Date or not finite.
 *
 * @example
 * ```ts
 * import { greenwichSiderealTime } from "@johnmorrisdotca/hoshi-stars/sky";
 *
 * // Meeus example 12.a: 1987 April 10 at 0h UT is 13h10m46.3668s, 197.693195 degrees
 * console.log(greenwichSiderealTime(Date.UTC(1987, 3, 10)).toFixed(6));
 * ```
 */
export function greenwichSiderealTime(when: When): number {
  return wrap360(siderealDegrees(moment(when)));
}

/**
 * The local mean sidereal time: the right ascension that is on your meridian, due south or north of you, in degrees. A star with this right ascension is crossing the meridian.
 *
 * @param when - The moment, a `Date` or milliseconds since 1970.
 * @param longitude - Degrees east of Greenwich (west is negative). Any finite number.
 * @returns Degrees, 0 up to but not including 360.
 * @throws TypeError if `when` is not a Date or a number, RangeError if it is invalid or `longitude` is not finite.
 *
 * @example
 * ```ts
 * import { localSiderealTime } from "@johnmorrisdotca/hoshi-stars/sky";
 *
 * // Greenwich's 197.693195 degrees at 0h UT, 1987 April 10, and Washington is 77.07 degrees west of it
 * console.log(localSiderealTime(Date.UTC(1987, 3, 10), -77.0656).toFixed(3)); // 120.628
 * ```
 */
export function localSiderealTime(when: When, longitude: number): number {
  const ms = moment(when);
  return wrap360(siderealDegrees(ms) + finite("longitude", longitude));
}

/** The three IAU 1976 precession angles zeta, z and theta, in radians, from J2000.0 to T Julian centuries after it (Meeus 21.2). */
function precessionAngles(T: number): [number, number, number] {
  const zeta = (2306.2181 * T + 0.30188 * T * T + 0.017998 * T * T * T) * ARCSEC;
  const z = (2306.2181 * T + 1.09468 * T * T + 0.018203 * T * T * T) * ARCSEC;
  const theta = (2004.3109 * T - 0.42665 * T * T - 0.041833 * T * T * T) * ARCSEC;
  return [zeta, z, theta];
}

/**
 * A J2000 position carried to the mean equator and equinox of a date: the precession of the Earth's axis (Meeus chapter 21, the rigorous method with the IAU 1976 constants, good for a few centuries either side of 2000 to far under an arc-second). It leaves out the star's own proper motion (which `starPosition` adds), nutation and aberration, together under a minute of arc.
 *
 * @param position - A right ascension and declination in degrees at J2000.
 * @param when - The date to carry it to.
 * @returns The right ascension (0 up to but not including 360) and declination in degrees.
 * @throws TypeError or RangeError, naming the argument, if `position` or `when` is not valid.
 *
 * @example
 * ```ts
 * import { precess } from "@johnmorrisdotca/hoshi-stars/sky";
 *
 * // Meeus example 21.b: theta Persei, carried to 2028 November 13.19 (about 15 minutes of arc east in right ascension)
 * const there = precess({ rightAscension: 41.054063, declination: 49.227750 }, Date.UTC(2028, 10, 13, 4, 33, 36));
 * console.log(there.rightAscension.toFixed(3), there.declination.toFixed(3)); // 41.547 49.348
 * ```
 */
export function precess(position: SkyPoint, when: When): SkyPoint {
  point("position", position);
  const T = centuries(moment(when));
  const [zeta, z, theta] = precessionAngles(T);
  const a0 = position.rightAscension * RAD + zeta;
  const d0 = position.declination * RAD;
  const cosD = Math.cos(d0);
  const A = cosD * Math.sin(a0);
  const B = Math.cos(theta) * cosD * Math.cos(a0) - Math.sin(theta) * Math.sin(d0);
  const C = Math.sin(theta) * cosD * Math.cos(a0) + Math.cos(theta) * Math.sin(d0);
  const declination = Math.abs(C) < 0.9999 ? Math.asin(C) : Math.sign(C) * Math.acos(Math.hypot(A, B));
  return { rightAscension: wrap360((Math.atan2(A, B) + z) * DEG), declination: declination * DEG };
}

/** The east, north and up parts of a direction, from its declination and hour angle (Meeus 13.5 and 13.6, turned to measure azimuth from north through east), for an observer at latitude phi. */
function toHorizontal(cosDcosH: number, cosDsinH: number, sinD: number, sinPhi: number, cosPhi: number): Horizontal {
  const east = -cosDsinH;
  const north = sinD * cosPhi - cosDcosH * sinPhi;
  const up = sinD * sinPhi + cosDcosH * cosPhi;
  const across = Math.hypot(east, north);
  return { altitude: Math.atan2(up, across) * DEG, azimuth: across < 1e-15 ? 0 : wrap360(Math.atan2(east, north) * DEG) };
}

/** Saemundsson's refraction (Meeus 16.4) in degrees for a true altitude in degrees, scaled for the air; 0 below -1 degree. */
function refractionDegrees(altitude: number, pressureHpa: number, temperatureC: number): number {
  if (altitude < -1) return 0;
  // the +0.0019279 arc-minute makes the bending exactly 0 at the zenith, where the bare formula gives a hair under
  const arcminutes = 1.02 / Math.tan((altitude + 10.3 / (altitude + 5.11)) * RAD) + 0.0019279;
  return (arcminutes / 60) * (pressureHpa / 1010) * (283 / (273 + temperatureC));
}

/**
 * Where a star (or any J2000 position) stands in the sky of a place on Earth at a moment: its altitude above the horizon and azimuth from north through east. The position is carried from J2000 to the equinox of the date (`precess`), the hour angle comes from the local mean sidereal time, and the horizon formulas are Meeus's (chapter 13). The result is geometric (no refraction) unless you ask for it. UTC stands for UT; nutation, aberration and parallax are left out, so it is good to about an arc-minute, far finer than the eye. The star's own proper motion is not added: pass `starPosition(star, when)` if you want it.
 *
 * @param position - A right ascension and declination in degrees, J2000 (the catalogue's frame), or of the date with `equinox: "date"`.
 * @param observer - Latitude north and longitude east in degrees, and optionally `heightM`.
 * @param when - The moment, a `Date` or milliseconds since 1970.
 * @param options - `equinox`, and `refraction` with `pressureHpa` and `temperatureC`.
 * @returns `{ altitude, azimuth }` in degrees.
 * @throws TypeError or RangeError, naming the argument and the value, for a position, observer, moment or option that is not valid (a latitude or declination outside -90 to 90, a number that is not finite, a `pressureHpa` of 0 or less).
 *
 * @example
 * ```ts
 * import { starByName, starPosition } from "@johnmorrisdotca/hoshi-stars";
 * import { horizontal } from "@johnmorrisdotca/hoshi-stars/sky";
 *
 * const polaris = starPosition(starByName("Polaris")!);
 * const view = horizontal(polaris, { latitude: 49.28, longitude: -123.12 }, new Date("2026-11-08T06:00:00Z"));
 * console.log(view.altitude.toFixed(1)); // 49.8: within a degree of the latitude, 49.28
 * ```
 */
export function horizontal(position: SkyPoint, observer: Observer, when: When, options: HorizontalOptions = {}): Horizontal {
  point("position", position);
  const o = place("observer", observer);
  const ms = moment(when);
  const equinox = options.equinox ?? "J2000";
  if (equinox !== "J2000" && equinox !== "date") throw new RangeError(`options.equinox must be "J2000" or "date", got ${String(equinox)}`);
  let pressure = 1010;
  let temperature = 10;
  if (options.refraction === true) {
    if (options.pressureHpa !== undefined && !(finite("options.pressureHpa", options.pressureHpa) > 0)) throw new RangeError(`options.pressureHpa must be greater than 0, got ${options.pressureHpa}`);
    if (options.temperatureC !== undefined && !(finite("options.temperatureC", options.temperatureC) > -100)) throw new RangeError(`options.temperatureC must be above -100, got ${options.temperatureC}`);
    pressure = options.pressureHpa ?? pressure;
    temperature = options.temperatureC ?? temperature;
  }
  const of = equinox === "date" ? position : precess(position, ms);
  const hourAngle = (siderealDegrees(ms) + o.longitude - of.rightAscension) * RAD;
  const dec = of.declination * RAD;
  const phi = o.latitude * RAD;
  const cosD = Math.cos(dec);
  const view = toHorizontal(cosD * Math.cos(hourAngle), cosD * Math.sin(hourAngle), Math.sin(dec), Math.sin(phi), Math.cos(phi));
  if (options.refraction === true) view.altitude += refractionDegrees(view.altitude, pressure, temperature);
  return view;
}

/**
 * Whether a position is above the horizon of a place at a moment (altitude greater than 0). With `refraction: true` it counts the bending of the light, so a star can be seen a little below the geometric horizon.
 *
 * @param position - A right ascension and declination in degrees, J2000 or (with `equinox: "date"`) of the date.
 * @param observer - Latitude north and longitude east in degrees.
 * @param when - The moment, a `Date` or milliseconds since 1970.
 * @param options - The same as `horizontal`.
 * @returns True when it is up.
 * @throws TypeError or RangeError, as `horizontal` does.
 *
 * @example
 * ```ts
 * import { starByName, starPosition } from "@johnmorrisdotca/hoshi-stars";
 * import { isAboveHorizon } from "@johnmorrisdotca/hoshi-stars/sky";
 *
 * // Polaris never sets for anyone in the northern hemisphere
 * const polaris = starPosition(starByName("Polaris")!);
 * console.log(isAboveHorizon(polaris, { latitude: 49.28, longitude: -123.12 }, Date.now()));
 * ```
 */
export function isAboveHorizon(position: SkyPoint, observer: Observer, when: When, options: HorizontalOptions = {}): boolean {
  return horizontal(position, observer, when, options).altitude > 0;
}

/**
 * Where a star stands in the sky of a place on ANOTHER planet: the sky turns about that planet's pole (the IAU WGCCRE pole and prime meridian, passed in as `spin`), so the star is rotated into the planet's own equatorial frame, its hour angle is the prime meridian plus the observer's east longitude minus its right ascension there, and the horizon formulas are the same as for Earth.
 *
 * The stars look the same from every planet: the nearest star, Proxima Centauri, shifts only about 40 arc-seconds seen from Pluto (annual parallax 0.77 arc-seconds times Pluto's 49 AU at its farthest), and a typical star far less, so a star's J2000 position serves anywhere in the solar system. Only the pole and the turning change.
 *
 * Limits: the latitude is used as the angle from the planet's equator on a sphere (the difference between planetographic and planetocentric latitude, up to a fifth of a degree on Mars, is ignored); the pole's slow drift is the caller's to add in if wanted (`spin.pole` is read as given); there is no atmosphere, and no precession of the pole is applied. `when` is read as the time scale the IAU rates are in (TDB); passing UTC is about 69 seconds early, which turns Mars by 0.28 degrees.
 *
 * @param position - A right ascension and declination in degrees at J2000.
 * @param spin - The planet's `pole` (right ascension and declination, degrees) and `primeMeridian` (`w0` degrees at J2000 and `rate` degrees a day).
 * @param observer - Latitude north and longitude east on that planet, in degrees (north being the side of the pole).
 * @param when - The moment, a `Date` or milliseconds since 1970.
 * @returns `{ altitude, azimuth }` in degrees, the azimuth from north through east.
 * @throws TypeError or RangeError, naming the argument and the value, for a position, spin, observer or moment that is not valid.
 *
 * @example
 * ```ts
 * import { starByName, starPosition } from "@johnmorrisdotca/hoshi-stars";
 * import { horizontalFrom } from "@johnmorrisdotca/hoshi-stars/sky";
 *
 * // Mars, IAU 2015 values: its north celestial pole is only 10 degrees from Deneb, so from the pole Deneb stands almost overhead
 * const mars = { pole: { rightAscension: 317.269202, declination: 54.432516 }, primeMeridian: { w0: 176.049863, rate: 350.891982443297 } };
 * const deneb = starPosition(starByName("Deneb")!);
 * console.log(horizontalFrom(deneb, mars, { latitude: 90, longitude: 0 }, Date.UTC(2026, 10, 8)).altitude.toFixed(1)); // 79.8
 * ```
 */
export function horizontalFrom(position: SkyPoint, spin: PlanetSpin, observer: Observer, when: When): Horizontal {
  point("position", position);
  if (typeof spin !== "object" || spin === null) throw new TypeError(`spin must be an object with a pole and a primeMeridian, got ${String(spin)}`);
  point("spin.pole", spin.pole);
  const meridian = spin.primeMeridian as PlanetSpin["primeMeridian"] | undefined;
  if (typeof meridian !== "object" || meridian === null) throw new TypeError(`spin.primeMeridian must be an object with w0 and rate, got ${String(meridian)}`);
  const w0 = finite("spin.primeMeridian.w0", meridian.w0);
  const rate = finite("spin.primeMeridian.rate", meridian.rate);
  const o = place("observer", observer);
  const days = (moment(when) - J2000_MS) / DAY_MS;
  const turned = (w0 + rate * days + o.longitude) * RAD;
  // The planet's frame: z toward its pole, x toward the node where its equator crosses the ICRF equator (right ascension of the pole + 90 degrees), y = z cross x.
  const a0 = spin.pole.rightAscension * RAD;
  const d0 = spin.pole.declination * RAD;
  const sinA = Math.sin(a0);
  const cosA = Math.cos(a0);
  const sinD0 = Math.sin(d0);
  const cosD0 = Math.cos(d0);
  const zx = cosD0 * cosA;
  const zy = cosD0 * sinA;
  const zz = sinD0;
  const xx = -sinA;
  const xy = cosA;
  const yx = -zz * xy;
  const yy = zz * xx;
  const yz = zx * xy - zy * xx;
  const dec = position.declination * RAD;
  const ra = position.rightAscension * RAD;
  const cosD = Math.cos(dec);
  const sx = cosD * Math.cos(ra);
  const sy = cosD * Math.sin(ra);
  const sz = Math.sin(dec);
  const px = sx * xx + sy * xy;
  const py = sx * yx + sy * yy + sz * yz;
  const pz = sx * zx + sy * zy + sz * zz;
  // cos(dec') cos(H) and cos(dec') sin(H), with H = turned - alpha'
  const sinT = Math.sin(turned);
  const cosT = Math.cos(turned);
  const phi = o.latitude * RAD;
  return toHorizontal(px * cosT + py * sinT, px * sinT - py * cosT, pz, Math.sin(phi), Math.cos(phi));
}
