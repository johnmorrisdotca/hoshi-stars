// The whole sky in one wide 2:1 picture: Mollweide, Hammer or plate carrée fitted to a box twice as wide as it is tall, in galactic or equatorial orientation, with lines that cross the seam cut cleanly.
// The all-sky tier (`@johnmorrisdotca/hoshi-stars/all-sky`). Pure maths on top of `projection` and the galactic frame of `milky-way`: no DOM, no clock, no state. The picture's pixels are the caller's.
import { fromGalactic, toGalactic } from "./milky-way.ts";
import { project, unproject, type SkyPoint } from "./projection.ts";

/**
 * The two orientations of the whole-sky picture: `galactic` puts the Galaxy's plane along the middle with the centre of the Galaxy (in Sagittarius) in the middle of the picture, `equatorial` puts
 * the celestial equator along the middle.
 *
 * @example
 * ```ts
 * import { ALL_SKY_FRAMES } from "@johnmorrisdotca/hoshi-stars/all-sky";
 *
 * console.log(ALL_SKY_FRAMES.join(", "));
 * ```
 */
export const ALL_SKY_FRAMES = ["galactic", "equatorial"] as const;

/**
 * An orientation of the whole-sky picture.
 *
 * @example
 * ```ts
 * import { ALL_SKY_FRAMES, type AllSkyFrame } from "@johnmorrisdotca/hoshi-stars/all-sky";
 *
 * const frame: AllSkyFrame = ALL_SKY_FRAMES[0];
 * console.log(frame);
 * ```
 */
export type AllSkyFrame = (typeof ALL_SKY_FRAMES)[number];

/**
 * The projections that fill a 2:1 box exactly: Mollweide's and Hammer's equal-area ovals and the plain longitude and latitude rectangle.
 *
 * @example
 * ```ts
 * import { ALL_SKY_PROJECTIONS } from "@johnmorrisdotca/hoshi-stars/all-sky";
 *
 * console.log(ALL_SKY_PROJECTIONS.join(", "));
 * ```
 */
export const ALL_SKY_PROJECTIONS = ["mollweide", "hammer", "equirectangular"] as const;

/**
 * A projection of the whole-sky picture.
 *
 * @example
 * ```ts
 * import { ALL_SKY_PROJECTIONS, type AllSkyProjection } from "@johnmorrisdotca/hoshi-stars/all-sky";
 *
 * const kind: AllSkyProjection = ALL_SKY_PROJECTIONS[0];
 * console.log(kind);
 * ```
 */
export type AllSkyProjection = (typeof ALL_SKY_PROJECTIONS)[number];

/**
 * How to lay the whole sky out.
 *
 * @example
 * ```ts
 * import type { AllSkyOptions } from "@johnmorrisdotca/hoshi-stars/all-sky";
 *
 * const options: AllSkyOptions = { width: 1000, frame: "equatorial", projection: "hammer" };
 * console.log(options.width / 2, "tall");
 * ```
 */
export interface AllSkyOptions {
  /** The picture's width in your units; it is half as tall. */
  width: number;
  /** The orientation; `galactic` by default. */
  frame?: AllSkyFrame;
  /** The projection; `mollweide` by default. */
  projection?: AllSkyProjection;
  /** The longitude of the frame (galactic longitude, or right ascension), in degrees, that lands in the middle; 0 for `galactic` and 180 (12 hours) for `equatorial` by default. The seam is half a turn from it. */
  centre?: number;
  /** True for the map convention, longitude growing to the right. Default false: the sky seen looking up, longitude (east) growing to the LEFT, as the rest of the package draws it. */
  mirror?: boolean;
}

/**
 * A point of the picture: `x` to the right and `y` DOWN from the top left corner, as a screen has it.
 *
 * @example
 * ```ts
 * import type { AllSkyPoint } from "@johnmorrisdotca/hoshi-stars/all-sky";
 *
 * const middle: AllSkyPoint = { x: 500, y: 250 };
 * console.log(middle.x / 2 === middle.y);
 * ```
 */
export interface AllSkyPoint {
  x: number;
  y: number;
}

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
/** Slack for the rim: a point within this many radians of the seam counts as on it. */
const SEAM_EPS = 1e-9;

interface Layout {
  frame: AllSkyFrame;
  kind: AllSkyProjection;
  width: number;
  height: number;
  centre: number;
  scale: number;
  mirror: boolean;
}

