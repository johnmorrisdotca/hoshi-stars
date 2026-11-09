// The faint stars: about three million of UCAC4's, to magnitude 12, in sky tiles of a few thousand stars each that a page loads for the part of the sky it shows.
// The faint tier (`@johnmorrisdotca/hoshi-stars/faint`): none of it is in the main bundle, and the tiles are files, not code (a tile is 6 bytes a star, see `decodeFaintTile`). Pure: no DOM, no clock, no state beyond what a caller hands in;
// fetching the tiles is `faintSky`'s job (`./faint-load.ts`), which takes the `fetch` to use.
// The data is NOT Hipparcos, Tycho or Gaia: NOTICE.md says which rows of UCAC4 are left out and why.

/**
 * The faintest magnitude in the tiles.
 *
 * @example
 * ```ts
 * import { FAINT_LIMIT } from "@johnmorrisdotca/hoshi-stars/faint";
 *
 * console.log(FAINT_LIMIT); // 12
 * ```
 */
export const FAINT_LIMIT = 12;

/**
 * The tile levels, brightest first. A star lies in the first level whose `faintest` it does not pass, so level 0 holds everything to magnitude 10, level 1 the stars from 10 to 11 and level 2 those from 11 to 12.
 * A level's tiles are bands of declination `bandDegrees` high, each cut into as many tiles along right ascension as keep a tile about as wide as it is tall at the edge of the band nearer the equator.
 *
 * @example
 * ```ts
 * import { FAINT_LEVELS } from "@johnmorrisdotca/hoshi-stars/faint";
 *
 * console.log(FAINT_LEVELS.map((level) => level.faintest)); // [10, 11, 12]
 * ```
 */
export const FAINT_LEVELS: ReadonlyArray<{ readonly faintest: number; readonly bandDegrees: number }> = [
  { faintest: 10, bandDegrees: 10 },
  { faintest: 11, bandDegrees: 6 },
  { faintest: 12, bandDegrees: 5 },
];

/** Magnitude is stored as `round(V * 20)`. */
const MAGNITUDE_STEP = 20;
/** Colour is stored as `round((B-V + 0.6) * 80)` from 0 to 254, and 255 for none. */
const COLOUR_OFFSET = 0.6;
const COLOUR_STEP = 80;
const NO_COLOUR = 255;
/** A position inside a tile is a whole number from 0 to this, across the tile. */
const FULL = 65535;
const RADIANS = Math.PI / 180;

/**
 * A tile: its level, its band of declination (0 at the south pole) and its column along the band (0 at right ascension 0).
 *
 * @example
 * ```ts
 * import { faintTileBounds, type FaintTileId } from "@johnmorrisdotca/hoshi-stars/faint";
 *
 * const tile: FaintTileId = { level: 2, band: 17, column: 12 };
 * console.log(faintTileBounds(tile));
 * ```
 */
export interface FaintTileId {
  level: number;
  band: number;
  column: number;
}

/**
 * A round patch of sky, in degrees: its middle and its radius.
 *
 * @example
 * ```ts
 * import type { FaintField } from "@johnmorrisdotca/hoshi-stars/faint";
 *
 * const orion: FaintField = { rightAscension: 83.8, declination: -5.4, radius: 3 };
 * console.log(orion.radius);
 * ```
 */
export interface FaintField {
  rightAscension: number;
  declination: number;
  radius: number;
}

/**
 * One faint star.
 *
 * @example
 * ```ts
 * import type { FaintStar } from "@johnmorrisdotca/hoshi-stars/faint";
 *
 * const show = (star: FaintStar): string => `${star.magnitude.toFixed(2)} at ${star.rightAscension.toFixed(4)}, ${star.declination.toFixed(4)}`;
 * console.log(show({ rightAscension: 83.8, declination: -5.4, magnitude: 11.2, colourIndex: 0.7 }));
 * ```
 */
export interface FaintStar {
  /** Right ascension in degrees at J2000 (the ICRS), 0 up to 360, good to a fraction of an arc-second. */
  rightAscension: number;
  /** Declination in degrees at J2000, -90 to 90. */
  declination: number;
  /** The magnitude to 0.05: APASS DR10's V for a bright star it holds (V 7.0 to 10.2, south of declination +20.0), else APASS V as UCAC4 carries it where it is APASS's own, else UCAC4's own model magnitude (between V and R). Smaller is brighter. */
  magnitude: number;
  /** B-V in magnitudes from APASS, to 0.0125, or `undefined` where UCAC4 has no APASS B and V for the star (about one star in ten). */
  colourIndex: number | undefined;
}

