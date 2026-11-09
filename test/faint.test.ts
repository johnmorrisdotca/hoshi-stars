// The faint stars: the tiles against the build report (scripts/make-faint-data.py), three UCAC4 stars where the catalogue puts them, three of UCAC4's copies of Hipparcos and Tycho-2 stars absent,
// no duplicate of a bright star, no ghost in the halo of a bright star that 2MASS does not confirm (MODULES-769), three stars that carry APASS DR10's magnitude (MODULES-786) and the counts of both against the build report,
// the tile grid, the selection of a patch of sky with a cap, and the loader with a fetch that reads the tiles from disk.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { decodeFaintTile, FAINT_LEVELS, faintGrid, faintSky, faintStarsIn, faintTileBounds, faintTilePath, faintTilesFor, type FaintTile, type FaintTileId } from "../src/faint.ts";
import { stars } from "../src/stars.ts";

const DIR = new URL("../faint-tiles/", import.meta.url);
const index = JSON.parse(readFileSync(new URL("index.json", DIR), "utf8")) as {
  stars: number;
  limit: number;
  levels: Array<{ level: number; faintest: number; bandDegrees: number; tiles: number; stars: number; bytes: number }>;
  keptByHalfMagnitude: Record<string, number>;
  report: Record<string, number>;
  keptByQuarterMagnitude: Record<string, number>;
  gapFill: { level: number; stars: number; sources: Array<{ name: string; starsKept: number }> };
  ghosts: {
    inHalo: number;
    confirmed: number;
    dropped: number;
    brightStarsWithAGhost: number;
    confirmedStars: Array<[number, number, number, number, string]>;
    droppedExamples: Array<[number, number, number, number]>;
  };
  apassV: { from: number; to: number; declinationMax: number; stars: number; colours: number; tiles: Record<string, [number, number]> };
  saoV?: unknown;
};
const ARC_SECOND = 1 / 3600;

const cache = new Map<string, FaintTile>();
function tileOf(id: FaintTileId): FaintTile {
  const key = faintTilePath(id);
  let found = cache.get(key);
  if (found === undefined) {
    found = decodeFaintTile(id, new Uint8Array(readFileSync(new URL(key, DIR))));
    cache.set(key, found);
  }
  return found;
}
function everyTile(): FaintTile[] {
  const all: FaintTile[] = [];
  for (let level = 0; level < FAINT_LEVELS.length; level++) {
    const grid = faintGrid(level);
    for (let band = 0; band < grid.bands; band++) for (let column = 0; column < grid.columns[band]!; column++) all.push(tileOf({ level, band, column }));
  }
  return all;
}
const separation = (ra1: number, dec1: number, ra2: number, dec2: number): number => {
  const r = Math.PI / 180;
  const h = Math.sin(((dec2 - dec1) * r) / 2) ** 2 + Math.cos(dec1 * r) * Math.cos(dec2 * r) * Math.sin(((ra2 - ra1) * r) / 2) ** 2;
  return (2 * Math.asin(Math.min(1, Math.sqrt(h)))) / r;
};
/** The faint stars within `arcsec` of a point, from the tiles that cover it. */
function near(ra: number, dec: number, arcsec: number): Array<{ rightAscension: number; declination: number; magnitude: number; colourIndex: number | undefined }> {
  const field = { rightAscension: ra, declination: dec, radius: arcsec * ARC_SECOND };
  return faintStarsIn(faintTilesFor(field).map(tileOf), field).stars;
}

test("the tile files are the grid: every tile of every level is there, in sixes of bytes, and the counts are the build's", () => {
  assert.equal(index.limit, 12);
  for (const level of index.levels) {
    const grid = faintGrid(level.level);
    assert.equal(grid.columns.reduce((a, b) => a + b, 0), level.tiles, `level ${level.level} tiles`);
    assert.equal(FAINT_LEVELS[level.level]!.bandDegrees, level.bandDegrees);
    assert.equal(FAINT_LEVELS[level.level]!.faintest, level.faintest);
    let count = 0;
    for (let band = 0; band < grid.bands; band++) {
      for (let column = 0; column < grid.columns[band]!; column++) {
        const id = { level: level.level, band, column };
        assert.ok(existsSync(new URL(faintTilePath(id), DIR)), faintTilePath(id));
        count += tileOf(id).count;
      }
    }
    assert.equal(count, level.stars, `level ${level.level} stars`);
  }
  assert.equal(index.levels.reduce((a, l) => a + l.stars, 0), index.stars);
});

