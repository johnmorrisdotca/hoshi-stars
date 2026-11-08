// The Milky Way as a small brightness grid in galactic coordinates (the milky-way tier, `@johnmorrisdotca/hoshi-stars/milky-way`): about 5 kB of data, made by
// scripts/make-milky-way-data.py from SAO star counts, the IRAS 100 micron dust map and a bulge of our own (see NOTICE.md). Pure: no DOM, no clock, no state beyond the unpacked grid.
import { MILKY_WAY_COLUMNS, MILKY_WAY_LATITUDE, MILKY_WAY_LEVELS, MILKY_WAY_PACKED, MILKY_WAY_ROWS } from "./data/milky-way.ts";
import type { SkyPoint } from "./projection.ts";

export type { SkyPoint };

/**
 * A point in galactic coordinates, in degrees.
 *
 * @example
 * ```ts
 * import type { GalacticPoint } from "@johnmorrisdotca/hoshi-stars/milky-way";
 *
 * const centre: GalacticPoint = { longitude: 0, latitude: 0 };
 * console.log(centre.longitude);
 * ```
 */
export interface GalacticPoint {
  /** Galactic longitude, 0 (toward the Galactic centre in Sagittarius) up to but not including 360. */
  longitude: number;
  /** Galactic latitude, -90 to 90: 0 is the plane of the Milky Way. */
  latitude: number;
}

/**
 * A ribbon of the Milky Way at one brightness level: two chains of sky points of the same length, the upper edge and the lower, each pair at the same galactic longitude. Draw the ribbon as
 * the polygon `upper` forward then `lower` backward. A strip stops where the band splits or ends (a dust lane, the end of a bright patch), so one level is several strips.
 *
 * @example
 * ```ts
 * import { milkyWayBands, type MilkyWayStrip } from "@johnmorrisdotca/hoshi-stars/milky-way";
 *
 * const strip: MilkyWayStrip = milkyWayBands()[0]!.strips[0]!;
 * console.log(strip.upper.length === strip.lower.length);
 * ```
 */
export interface MilkyWayStrip {
  /** The edge toward the galactic north, from low longitude to high. */
  upper: SkyPoint[];
  /** The edge toward the galactic south, at the same longitudes as `upper`. */
  lower: SkyPoint[];
}

/**
 * Everywhere the Milky Way is brighter than one level.
 *
 * @example
 * ```ts
 * import { milkyWayBands, type MilkyWayBand } from "@johnmorrisdotca/hoshi-stars/milky-way";
 *
 * const band: MilkyWayBand = milkyWayBands([0.5])[0]!;
 * console.log(band.level, band.strips.length);
 * ```
 */
export interface MilkyWayBand {
  /** The level, 0 (dark sky) to 1 (the brightest part of the core), as `milkyWayBrightness` gives it. */
  level: number;
  /** The ribbons where the brightness is above the level. */
  strips: MilkyWayStrip[];
}

/**
 * Where to cut the bands, and how finely.
 *
 * @example
 * ```ts
 * import { milkyWayBands, type MilkyWayBandsOptions } from "@johnmorrisdotca/hoshi-stars/milky-way";
 *
 * const options: MilkyWayBandsOptions = { step: 2 };
 * console.log(milkyWayBands([0.3, 0.6], options).length);
 * ```
 */
export interface MilkyWayBandsOptions {
  /** Degrees of galactic longitude between points along a strip; a multiple of the grid's 0.5, default 1. */
  step?: number;
}

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
// The J2000 galactic frame: the north galactic pole's right ascension and declination, and the galactic longitude of the north celestial pole (IAU 1958 as set in ICRS by the Hipparcos catalogue's documentation, 192.85948, 27.12825 and 122.93192 degrees).
const POLE_RA = 192.85948 * RAD;
const POLE_DEC = 27.12825 * RAD;
const POLE_L = 122.93192 * RAD;

const COLUMNS = MILKY_WAY_COLUMNS;
const ROWS = MILKY_WAY_ROWS;
const STEP_L = 360 / COLUMNS;
const STEP_B = (2 * MILKY_WAY_LATITUDE) / ROWS;

let grid: Float32Array | undefined;