/**
 * A tile, decoded: the stars of one tile as parallel arrays, sorted by declination. `magnitude` is in magnitudes, and `colourIndex` is `NaN` where there is none.
 *
 * @example
 * ```ts
 * import { decodeFaintTile } from "@johnmorrisdotca/hoshi-stars/faint";
 *
 * const tile = decodeFaintTile({ level: 0, band: 9, column: 0 }, new Uint8Array(0));
 * console.log(tile.count); // 0
 * ```
 */
export interface FaintTile {
  id: FaintTileId;
  count: number;
  rightAscension: Float64Array;
  declination: Float64Array;
  magnitude: Float64Array;
  colourIndex: Float64Array;
}

/** How many tiles lie along a band: as many as keep a tile about as wide as it is tall at the band's edge nearer the equator (the same rule as scripts/make-faint-data.py). */
function columnsOf(bandDegrees: number, band: number): number {
  const low = -90 + band * bandDegrees;
  const high = low + bandDegrees;
  const nearer = low < 0 && 0 < high ? 0 : Math.min(Math.abs(low), Math.abs(high));
  return Math.max(1, Math.floor((360 * Math.cos(nearer * RADIANS)) / bandDegrees + 1e-9));
}

/**
 * How many bands and how many tiles a level has.
 *
 * @param level - The level, 0 to 2.
 * @returns The number of bands and the number of tiles in each, band by band from the south pole.
 *
 * @example
 * ```ts
 * import { faintGrid } from "@johnmorrisdotca/hoshi-stars/faint";
 *
 * const grid = faintGrid(0);
 * console.log(grid.columns.length, grid.columns[9]); // 18 bands, 36 tiles in the one on the equator side
 * ```
 */
export function faintGrid(level: number): { bands: number; columns: number[] } {
  const height = FAINT_LEVELS[level]?.bandDegrees;
  if (height === undefined) throw new RangeError(`There is no faint level ${level}`);
  const bands = 180 / height;
  return { bands, columns: Array.from({ length: bands }, (_, band) => columnsOf(height, band)) };
}

/**
 * The sky a tile covers: right ascension and declination from and to, in degrees.
 *
 * @param tile - The tile.
 * @returns Its edges.
 *
 * @example
 * ```ts
 * import { faintTileBounds } from "@johnmorrisdotca/hoshi-stars/faint";
 *
 * console.log(faintTileBounds({ level: 0, band: 9, column: 0 })); // { raFrom: 0, raTo: 10, decFrom: 0, decTo: 10 }
 * ```
 */
export function faintTileBounds(tile: FaintTileId): { raFrom: number; raTo: number; decFrom: number; decTo: number } {
  const height = FAINT_LEVELS[tile.level]?.bandDegrees;
  if (height === undefined) throw new RangeError(`There is no faint level ${tile.level}`);
  const width = 360 / columnsOf(height, tile.band);
  return { raFrom: tile.column * width, raTo: (tile.column + 1) * width, decFrom: -90 + tile.band * height, decTo: -90 + (tile.band + 1) * height };
}

/**
 * Where a tile's file is, under the folder that holds the tiles: `L2/17-12.bin`.
 *
 * @param tile - The tile.
 * @returns The path, with forward slashes.
 *
 * @example
 * ```ts
 * import { faintTilePath } from "@johnmorrisdotca/hoshi-stars/faint";
 *
 * console.log(faintTilePath({ level: 2, band: 17, column: 12 })); // L2/17-12.bin
 * ```
 */
export const faintTilePath = (tile: FaintTileId): string => `L${tile.level}/${tile.band}-${tile.column}.bin`;

/** The right ascension (degrees either side of the cone's middle) that a cone reaches at declination `dec`, or `undefined` where it does not reach, or 180 where it reaches all the way round. */
function reachAt(centreDec: number, radius: number, dec: number): number | undefined {
  const argument = (Math.cos(radius * RADIANS) - Math.sin(centreDec * RADIANS) * Math.sin(dec * RADIANS)) / (Math.cos(centreDec * RADIANS) * Math.cos(dec * RADIANS));
  if (!(argument <= 1)) return undefined;
  if (argument <= -1 || Number.isNaN(argument)) return 180;
  return Math.acos(argument) / RADIANS;
}

