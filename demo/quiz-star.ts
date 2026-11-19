// The question "which mansion holds this star?", for the Chinese mansions that hold only one or two of their stars in the catalogue (角, 氐, 虛, 室, 壁, 婁 and 觜): too few for the usual question, which asks for a
// figure by its lines. The chart has a fixed field, never fitted to the stars, centred on the middle of the mansion's held stars; those stars (and no others) are ringed, and the stars of the other mansions are drawn faintly
// round them, with their lines in the line styles. The rings do not say "determinative": 氐 and 觜 have no star numbered 1 in the data, and the Wikidata numbers are not relied on. Pure: no DOM; the projection is passed in.
import type { Star } from "../src/stars.ts";

/** The angle from the middle of the chart to the edge of the field, in degrees, the same for every question: 20 degrees along the short side's half (the field is about 48 degrees across the short side of the chart). */
export const FIELD_RADIUS = 20;
/** How much of the half of the chart's short side the field fills. */
export const FIELD_FILL = 0.42;
/** The radius of the ring round a held star, in pixels. */
export const RING_RADIUS = 11;

interface Point {
  rightAscension: number;
  declination: number;
}

/**
 * The middle of some stars on the sky: the direction of the sum of their unit vectors (not the mean of their right ascensions, which is wrong across 0 and 360 degrees and near a pole).
 *
 * @param stars - One or more stars.
 * @returns Its right ascension (0 to 360) and declination, in degrees.
 */
export function middleOf(stars: ReadonlyArray<Point>): Point {
  const d = Math.PI / 180;
  let x = 0;
  let y = 0;
  let z = 0;
  for (const star of stars) {
    x += Math.cos(star.declination * d) * Math.cos(star.rightAscension * d);
    y += Math.cos(star.declination * d) * Math.sin(star.rightAscension * d);
    z += Math.sin(star.declination * d);
  }
  return { rightAscension: ((Math.atan2(y, x) / d) % 360 + 360) % 360, declination: Math.atan2(z, Math.hypot(x, y)) / d };
}

/** A way to put a point of the sky on the chart: its pixel, or `undefined` where it falls off the projection. */
export type Place = (point: Point) => [number, number] | undefined;

/** The figure of another mansion, as the stars it holds and the lines between them. */
export interface Neighbour {
  stars: readonly Star[];
  segments: ReadonlyArray<readonly [Star, Star]>;
}

/**
 * The marks drawn over the chart for a question: a ring round each held star (`data-ring` is its Bright Star Catalogue number), the stars of the neighbouring mansions as faint dots (`data-near`), and, when `lines` is set, their lines
 * faintly. Only what falls inside the chart is drawn. Nothing is written that names a mansion.
 *
 * @param held - The stars of the mansion asked.
 * @param neighbours - The other mansions.
 * @param place - The chart's projection.
 * @param width - The chart's width in pixels.
 * @param height - The chart's height in pixels.
 * @param lines - Whether the neighbours' lines are drawn.
 */
export function marksSvg(held: readonly Star[], neighbours: readonly Neighbour[], place: Place, width: number, height: number, lines: boolean): string {
  const inside = (at: [number, number] | undefined): at is [number, number] => at !== undefined && at[0] >= 0 && at[0] <= width && at[1] >= 0 && at[1] <= height;
  const here = (star: Star): [number, number] | undefined => place({ rightAscension: star.rightAscension, declination: star.declination });
  let faint = "";
  for (const near of neighbours) {
    if (lines) {
      for (const [a, b] of near.segments) {
        const from = here(a);
        const to = here(b);
        if (inside(from) && inside(to)) faint += `<line x1="${from[0].toFixed(1)}" y1="${from[1].toFixed(1)}" x2="${to[0].toFixed(1)}" y2="${to[1].toFixed(1)}" stroke="#8fa3c7" stroke-opacity="0.35" stroke-width="1"/>`;
      }
    }
    for (const star of near.stars) {
      const at = here(star);
      if (inside(at)) faint += `<circle cx="${at[0].toFixed(1)}" cy="${at[1].toFixed(1)}" r="2.5" fill="none" stroke="#8fa3c7" stroke-opacity="0.45" stroke-width="1" data-near="${star.hr}"/>`;
    }
  }
  let rings = "";
  for (const star of held) {
    const at = here(star);
    if (inside(at)) rings += `<circle cx="${at[0].toFixed(1)}" cy="${at[1].toFixed(1)}" r="${RING_RADIUS}" fill="none" stroke="#ffe49a" stroke-width="2" data-ring="${star.hr}"/>`;
  }
  return `<g pointer-events="none">${faint}${rings}</g>`;
}
