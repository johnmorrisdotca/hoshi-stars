// Compares two Milky Way grids (MODULES-780): the shipped src/data/milky-way.ts and the fallback data-no-sao/milky-way.ts, cell by cell. `node scripts/compare-milky.ts` prints the numbers that
// docs/research/milky-no-sao.md quotes, and test/milky-no-sao.test.ts calls `compareMilky` on the same two files.
import { readFileSync } from "node:fs";

const COLUMNS = 360;
const ROWS = 120;
const LEVELS = 31;
const LATITUDE = 30;

/** A grid read from a data file: brightness 0 to 1, row by row from latitude -30, column by column from longitude 0, one degree of longitude by half a degree of latitude. */
export function readGrid(file: URL): Float64Array {
  const text = readFileSync(file, "utf8");
  const packed = /MILKY_WAY_PACKED = "([^"]+)"/.exec(text)?.[1];
  if (packed === undefined) throw new Error(`${file.pathname} holds no packed grid`);
  const out = new Float64Array(COLUMNS * ROWS);
  let at = 0;
  for (const byte of Buffer.from(packed, "base64")) for (let n = (byte & 7) + 1; n > 0; n--) out[at++] = (byte >> 3) / LEVELS;
  if (at !== COLUMNS * ROWS) throw new Error(`${file.pathname}: ${at} cells, not ${COLUMNS * ROWS}`);
  return out;
}

/** A cell's longitude of its middle (0 to 360) and latitude of its middle (-30 to 30). */
const longitudeOf = (index: number): number => (index % COLUMNS) + 0.5;
const latitudeOf = (index: number): number => -LATITUDE + (Math.floor(index / COLUMNS) + 0.5) * ((2 * LATITUDE) / ROWS);

export interface Cell {
  longitude: number;
  latitude: number;
  shipped: number;
  fallback: number;
}

export interface Comparison {
  /** Pearson correlation of the two grids over every cell, and over the cells within 10 degrees of the plane. */
  correlation: number;
  correlationNearPlane: number;
  /** Mean absolute difference in brightness (0 to 1) over every cell. */
  meanDifference: number;
  /** The cells that differ most, largest first. */
  worstCells: Cell[];
  /** The same, one for each place: a cell is taken only when no cell already taken is within 6 degrees. */
  worstPlaces: Cell[];
  /** Per longitude (one degree), the brightness-weighted mean latitude of the band within 15 degrees of the plane; the mean and the largest difference between the two, in degrees, and where. */
  centreLineMean: number;
  centreLineMax: number;
  centreLineMaxAt: number;
  /** The brightest cell of each grid. */
  brightest: { shipped: Cell; fallback: Cell };
  /** The share of the grid's total brightness in the 20 degrees round the Galactic centre, for each. */
  coreShare: { shipped: number; fallback: number };
}

const pearson = (a: number[], b: number[]): number => {
  const n = a.length;
  const ma = a.reduce((s, v) => s + v, 0) / n;
  const mb = b.reduce((s, v) => s + v, 0) / n;
  let sab = 0;
  let saa = 0;
  let sbb = 0;
  for (let i = 0; i < n; i++) {
    sab += (a[i]! - ma) * (b[i]! - mb);
    saa += (a[i]! - ma) ** 2;
    sbb += (b[i]! - mb) ** 2;
  }
  return sab / Math.sqrt(saa * sbb);
};

const centreLine = (grid: Float64Array): number[] =>
  Array.from({ length: COLUMNS }, (_, column) => {
    let sum = 0;
    let weight = 0;
    for (let row = 0; row < ROWS; row++) {
      const latitude = latitudeOf(row * COLUMNS);
      if (Math.abs(latitude) > 15) continue;
      const v = grid[row * COLUMNS + column]!;
      sum += v * latitude;
      weight += v;
    }
    return weight > 0 ? sum / weight : 0;
  });

const gap = (a: number, b: number): number => Math.abs(((a - b + 540) % 360) - 180);

