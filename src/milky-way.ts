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
 * @param options - `detail`: 0 (the default) reads the grid in straight lines; above 0, up to 2, it is read sharper (see `MilkyWayDetailOptions`).
 * @returns A number from 0 to 1.
 * @throws TypeError if the right ascension, declination or detail is not a finite number. RangeError if `detail` is outside 0 to 2.
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
export function milkyWayBrightness(point: SkyPoint, options: MilkyWayDetailOptions = {}): number {
  const detail = detailOf(options.detail, 0);
  const g = toGalactic(point);
  return detail === 0 ? brightnessAt(g.longitude, g.latitude) : sharpAt(g.longitude, g.latitude, detail);
}

/**
 * How sharply to read the grid between its points.
 *
 * @example
 * ```ts
 * import { milkyWayBrightness, type MilkyWayDetailOptions } from "@johnmorrisdotca/hoshi-stars/milky-way";
 *
 * const options: MilkyWayDetailOptions = { detail: 1 };
 * console.log(milkyWayBrightness({ rightAscension: 190, declination: -63 }, options)); // the Coalsack, darker than with detail 0
 * ```
 */
export interface MilkyWayDetailOptions {
  /**
   * 0 reads the grid in straight lines between its points (the default for `milkyWayBrightness`). Above 0 the grid is read along smooth curves and each value is pushed away from the mean of the
   * degree or two round it, by this much: the dust lanes come out narrower and darker and the star clouds beside them brighter, the way the eye sees them. It sharpens what the grid holds and adds
   * no detail of its own (no noise, nothing made up). From 0 to 2; 1 is the default for `milkyWayTexture`.
   */
  detail?: number;
}

function detailOf(value: unknown, fallback: number): number {
  if (value === undefined) return fallback;
  finite("detail", value);
  const v = value as number;
  if (v < 0 || v > 2) throw new RangeError(`detail must be from 0 to 2, got ${v}`);
  return v;
}

const smoothed = new Map<number, Float32Array>();

// The grid smoothed with a Gaussian of `sigma` cells each way (a cell is 1 degree of longitude by 0.5 of latitude), kept: 0.7 cells takes the steps of the 32 levels out, so that sharpening does not
// draw them as contours, and 2 cells is the mean round each point that the detail pushes away from.
function blur(sigma: number): Float32Array {
  const kept = smoothed.get(sigma);
  if (kept !== undefined) return kept;
  const source = unpack();
  const reach = Math.ceil(sigma * 3);
  const weights = Array.from({ length: 2 * reach + 1 }, (_, i) => Math.exp(-((i - reach) ** 2) / (2 * sigma * sigma)));
  const total = weights.reduce((a, b) => a + b, 0);
  const across = new Float32Array(COLUMNS * ROWS);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLUMNS; c++) {
      let sum = 0;
      for (let i = -reach; i <= reach; i++) sum += weights[i + reach]! * source[(((c + i) % COLUMNS) + COLUMNS) % COLUMNS + r * COLUMNS]!;
      across[c + r * COLUMNS] = sum / total;
    }
  }
  const out = new Float32Array(COLUMNS * ROWS);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLUMNS; c++) {
      let sum = 0;
      for (let i = -reach; i <= reach; i++) sum += weights[i + reach]! * across[c + Math.max(0, Math.min(ROWS - 1, r + i)) * COLUMNS]!;
      out[c + r * COLUMNS] = sum / total;
    }
  }
  smoothed.set(sigma, out);
  return out;
}

// Catmull-Rom weights for the four points round a fraction t of the way between the middle two.
function curve(t: number, out: Float64Array): void {
  const t2 = t * t;
  const t3 = t2 * t;
  out[0] = (-t3 + 2 * t2 - t) / 2;
  out[1] = (3 * t3 - 5 * t2 + 2) / 2;
  out[2] = (-3 * t3 + 4 * t2 + t) / 2;
  out[3] = (t3 - t2) / 2;
}

const WX = new Float64Array(4);
const WY = new Float64Array(4);

function sharpAt(longitude: number, latitude: number, detail: number): number {
  if (latitude <= -MILKY_WAY_LATITUDE || latitude >= MILKY_WAY_LATITUDE) return 0;
  const source = blur(0.7);
  const mean = blur(2);
  const x = longitude / STEP_L - 0.5;
  const y = (latitude + MILKY_WAY_LATITUDE) / STEP_B - 0.5;
  const c = Math.floor(x);
  const r = Math.floor(y);
  curve(x - c, WX);
  curve(y - r, WY);
  let sum = 0;
  for (let j = 0; j < 4; j++) {
    const row = Math.max(0, Math.min(ROWS - 1, r - 1 + j)) * COLUMNS;
    let line = 0;
    for (let i = 0; i < 4; i++) {
      const at = ((((c - 1 + i) % COLUMNS) + COLUMNS) % COLUMNS) + row;
      const v = source[at]!;
      line += WX[i]! * (v + detail * (v - mean[at]!));
    }
    sum += WY[j]! * line;
  }
  return Math.max(0, Math.min(1, sum));
}