function unpack(): Float32Array {
  if (grid === undefined) {
    const text = atob(MILKY_WAY_PACKED);
    const out = new Float32Array(COLUMNS * ROWS);
    let at = 0;
    for (let i = 0; i < text.length; i++) {
      const byte = text.charCodeAt(i);
      const value = (byte >> 3) / MILKY_WAY_LEVELS;
      for (let n = (byte & 7) + 1; n > 0; n--) out[at++] = value;
    }
    grid = out;
  }
  return grid;
}

/**
 * The galactic longitude and latitude of a point of the sky (J2000, the IAU's galactic frame).
 *
 * @param point - A right ascension and declination in degrees.
 * @returns Longitude 0 up to but not including 360, latitude -90 to 90.
 * @throws TypeError if the right ascension or declination is not a finite number.
 *
 * @example
 * ```ts
 * import { toGalactic } from "@johnmorrisdotca/hoshi-stars/milky-way";
 *
 * // Sagittarius A*, the centre of the Galaxy, is at the origin
 * console.log(toGalactic({ rightAscension: 266.4168, declination: -29.0078 })); // about { longitude: 0, latitude: 0 }
 * ```
 */
export function toGalactic(point: SkyPoint): GalacticPoint {
  finite("rightAscension", point?.rightAscension);
  finite("declination", point?.declination);
  const ra = point.rightAscension * RAD;
  const dec = point.declination * RAD;
  const sinB = Math.sin(dec) * Math.sin(POLE_DEC) + Math.cos(dec) * Math.cos(POLE_DEC) * Math.cos(ra - POLE_RA);
  const y = Math.cos(dec) * Math.sin(ra - POLE_RA);
  const x = Math.sin(dec) * Math.cos(POLE_DEC) - Math.cos(dec) * Math.sin(POLE_DEC) * Math.cos(ra - POLE_RA);
  const longitude = (((POLE_L - Math.atan2(y, x)) * DEG) % 360 + 360) % 360;
  return { longitude: longitude >= 360 ? 0 : longitude, latitude: Math.asin(Math.max(-1, Math.min(1, sinB))) * DEG };
}

/**
 * The right ascension and declination (J2000) of a point given in galactic coordinates.
 *
 * @param point - A galactic longitude and latitude in degrees.
 * @returns Right ascension 0 up to but not including 360, declination -90 to 90.
 * @throws TypeError if the longitude or latitude is not a finite number.
 *
 * @example
 * ```ts
 * import { fromGalactic } from "@johnmorrisdotca/hoshi-stars/milky-way";
 *
 * console.log(fromGalactic({ longitude: 0, latitude: 0 })); // about { rightAscension: 266.4, declination: -28.9 }
 * ```
 */
export function fromGalactic(point: GalacticPoint): SkyPoint {
  finite("longitude", point?.longitude);
  finite("latitude", point?.latitude);
  const b = point.latitude * RAD;
  const dl = POLE_L - point.longitude * RAD;
  const sinDec = Math.sin(b) * Math.sin(POLE_DEC) + Math.cos(b) * Math.cos(POLE_DEC) * Math.cos(dl);
  const y = Math.cos(b) * Math.sin(dl);
  const x = Math.sin(b) * Math.cos(POLE_DEC) - Math.cos(b) * Math.sin(POLE_DEC) * Math.cos(dl);
  const rightAscension = ((POLE_RA + Math.atan2(y, x)) * DEG % 360 + 360) % 360;
  return { rightAscension: rightAscension >= 360 ? 0 : rightAscension, declination: Math.asin(Math.max(-1, Math.min(1, sinDec))) * DEG };
}

function finite(name: string, value: unknown): void {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new TypeError(`${name} must be a finite number, got ${String(value)}`);
}

function cell(column: number, row: number): number {
  return unpack()[(((column % COLUMNS) + COLUMNS) % COLUMNS) + Math.max(0, Math.min(ROWS - 1, row)) * COLUMNS]!;
}