function setup(options: AllSkyOptions): Layout {
  if (typeof options !== "object" || options === null) throw new TypeError(`options must be an object with a width, got ${String(options)}`);
  const width = options.width;
  if (typeof width !== "number" || !Number.isFinite(width) || width <= 0) throw new RangeError(`options.width must be a number above 0, got ${String(width)}`);
  const frame = options.frame ?? "galactic";
  if (!ALL_SKY_FRAMES.includes(frame)) throw new RangeError(`options.frame must be one of ${ALL_SKY_FRAMES.map((f) => `"${f}"`).join(", ")}, got "${String(frame)}"`);
  const kind = options.projection ?? "mollweide";
  if (!ALL_SKY_PROJECTIONS.includes(kind)) throw new RangeError(`options.projection must be one of ${ALL_SKY_PROJECTIONS.map((p) => `"${p}"`).join(", ")}, got "${String(kind)}"`);
  const centre = options.centre ?? (frame === "galactic" ? 0 : 180);
  if (typeof centre !== "number" || !Number.isFinite(centre)) throw new RangeError(`options.centre must be a finite number of degrees, got ${String(centre)}`);
  // Mollweide and Hammer are 4 sqrt(2) by 2 sqrt(2) at scale 1; the plain rectangle is 2 pi by pi.
  const scale = kind === "equirectangular" ? width / (2 * Math.PI) : width / (4 * Math.SQRT2);
  return { frame, kind, width, height: width / 2, centre, scale, mirror: options.mirror === true };
}

/** A point of the sky in the picture's frame, as a longitude and latitude in degrees. */
function inFrame(frame: AllSkyFrame, point: SkyPoint): SkyPoint {
  if (frame === "equatorial") return point;
  const g = toGalactic(point);
  return { rightAscension: g.longitude, declination: g.latitude };
}

function outOfFrame(frame: AllSkyFrame, point: SkyPoint): SkyPoint {
  if (frame === "equatorial") return point;
  return fromGalactic({ longitude: point.rightAscension, latitude: point.declination });
}

const wrap180 = (degrees: number): number => ((((degrees + 180) % 360) + 360) % 360) - 180;

function place(o: Layout, point: SkyPoint): AllSkyPoint {
  const at = project(o.kind, point, { centre: { rightAscension: o.centre, declination: 0 }, scale: o.scale, mirror: o.mirror })!;
  return { x: o.width / 2 + at.x, y: o.height / 2 - at.y };
}

/**
 * Where a point of the sky lands in the picture.
 *
 * @param point - The sky position in degrees (J2000): right ascension and declination.
 * @param options - The picture: its `width`, and optionally the `frame`, the `projection`, the `centre` and `mirror`.
 * @returns The point in the picture, `x` from the left and `y` from the top, inside the box `0..width` by `0..width / 2`.
 * @throws RangeError if the width is not above 0, or the frame or projection is not one of the lists, or the centre is not finite; TypeError for a point without a right ascension and declination.
 *
 * @example
 * ```ts
 * import { allSkyProject } from "@johnmorrisdotca/hoshi-stars/all-sky";
 *
 * // The Galaxy's centre (Sagittarius A*) is the middle of a galactic picture 1000 wide
 * console.log(allSkyProject({ rightAscension: 266.4168, declination: -29.0078 }, { width: 1000 })); // about { x: 500, y: 250 }
 * ```
 */
export function allSkyProject(point: SkyPoint, options: AllSkyOptions): AllSkyPoint {
  const o = setup(options);
  return place(o, inFrame(o.frame, point));
}

/**
 * The sky under a point of the picture: the inverse of `allSkyProject`, with the same options.
 *
 * @param point - A point of the picture, `x` from the left and `y` from the top.
 * @param options - The same options that drew the picture.
 * @returns The sky position (right ascension 0 up to 360 and declination, in degrees, J2000), or `undefined` when the point is outside the oval (or the box, for the plain rectangle).
 * @throws RangeError for a bad option, TypeError for a point without a number `x` and `y`.
 *
 * @example
 * ```ts
 * import { allSkyProject, allSkyUnproject } from "@johnmorrisdotca/hoshi-stars/all-sky";
 *
 * const options = { width: 1000, frame: "equatorial" } as const;
 * const spot = allSkyProject({ rightAscension: 88.79, declination: 7.41 }, options); // Betelgeuse
 * console.log(allSkyUnproject(spot, options)); // about { rightAscension: 88.79, declination: 7.41 }
 * ```
 */
export function allSkyUnproject(point: AllSkyPoint, options: AllSkyOptions): SkyPoint | undefined {
  const o = setup(options);
  if (typeof point !== "object" || point === null || typeof point.x !== "number" || typeof point.y !== "number") throw new TypeError(`point must be an object with a number x and y, got ${String(point)}`);
  const at = unproject(o.kind, { x: point.x - o.width / 2, y: o.height / 2 - point.y }, { centre: { rightAscension: o.centre, declination: 0 }, scale: o.scale, mirror: o.mirror });
  return at === undefined ? undefined : outOfFrame(o.frame, at);
}