test("the stars are in the tile they belong to and in the level their magnitude gives, none fainter than 12, and the counts by magnitude match the build report", () => {
  const byHalf = new Map<number, number>();
  for (const tile of everyTile()) {
    const { raFrom, raTo, decFrom, decTo } = faintTileBounds(tile.id);
    const { faintest } = FAINT_LEVELS[tile.id.level]!;
    const lowest = tile.id.level === 0 ? -Infinity : FAINT_LEVELS[tile.id.level - 1]!.faintest;
    for (let i = 0; i < tile.count; i++) {
      assert.ok(tile.rightAscension[i]! >= raFrom - 1e-9 && tile.rightAscension[i]! <= raTo + 1e-9);
      assert.ok(tile.declination[i]! >= decFrom - 1e-9 && tile.declination[i]! <= decTo + 1e-9);
      const m = tile.magnitude[i]!;
      assert.ok(m <= faintest + 1e-6 && m > lowest, `${faintTilePath(tile.id)} holds a ${m} star`);
      if (i > 0) assert.ok(tile.declination[i]! >= tile.declination[i - 1]!, "sorted by declination");
      byHalf.set(Math.floor(m * 2 + 1e-6) / 2, (byHalf.get(Math.floor(m * 2 + 1e-6) / 2) ?? 0) + 1);
    }
  }
  const got = Object.fromEntries([...byHalf].sort((a, b) => a[0] - b[0]).map(([k, v]) => [k.toFixed(1), v]));
  assert.deepEqual(got, index.keptByHalfMagnitude);
  assert.ok(index.stars > 2_300_000 && index.stars < 2_600_000, `${index.stars} stars`);
});

test("three UCAC4 stars are where the catalogue puts them, with its magnitude and colour", () => {
  // Read from UCAC4 itself (NASA/IPAC IRSA's ucac4_sources, 2026-11-09): id, RA and Dec at J2000 in degrees, the magnitude the build uses (APASS V; the model magnitude where there is no V), and B-V where APASS has both.
  const known: Array<[string, number, number, number, number | undefined]> = [
    ["423-010026 in Orion", 83.2707833, -5.5765825, 10.602, 11.043 - 10.602],
    ["150-125507 in Centaurus", 200.1120197, -60.0566633, 10.642, 10.71 - 10.642],
    ["652-079316 in Cygnus", 298.0202692, 40.2656519, 11.95, 12.432 - 11.95],
    ["646-077736, no V: the model magnitude", 298.0175883, 39.1829597, 11.816, undefined],
  ];
  for (const [name, ra, dec, magnitude, colour] of known) {
    const found = near(ra, dec, 1.5);
    assert.equal(found.length, 1, `${name}: ${found.length} stars within 1.5 arc-seconds`);
    const star = found[0]!;
    assert.ok(separation(star.rightAscension, star.declination, ra, dec) < 0.3 * ARC_SECOND * 1, `${name} is ${(separation(star.rightAscension, star.declination, ra, dec) / ARC_SECOND).toFixed(3)} arc-seconds off`);
    assert.ok(Math.abs(star.magnitude - magnitude) <= 0.026, `${name}: ${star.magnitude} against ${magnitude}`);
    if (colour === undefined) assert.equal(star.colourIndex, undefined, name);
    else assert.ok(star.colourIndex !== undefined && Math.abs(star.colourIndex - colour) <= 0.0126, `${name}: B-V ${star.colourIndex} against ${colour}`);
  }
});

