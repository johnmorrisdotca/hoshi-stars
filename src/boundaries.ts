// Which of the 88 constellations a point on the sky is in, and the boundary lines for drawing them.
// The boundaries tier (`@johnmorrisdotca/hoshi-stars/boundaries`): about 7 kB of data gzipped, apart from the constellations table (about 2 kB) and nothing else. Pure: no DOM, no clock, no state beyond the parsed table.
// The boundaries are the IAU's, Delporte (1930) as N. G. Roman (1987, PASP 99, 695) put them into a table on the equator and equinox of B1875.0, so a position is first precessed to B1875.0
// with the rigorous angles of the IAU 1976 system as J. Meeus gives them (Astronomical Algorithms, 2nd ed., chapter 21), then looked up in Roman's table.
import { BOUNDARY_RINGS, BOUNDARY_ROWS } from "./data/boundaries.ts";
import { constellation, constellations, type Constellation } from "./constellations.ts";
import { J2000_MS, moment, type When } from "./when.ts";

/**
 * The boundary of one constellation, as lines to draw.
 *
 * @example
 * ```ts
 * import { boundaryOf, type Boundary } from "@johnmorrisdotca/hoshi-stars/boundaries";
 *
 * const crux: Boundary = boundaryOf("Cru");
 * console.log(crux.constellation.name, crux.outlines.length, crux.outlines[0]!.length);
 * ```
 */
export interface Boundary {
  /** The constellation the boundary encloses. */
  constellation: Constellation;
  /** The closed outlines, each a list of points (degrees, J2000) with the first point repeated as the last. Most constellations have one; Serpens has two, its head and its tail. */
  outlines: Array<Array<{ rightAscension: number; declination: number }>>;
}

const DEGREES = Math.PI / 180;
const ARCSECOND = DEGREES / 3600;
const JULIAN_CENTURY_MS = 36_525 * 86_400_000;
// Julian centuries from J2000.0 to B1875.0, which is JD 2405889.25855 (Meeus chapter 21: JD = 2415020.3135 + 365.242198781 (B - 1900)).
const B1875_CENTURIES = (2405889.25855 - 2451545) / 36_525;

type Matrix = number[];

function multiply(a: Matrix, b: Matrix): Matrix {
  const out: Matrix = [];
  for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) out.push(a[row * 3]! * b[col]! + a[row * 3 + 1]! * b[3 + col]! + a[row * 3 + 2]! * b[6 + col]!);
  return out;
}

/** The rotation that takes a direction on the equator and equinox at one epoch to the equator and equinox at another (both in Julian centuries from J2000.0): Meeus's rigorous precession, IAU 1976. */
function precession(from: number, to: number): Matrix {
  const t = to - from;
  const base = (2306.2181 + 1.39656 * from - 0.000139 * from * from) * t;
  const zeta = (base + (0.30188 - 0.000344 * from) * t * t + 0.017998 * t ** 3) * ARCSECOND;
  const z = (base + (1.09468 + 0.000066 * from) * t * t + 0.018203 * t ** 3) * ARCSECOND;
  const theta = ((2004.3109 - 0.8533 * from - 0.000217 * from * from) * t - (0.42665 + 0.000217 * from) * t * t - 0.041833 * t ** 3) * ARCSECOND;
  const [cz, sz, cd, sd, ct, st] = [Math.cos(zeta), Math.sin(zeta), Math.cos(z), Math.sin(z), Math.cos(theta), Math.sin(theta)] as [number, number, number, number, number, number];
  return multiply([cd, -sd, 0, sd, cd, 0, 0, 0, 1], multiply([ct, 0, -st, 0, 1, 0, st, 0, ct], [cz, -sz, 0, sz, cz, 0, 0, 0, 1]));
}

function rotate(m: Matrix, rightAscension: number, declination: number): [number, number] {
  const ra = rightAscension * DEGREES;
  const dec = declination * DEGREES;
  const cosine = Math.cos(dec);
  const x = cosine * Math.cos(ra);
  const y = cosine * Math.sin(ra);
  const z = Math.sin(dec);
  const nx = m[0]! * x + m[1]! * y + m[2]! * z;
  const ny = m[3]! * x + m[4]! * y + m[5]! * z;
  const nz = m[6]! * x + m[7]! * y + m[8]! * z;
  const angle = Math.atan2(ny, nx) / DEGREES;
  return [angle < 0 ? angle + 360 : angle, Math.asin(Math.max(-1, Math.min(1, nz))) / DEGREES];
}