/**
 * The tiles that cover a round patch of sky, for stars to a magnitude: every tile of the levels that hold stars that bright whose rectangle the patch may touch. A tile it only comes near is included; a tile it misses is not, by more than a rounding.
 *
 * @param field - The patch: its middle and radius in degrees.
 * @param limit - The faintest magnitude wanted; 12 where left out. Level 0 holds the stars to 10, level 1 those to 11.
 * @returns The tiles, brightest level first.
 *
 * @example
 * ```ts
 * import { faintTilePath, faintTilesFor } from "@johnmorrisdotca/hoshi-stars/faint";
 *
 * const orion = { rightAscension: 83.8, declination: -5.4, radius: 2 };
 * console.log(faintTilesFor(orion, 12).map(faintTilePath));
 * ```
 */
export function faintTilesFor(field: FaintField, limit: number = FAINT_LIMIT): FaintTileId[] {
  const tiles: FaintTileId[] = [];
  const radius = Math.min(180, Math.max(0, field.radius));
  const decLow = Math.max(-90, field.declination - radius);
  const decHigh = Math.min(90, field.declination + radius);
  const centreRa = ((field.rightAscension % 360) + 360) % 360;
  // the declination at which the patch is widest, where it is on the sphere
  const widest = Math.asin(Math.max(-1, Math.min(1, Math.sin(field.declination * RADIANS) / Math.cos(Math.min(89.999, radius) * RADIANS)))) / RADIANS;
  for (let level = 0; level < FAINT_LEVELS.length; level++) {
    const { faintest, bandDegrees } = FAINT_LEVELS[level]!;
    const previous = level === 0 ? -Infinity : FAINT_LEVELS[level - 1]!.faintest;
    if (limit <= previous) break;
    const grid = faintGrid(level);
    for (let band = 0; band < grid.bands; band++) {
      const from = -90 + band * bandDegrees;
      const to = from + bandDegrees;
      if (to < decLow || from > decHigh) continue;
      const columns = grid.columns[band]!;
      const width = 360 / columns;
      // the most right ascension the patch has inside this band: at its edges, and at its widest declination if that is in the band
      let reach: number | undefined;
      for (const dec of [Math.max(from, decLow), Math.min(to, decHigh), widest]) {
        if (dec < Math.max(from, decLow) || dec > Math.min(to, decHigh)) continue;
        const r = reachAt(field.declination, radius, dec);
        if (r !== undefined && (reach === undefined || r > reach)) reach = r;
      }
      if (reach === undefined) continue;
      if (reach >= 180 || radius >= 90 - Math.abs(field.declination)) {
        for (let column = 0; column < columns; column++) tiles.push({ level, band, column });
        continue;
      }
      const first = Math.floor((centreRa - reach) / width);
      const last = Math.floor((centreRa + reach) / width);
      const seen = new Set<number>();
      for (let c = first; c <= last; c++) {
        const column = ((c % columns) + columns) % columns;
        if (seen.has(column)) continue;
        seen.add(column);
        tiles.push({ level, band, column });
      }
    }
    if (limit <= faintest) break;
  }
  return tiles;
}

/**
 * Decode a tile file: `n` stars as six planes of `n` bytes (the step in declination, low and high byte; right ascension, low and high; magnitude; colour), the stars sorted by declination; `n` is the length over six.
 *
 * @param tile - The tile the bytes are of.
 * @param bytes - The file's bytes.
 * @returns The stars as parallel arrays.
 *
 * @example
 * ```ts no-run
 * import { decodeFaintTile } from "@johnmorrisdotca/hoshi-stars/faint";
 *
 * const response = await fetch("https://johnmorrisdotca.github.io/hoshi-stars/faint-tiles/L2/17-12.bin");
 * const tile = decodeFaintTile({ level: 2, band: 17, column: 12 }, new Uint8Array(await response.arrayBuffer()));
 * console.log(tile.count, tile.magnitude[0]);
 * ```
 */
