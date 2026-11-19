// The quiz's levels by latitude and month: the figures a reader at a latitude can see in the evening sky of a month. At 21:00 by the Sun on the 15th (longitude 0; the Sun's time is what an evening means, and the year is fixed:
// precession over a few decades moves nothing here), a figure counts when more than half of its stars are more than 10 degrees above the horizon (the ones below that are lost in the haze and the houses). The numbers are the
// package's own `horizontal` on the stars of its own figures. The latitude is a whole number of degrees from -90 to 90; the old pages' North and South were 40 and -40 (a round figure that stands for Europe, the USA, Japan and China
// and for Chile, South Africa, Australia and New Zealand), and an old address's `hemisphere=north` or `south` still means those. Pure: no DOM, no clock.
import { constellations, starsIn } from "../src/constellations.ts";
import { figureOf } from "../src/lines.ts";
import { horizontal } from "../src/sky.ts";

/** The hemispheres of the old addresses (`hemisphere=north`), and the latitude each stands for, in degrees north. */
export const HEMISPHERES = ["north", "south"] as const;
export type Hemisphere = (typeof HEMISPHERES)[number];
export const LATITUDE: Readonly<Record<Hemisphere, number>> = { north: 40, south: -40 };
/** How far above the horizon a star must be to count, in degrees. */
export const MIN_ALTITUDE = 10;
/** The largest latitude, north or south, in degrees. */
export const MAX_LATITUDE = 90;

/**
 * The latitude a text says: a number from -90 to 90 degrees (north positive), rounded to a whole degree (`40.4` is 40, `-34.6` is -35). Blank, not a number, or outside -90 to 90 is `null`: no latitude.
 *
 * @param text - What was typed or what the address holds, or `null` where there is nothing.
 * @returns A whole number of degrees from -90 to 90, or `null`.
 */
export function latitudeOf(text: string | null | undefined): number | null {
  if (text === null || text === undefined || !/^\s*[+-]?\d+(\.\d+)?\s*$/.test(text)) return null;
  const value = Number(text);
  if (!(value >= -MAX_LATITUDE && value <= MAX_LATITUDE)) return null;
  return Math.round(value) + 0;
}

/**
 * The latitude an address asks for: `lat` if it holds a good one, else the old `hemisphere` (`north` is 40 and `south` is -40), else `null`, the whole sky. When both are there, `lat` wins.
 *
 * @param lat - The address's `lat`, or `null`.
 * @param hemisphere - The address's `hemisphere`, or `null`.
 */
export function askedLatitude(lat: string | null | undefined, hemisphere: string | null | undefined): number | null {
  const typed = latitudeOf(lat);
  if (typed !== null) return typed;
  return hemisphere === "north" || hemisphere === "south" ? LATITUDE[hemisphere] : null;
}

/** Whether a figure is in the evening sky at a latitude in a month: more than half of its stars are more than `MIN_ALTITUDE` degrees up at 21:00 on the 15th. */
export function isSeen(stars: ReadonlyArray<{ rightAscension: number; declination: number }>, latitude: number, month: number): boolean {
  const when = new Date(Date.UTC(2026, month - 1, 15, 21));
  const observer = { latitude, longitude: 0 };
  const up = stars.filter((star) => horizontal({ rightAscension: star.rightAscension, declination: star.declination }, observer, when).altitude > MIN_ALTITUDE).length;
  return up * 2 > stars.length;
}

/** Whether a figure is in the sky at a latitude in a month, or (month 0) in some month of the year. */
export const isSeenIn = (stars: ReadonlyArray<{ rightAscension: number; declination: number }>, latitude: number, month: number): boolean => (month > 0 ? isSeen(stars, latitude, month) : Array.from({ length: 12 }, (_, i) => i + 1).some((m) => isSeen(stars, latitude, m)));

const cache = new Map<string, readonly string[]>();

/**
 * The constellations in the evening sky at a latitude in a month, as IAU abbreviations in the order of the 88.
 *
 * @param latitude - Degrees north, negative south, -90 to 90.
 * @param month - 1 to 12.
 */
export function seenIn(latitude: number, month: number): readonly string[] {
  const key = `${latitude}|${month}`;
  const held = cache.get(key);
  if (held !== undefined) return held;
  const seen = constellations()
    .filter((c) => {
      const figure = figureOf(c.abbreviation).stars;
      return isSeen(figure.length > 0 ? figure : starsIn(c.abbreviation).filter((star) => star.magnitude < 5), latitude, month);
    })
    .map((c) => c.abbreviation);
  cache.set(key, seen);
  return seen;
}