test("UCAC4's copies of Hipparcos and Tycho-2 stars are not in the tiles", () => {
  // Rows of UCAC4 with object type 7 (a supplement star from Hipparcos and Tycho-2, no CCD data) and 6 (position substituted from them), read from ucac4_sources on 2026-11-09. Nothing within 2 arc-seconds of any.
  const copies: Array<[string, number, number]> = [
    ["423-010223, type 7, Orion", 83.8600111, -5.4168681],
    ["655-082797, type 6, Cygnus", 299.5099264, 40.9268431],
    ["150-113928, type 6, Crux, with an APASS V", 191.8992128, -60.0809917],
  ];
  // These are real stars. A gap fill (SAO, or APASS with 2MASS: measured on their own, test/gap.test.ts) may hold them, so the position check is for a build with none.
  if (index.gapFill.stars === 0) for (const [name, ra, dec] of copies) assert.equal(near(ra, dec, 2).length, 0, name);
  for (const dropped of ["dropped: object type 4, external high-proper-motion data", "dropped: object type 6, substituted from FK6, Hipparcos or Tycho-2", "dropped: object type 7, supplement star from FK6, Hipparcos or Tycho-2"]) assert.ok((index.report[dropped] ?? 0) > 0, dropped);
  assert.equal(Object.keys(index.report).filter((k) => /^kept.*object type [467]/.test(k)).length, 0);
});

test("none of the 5,080 bright stars is in the tiles a second time", () => {
  let checked = 0;
  for (const star of stars()) {
    const field = { rightAscension: star.rightAscension, declination: star.declination, radius: 20 * ARC_SECOND };
    const twin = faintStarsIn(faintTilesFor(field, 8.5).map(tileOf), field, 8.5).stars.find((f) => Math.abs(f.magnitude - star.magnitude) <= 1.5);
    assert.equal(twin, undefined, `HR ${star.hr}`);
    checked++;
  }
  assert.equal(checked, 5080);
});

test("the grid: bands from the south pole, tiles about as wide as tall, and faintTilesFor finds the tile that holds a point, across right ascension 0 and at the poles", () => {
  for (let level = 0; level < FAINT_LEVELS.length; level++) {
    const { bands, columns } = faintGrid(level);
    assert.equal(bands * FAINT_LEVELS[level]!.bandDegrees, 180);
    assert.equal(columns[bands / 2]!, 360 / FAINT_LEVELS[level]!.bandDegrees);
    assert.ok(columns[0]! >= 1 && columns[bands - 1]! >= 1);
  }
  assert.deepEqual(faintTileBounds({ level: 0, band: 9, column: 0 }), { raFrom: 0, raTo: 10, decFrom: 0, decTo: 10 });
  assert.equal(faintTilePath({ level: 2, band: 17, column: 12 }), "L2/17-12.bin");
  const holds = (ra: number, dec: number, limit: number, level: number): boolean => faintTilesFor({ rightAscension: ra, declination: dec, radius: 0.05 }, limit).some((t) => {
    const b = faintTileBounds(t);
    return t.level === level && ra >= b.raFrom && ra <= b.raTo && dec >= b.decFrom && dec <= b.decTo;
  });
  for (const [ra, dec] of [[83.8, -5.4], [0.01, 0.01], [359.99, 30], [180, 89.9], [10, -89.9], [123.4, 60.0]] as const) for (let level = 0; level < 3; level++) assert.ok(holds(ra, dec, FAINT_LEVELS[level]!.faintest, level), `${ra}, ${dec}, level ${level}`);
  // a patch across right ascension 0 finds tiles on both sides
  const across = faintTilesFor({ rightAscension: 0, declination: 0, radius: 3 }, 12).filter((t) => t.level === 0);
  assert.ok(across.some((t) => t.column === 0) && across.some((t) => t.column === 35));
  // the pole: a patch round it takes every tile of the polar bands
  assert.equal(faintTilesFor({ rightAscension: 10, declination: 90, radius: 2 }, 9).filter((t) => t.band === 17).length, faintGrid(0).columns[17]);
  // the level a limit needs: to 9 only level 0, to 10.5 levels 0 and 1, to 12 all three; a deeper limit never drops a tile
  const orion = { rightAscension: 83.8, declination: -5.4, radius: 2 };
  assert.deepEqual([...new Set(faintTilesFor(orion, 9).map((t) => t.level))], [0]);
  assert.deepEqual([...new Set(faintTilesFor(orion, 10.5).map((t) => t.level))], [0, 1]);
  assert.deepEqual([...new Set(faintTilesFor(orion, 12).map((t) => t.level))], [0, 1, 2]);
  assert.ok(faintTilesFor(orion, 12).length <= 12);
});