/**
 * One stop of a colour ramp: at a brightness level, a colour and an opacity. Between stops the colour runs in a straight line.
 *
 * @example
 * ```ts
 * import type { MilkyWayRampStop } from "@johnmorrisdotca/hoshi-stars/milky-way";
 *
 * const core: MilkyWayRampStop = { level: 1, red: 255, green: 243, blue: 216, alpha: 0.88 };
 * console.log(core.level);
 * ```
 */
export interface MilkyWayRampStop {
  /** The brightness, 0 to 1, as `milkyWayBrightness` gives it. */
  level: number;
  /** Red, green and blue, 0 to 255. */
  red: number;
  green: number;
  blue: number;
  /** Opacity, 0 (clear) to 1. */
  alpha: number;
}

/**
 * The package's ramp for a night sky: clear where there is no Milky Way, a faint blue glow, a grey-white band and a warm core, with the opacity rising with the brightness so that the texture can be
 * laid over a dark sky as it is. Made for this package (no photograph's colours were read).
 *
 * @example
 * ```ts
 * import { MILKY_WAY_NIGHT_RAMP } from "@johnmorrisdotca/hoshi-stars/milky-way";
 *
 * console.log(MILKY_WAY_NIGHT_RAMP.length, MILKY_WAY_NIGHT_RAMP[0]!.alpha); // 6 0
 * ```
 */
export const MILKY_WAY_NIGHT_RAMP: readonly MilkyWayRampStop[] = Object.freeze(
  (
    [
      [0, 0, 0, 0, 0],
      [0.08, 106, 128, 200, 0.1],
      [0.2, 122, 144, 210, 0.24],
      [0.4, 166, 182, 230, 0.4],
      [0.65, 232, 228, 232, 0.58],
      [1, 255, 243, 216, 0.88],
    ] as const
  ).map(([level, red, green, blue, alpha]) => Object.freeze({ level, red, green, blue, alpha })),
);

/**
 * What texture to paint.
 *
 * @example
 * ```ts
 * import { milkyWayTexture, type MilkyWayTextureOptions } from "@johnmorrisdotca/hoshi-stars/milky-way";
 *
 * const options: MilkyWayTextureOptions = { width: 1024, frame: "galactic", detail: 1.5 };
 * console.log(milkyWayTexture(options).height); // 512
 * ```
 */
export interface MilkyWayTextureOptions extends MilkyWayDetailOptions {
  /** Pixels across: an even whole number from 16 to 4096 (the family's largest texture side), default 2048. The height is half of it. */
  width?: number;
  /**
   * `equatorial` (the default): across is right ascension, 0 at the left edge rising to 360 at the right, and down is declination, +90 at the top to -90 at the bottom, the way a sky sphere in
   * equatorial coordinates is mapped. `galactic`: across is galactic longitude and down galactic latitude, the same way round, with the Galactic centre at the left edge.
   */
  frame?: "equatorial" | "galactic";
  /** The colours, at least two stops in rising order of level, the first at 0 and the last at 1. Default `MILKY_WAY_NIGHT_RAMP`. */
  ramp?: readonly MilkyWayRampStop[];
}

/**
 * A painted Milky Way texture.
 *
 * @example
 * ```ts
 * import { milkyWayTexture, type MilkyWayTexturePixels } from "@johnmorrisdotca/hoshi-stars/milky-way";
 *
 * const texture: MilkyWayTexturePixels = milkyWayTexture({ width: 256 });
 * console.log(texture.data.length === texture.width * texture.height * 4); // true
 * ```
 */
export interface MilkyWayTexturePixels {
  width: number;
  height: number;
  /** Red, green, blue and opacity for each pixel, row by row from the top, as `ImageData` and a WebGL texture take them. The colour is not multiplied by the opacity. */
  data: Uint8ClampedArray;
}

function rampOf(ramp: readonly MilkyWayRampStop[]): readonly MilkyWayRampStop[] {
  if (!Array.isArray(ramp) || ramp.length < 2) throw new RangeError("ramp must have at least two stops");
  let last = -Infinity;
  for (const stop of ramp) {
    for (const key of ["level", "red", "green", "blue", "alpha"] as const) finite(`ramp ${key}`, stop?.[key]);
    if (!(stop.level > last)) throw new RangeError("ramp levels must rise");
    last = stop.level;
  }
  if (ramp[0]!.level !== 0 || ramp[ramp.length - 1]!.level !== 1) throw new RangeError("ramp must run from level 0 to level 1");
  return ramp;
}