function brightnessAt(longitude: number, latitude: number): number {
  if (latitude <= -MILKY_WAY_LATITUDE || latitude >= MILKY_WAY_LATITUDE) return 0;
  const x = longitude / STEP_L - 0.5;
  const y = (latitude + MILKY_WAY_LATITUDE) / STEP_B - 0.5;
  const c = Math.floor(x);
  const r = Math.floor(y);
  const fx = x - c;
  const fy = y - r;
  const top = cell(c, r + 1) * (1 - fx) + cell(c + 1, r + 1) * fx;
  const bottom = cell(c, r) * (1 - fx) + cell(c + 1, r) * fx;
  return bottom * (1 - fy) + top * fy;
}

/**
 * How bright the Milky Way is toward a point, as a display value from 0 (dark sky) to 1 (the brightest part of the core, in Sagittarius). It follows the band along the galactic equator, is brightest
 * toward the Galactic centre, and is dimmer where the dust lanes cross it (the Great Rift, the Coalsack, the Cygnus Rift). The grid is 0.5 degrees on a side near the plane and holds thirty-two levels, so
 * it is a smooth map for shading a chart or a texture, not a measurement; beyond 30 degrees of the plane it is 0. The values are already shaped for the eye (a gamma of about 0.45), so use them as a pixel's
 * brightness directly.
 *
 * @param point - A right ascension and declination in degrees (J2000).
 * @returns A number from 0 to 1.
 * @throws TypeError if the right ascension or declination is not a finite number.
 *
 * @example
 * ```ts
 * import { milkyWayBrightness } from "@johnmorrisdotca/hoshi-stars/milky-way";
 *
 * const sagittarius = milkyWayBrightness({ rightAscension: 266.4, declination: -28.9 });
 * const pole = milkyWayBrightness({ rightAscension: 192.9, declination: 27.1 });
 * console.log(sagittarius > pole); // true
 * ```
 */
export function milkyWayBrightness(point: SkyPoint): number {
  const g = toGalactic(point);
  return brightnessAt(g.longitude, g.latitude);
}

interface Span {
  low: number;
  high: number;
}

/** The latitudes where one column of the grid is above a level, as spans, with the crossing between two rows found by a straight line. */
function spans(column: number, level: number): Span[] {
  const out: Span[] = [];
  let start: number | undefined;
  const latitude = (row: number): number => -MILKY_WAY_LATITUDE + (row + 0.5) * STEP_B;
  for (let row = 0; row < ROWS; row++) {
    const v = cell(column, row);
    const above = v > level;
    if (above && start === undefined) {
      if (row === 0) start = -MILKY_WAY_LATITUDE;
      else {
        const u = cell(column, row - 1);
        start = latitude(row - 1) + ((level - u) / (v - u)) * STEP_B;
      }
    } else if (!above && start !== undefined) {
      const u = cell(column, row - 1);
      out.push({ low: start, high: latitude(row - 1) + ((u - level) / (u - v)) * STEP_B });
      start = undefined;
    }
  }
  if (start !== undefined) out.push({ low: start, high: MILKY_WAY_LATITUDE });
  return out;
}

const overlaps = (a: Span, b: Span): boolean => a.low < b.high && b.low < a.high;

/**
 * The Milky Way cut at some brightness levels, as ribbons of sky points for drawing soft bands (a polygon per strip, filled with a low opacity so the levels build up). Each strip runs along
 * the galactic equator; a dust lane that splits the band ends the strips on either side of it, so the lane shows as a gap. The points are in right ascension and declination, ready for
 * `project` from `@johnmorrisdotca/hoshi-stars/projection`; a strip crossing a map's seam or the far side is the caller's to cut (compare the longitudes of neighbouring points).
 *
 * @param levels - Levels from 0 to 1, as `milkyWayBrightness` measures them. Default `[0.2, 0.42, 0.68]`: the glow, the band and the core. Each must be a number above 0 and below 1.
 * @param options - `step`: degrees of longitude between points along a strip (a multiple of 0.5, default 1).
 * @returns One band per level, in the order given.
 * @throws RangeError if a level is not between 0 and 1 (exclusive) or `step` is not a positive multiple of 0.5. TypeError if a level is not a number.
 *
 * @example
 * ```ts
 * import { milkyWayBands } from "@johnmorrisdotca/hoshi-stars/milky-way";
 * import { project } from "@johnmorrisdotca/hoshi-stars/projection";
 *
 * for (const band of milkyWayBands()) {
 *   for (const strip of band.strips) {
 *     const polygon = [...strip.upper, ...strip.lower.slice().reverse()].map((p) => project("hammer", p, { centre: { rightAscension: 0, declination: 0 } }));
 *     console.log(band.level, polygon.length);
 *   }
 * }
 * ```
 */