test("every star within a patch is found in the tiles faintTilesFor names, near the poles and the seam too", () => {
  for (const field of [{ rightAscension: 5, declination: 85, radius: 4 }, { rightAscension: 359, declination: -40, radius: 2.5 }, { rightAscension: 270, declination: 0, radius: 1.5 }]) {
    const named = new Set(faintTilesFor(field, 12).map(faintTilePath));
    const found = faintStarsIn(everyTile(), field, 12).stars;
    assert.ok(found.length > 0);
    const viaNamed = faintStarsIn([...named].map((p) => {
      const [level, rest] = p.split("/") as [string, string];
      const [band, column] = rest.replace(".bin", "").split("-").map(Number) as [number, number];
      return tileOf({ level: Number(level.slice(1)), band, column });
    }), field, 12).stars;
    assert.equal(viaNamed.length, found.length, `${JSON.stringify(field)}`);
  }
});

test("faintStarsIn: brightest first, inside the radius, a cap keeps the brightest and says how deep the list is complete", () => {
  const field = { rightAscension: 299, declination: 40, radius: 1.2 };
  const tiles = faintTilesFor(field).map(tileOf);
  const all = faintStarsIn(tiles, field);
  assert.equal(all.depth, 12);
  assert.ok(all.stars.length > 300, `${all.stars.length} stars in the Cygnus patch`);
  for (let i = 1; i < all.stars.length; i++) assert.ok(all.stars[i]!.magnitude >= all.stars[i - 1]!.magnitude);
  assert.ok(all.stars.every((s) => separation(s.rightAscension, s.declination, 299, 40) <= 1.2 + 1e-9));
  const capped = faintStarsIn(tiles, field, 12, 100);
  assert.ok(capped.stars.length <= 100 && capped.stars.length > 50);
  assert.ok(capped.depth < 12);
  assert.ok(capped.stars.every((s) => s.magnitude <= capped.depth + 1e-6), "complete to the depth");
  assert.equal(capped.stars.length, all.stars.filter((s) => s.magnitude <= capped.depth + 1e-6).length);
  const shallow = faintStarsIn(tiles, field, 10);
  assert.ok(shallow.stars.length < all.stars.length && shallow.stars.every((s) => s.magnitude <= 10));
  assert.equal(shallow.depth, 10);
  assert.deepEqual(faintStarsIn([], field, 12, 5), { stars: [], depth: 12 });
});

test("decodeFaintTile reads the six planes, and refuses a file that is not a whole number of stars", () => {
  const id = { level: 0, band: 9, column: 0 };
  assert.equal(decodeFaintTile(id, new Uint8Array(0)).count, 0);
  // two stars as six planes: declination steps 100 and 300 (low bytes 100 and 44, high bytes 0 and 1), right ascension 0 and 65535, magnitude 8.0 (160) and 12.0 (240), colour none (255) and B-V 0.4 (80)
  const planes = new Uint8Array([100, 44, 0, 1, 0, 255, 0, 255, 160, 240, 255, 80]);
  const tile = decodeFaintTile(id, planes);
  assert.equal(tile.count, 2);
  assert.ok(Math.abs(tile.declination[0]! - (100 / 65535) * 10) < 1e-9);
  assert.ok(Math.abs(tile.declination[1]! - ((100 + 300) / 65535) * 10) < 1e-9);
  assert.equal(tile.rightAscension[0], 0);
  assert.ok(Math.abs(tile.rightAscension[1]! - 10) < 1e-9);
  assert.deepEqual([tile.magnitude[0], tile.magnitude[1]], [8, 12]);
  assert.ok(Number.isNaN(tile.colourIndex[0]!) && Math.abs(tile.colourIndex[1]! - 0.4) < 1e-6);
  assert.throws(() => decodeFaintTile(id, new Uint8Array(7)), RangeError);
});