/**
 * The Milky Way painted as a texture for a WebGL sky (or a canvas): a picture twice as wide as it is high covering the whole sky, coloured from the brightness grid by a ramp. It is read with
 * `detail` (1 by default, see `MilkyWayDetailOptions`), so the dust lanes (the Great Rift, the Coalsack, the Cygnus Rift) are sharper than the plain grid gives them. Made from the package's
 * numbers alone: no photograph is read. Pure: it returns new pixels and keeps nothing but the grid it unpacks once.
 *
 * Seen from inside a sphere, the sky runs the other way round from a map: give a sphere this texture with its across direction flipped (in three.js, `texture.wrapS = RepeatWrapping` and
 * `texture.repeat.x = -1`), or turn the sphere inside out by scaling it by -1 across.
 *
 * @param options - `width` (default 2048), `frame` (`equatorial`, the default, or `galactic`), `detail` (0 to 2, default 1) and `ramp` (default `MILKY_WAY_NIGHT_RAMP`).
 * @returns The pixels.
 * @throws RangeError if `width` is not an even whole number from 16 to 4096, `detail` is outside 0 to 2, `frame` is unknown or `ramp` does not run from level 0 to 1 in rising order. TypeError if a number is not finite.
 *
 * @example
 * ```ts
 * import { milkyWayTexture } from "@johnmorrisdotca/hoshi-stars/milky-way";
 *
 * const { width, height, data } = milkyWayTexture({ width: 2048 });
 * // a canvas: context.putImageData(new ImageData(data, width, height), 0, 0)
 * // three.js: new DataTexture(data, width, height) with flipY true, colorSpace SRGBColorSpace and needsUpdate true
 * console.log(width, height); // 2048 1024
 * ```
 */
export function milkyWayTexture(options: MilkyWayTextureOptions = {}): MilkyWayTexturePixels {
  const width = options.width ?? 2048;
  if (typeof width !== "number" || !Number.isInteger(width) || width < 16 || width > 4096 || width % 2 !== 0) throw new RangeError(`width must be an even whole number from 16 to 4096, got ${String(width)}`);
  const frame = options.frame ?? "equatorial";
  if (frame !== "equatorial" && frame !== "galactic") throw new RangeError(`frame must be "equatorial" or "galactic", got ${String(frame)}`);
  const detail = detailOf(options.detail, 1);
  const ramp = rampOf(options.ramp ?? MILKY_WAY_NIGHT_RAMP);
  const height = width / 2;
  // the ramp as a table of 1,024 steps, so that each pixel is one lookup
  const STEPS = 1024;
  const table = new Uint8ClampedArray((STEPS + 1) * 4);
  for (let s = 0, k = 1; s <= STEPS; s++) {
    const level = s / STEPS;
    while (k < ramp.length - 1 && level > ramp[k]!.level) k += 1;
    const a = ramp[k - 1]!;
    const z = ramp[k]!;
    const t = Math.max(0, Math.min(1, (level - a.level) / (z.level - a.level)));
    table[s * 4] = a.red + (z.red - a.red) * t;
    table[s * 4 + 1] = a.green + (z.green - a.green) * t;
    table[s * 4 + 2] = a.blue + (z.blue - a.blue) * t;
    table[s * 4 + 3] = (a.alpha + (z.alpha - a.alpha) * t) * 255;
  }
  const data = new Uint8ClampedArray(width * height * 4);
  const sinPole = Math.sin(POLE_DEC);
  const cosPole = Math.cos(POLE_DEC);
  const cosRa = new Float64Array(width);
  const sinRa = new Float64Array(width);
  for (let x = 0; x < width; x++) {
    const ra = ((x + 0.5) / width) * 2 * Math.PI - POLE_RA;
    cosRa[x] = Math.cos(ra);
    sinRa[x] = Math.sin(ra);
  }
  for (let y = 0; y < height; y++) {
    const up = 90 - ((y + 0.5) / height) * 180;
    const sinDec = Math.sin(up * RAD);
    const cosDec = Math.cos(up * RAD);
    for (let x = 0; x < width; x++) {
      let longitude: number;
      let latitude: number;
      if (frame === "galactic") {
        longitude = ((x + 0.5) / width) * 360;
        latitude = up;
      } else {
        latitude = Math.asin(Math.max(-1, Math.min(1, sinDec * sinPole + cosDec * cosPole * cosRa[x]!))) * DEG;
        const across = cosDec * sinRa[x]!;
        const along = sinDec * cosPole - cosDec * sinPole * cosRa[x]!;
        longitude = ((((POLE_L - Math.atan2(across, along)) * DEG) % 360) + 360) % 360;
      }
      const b = detail === 0 ? brightnessAt(longitude, latitude) : sharpAt(longitude, latitude, detail);
      const s = Math.round(b * STEPS) * 4;
      const at = (y * width + x) * 4;
      data[at] = table[s]!;
      data[at + 1] = table[s + 1]!;
      data[at + 2] = table[s + 2]!;
      data[at + 3] = table[s + 3]!;
    }
  }
  return { width, height, data };
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