export function milkyWayBands(levels: readonly number[] = [0.2, 0.42, 0.68], options: MilkyWayBandsOptions = {}): MilkyWayBand[] {
  const step = options.step ?? 1;
  if (typeof step !== "number" || !(step >= STEP_L) || Math.abs(step / STEP_L - Math.round(step / STEP_L)) > 1e-9) throw new RangeError(`step must be a positive multiple of ${STEP_L}, got ${String(step)}`);
  const stride = Math.round(step / STEP_L);
  for (const level of levels) {
    finite("level", level);
    if (!(level > 0 && level < 1)) throw new RangeError(`a level must be above 0 and below 1, got ${level}`);
  }
  return levels.map((level) => ({ level, strips: stripsAt(level, stride) }));
}

function stripsAt(level: number, stride: number): MilkyWayStrip[] {
  const count = COLUMNS / stride;
  const longitude = (k: number): number => (k * stride + 0.5) * STEP_L;
  // columns 0 to count: the last is the first again, so that the band is cut once, at longitude 0
  const columns = Array.from({ length: count + 1 }, (_, k) => spans((k % count) * stride, level));
  const forward = columns.map((c, k) => c.map((a) => (k < count ? columns[k + 1]!.flatMap((b, i) => (overlaps(a, b) ? [i] : [])) : [])));
  const backward = columns.map((c, k) => c.map((b) => (k > 0 ? columns[k - 1]!.flatMap((a, i) => (overlaps(a, b) ? [i] : [])) : [])));
  const joined = (k: number, a: number): number | undefined => {
    const next = forward[k]![a]!;
    return next.length === 1 && backward[k + 1]![next[0]!]!.length === 1 ? next[0] : undefined;
  };
  const strips: MilkyWayStrip[] = [];
  const make = (members: Array<[number, Span]>, pinchStart: boolean, pinchEnd: boolean): void => {
    const upper: SkyPoint[] = [];
    const lower: SkyPoint[] = [];
    const half = (stride * STEP_L) / 2;
    const first = members[0]!;
    const last = members[members.length - 1]!;
    const mid = (s: Span): number => (s.low + s.high) / 2;
    if (pinchStart) {
      const p = fromGalactic({ longitude: longitude(first[0]) - half, latitude: mid(first[1]) });
      upper.push(p);
      lower.push(p);
    }
    for (const [k, s] of members) {
      upper.push(fromGalactic({ longitude: longitude(k), latitude: s.high }));
      lower.push(fromGalactic({ longitude: longitude(k), latitude: s.low }));
    }
    if (pinchEnd) {
      const p = fromGalactic({ longitude: longitude(last[0]) + half, latitude: mid(last[1]) });
      upper.push(p);
      lower.push(p);
    }
    strips.push({ upper, lower });
  };
  for (let k = 0; k <= count; k++) {
    for (let a = 0; a < columns[k]!.length; a++) {
      const before = backward[k]![a]!;
      if (k > 0 && before.length === 1 && joined(k - 1, before[0]!) === a) continue;
      const members: Array<[number, Span]> = [[k, columns[k]![a]!]];
      let ci = k;
      let ai = a;
      for (let next = joined(ci, ai); next !== undefined; next = joined(ci, ai)) {
        ci += 1;
        ai = next;
        members.push([ci, columns[ci]![ai]!]);
      }
      make(members, k > 0 && before.length === 0, ci < count && forward[ci]![ai]!.length === 0);
      // where the band branches or merges, the pairs that are not joined get a strip of their own
      for (const d of forward[ci]![ai]!) if (joined(ci, ai) !== d) make([[ci, columns[ci]![ai]!], [ci + 1, columns[ci + 1]![d]!]], false, false);
    }
  }
  return strips;
}