test("faintSky loads only the tiles a patch needs, once, answers from them, and keeps the newest", async () => {
  const asked: string[] = [];
  const fetchFromDisk = async (url: string): Promise<{ ok: boolean; status: number; arrayBuffer(): Promise<ArrayBuffer> }> => {
    asked.push(url);
    const path = url.replace("https://tiles.example/", "");
    if (!existsSync(new URL(path, DIR))) return { ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) };
    const bytes = readFileSync(new URL(path, DIR));
    return { ok: true, status: 200, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer };
  };
  const sky = faintSky({ baseUrl: "https://tiles.example/", fetch: fetchFromDisk });
  const orion = { rightAscension: 83.8, declination: -5.4, radius: 1 };
  assert.deepEqual(sky.stars(orion, 12), { stars: [], depth: 12, loaded: false });
  await Promise.all([sky.load(orion, 12), sky.load(orion, 12)]);
  const need = faintTilesFor(orion, 12);
  assert.equal(asked.length, need.length, "each tile once, though asked for twice");
  assert.ok(asked.every((url) => url.startsWith("https://tiles.example/L")));
  const got = sky.stars(orion, 12, 500);
  assert.equal(got.loaded, true);
  assert.ok(got.stars.length > 100 && got.stars.length <= 500);
  await sky.load(orion, 10);
  assert.equal(asked.length, need.length, "nothing fetched again");
  assert.equal(sky.size, need.length);
  // a smaller cache lets the oldest go
  const small = faintSky({ baseUrl: "https://tiles.example/", fetch: fetchFromDisk, maxTiles: 2 });
  await small.load(orion, 12);
  assert.equal(small.size, 2);
  // a missing tile rejects and is tried again the next time
  const broken = faintSky({ baseUrl: "https://tiles.example/nothing-here/", fetch: fetchFromDisk });
  await assert.rejects(broken.load(orion, 12), /could not be fetched \(404\)/);
  assert.equal(broken.stars(orion, 12).loaded, false);
});

// ----- ghosts in the halo of a bright star (MODULES-769) -----
/** The reach in arc-seconds of the halo of a bright star of visual magnitude `v`: scripts/make-faint-data.py `ghost_radius`. */
const haloRadius = (v: number): number => Math.min(120, 30 * 10 ** (0.2 * (5.5 - v)));
/** The position a 2MASS designation names: hhmmssss then the sign and ddmmsss (J2000), so 05283322-0441493 is 05h 28m 33.22s, -04d 41m 49.3s. */
function twoMassPosition(designation: string): { ra: number; dec: number } {
  const m = /^(\d\d)(\d\d)(\d\d)(\d\d)([+-])(\d\d)(\d\d)(\d\d)(\d)$/.exec(designation);
  assert.ok(m, designation);
  return { ra: (Number(m[1]) + Number(m[2]) / 60 + Number(`${m[3]}.${m[4]}`) / 3600) * 15, dec: (m[5] === "-" ? -1 : 1) * (Number(m[6]) + Number(m[7]) / 60 + Number(`${m[8]}.${m[9]}`) / 3600) };
}

