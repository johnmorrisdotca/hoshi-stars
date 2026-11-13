// The quiz's levels by hemisphere and month: the constellations a reader in the north or in the south can see in the evening sky of a month. Seen from 40 degrees north or 40 degrees south (a round figure that stands for
// Europe, the USA, Japan and China in the north and for Chile, South Africa, Australia and New Zealand in the south), at 21:00 by the Sun on the 15th: a constellation counts when more than half of the stars of its figure are
// more than 10 degrees above the horizon (the ones below that are lost in the haze and the houses). The numbers are the package's own `horizontal` on the stars of its own figures. Pure: no DOM, no clock (the year is fixed;
// precession over a few decades moves nothing here).
import { constellations, starsIn } from "../src/constellations.ts";
import { figureOf } from "../src/lines.ts";
import { horizontal } from "../src/sky.ts";

export const HEMISPHERES = ["north", "south"] as const;
export type Hemisphere = (typeof HEMISPHERES)[number];

/** The latitude a hemisphere stands for, in degrees north. */
export const LATITUDE: Readonly<Record<Hemisphere, number>> = { north: 40, south: -40 };
/** How far above the horizon a star must be to count, in degrees. */
export const MIN_ALTITUDE = 10;

const cache = new Map<string, readonly string[]>();

/**
 * The constellations in the evening sky of a hemisphere in a month, as IAU abbreviations in the order of the 88.
 *
 * @param hemisphere - `north` (from 40 degrees north) or `south` (from 40 degrees south).
 * @param month - 1 to 12.
 */
export function seenIn(hemisphere: Hemisphere, month: number): readonly string[] {
  const key = `${hemisphere}${month}`;
  const held = cache.get(key);
  if (held !== undefined) return held;
  const when = new Date(Date.UTC(2026, month - 1, 15, 21));
  const observer = { latitude: LATITUDE[hemisphere], longitude: 0 };
  const seen = constellations()
    .filter((c) => {
      const figure = figureOf(c.abbreviation).stars;
      const marks = figure.length > 0 ? figure : starsIn(c.abbreviation).filter((star) => star.magnitude < 5);
      const up = marks.filter((star) => horizontal({ rightAscension: star.rightAscension, declination: star.declination }, observer, when).altitude > MIN_ALTITUDE).length;
      return up * 2 > marks.length;
    })
    .map((c) => c.abbreviation);
  cache.set(key, seen);
  return seen;
}