/** A point of the rim: the seam at latitude `latitude`, on the side the longitude `side` (+1 or -1 half turn from the centre) lands on. */
function rim(o: Layout, latitude: number, side: 1 | -1): AllSkyPoint {
  return place(o, { rightAscension: o.centre + side * (180 - SEAM_EPS * DEG), declination: latitude });
}

/**
 * The edge of the whole-sky picture as a closed run of points: the oval of Mollweide and Hammer, or the rectangle. Use it for the sky's background and as a clip path.
 *
 * @param options - The picture.
 * @param steps - How many points to a side of the oval; 90 by default.
 * @returns Points going down the left edge, then up the right, the first repeated at the end.
 * @throws RangeError for a bad option or `steps` below 2.
 *
 * @example
 * ```ts
 * import { allSkyOutline } from "@johnmorrisdotca/hoshi-stars/all-sky";
 *
 * const edge = allSkyOutline({ width: 1000, projection: "hammer" });
 * console.log(edge.length, edge[0]);
 * ```
 */
export function allSkyOutline(options: AllSkyOptions, steps = 90): AllSkyPoint[] {
  const o = setup(options);
  if (!Number.isInteger(steps) || steps < 2) throw new RangeError(`steps must be a whole number of at least 2, got ${String(steps)}`);
  const leftSide: 1 | -1 = o.mirror ? -1 : 1;
  const out: AllSkyPoint[] = [];
  for (let i = 0; i <= steps; i += 1) out.push(rim(o, 90 - (180 * i) / steps, leftSide));
  for (let i = 0; i <= steps; i += 1) out.push(rim(o, -90 + (180 * i) / steps, (leftSide * -1) as 1 | -1));
  out.push(out[0]!);
  return out;
}

/** Unit vector of a point of the frame. */
function vector(p: SkyPoint): [number, number, number] {
  const ra = p.rightAscension * RAD;
  const dec = p.declination * RAD;
  return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
}

function fromVector(v: readonly [number, number, number]): SkyPoint {
  return { rightAscension: Math.atan2(v[1], v[0]) * DEG, declination: Math.atan2(v[2], Math.hypot(v[0], v[1])) * DEG };
}

/** The points of the great circle from `a` to `b`, no more than `step` degrees apart, both ends included. */
function along(a: SkyPoint, b: SkyPoint, step: number): SkyPoint[] {
  const u = vector(a);
  const v = vector(b);
  const dot = Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1] + u[2] * v[2]));
  const angle = Math.acos(dot) * DEG;
  const pieces = Math.max(1, Math.ceil(angle / step));
  if (pieces === 1 || angle < 1e-9) return [a, b];
  const sin = Math.sin(angle * RAD);
  const out: SkyPoint[] = [a];
  for (let i = 1; i < pieces; i += 1) {
    const t = i / pieces;
    const wa = Math.sin((1 - t) * angle * RAD) / sin;
    const wb = Math.sin(t * angle * RAD) / sin;
    out.push(fromVector([wa * u[0] + wb * v[0], wa * u[1] + wb * v[1], wa * u[2] + wb * v[2]]));
  }
  out.push(b);
  return out;
}

/**
 * A line on the sky (a figure's segment, a boundary, a meridian) as runs of points of the picture. The line follows great circles between your points, cut every `step` degrees so a curve
 * stays smooth, and a line that crosses the seam (the edge, half a turn from the centre) is cut there into two runs that end ON the edge, one at each side, so nothing is drawn across the picture.
 *
 * @param points - The sky positions in degrees, in order (a closed outline repeats its first point).
 * @param options - The picture.
 * @param step - The longest piece between two points of a run, in degrees; 2 by default.
 * @returns One run for a line that stays on its side of the seam, more where it crosses; each has at least two points.
 * @throws RangeError for a bad option or a `step` that is not above 0, TypeError for a point without a right ascension and declination.
 *
 * @example
 * ```ts
 * import { allSkyLine } from "@johnmorrisdotca/hoshi-stars/all-sky";
 *
 * // Two points either side of the galactic anticentre: the line is cut at the edge
 * const runs = allSkyLine([{ rightAscension: 84, declination: 30 }, { rightAscension: 100, declination: 30 }], { width: 1000, centre: 0 });
 * console.log(runs.length);
 * ```
 */