test("no faint star lies in the halo of a bright star unless a 2MASS source confirms it, and each confirmation is a source that is where the star is", () => {
  const confirmed = index.ghosts.confirmedStars;
  const isConfirmed = (ra: number, dec: number, magnitude: number): boolean => confirmed.some((c) => separation(c[0], c[1], ra, dec) < 1.0 * ARC_SECOND && Math.abs(c[2] - magnitude) <= 0.026);
  let checked = 0;
  let inHalo = 0;
  for (const star of stars()) {
    const reach = haloRadius(star.magnitude) - 1; // less an arc-second, which a tile's grid rounds a position by
    const field = { rightAscension: star.rightAscension, declination: star.declination, radius: reach * ARC_SECOND };
    for (const f of faintStarsIn(faintTilesFor(field).map(tileOf), field).stars) {
      const d = separation(f.rightAscension, f.declination, star.rightAscension, star.declination) / ARC_SECOND;
      if (d > reach) continue;
      inHalo++;
      assert.ok(isConfirmed(f.rightAscension, f.declination, f.magnitude), `HR ${star.hr} (V ${star.magnitude}): a faint star of ${f.magnitude} ${d.toFixed(1)} arc-seconds away is in its halo and nothing confirms it`);
    }
    checked++;
  }
  assert.equal(checked, 5080);
  assert.ok(inHalo > 100, `${inHalo} stars in the halos`);
  // the confirmations: each is in the tiles, and its 2MASS source (named by its designation, which is its position) is within the 2 arc-seconds the rule allows, less the grid's rounding
  for (const [ra, dec, magnitude, brightV, designation] of confirmed) {
    const found = near(ra, dec, 1.0);
    assert.equal(found.length, 1, `confirmed star at ${ra}, ${dec}`);
    assert.ok(Math.abs(found[0]!.magnitude - magnitude) <= 0.026);
    const source = twoMassPosition(designation);
    assert.ok(separation(source.ra, source.dec, ra, dec) <= 2.1 * ARC_SECOND, `${designation} is ${(separation(source.ra, source.dec, ra, dec) / ARC_SECOND).toFixed(2)} arc-seconds from the star`);
    assert.ok(brightV > -2 && brightV <= 6.1);
  }
  // the dropped ghosts are not there
  for (const [ra, dec, , v] of index.ghosts.droppedExamples) {
    assert.ok(v > -2 && v <= 6.1);
    assert.equal(near(ra, dec, 0.5).length, 0, `a ghost at ${ra}, ${dec} is still in the tiles`);
  }
});

test("the ghost counts add up, and the build report adds up to the tiles", () => {
  const g = index.ghosts;
  assert.equal(g.inHalo, g.confirmed + g.dropped);
  assert.equal(g.confirmedStars.length, g.confirmed);
  assert.equal(index.report["ghost rule: kept stars in the halo of a bright star"], g.inHalo);
  assert.equal(index.report["ghost rule: confirmed by a 2MASS source, kept"], g.confirmed);
  assert.equal(index.report["dropped: ghost, in the halo of a bright star with no 2MASS source"], g.dropped);
  assert.ok(g.dropped > 500 && g.brightStarsWithAGhost > 400 && g.brightStarsWithAGhost <= g.dropped);
  // every row read is a star of the tiles or is dropped for a reason the report names
  const dropped = Object.entries(index.report).filter(([k]) => k.startsWith("dropped: ")).reduce((a, [, v]) => a + v, 0);
  assert.equal(index.report["rows read"]! - dropped, index.report["kept"]);
  assert.equal(index.report["kept"]! + index.gapFill.stars, index.stars);
});

test("the counts by quarter magnitude are the tiles' own", () => {
  const byQuarter = new Map<string, number>();
  for (const tile of everyTile()) for (let i = 0; i < tile.count; i++) {
    const q = (Math.floor(tile.magnitude[i]! * 4 + 1e-6) / 4).toFixed(2);
    byQuarter.set(q, (byQuarter.get(q) ?? 0) + 1);
  }
  for (const [q, n] of Object.entries(index.keptByQuarterMagnitude)) assert.equal(byQuarter.get(q) ?? 0, n, `quarter magnitude ${q}`);
  assert.ok(Object.keys(index.keptByQuarterMagnitude).includes("7.00") && Object.keys(index.keptByQuarterMagnitude).includes("10.00"));
});

