// The nearby stars matched in the faint tiles (src/data/nearby-faint.ts) and the UCAC4 positions taken from the match (src/data/nearby-ucac4.ts), held against the tiles and the rules of scripts/make-nearby-faint.ts.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { starGrade } from "../src/accuracy.ts";
import { nearbyIdOfFaint } from "../src/catalogue-faint.ts";
import { NEARBY_ROWS } from "../src/data/nearby.ts";
import { NEARBY_FAINT_COUNTS, NEARBY_FAINT_ROWS } from "../src/data/nearby-faint.ts";
import { NEARBY_UCAC4_ROWS } from "../src/data/nearby-ucac4.ts";
import { decodeFaintTile, faintStarsIn, faintTilePath, faintTilesFor, type FaintField } from "../src/faint-core.ts";
import { nearbyStarByName, nearbyStars } from "../src/nearby.ts";

const RADIANS = Math.PI / 180;
const arcsec = (a: { rightAscension: number; declination: number }, b: { rightAscension: number; declination: number }): number => {
  const cos = Math.sin(a.declination * RADIANS) * Math.sin(b.declination * RADIANS) + Math.cos(a.declination * RADIANS) * Math.cos(b.declination * RADIANS) * Math.cos((a.rightAscension - b.rightAscension) * RADIANS);
  return (Math.acos(Math.min(1, cos)) / RADIANS) * 3600;
};
const tilesOf = (field: FaintField) =>
  faintTilesFor(field).map((id) => {
    const file = new URL(`../faint-tiles/${faintTilePath(id)}`, import.meta.url);
    return decodeFaintTile(id, existsSync(file) ? new Uint8Array(readFileSync(file)) : new Uint8Array(0));
  });
const raw = new Map(NEARBY_ROWS.split("\n").map((row) => row.split("|")).map((p) => [p[0]!, { rightAscension: Number(p[7]) / 360000, declination: Number(p[8]) / 360000, errorArcsec: Number(p[9]) / 10, coarse: p[6] === "" }]));
const rows = NEARBY_FAINT_ROWS.split("\n").map((row) => row.split("|"));

test("the counts add up to the nearby table", () => {
  const c = NEARBY_FAINT_COUNTS;
  assert.equal(c.nearby, nearbyStars().length);
  assert.equal(c.matched + c.ambiguous + c.new + c.noMagnitude, c.nearby);
  assert.deepEqual([c.matched, c.ambiguous, c.ambiguousSettled, c.new, c.noMagnitude, c.matchedCoarse, c.ucac4Positions], [2135, 55, 47, 3368, 7, 270, 133]);
  assert.equal(rows.length, c.matched + c.ambiguousSettled);
  assert.equal(rows.filter((r) => r[3] === "n").length, c.ambiguousSettled);
  assert.equal(new Set(rows.map((r) => r[0])).size, rows.length);
  assert.equal(new Set(rows.map((r) => r[1])).size, rows.length, "no faint star is two nearby stars");
});

test("every matched faint star is in the tiles, inside the window, with a magnitude that fits", () => {
  for (const [gctp, key, separation] of rows) {
    const own = raw.get(gctp!)!;
    const star = nearbyStarByName(`GCTP ${gctp}`)!;
    const window = Math.min(60, Math.max(2, 3 * own.errorArcsec));
    const found = faintStarsIn(tilesOf({ rightAscension: own.rightAscension, declination: own.declination, radius: window / 3600 }), { rightAscension: own.rightAscension, declination: own.declination, radius: window / 3600 }).stars;
    const faint = found.find((f) => `${f.rightAscension.toFixed(6)},${f.declination.toFixed(6)}` === key);
    assert.ok(faint, `${gctp}: ${key} is not in the tiles`);
    assert.ok(Math.abs(arcsec(own, faint) - Number(separation)) < 0.01, gctp);
    const [low, high] = star.magnitudeKind === "blue" ? [-3, 1.5] : [-1.5, 1.5];
    assert.ok(faint.magnitude - star.magnitude! >= low && faint.magnitude - star.magnitude! <= high, gctp);
  }
});