export function decodeFaintTile(tile: FaintTileId, bytes: Uint8Array): FaintTile {
  if (bytes.length % 6 !== 0) throw new RangeError(`A faint tile's length is a multiple of 6, not ${bytes.length}`);
  const count = bytes.length / 6;
  const { raFrom, raTo, decFrom, decTo } = faintTileBounds(tile);
  const rightAscension = new Float64Array(count);
  const declination = new Float64Array(count);
  const magnitude = new Float64Array(count);
  const colourIndex = new Float64Array(count);
  let y = 0;
  for (let i = 0; i < count; i++) {
    y += bytes[i]! | (bytes[count + i]! << 8);
    const x = bytes[2 * count + i]! | (bytes[3 * count + i]! << 8);
    declination[i] = decFrom + (y / FULL) * (decTo - decFrom);
    rightAscension[i] = raFrom + (x / FULL) * (raTo - raFrom);
    magnitude[i] = bytes[4 * count + i]! / MAGNITUDE_STEP;
    const c = bytes[5 * count + i]!;
    colourIndex[i] = c === NO_COLOUR ? NaN : Math.round((c / COLOUR_STEP - COLOUR_OFFSET) * 1e4) / 1e4;
  }
  return { id: tile, count, rightAscension, declination, magnitude, colourIndex };
}

/** The angle between two points of the sky, degrees, as the cosine of it: a cheap test against `cos(radius)`. */
function cosineBetween(ra1: number, sinDec1: number, cosDec1: number, ra2: number, dec2: number): number {
  const dec = dec2 * RADIANS;
  return sinDec1 * Math.sin(dec) + cosDec1 * Math.cos(dec) * Math.cos((ra2 - ra1) * RADIANS);
}

/**
 * The stars of some decoded tiles that lie in a round patch of sky and are as bright as a limit, brightest first. With `max`, the brightest `max` of them: the list is then complete only to `depth`, which is the magnitude the list is cut at.
 *
 * @param tiles - Decoded tiles, from `decodeFaintTile` (any more than the field needs is fine).
 * @param field - The patch.
 * @param limit - The faintest magnitude wanted; 12 where left out.
 * @param max - The most stars to return; all of them where left out.
 * @returns The stars, and `depth`: the faintest magnitude the list holds all the stars of: `limit` when nothing was cut, else the magnitude of the cut (stars a step fainter are left out).
 *
 * @example
 * ```ts
 * import { faintStarsIn, type FaintTile } from "@johnmorrisdotca/hoshi-stars/faint";
 *
 * const tiles: FaintTile[] = []; // the tiles of faintTilesFor(field), fetched and decoded
 * const { stars, depth } = faintStarsIn(tiles, { rightAscension: 83.8, declination: -5.4, radius: 1 }, 11, 2000);
 * console.log(stars.length, depth);
 * ```
 */
export function faintStarsIn(tiles: Iterable<FaintTile>, field: FaintField, limit: number = FAINT_LIMIT, max: number = Infinity): { stars: FaintStar[]; depth: number } {
  const cosRadius = Math.cos(Math.min(180, Math.max(0, field.radius)) * RADIANS);
  const sinDec = Math.sin(field.declination * RADIANS);
  const cosDec = Math.cos(field.declination * RADIANS);
  // the magnitudes are in steps of 1/20: a histogram of the stars in the patch finds the cut without sorting them all
  const steps = Math.min(255, Math.floor(limit * MAGNITUDE_STEP + 1e-6));
  const histogram = new Uint32Array(steps + 1);
  const picked: Array<{ tile: FaintTile; index: number }> = [];
  for (const tile of tiles) {
    for (let i = 0; i < tile.count; i++) {
      const step = Math.round(tile.magnitude[i]! * MAGNITUDE_STEP);
      if (step > steps) continue;
      if (cosineBetween(field.rightAscension, sinDec, cosDec, tile.rightAscension[i]!, tile.declination[i]!) < cosRadius) continue;
      histogram[step]!++;
      picked.push({ tile, index: i });
    }
  }
  let cut = steps;
  let depth = limit;
  if (picked.length > max) {
    // the faintest step whose stars, and all the brighter ones, number no more than `max`
    let running = 0;
    cut = -1;
    for (let step = 0; step <= steps; step++) {
      if (running + histogram[step]! > max) break;
      running += histogram[step]!;
      cut = step;
    }
    depth = Math.max(0, cut) / MAGNITUDE_STEP;
  }
  const stars: FaintStar[] = [];
  for (const { tile, index } of picked) {
    if (Math.round(tile.magnitude[index]! * MAGNITUDE_STEP) > cut) continue;
    const c = tile.colourIndex[index]!;
    stars.push({ rightAscension: tile.rightAscension[index]!, declination: tile.declination[index]!, magnitude: tile.magnitude[index]!, colourIndex: Number.isNaN(c) ? undefined : c });
  }
  stars.sort((a, b) => a.magnitude - b.magnitude);
  return { stars, depth: Math.round(depth * 100) / 100 };
}