// ----- APASS DR10's magnitudes for UCAC4's bright stars (MODULES-786) -----
test("three stars carry APASS DR10's V and B-V, not UCAC4's, which ran a magnitude too faint", () => {
  // UCAC4 (IRSA ucac4_sources, 2026-11-09): id, J2000 position, the V it gave (APASS DR6's, saturated). APASS DR10 (GAVO apass.dr10, 2026-11-09): id, V and B (so B-V). The tile holds V to 0.05 and B-V to 0.0125.
  const known: Array<{ ucac4: string; ra: number; dec: number; ucacV: number; apass: string; v: number; b: number }> = [
    { ucac4: "368-064024", ra: 193.3007611, dec: -16.5922033, ucacV: 9.073, apass: "070-4715278", v: 8.061, b: 8.973 },
    { ucac4: "521-019709", ra: 91.0463344, dec: 14.0735975, ucacV: 9.334, apass: "100-1283734", v: 8.233, b: 8.644 },
    { ucac4: "078-051921", ra: 349.6123733, dec: -74.5162114, ucacV: 9.108, apass: "015-1507731", v: 7.951, b: 8.421 },
  ];
  for (const k of known) {
    const found = near(k.ra, k.dec, 1.5);
    assert.equal(found.length, 1, `${k.ucac4}: ${found.length} stars within 1.5 arc-seconds`);
    const star = found[0]!;
    assert.ok(Math.abs(star.magnitude - k.v) <= 0.026, `${k.ucac4} (APASS ${k.apass}): ${star.magnitude} against APASS DR10's ${k.v}`);
    assert.ok(k.ucacV - star.magnitude > 0.9, `${k.ucac4} is ${k.ucacV - star.magnitude} magnitudes brighter than UCAC4's ${k.ucacV}`);
    assert.ok(star.colourIndex !== undefined && Math.abs(star.colourIndex - (k.b - k.v)) <= 0.0126, `${k.ucac4}: B-V ${star.colourIndex} against ${(k.b - k.v).toFixed(3)}`);
  }
});

test("the index says per tile how many stars took APASS's V, none north of +20 degrees, and the counts are the report's", () => {
  const a = index.apassV;
  assert.equal(a.from, 7);
  assert.equal(a.declinationMax, 20);
  assert.equal(index.report["magnitude taken from APASS DR10"], a.stars);
  assert.equal(index.report["colour taken from APASS DR10 (B-V, both errors under 0.1)"], a.colours);
  let stars = 0;
  let colours = 0;
  for (const [path, [took, colour]] of Object.entries(a.tiles)) {
    const [level, rest] = path.split("/") as [string, string];
    const [band, column] = rest.replace(".bin", "").split("-").map(Number) as [number, number];
    const id = { level: Number(level.slice(1)), band, column };
    assert.ok(existsSync(new URL(`${path}.bin`, DIR)), path);
    assert.ok(took >= 1 && took <= tileOf(id).count && colour <= took, path);
    assert.ok(faintTileBounds(id).decFrom < a.declinationMax, `${path} reaches past +${a.declinationMax}`);
    stars += took;
    colours += colour;
  }
  assert.equal(stars, a.stars);
  assert.equal(colours, a.colours);
  assert.ok(a.stars > 100_000, `${a.stars} stars took APASS's V`);
});

test("SAO's magnitudes are not used while its terms are unconfirmed, and nothing of Hipparcos, Tycho or Gaia is read for the repairs", () => {
  const notice = readFileSync(new URL("../NOTICE.md", import.meta.url), "utf8");
  assert.match(notice, /SAO[^\n]*confirmation requested 2026-11-09/);
  assert.equal(index.saoV, undefined, "SAO's V is in the tiles while NOTICE.md says its terms are unconfirmed");
  assert.equal(index.report["magnitude taken from SAO"], undefined);
  const script = readFileSync(new URL("../scripts/make-faint-data.py", import.meta.url), "utf8");
  // the new queries, by name: APASS DR10 through GAVO and 2MASS through IRSA, columns that carry no value of Hipparcos, Tycho or Gaia
  assert.match(script, /APASS_TABLE = "apass\.dr10"/);
  assert.match(script, /APASS_COLUMNS = "id, ra, dec, ra_error, dec_error, nobs_v, mag_v, err_mag_v, nobs_b, mag_b, err_mag_b"/);
  assert.match(script, /"fp_psc", "p\.designation, p\.ra, p\.dec, p\.j_m, p\.ph_qual, p\.cc_flg"/);
  for (const section of [index.ghosts, index.apassV]) for (const key of JSON.stringify(section).match(/"[A-Za-z][A-Za-z ,.()0-9-]*":/g) ?? []) assert.doesNotMatch(key, /hipparcos|tycho|gaia/i, key);
  for (const key of Object.keys(index.report).filter((k) => /ghost|APASS DR10|SAO/.test(k))) assert.doesNotMatch(key, /hipparcos|tycho|gaia/i, key);
});