let lows = new Float64Array(0);
let highs = new Float64Array(0);
let souths = new Float64Array(0);
let owners: Constellation[] = [];
const rings = new Map<string, Array<Array<[number, number]>>>();
let toB1875: Matrix = [];
let fromB1875: Matrix = [];

function load(): void {
  if (owners.length > 0) return;
  const byAbbreviation = new Map(constellations().map((c) => [c.abbreviation, c]));
  const rows = BOUNDARY_ROWS.split("\n");
  lows = new Float64Array(rows.length);
  highs = new Float64Array(rows.length);
  souths = new Float64Array(rows.length);
  const found: Constellation[] = [];
  rows.forEach((row, index) => {
    const [low, high, south, abbreviation] = row.split(" ") as [string, string, string, string];
    lows[index] = Number(low);
    highs[index] = Number(high);
    souths[index] = Number(south);
    found.push(byAbbreviation.get(abbreviation)!);
  });
  for (const line of BOUNDARY_RINGS.split("\n")) {
    const [abbreviation, text] = line.split("|") as [string, string];
    rings.set(
      abbreviation,
      text.split("/").map((ring) => ring.split(" ").map((corner) => corner.split(",").map(Number) as [number, number])),
    );
  }
  toB1875 = precession(0, B1875_CENTURIES);
  fromB1875 = [toB1875[0]!, toB1875[3]!, toB1875[6]!, toB1875[1]!, toB1875[4]!, toB1875[7]!, toB1875[2]!, toB1875[5]!, toB1875[8]!];
  owners = found;
}

/**
 * The constellation a point on the sky is in. The position is precessed to the equator and equinox of B1875.0, where the IAU's boundaries (Delporte 1930) are defined, and looked up in
 * N. G. Roman's table of them (1987, PASP 99, 695). Coordinates are J2000, the frame of this package's stars, unless `when` says the position is of date. The constellations tile the
 * sky, so every point is in exactly one; Serpens is one constellation (`Ser`) although it is in two pieces.
 *
 * A point within a few arc-seconds of a boundary can fall either side of it: Roman's table has the boundaries to a hundredth of a second of time and the precession here is IAU 1976, not the
 * Newcomb-based one of 1930.
 *
 * @param position - `rightAscension` in degrees (any real number, taken modulo 360) and `declination` in degrees, -90 to 90.
 * @param when - The equinox the coordinates are on: a `Date` or milliseconds since 1970 (UTC), for a position of date such as a telescope's. J2000 when left out.
 * @returns The shared, frozen constellation.
 * @throws TypeError if `position` is not an object with numeric `rightAscension` and `declination`, or `when` is not a `Date` or number. RangeError if a coordinate is not finite or the
 * declination is outside -90 to 90, or `when` is not a valid moment.
 *
 * @example
 * ```ts
 * import { starByName } from "@johnmorrisdotca/hoshi-stars";
 * import { constellationAt } from "@johnmorrisdotca/hoshi-stars/boundaries";
 *
 * console.log(constellationAt(starByName("Betelgeuse")!).name);                       // Orion
 * console.log(constellationAt({ rightAscension: 0, declination: 90 }).abbreviation);   // UMi
 * console.log(constellationAt({ rightAscension: 83.8, declination: -5.4 }, Date.UTC(2026, 10, 8)).english);
 * ```
 */
export function constellationAt(position: { rightAscension: number; declination: number }, when?: When): Constellation {
  const { rightAscension, declination } = (position ?? {}) as { rightAscension?: unknown; declination?: unknown };
  if (typeof rightAscension !== "number" || typeof declination !== "number") throw new TypeError("position must be { rightAscension, declination } in degrees");
  if (!Number.isFinite(rightAscension)) throw new RangeError(`rightAscension must be a finite number of degrees, got ${rightAscension}`);
  if (!Number.isFinite(declination) || declination < -90 || declination > 90) throw new RangeError(`declination must be from -90 to 90 degrees, got ${declination}`);
  load();
  const [ra, dec] = rotate(when === undefined ? toB1875 : precession((moment(when) - J2000_MS) / JULIAN_CENTURY_MS, B1875_CENTURIES), rightAscension, declination);
  const hours = (ra / 15) % 24;
  for (let row = 0; row < lows.length; row++) if (dec >= souths[row]! && hours >= lows[row]! && hours < highs[row]!) return owners[row]!;
  throw new RangeError(`no constellation found for ${rightAscension}, ${declination}`);
}

