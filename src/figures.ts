// Our own line-art figures for constellations, stored as paths in sky coordinates (right ascension and declination in degrees, J2000), so one figure fits any projection.
// The figures tier (`@johnmorrisdotca/hoshi-stars/figures`): the drawings are a few kB each and nothing else is loaded but the projection. Pure: no DOM, no clock, no state beyond the parsed table.
import { FIGURE_ROWS } from "./data/figures.ts";
import { project, type Projection, type ProjectionOptions, type SkyPoint } from "./projection.ts";

/**
 * One figure: the line art drawn over a constellation, or over a star cluster.
 *
 * @example
 * ```ts
 * import { figure, type Figure } from "@johnmorrisdotca/hoshi-stars/figures";
 *
 * const bear: Figure = figure("UMa")!;
 * console.log(bear.english, bear.japanese, bear.path.length, "characters");
 * ```
 */
export interface Figure {
  /** The key: the IAU abbreviation (`UMa`) for a constellation, the Messier number (`M45`) for a cluster. */
  id: string;
  /** The IAU abbreviation of the constellation the figure lies in (`UMa`; `Tau` for `M45`). */
  constellation: string;
  /** The English name (`Great Bear`, `Pleiades`). */
  english: string;
  /** The Japanese name (`おおぐま座`, `すばる`). */
  japanese: string;
  /** The drawing as SVG path data in degrees of right ascension and declination: `M` starts a stroke at a point; then `r` (a smooth curve, Catmull-Rom, through the points) or `l` (straight lines) and the steps from each point to the next; `z` closes a smooth curve. Right ascension may run below 0 or above 360 to stay continuous across the 0 h line. */
  path: string;
}

const stored: Figure[] = [];

function load(): void {
  if (stored.length > 0) return;
  for (const [id, constellation, english, japanese, path] of FIGURE_ROWS) stored.push(Object.freeze({ id, constellation, english, japanese, path }));
}

/**
 * All the figures drawn so far.
 *
 * @returns A fresh array of the shared, frozen figures.
 *
 * @example
 * ```ts
 * import { figures } from "@johnmorrisdotca/hoshi-stars/figures";
 *
 * console.log(figures().map((f) => f.id));
 * ```
 */
export function figures(): Figure[] {
  load();
  return [...stored];
}

/**
 * A figure by its key, ignoring case: the IAU abbreviation of a constellation (`UMa`) or the Messier number of a cluster (`M45`).
 *
 * @param text - The key.
 * @returns The figure, or `undefined` if there is none yet.
 * @throws TypeError if `text` is not a string.
 *
 * @example
 * ```ts
 * import { figure } from "@johnmorrisdotca/hoshi-stars/figures";
 *
 * console.log(figure("ori")?.english, figure("M45")?.japanese, figure("Cru"));
 * ```
 */
export function figure(text: string): Figure | undefined {
  if (typeof text !== "string") throw new TypeError(`text must be a string, got ${typeof text}`);
  load();
  const key = text.trim().toLowerCase();
  return stored.find((f) => f.id.toLowerCase() === key);
}

type Pair = [number, number];
interface Stroke {
  points: Pair[];
  smooth: boolean;
  closed: boolean;
}

function strokes(path: string): Stroke[] {
  const out: Stroke[] = [];
  let at: Pair = [0, 0];
  for (const part of path.split("M").slice(1)) {
    const words = part.match(/[rlz]|-?\d*\.?\d+/g) ?? [];
    at = [Number(words[0]), Number(words[1])];
    const stroke: Stroke = { points: [at], smooth: false, closed: false };
    for (let i = 2; i < words.length; ) {
      const word = words[i]!;
      if (word === "r" || word === "l") {
        stroke.smooth = word === "r";
        i += 1;
      } else if (word === "z") {
        stroke.closed = true;
        i += 1;
      } else {
        at = [at[0] + Number(word), at[1] + Number(words[i + 1])];
        stroke.points.push(at);
        i += 2;
      }
    }
    out.push(stroke);
  }
  return out;
}

