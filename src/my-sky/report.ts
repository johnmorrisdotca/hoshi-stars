// What is where in my sky right now, as plain numbers: the Sun, the Moon (with its shape and its next rise and set) and the five bright planets, each with its altitude and azimuth, and how faint a star can be and still be seen
// against the sky the Sun leaves. The element reads this to draw and to write its panel; a page that draws a sky of its own can too. Pure: no DOM, no clock reads.
import type { Observer } from "../sky.ts";
import { moment, type When } from "../when.ts";
import { altitudeAzimuth, localFrame } from "./frame.ts";
import { moonHorizontal, moonPhase, moonPosition, moonRiseSet, type MoonPhase } from "./moon.ts";
import { planetPlaces, type PlanetPlace } from "./planets.ts";
import { sunPlace } from "./sun.ts";

/**
 * The Moon in this sky.
 *
 * @example
 * ```ts
 * import type { MoonInSky } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * const up = (moon: MoonInSky): boolean => moon.altitude > 0;
 * console.log(typeof up);
 * ```
 */
export interface MoonInSky {
  /** Degrees above the horizon as seen from the place (the parallax taken off), negative below it. */
  altitude: number;
  /** Degrees from north through east. */
  azimuth: number;
  /** Whether the Moon is above the standard horizon, which is what a rise and a set mean. */
  up: boolean;
  /** Its shape: the lit part, the phase angle, waxing or waning and the name. */
  phase: MoonPhase;
  /** The next rise and the next set after the moment, in milliseconds since 1970, or `null` for none in the next 26 hours. */
  rise: number | null;
  set: number | null;
  /** The apparent size of the disc in degrees (about 0.5). */
  diameter: number;
  /** The unit vector toward the Sun's bright side (east, north, up of the place): used to turn the drawn disc so its lit side faces the Sun. */
  towardSun: { east: number; north: number; up: number };
}

/**
 * One planet in this sky: where it is among the stars and where it stands over the place.
 *
 * @example
 * ```ts
 * import type { PlanetInSky } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * const names = (planets: readonly PlanetInSky[]): string => planets.filter((p) => p.up).map((p) => p.id).join(", ");
 * console.log(typeof names);
 * ```
 */
export interface PlanetInSky extends PlanetPlace {
  altitude: number;
  azimuth: number;
  /** Above the horizon. */
  up: boolean;
}

/**
 * The whole sky now: the Sun, the Moon and the planets.
 *
 * @example
 * ```ts
 * import type { SkyReport } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * const lit = (report: SkyReport): number => Math.round(report.moon.phase.illuminated * 100);
 * console.log(typeof lit);
 * ```
 */
export interface SkyReport {
  sun: { altitude: number; azimuth: number };
  moon: MoonInSky;
  planets: PlanetInSky[];
  /** The faintest star magnitude that can be seen against this sky (`limitingMagnitude` of the Sun's altitude). */
  limit: number;
}

/**
 * How faint a star can be and still be seen when the Sun is at a given altitude: 6 in the dark (the Sun 18 degrees or more below the horizon), falling in a straight line to -3 as the Sun rises to the horizon, so that
 * by civil twilight (-6 degrees) only the brightest stars show (magnitude 0), by nautical twilight (-12) the moderately bright (3) and in daylight none. A simple line of our own through what an observer sees, not a measurement.
 *
 * @param sunAltitude - The Sun's altitude in degrees.
 * @returns A limiting magnitude from 6 down to -3.
 *
 * @example
 * ```ts
 * import { limitingMagnitude } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * console.log(limitingMagnitude(-30), limitingMagnitude(-6), limitingMagnitude(10)); // 6 0 -3
 * ```
 */
export function limitingMagnitude(sunAltitude: number): number {
  if (sunAltitude <= -18) return 6;
  if (sunAltitude >= 0) return -3;
  return 6 + ((sunAltitude + 18) / 18) * -9;
}

/**
 * Where the Sun, the Moon and the five bright planets are in the sky of a place at a moment, and the shape and the next rise and set of the Moon.
 *
 * @param observer - Latitude north and longitude east in degrees.
 * @param when - The moment, a `Date` or milliseconds since 1970.
 * @returns The report.
 * @throws TypeError or RangeError for an observer or moment that is not valid.
 *
 * @example
 * ```ts
 * import { skyReport } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * // Vancouver at midnight in November: the Sun is far below the horizon, Mars, Jupiter and Saturn are up, and the Moon has set
 * const report = skyReport({ latitude: 49.28, longitude: -123.12 }, new Date("2026-11-12T08:00:00Z"));
 * console.log(report.sun.altitude < -50, report.planets.filter((p) => p.up).map((p) => p.id).join(","), report.moon.up); // true mars,jupiter,saturn false
 * ```
 */
export function skyReport(observer: Observer, when: When): SkyReport {
  const ms = moment(when);
  const frame = localFrame(observer, ms);
  const spot = { east: 0, north: 0, up: 0 };
  const sunData = sunPlace(ms);
  const sun = altitudeAzimuth(frame.fromDate(sunData.rightAscension, sunData.declination, spot));
  const moonData = moonPosition(ms);
  const moonView = moonHorizontal(observer, ms);
  const next = moonRiseSet(observer, ms);
  const towardSun = { ...frame.fromDate(sunData.rightAscension, sunData.declination, { east: 0, north: 0, up: 0 }) };
  const planets = planetPlaces(ms).map((p): PlanetInSky => {
    const view = altitudeAzimuth(frame.fromJ2000(p.rightAscension, p.declination, spot));
    return { ...p, altitude: view.altitude, azimuth: view.azimuth, up: view.altitude > 0 };
  });
  return {
    sun,
    moon: { altitude: moonView.altitude, azimuth: moonView.azimuth, up: next.up, phase: moonPhase(ms), rise: next.rise, set: next.set, diameter: 2 * Math.asin(1737.4 / moonData.distanceKm) * (180 / Math.PI), towardSun },
    planets,
    limit: limitingMagnitude(sun.altitude),
  };
}