export function allSkyLine(points: readonly SkyPoint[], options: AllSkyOptions, step = 2): AllSkyPoint[][] {
  const o = setup(options);
  if (typeof step !== "number" || !(step > 0)) throw new RangeError(`step must be a number of degrees above 0, got ${String(step)}`);
  return runs(o, points.map((p) => inFrame(o.frame, p)), step);
}

/** The runs of a line whose points are already in the picture's frame. */
function runs(o: Layout, framed: readonly SkyPoint[], step: number): AllSkyPoint[][] {
  const out: AllSkyPoint[][] = [];
  let run: AllSkyPoint[] = [];
  const flush = (): void => {
    if (run.length >= 2) out.push(run);
    run = [];
  };
  let before: SkyPoint | undefined;
  const lambda = (p: SkyPoint): number => wrap180(p.rightAscension - o.centre);
  const add = (p: SkyPoint): void => {
    if (before !== undefined) {
      const a = lambda(before);
      const b = lambda(p);
      // The two points are on opposite sides of the seam and far apart in longitude: the line runs across the seam, not through the middle.
      if (Math.sign(a) !== Math.sign(b) && Math.abs(a) + Math.abs(b) > 180 && !(a === 0 || b === 0)) {
        const t = (180 - Math.abs(a)) / (360 - Math.abs(a) - Math.abs(b));
        const latitude = before.declination + t * (p.declination - before.declination);
        run.push(rim(o, latitude, Math.sign(a) as 1 | -1));
        flush();
        run.push(rim(o, latitude, Math.sign(b) as 1 | -1));
      }
    }
    run.push(place(o, p));
    before = p;
  };
  for (let i = 0; i < framed.length; i += 1) {
    const p = framed[i]!;
    if (i === 0) {
      add(p);
      continue;
    }
    const pieces = along(framed[i - 1]!, p, step);
    for (let k = 1; k < pieces.length; k += 1) add(pieces[k]!);
  }
  flush();
  return out;
}

/**
 * One line of the grid of the picture: a meridian (a line of constant longitude) or a parallel (constant latitude) of the picture's own frame.
 *
 * @example
 * ```ts
 * import { allSkyGrid, type AllSkyGridLine } from "@johnmorrisdotca/hoshi-stars/all-sky";
 *
 * const line: AllSkyGridLine = allSkyGrid({ width: 1000 })[0]!;
 * console.log(line.kind, line.degrees, line.runs.length);
 * ```
 */
export interface AllSkyGridLine {
  /** `meridian` runs top to bottom, `parallel` side to side. */
  kind: "meridian" | "parallel";
  /** The longitude (0 up to 360) or latitude (-90 to 90) of the line, in the picture's frame: the galactic plane is the parallel at 0. */
  degrees: number;
  /** The line as runs of points, cut at the seam. */
  runs: AllSkyPoint[][];
}

/**
 * The grid of the picture: a meridian every `every` degrees of longitude and a parallel every `every` degrees of latitude, in the picture's own frame (the galactic grid for a galactic picture),
 * the poles left out.
 *
 * @param options - The picture.
 * @param every - The spacing in degrees, a divisor of 90; 30 by default.
 * @returns The meridians, then the parallels from south to north.
 * @throws RangeError for a bad option or a spacing that is not a divisor of 90.
 *
 * @example
 * ```ts
 * import { allSkyGrid } from "@johnmorrisdotca/hoshi-stars/all-sky";
 *
 * const grid = allSkyGrid({ width: 1000, frame: "galactic" });
 * console.log(grid.filter((line) => line.kind === "parallel").map((line) => line.degrees)); // [ -60, -30, 0, 30, 60 ]
 * ```
 */
export function allSkyGrid(options: AllSkyOptions, every = 30): AllSkyGridLine[] {
  const o = setup(options);
  if (typeof every !== "number" || !(every >= 1 && every <= 90) || 90 % every !== 0) throw new RangeError(`every must be a divisor of 90 from 1 to 90 degrees, got ${String(every)}`);
  const lines: AllSkyGridLine[] = [];
  for (let longitude = 0; longitude < 360; longitude += every) {
    const points: SkyPoint[] = [];
    for (let latitude = -90; latitude <= 90; latitude += 10) points.push({ rightAscension: longitude, declination: latitude });
    lines.push({ kind: "meridian", degrees: longitude, runs: runs(o, points, 2) });
  }
  for (let latitude = -90 + every; latitude < 90; latitude += every) {
    const points: SkyPoint[] = [];
    for (let longitude = 0; longitude <= 360; longitude += 5) points.push({ rightAscension: o.centre + longitude, declination: latitude });
    lines.push({ kind: "parallel", degrees: latitude, runs: runs(o, points, 2) });
  }
  return lines;
}