function outline(abbreviation: string, step: number): Boundary["outlines"] {
  return rings.get(abbreviation)!.map((corners) => {
    const points: Array<{ rightAscension: number; declination: number }> = [];
    const add = (hours: number, degrees: number): void => {
      const [rightAscension, declination] = rotate(fromB1875, hours * 15, degrees);
      points.push({ rightAscension, declination });
    };
    corners.forEach(([hours, degrees], index) => {
      const [nextHours, nextDegrees] = corners[(index + 1) % corners.length]!;
      if (hours % 24 === nextHours % 24 && degrees === nextDegrees) return;
      const along = degrees === nextDegrees ? Math.abs(nextHours - hours) * 15 * Math.cos(degrees * DEGREES) : Math.abs(nextDegrees - degrees);
      const pieces = Math.max(1, Math.ceil(along / step));
      for (let piece = 0; piece < pieces; piece++) {
        const part = piece / pieces;
        add(hours + (nextHours - hours) * part, degrees + (nextDegrees - degrees) * part);
      }
    });
    points.push({ ...points[0]! });
    return points;
  });
}

function checkStep(options: { step?: number }): number {
  const step = options?.step ?? 1;
  if (typeof step !== "number") throw new TypeError(`step must be a number of degrees, got ${typeof step}`);
  if (!(step >= 0.01 && step <= 90)) throw new RangeError(`step must be from 0.01 to 90 degrees, got ${step}`);
  return step;
}

/**
 * The boundary of one constellation as closed outlines in J2000 degrees, ready to draw. The edges of the IAU boundaries run along lines of constant right ascension and constant declination
 * on B1875.0; after precession those lines are slightly tilted curves, so each edge is cut into pieces no longer than `step` (1 degree of arc by default, measured along the edge: a
 * parallel of declination is shorter than its span in right ascension by cos(declination)) and every piece end is precessed. Joining the points with straight lines then follows the
 * curve to well under a pixel on a chart a few hundred pixels across. A constellation that holds a celestial pole (Ursa Minor, Octans) has one outline that goes round the pole.
 *
 * A point's `rightAscension` runs from 0 up to 360, so an outline that crosses 0 jumps from near 360 to near 0: project each point, then draw, rather than drawing degrees directly.
 *
 * @param text - The constellation, as the IAU abbreviation (`Ori`) or any other name `constellation` accepts.
 * @param options - `step`: the longest piece of an edge, in degrees from 0.01 to 90 (default 1).
 * @returns A new boundary; its points are new objects each call.
 * @throws TypeError if `text` is not a string or `step` not a number. RangeError if `text` is not one of the 88 constellations or `step` is out of range.
 *
 * @example
 * ```ts
 * import { boundaryOf } from "@johnmorrisdotca/hoshi-stars/boundaries";
 * import { project } from "@johnmorrisdotca/hoshi-stars/projection";
 *
 * const orion = boundaryOf("Orion");
 * const path = orion.outlines[0]!.map((p) => project("stereographic", p, { centre: { rightAscension: 83.8, declination: 0 }, scale: 300 })!);
 * console.log(path.length, "points");
 * ```
 */
export function boundaryOf(text: string, options: { step?: number } = {}): Boundary {
  const found = constellation(text);
  if (found === undefined) throw new RangeError(`"${text}" is not one of the 88 constellations (use the IAU abbreviation such as "Ori")`);
  const step = checkStep(options);
  load();
  return { constellation: found, outlines: outline(found.abbreviation, step) };
}

/**
 * The boundaries of all 88 constellations, alphabetical by Latin name like `constellations()`. Together the outlines tile the sky: each edge is shared by two constellations, and both
 * give the same points along it (to the arc-second the points are the same place).
 *
 * @param options - `step`: the longest piece of an edge, in degrees from 0.01 to 90 (default 1). At 1 degree the whole sky is about 9,000 points.
 * @returns New boundaries.
 * @throws TypeError if `step` is not a number. RangeError if it is out of range.
 *
 * @example
 * ```ts
 * import { boundaries } from "@johnmorrisdotca/hoshi-stars/boundaries";
 *
 * const all = boundaries();
 * console.log(all.length, all.reduce((n, b) => n + b.outlines.reduce((m, o) => m + o.length, 0), 0), "points");
 * ```
 */
export function boundaries(options: { step?: number } = {}): Boundary[] {
  const step = checkStep(options);
  load();
  return constellations().map((found) => ({ constellation: found, outlines: outline(found.abbreviation, step) }));
}