function wrap(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

/**
 * The figure as polylines on the sky: each curve cut into pieces no longer than `step` degrees.
 *
 * @param art - The figure.
 * @param options - `step`: the longest piece in degrees, 0.01 to 90 (default 1).
 * @returns The strokes, each a list of points in degrees, J2000, with right ascension 0 up to 360.
 * @throws RangeError if `step` is out of range.
 *
 * @example
 * ```ts
 * import { figure, figureLines } from "@johnmorrisdotca/hoshi-stars/figures";
 *
 * const lines = figureLines(figure("Cas")!, { step: 0.5 });
 * console.log(lines.length, "strokes,", lines.reduce((n, s) => n + s.length, 0), "points");
 * ```
 */
export function figureLines(art: Figure, options: { step?: number } = {}): SkyPoint[][] {
  const step = options.step ?? 1;
  if (typeof step !== "number" || !(step >= 0.01 && step <= 90)) throw new RangeError(`step must be from 0.01 to 90 degrees, got ${String(step)}`);
  return strokes(art.path).map(({ points, smooth, closed }) => {
    const line: SkyPoint[] = [];
    const last = points.length - 1;
    const node = (i: number): Pair => points[closed ? (i + points.length) % points.length : Math.max(0, Math.min(last, i))]!;
    for (let i = 0; i < (closed ? points.length : last); i++) {
      const [p0, p1, p2, p3] = [node(i - 1), node(i), node(i + 1), node(i + 2)];
      const length = Math.hypot((p2[0] - p1[0]) * Math.cos((p1[1] * Math.PI) / 180), p2[1] - p1[1]);
      const n = Math.max(smooth ? 8 : 1, Math.min(64, Math.ceil(length / step)));
      const b1: Pair = smooth ? [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6] : p1;
      const b2: Pair = smooth ? [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6] : p2;
      for (let s = i === 0 ? 0 : 1; s <= n; s++) {
        const t = s / n;
        const u = 1 - t;
        const mix = (axis: 0 | 1): number => u * u * u * p1[axis] + 3 * u * u * t * b1[axis] + 3 * u * t * t * b2[axis] + t * t * t * p2[axis];
        line.push({ rightAscension: wrap(mix(0)), declination: Math.max(-90, Math.min(90, mix(1))) });
      }
    }
    return line;
  });
}

/**
 * The figure as SVG path data in a projection. `y` runs DOWN, as on a screen, and the chart's centre is (0, 0): put the path in a `<g transform="translate(cx cy)">`. A point the projection cannot show
 * (the far side for `orthographic` and `gnomonic`) cuts the stroke there.
 *
 * @param art - The figure.
 * @param kind - The projection.
 * @param options - The projection options (`centre`, `scale`, `rotation`, `mirror`; `scale` is the radius of the sky in drawing units, so about 57 times the pixels a degree takes), and `step` (the longest piece in degrees, default 1) and `digits` (decimals in the numbers, default 2).
 * @returns Path data of `M` and `L` commands; empty when nothing of the figure is visible.
 * @throws RangeError if `kind` or a projection option is not valid, or `step` is out of range.
 *
 * @example
 * ```ts
 * import { figure, figurePath } from "@johnmorrisdotca/hoshi-stars/figures";
 *
 * const d = figurePath(figure("Ori")!, "stereographic", { centre: { rightAscension: 83.8, declination: 0 }, scale: 400 });
 * console.log(`<path d="${d}" fill="none" stroke="currentColor"/>`);
 * ```
 */
export function figurePath(art: Figure, kind: Projection, options: ProjectionOptions & { step?: number; digits?: number }): string {
  const { step, digits = 2, ...where } = options;
  const lines = figureLines(art, step === undefined ? {} : { step });
  const number = (v: number): string => String(Number(v.toFixed(digits)) + 0);
  let d = "";
  for (const line of lines) {
    let drawing = false;
    for (const point of line) {
      const at = project(kind, point, where);
      if (at === undefined) {
        drawing = false;
        continue;
      }
      d += `${drawing ? "L" : "M"}${number(at.x)} ${number(-at.y)}`;
      drawing = true;
    }
  }
  return d;
}
