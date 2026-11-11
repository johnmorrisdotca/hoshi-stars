// Where the Sun is on the sky on a day, and which constellation that is, with the moments the Sun went in and came out. The Sun's place is the low-precision formula of The Astronomical
// Almanac (U.S. Naval Observatory and HM Nautical Almanac Office, section C, "Low precision formulas for the Sun"), good to 0.01 degrees from 1950 to 2050: the Sun takes about six hours
// to move that far, so a day it enters a constellation can be one day off near midnight, and no more. The constellation is hoshi's own lookup in the IAU boundaries (Delporte 1930), for
// the position of date. Real astronomy only: the Sun's path crosses thirteen constellations, Ophiuchus among them, on dates that are not the traditional signs'.
import { constellationAt } from "../src/boundaries.ts";
import type { Constellation } from "../src/constellations.ts";

const DAY = 86_400_000;
const J2000 = Date.UTC(2000, 0, 1, 12);
const RAD = Math.PI / 180;

/** The Sun's right ascension and declination of date, in degrees, at a moment (milliseconds since 1970, UTC). */
export function sunPlace(ms: number): { rightAscension: number; declination: number } {
  const n = (ms - J2000) / DAY;
  const mean = 280.46 + 0.9856474 * n;
  const anomaly = (357.528 + 0.9856003 * n) * RAD;
  const longitude = (mean + 1.915 * Math.sin(anomaly) + 0.02 * Math.sin(2 * anomaly)) * RAD;
  const obliquity = (23.439 - 0.0000004 * n) * RAD;
  const rightAscension = Math.atan2(Math.cos(obliquity) * Math.sin(longitude), Math.cos(longitude)) / RAD;
  const declination = Math.asin(Math.sin(obliquity) * Math.sin(longitude)) / RAD;
  return { rightAscension: ((rightAscension % 360) + 360) % 360, declination };
}

/** The constellation the Sun is in at a moment. */
export const sunIn = (ms: number): Constellation => constellationAt(sunPlace(ms), ms);

/** The moment, to the minute, at which the Sun crosses the edge of `from`, between a moment `inside` it and one `outside` it (in either order). */
function crossing(inside: number, outside: number, from: string): number {
  let i = inside;
  let o = outside;
  while (Math.abs(o - i) > 60_000) {
    const mid = (i + o) / 2;
    if (sunIn(mid).abbreviation === from) i = mid;
    else o = mid;
  }
  return Math.round((i + o) / 2 / 60_000) * 60_000;
}

/** The constellation the Sun is in at a moment, and the moments it went in and comes out (to the minute). */
export function sunStay(ms: number): { constellation: Constellation; entered: number; left: number } {
  const constellation = sunIn(ms);
  const here = constellation.abbreviation;
  let back = ms;
  while (sunIn(back - DAY).abbreviation === here) back -= DAY;
  let ahead = ms;
  while (sunIn(ahead + DAY).abbreviation === here) ahead += DAY;
  // the day before `back` is outside, so the entry is between them; the day after `ahead` is outside, so the exit is between them
  const entered = crossing(back, back - DAY, here);
  const left = crossing(ahead, ahead + DAY, here);
  return { constellation, entered, left };
}

/** Every constellation the Sun passes through in a calendar year (UTC), in order, with the moment it enters each. The first is the one it is in on 1 January. */
export function sunYear(year: number): { constellation: Constellation; entered: number }[] {
  const out: { constellation: Constellation; entered: number }[] = [];
  let ms = Date.UTC(year, 0, 1);
  const end = Date.UTC(year + 1, 0, 1);
  let now = sunIn(ms).abbreviation;
  out.push({ constellation: sunIn(ms), entered: sunStay(ms).entered });
  while (ms < end) {
    const next = ms + DAY;
    const there = sunIn(next).abbreviation;
    if (there !== now) {
      const entered = crossing(ms, next, now);
      out.push({ constellation: sunIn(next), entered });
      now = there;
    }
    ms = next;
  }
  return out;
}

const OBLIQUITY_J2000 = 23.4392911 * RAD;
/** A point on the ecliptic of J2000 at a longitude (degrees), in right ascension and declination of J2000, the frame the chart is drawn in. */
export function eclipticPoint(longitude: number): { rightAscension: number; declination: number } {
  const l = longitude * RAD;
  const rightAscension = Math.atan2(Math.cos(OBLIQUITY_J2000) * Math.sin(l), Math.cos(l)) / RAD;
  return { rightAscension: ((rightAscension % 360) + 360) % 360, declination: Math.asin(Math.sin(OBLIQUITY_J2000) * Math.sin(l)) / RAD };
}

/** The Sun's place in J2000 for the chart: its longitude of date less the precession since 2000 (1.3969713 degrees a century, Lieske 1977), on the ecliptic of J2000. */
export function sunOnChart(ms: number): { rightAscension: number; declination: number } {
  const { rightAscension, declination } = sunPlace(ms);
  const ra = rightAscension * RAD;
  const dec = declination * RAD;
  const obliquity = (23.439 - 0.0000004 * ((ms - J2000) / DAY)) * RAD;
  const ofDate = Math.atan2(Math.sin(ra) * Math.cos(obliquity) + Math.tan(dec) * Math.sin(obliquity), Math.cos(ra)) / RAD;
  return eclipticPoint(ofDate - (1.3969713 * (ms - J2000)) / (36_525 * DAY));
}
