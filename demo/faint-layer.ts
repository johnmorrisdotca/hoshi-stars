// What the demo's two maps share of the faint stars: the depth rule (how deep a view looks for its zoom), the cap on dots, and the dots themselves as a few paths.
// Pure: no DOM and no fetching (the tiles are `faint.ts`'s). The sky chart (`chart.ts`) and the whole-sky page (`whole-sky.ts`) both draw from here, so the two cannot drift apart.
import { blackBodyColour, starTemperatureK } from "../src/index.ts";
import { FAINT_LIMIT, type FaintStar } from "../src/faint-core.ts";

/** The faint stars to draw (the brightest first), and the magnitude the list is complete to in the field (a cap cuts it short). */
export interface FaintDraw {
  stars: readonly FaintStar[];
  depth: number;
}

/** The faint layer starts once the depth passes this: the stars of 6 to 7 are the Bright Star Catalogue's, and there is little to add. */
export const FAINT_FROM = 7;
/** The most faint stars one view draws, brightest first: a view is never millions of marks. */
export const FAINT_DOT_CAP = 6000;

/** UCAC4 holds few stars from 6.5 to 8 (its rows copied from Tycho are left out), so once the view is zoomed in this far (the chart's own zoom, about 3x on the readout, which counts from the whole-sky fit) the layer starts at `FAINT_PAST_GAP` instead of climbing slowly through that nearly empty band, where zooming in would show almost nothing new. */
export const FAINT_JUMP_ZOOM = 8;
export const FAINT_PAST_GAP = 8.5;

/** The faintest magnitude the faint layer is asked for: the same telescope rule as `depthOf` (2.5 magnitudes for each tenfold zoom), but from `FAINT_JUMP_ZOOM` on never less than `FAINT_PAST_GAP` and deepening from there at the same rate, up to the faintest star of the tiles. */
export const faintDepthOf = (magnitude: number, zoom: number): number => {
  const telescope = magnitude + 2.5 * Math.log10(Math.max(1, zoom));
  const pastGap = zoom >= FAINT_JUMP_ZOOM ? FAINT_PAST_GAP + 2.5 * Math.log10(zoom / FAINT_JUMP_ZOOM) : -Infinity;
  return Math.round(Math.min(FAINT_LIMIT, Math.max(telescope, pastGap)) * 100) / 100;
};

/** The colours of the faint stars by B-V (hot and blue to cool and red), and for a star with no colour; from the same black-body colours the bright stars use. */
const FAINT_BREAKS = [0.2, 0.6, 1.0, 1.4] as const;
const FAINT_COLOURS = [-0.1, 0.4, 0.8, 1.2, 1.7].map((bv) => blackBodyColour(starTemperatureK(bv))).concat("#d9deee");
/** The faint stars of a size class are one path each: a size class by magnitude, a colour class by B-V, so a view is a dozen elements however many stars it holds. */
const faintClassOf = (magnitude: number): number => (magnitude < 9 ? 0 : magnitude < 10.5 ? 1 : 2);
const faintColourOf = (colourIndex: number | undefined): number => (colourIndex === undefined ? FAINT_BREAKS.length + 1 : FAINT_BREAKS.findIndex((b) => colourIndex < b) === -1 ? FAINT_BREAKS.length : FAINT_BREAKS.findIndex((b) => colourIndex < b));
const round = (n: number): string => n.toFixed(1);

/**
 * The faint stars as dots in a few paths (round caps on zero-length lines), the brightest first up to the cap, and what was drawn. `place` gives a star's pixel on the picture (or nothing where it has none), `inside` says whether a pixel is on the picture;
 * `grow` scales the dots (1 for the sky chart, which grows them as it zooms; less where the page's own stars are small).
 */
export function faintMarks(faint: FaintDraw, place: (star: FaintStar) => [number, number] | undefined, inside: (at: [number, number], margin?: number) => boolean, grow: number): { svg: string; drawn: number; depth: number } {
  const radii = [0.95, 0.8, 0.65];
  const paths = new Map<number, string>();
  let drawn = 0;
  let depth = faint.depth;
  for (const star of faint.stars) {
    const at = place(star);
    if (at === undefined || !inside(at, 2)) continue;
    if (drawn === FAINT_DOT_CAP) {
      depth = Math.min(depth, Math.floor(star.magnitude * 20) / 20 - 0.05);
      break;
    }
    const key = faintClassOf(star.magnitude) * 8 + faintColourOf(star.colourIndex);
    paths.set(key, (paths.get(key) ?? "") + `M${round(at[0])} ${round(at[1])}h.1`);
    drawn++;
  }
  let svg = "";
  for (const [key, d] of paths) svg += `<path d="${d}" stroke="${FAINT_COLOURS[key % 8]}" stroke-width="${round(2 * radii[Math.floor(key / 8)]! * grow)}" stroke-linecap="round" fill="none" stroke-opacity=".9"/>`;
  return { svg: `<g data-layer="faint">${svg}</g>`, drawn, depth: Math.round(depth * 100) / 100 };
}