test("a known pair: AD Leonis is matched, and a 2MASS star's match lies within 2 arc-seconds", () => {
  const ad = rows.find((r) => r[0] === nearbyStarByName("AD Leonis")!.gctp)!;
  assert.ok(Number(ad[2]) < 1);
  for (const [gctp, , separation] of rows) if (!raw.get(gctp!)!.coarse) assert.ok(Number(separation) <= 2, gctp);
});

test("a UCAC4 position: a coarse star's, near its matched faint star, inside twice its Yale error, with UCAC4's own error", () => {
  const matched = new Map(rows.map((r) => [r[0]!, r[1]!.split(",").map(Number)]));
  const ucac4 = NEARBY_UCAC4_ROWS.split("\n").map((row) => row.split("|"));
  assert.equal(ucac4.length, NEARBY_FAINT_COUNTS.ucac4Positions);
  for (const [gctp, id, ra, dec, errorMas, offset] of ucac4) {
    const own = raw.get(gctp!)!;
    const star = nearbyStarByName(`GCTP ${gctp}`)!;
    assert.ok(own.coarse, gctp);
    assert.deepEqual([star.positionSource, star.flags.coarsePosition, star.rightAscension, star.declination], ["UCAC4", false, Number(ra), Number(dec)]);
    assert.equal(star.ucac4, `UCAC4 ${id!.padStart(9, "0").slice(0, 3)}-${id!.padStart(9, "0").slice(3)}`);
    assert.equal(nearbyStarByName(star.ucac4!), star);
    const [fra, fdec] = matched.get(gctp!)!;
    assert.ok(arcsec(star, { rightAscension: fra!, declination: fdec! }) < 1.5, gctp);
    assert.ok(Math.abs(arcsec(star, own) - Number(offset)) < 0.1, gctp);
    assert.ok(Number(offset) <= Math.max(2, 2 * own.errorArcsec) + 1.5, gctp);
    assert.ok(Number(errorMas) > 0 && Number(errorMas) < 1000, gctp);
    assert.equal(star.positionErrorArcsec, Number(errorMas) / 1000);
  }
});

test("a faint star has no parallax, so its grade is C", () => {
  assert.equal(starGrade({ rightAscension: 83.8, declination: -5.4, magnitude: 11.2, colourIndex: 0.7 }), "C");
});

test("an ambiguous star is settled by the nearest pair first: no fitting faint star nearer to it is free", () => {
  const owner = new Map(rows.map((r) => [r[1]!, { gctp: r[0]!, separation: Number(r[2]), settled: r[3] === "n" }]));
  const settled = rows.filter((r) => r[3] === "n");
  for (const [gctp, key, separation] of settled) {
    const own = raw.get(gctp!)!;
    const star = nearbyStarByName(`GCTP ${gctp}`)!;
    const window = Math.min(60, Math.max(2, 3 * own.errorArcsec));
    const field = { rightAscension: own.rightAscension, declination: own.declination, radius: window / 3600 };
    const [low, high] = star.magnitudeKind === "blue" ? [-3, 1.5] : [-1.5, 1.5];
    const fits = faintStarsIn(tilesOf(field), field).stars.filter((f) => f.magnitude - star.magnitude! >= low && f.magnitude - star.magnitude! <= high);
    assert.ok(fits.length >= 1, gctp);
    for (const f of fits) {
      const d = arcsec(own, f);
      if (`${f.rightAscension.toFixed(6)},${f.declination.toFixed(6)}` === key || d >= Number(separation) - 0.01) continue;
      // a nearer faint star that fits belongs to another nearby star, which took it by a clear match or by a pair no farther apart
      const other = owner.get(`${f.rightAscension.toFixed(6)},${f.declination.toFixed(6)}`);
      assert.ok(other !== undefined && other.gctp !== gctp, `${gctp}: a free faint star ${d.toFixed(2)} arc-seconds away`);
      assert.ok(!other.settled || other.separation <= d + 1e-6, `${gctp}: a faint star ${d.toFixed(2)} arc-seconds away went to a farther pair`);
    }
    const [ra, dec] = key!.split(",").map(Number);
    assert.equal(nearbyIdOfFaint({ rightAscension: ra!, declination: dec! }), `gctp-${gctp}`);
  }
});