/** Compares the shipped grid with the fallback. */
export function compareMilky(shipped: Float64Array, fallback: Float64Array): Comparison {
  const cell = (index: number): Cell => ({ longitude: longitudeOf(index), latitude: latitudeOf(index), shipped: shipped[index]!, fallback: fallback[index]! });
  const all = Array.from({ length: shipped.length }, (_, i) => i);
  const near = all.filter((i) => Math.abs(latitudeOf(i)) <= 10);
  const byDifference = [...all].sort((i, j) => Math.abs(fallback[j]! - shipped[j]!) - Math.abs(fallback[i]! - shipped[i]!));
  const places: number[] = [];
  for (const i of byDifference) {
    if (places.length === 10) break;
    const c = cell(i);
    if (places.every((p) => Math.hypot(gap(longitudeOf(p), c.longitude) * Math.cos((c.latitude * Math.PI) / 180), latitudeOf(p) - c.latitude) >= 6)) places.push(i);
  }
  const lineA = centreLine(shipped);
  const lineB = centreLine(fallback);
  const lineGap = lineA.map((v, i) => Math.abs(v - lineB[i]!));
  const worst = lineGap.indexOf(Math.max(...lineGap));
  const top = (grid: Float64Array): number => all.reduce((best, i) => (grid[i]! > grid[best]! ? i : best), 0);
  const core = (grid: Float64Array): number => {
    let inside = 0;
    let total = 0;
    for (const i of all) {
      total += grid[i]!;
      if (gap(longitudeOf(i), 0) <= 20) inside += grid[i]!;
    }
    return inside / total;
  };
  return {
    correlation: pearson(Array.from(shipped), Array.from(fallback)),
    correlationNearPlane: pearson(near.map((i) => shipped[i]!), near.map((i) => fallback[i]!)),
    meanDifference: all.reduce((s, i) => s + Math.abs(shipped[i]! - fallback[i]!), 0) / all.length,
    worstCells: byDifference.slice(0, 10).map(cell),
    worstPlaces: places.map(cell),
    centreLineMean: lineGap.reduce((s, v) => s + v, 0) / COLUMNS,
    centreLineMax: lineGap[worst]!,
    centreLineMaxAt: worst + 0.5,
    brightest: { shipped: cell(top(shipped)), fallback: cell(top(fallback)) },
    coreShare: { shipped: core(shipped), fallback: core(fallback) },
  };
}

/** The two files this package holds. */
export const SHIPPED = new URL("../src/data/milky-way.ts", import.meta.url);
export const FALLBACK = new URL("../data-no-sao/milky-way.ts", import.meta.url);

if (process.argv[1] !== undefined && import.meta.url === new URL(process.argv[1], "file:").href) {
  const result = compareMilky(readGrid(SHIPPED), readGrid(FALLBACK));
  const f = (v: number, d = 3): string => v.toFixed(d);
  const row = (c: Cell): string => `l ${f(c.longitude, 1)}, b ${f(c.latitude, 2)}: shipped ${f(c.shipped, 2)}, fallback ${f(c.fallback, 2)}`;
  console.log(`correlation, every cell ${f(result.correlation)}; within 10 degrees of the plane ${f(result.correlationNearPlane)}; mean difference ${f(result.meanDifference)}`);
  console.log(`centre line: mean difference ${f(result.centreLineMean, 2)} degrees, largest ${f(result.centreLineMax, 2)} at l ${result.centreLineMaxAt}`);
  console.log(`brightest cell: shipped ${row(result.brightest.shipped)}; fallback ${row(result.brightest.fallback)}`);
  console.log(`share of all brightness within 20 degrees of the centre: shipped ${f(result.coreShare.shipped)}, fallback ${f(result.coreShare.fallback)}`);
  console.log("the 10 cells that differ most:");
  for (const c of result.worstCells) console.log(`  ${row(c)}`);
  console.log("the 10 places that differ most (6 degrees apart):");
  for (const c of result.worstPlaces) console.log(`  ${row(c)}`);
}
