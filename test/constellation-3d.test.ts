// A constellation in space: the axes, the distance qualities, Orion's seven placed stars and the one with no distance, ranges that hold the best distance, the line of sight that makes the front view equal the sky chart, a viewpoint that moves the
// figure the way `skyFrom` does, and bad input is named.
import assert from "node:assert/strict";
import { test } from "node:test";
import { constellationIn3D, DISTANCE_QUALITIES, distanceQuality, distanceQualityTable, positionIn3D, QUALITY_LIMITS } from "../src/constellation-3d.ts";
import { figureOf } from "../src/lines.ts";
import { skyFrom } from "../src/sky-from.ts";
import { starByName, stars } from "../src/stars.ts";

const near = (a: number, b: number, tolerance = 1e-9): boolean => Math.abs(a - b) <= tolerance;
const length = (v: readonly number[]): number => Math.hypot(v[0]!, v[1]!, v[2]!);

test("positionIn3D puts right ascension 0 on x, 6 hours on y and the north pole on z, at the distance given", () => {
  const [x, y, z] = positionIn3D(0, 0, 10);
  assert.ok(near(x, 10) && near(y, 0) && near(z, 0));
  const [a, b, c] = positionIn3D(90, 0, 10);
  assert.ok(near(a, 0) && near(b, 10) && near(c, 0));
  assert.ok(near(positionIn3D(12, 90, 7)[2], 7));
  assert.ok(near(length(positionIn3D(123, -45, 33)), 33));
});

test("distanceQuality: good under 5%, fair to 20%, rough above it or with no error, none without a parallax", () => {
  assert.deepEqual(DISTANCE_QUALITIES, ["good", "fair", "rough", "none"]);
  assert.deepEqual(QUALITY_LIMITS, { good: 0.05, rough: 0.2 });
  assert.equal(distanceQuality({ parallaxMas: 0, parallaxErrorMas: undefined, parallaxSource: undefined }), "none");
  assert.equal(distanceQuality({ parallaxMas: 100, parallaxErrorMas: 4.9, parallaxSource: "GCTP" }), "good");
  assert.equal(distanceQuality({ parallaxMas: 100, parallaxErrorMas: 5, parallaxSource: "GCTP" }), "fair");
  assert.equal(distanceQuality({ parallaxMas: 100, parallaxErrorMas: 20, parallaxSource: "GCTP" }), "fair");
  assert.equal(distanceQuality({ parallaxMas: 100, parallaxErrorMas: 20.1, parallaxSource: "GCTP" }), "rough");
  assert.equal(distanceQuality({ parallaxMas: 100, parallaxErrorMas: undefined, parallaxSource: "BSC" }), "rough");
  assert.equal(distanceQuality({ parallaxMas: 100, parallaxErrorMas: undefined, parallaxSource: "dynamical" }), "fair");
  assert.equal(distanceQuality(starByName("Alnilam")!), "none");
  assert.equal(distanceQuality(starByName("Rigel")!), "rough");
  assert.equal(distanceQuality(starByName("Betelgeuse")!), "fair");
  assert.equal(distanceQuality(starByName("Sirius")!), "good");
});

test("Orion: eight figure stars, seven with a distance, Alnilam with none and so no place", () => {
  const orion = constellationIn3D("Ori");
  assert.equal(orion.constellation.abbreviation, "Ori");
  assert.equal(orion.stars.length, figureOf("Ori").stars.length);
  assert.equal(orion.stars.length, 8);
  const alnilam = orion.stars.find((one) => one.star.name === "Alnilam")!;
  assert.equal(alnilam.quality, "none");
  assert.equal(alnilam.position, undefined);
  assert.equal(alnilam.lightYears, undefined);
  assert.equal(alnilam.range, undefined);
  assert.equal(alnilam.wide, false);
  assert.ok(near(length(alnilam.sight.direction), 1), "it keeps its line of sight from the Earth");
  assert.deepEqual(alnilam.sight.origin, [0, 0, 0]);
  assert.equal(orion.stars.filter((one) => one.position !== undefined).length, 7);
  assert.equal(orion.counts.none, 1);
  assert.equal(Object.values(orion.counts).reduce((a, b) => a + b, 0), 8);
  assert.deepEqual(orion.viewpoint, { name: undefined, earth: [0, 0, 0] });
  for (const [a, b] of orion.segments) assert.ok(a >= 0 && b >= 0 && a < 8 && b < 8 && a !== b);
  assert.equal(orion.segments.length, figureOf("Ori").segments.length);
});

test("a range holds the best distance, a far end of Infinity has no far place, and a wide error bar is flagged", () => {
  let infinite = 0;
  for (const c of ["Ori", "UMa", "Cas", "Cru", "Sco"]) {
    for (const one of constellationIn3D(c).stars) {
      if (one.position === undefined) continue;
      assert.ok(one.range === undefined || (one.range[0] <= one.lightYears! + 1e-9 && one.lightYears! <= one.range[1] + 1e-9), `${one.id}`);
      if (one.range !== undefined && one.range[1] === Number.POSITIVE_INFINITY) {
        infinite += 1;
        assert.equal(one.farPosition, undefined);
        assert.equal(one.wide, true);
      }
      if (one.range !== undefined && one.nearPosition !== undefined && one.farPosition !== undefined) {
        assert.ok(near(length(one.nearPosition), one.range[0], 1e-6));
        assert.ok(near(length(one.farPosition), one.range[1], 1e-6));
        assert.equal(one.wide, one.range[1] - one.range[0] > one.lightYears!);
      }
    }
  }
  assert.ok(infinite > 0, "Saiph's error reaches its parallax");
  const saiph = constellationIn3D("Ori").stars.find((one) => one.star.name === "Saiph")!;
  assert.equal(saiph.wide, true);
  assert.equal(saiph.range![1], Number.POSITIVE_INFINITY);
  const sirius = constellationIn3D("CMa").stars.find((one) => one.star.name === "Sirius")!;
  assert.equal(sirius.wide, false);
  assert.ok(sirius.range![1] - sirius.range![0] < 0.1 * sirius.lightYears!);
});

test("from the Earth every star lies on its line of sight, so the front view is the sky chart whatever the distances", () => {
  for (const one of constellationIn3D("UMa").stars) {
    if (one.position === undefined) continue;
    const d = length(one.position);
    const direction = one.position.map((n) => n / d);
    for (let i = 0; i < 3; i += 1) assert.ok(near(direction[i]!, one.sight.direction[i]!, 1e-9));
    // and the direction is the star's own right ascension and declination
    const [x, y, z] = positionIn3D(one.star.rightAscension, one.star.declination, 1);
    assert.ok(near(x, one.sight.direction[0], 1e-12) && near(y, one.sight.direction[1], 1e-12) && near(z, one.sight.direction[2], 1e-12));
  }
});

test("the frame: the middle of the figure, up square to it and toward the north, and the figure's radius", () => {
  const orion = constellationIn3D("Ori");
  const { centre, up } = orion.frame;
  assert.ok(near(length(centre), 1) && near(length(up), 1));
  assert.ok(near(centre[0] * up[0] + centre[1] * up[1] + centre[2] * up[2], 0, 1e-9));
  assert.ok(up[2] > 0.9, "north is up");
  // Orion's middle is at right ascension about 5h40m, declination about -1
  const ra = (Math.atan2(centre[1], centre[0]) * 180) / Math.PI / 15;
  assert.ok(ra > 5.3 && ra < 5.9, String(ra));
  assert.ok(orion.radius > 5 && orion.radius < 20, String(orion.radius));
  // a figure at the pole still has an up
  for (const c of ["UMi", "Oct", "Cep", "Cam"]) {
    const frame = constellationIn3D(c).frame;
    assert.ok(near(length(frame.up), 1) && near(length(frame.centre), 1), c);
  }
});

test("seen from Alpha Centauri the Earth is 4.35 light-years away and Orion's stars hardly move; the direction agrees with skyFrom", () => {
  const alpha = starByName("Rigil Kentaurus")!;
  const orion = constellationIn3D("Ori", { from: alpha });
  assert.ok(near(length(orion.viewpoint.earth), 4.35, 0.05));
  const sky = new Map(skyFrom(alpha).map((one) => [one.id, one]));
  for (const one of orion.stars) {
    if (one.position === undefined) {
      assert.equal(sky.has(one.id), false);
      continue;
    }
    const seen = sky.get(one.id)!;
    const [x, y, z] = positionIn3D(seen.rightAscension, seen.declination, seen.lightYears);
    assert.ok(Math.hypot(x - one.position[0], y - one.position[1], z - one.position[2]) < 1e-6, one.id);
    assert.ok(near(one.lightYears!, seen.lightYears, 1e-6));
    const home = constellationIn3D("Ori").stars.find((s) => s.id === one.id)!;
    assert.ok(Math.abs(one.lightYears! - home.lightYears!) <= 4.4, "a star hundreds of light-years away is as far from Alpha Centauri as from us, give or take its distance");
    assert.ok(one.range![0] <= one.lightYears! + 1e-9 && one.lightYears! <= one.range![1] + 1e-9);
  }
  // the unknown star's line of sight starts at the Earth, not at the viewpoint
  const alnilam = orion.stars.find((one) => one.star.name === "Alnilam")!;
  assert.deepEqual(alnilam.sight.origin, orion.viewpoint.earth);
});

test("the viewpoint star is left out of its own figure, a point in parsecs is a viewpoint, and the Sun's place is the origin's opposite", () => {
  const fromBetelgeuse = constellationIn3D("Ori", { from: "Betelgeuse" });
  assert.equal(fromBetelgeuse.stars.length, 7);
  assert.equal(fromBetelgeuse.stars.some((one) => one.star.name === "Betelgeuse"), false);
  assert.equal(fromBetelgeuse.viewpoint.name, "Betelgeuse");
  assert.ok(near(length(fromBetelgeuse.viewpoint.earth), starByName("Betelgeuse") ? constellationIn3D("Ori").stars.find((one) => one.star.name === "Betelgeuse")!.lightYears! : 0, 1e-6));
  assert.equal(fromBetelgeuse.segments.every(([a, b]) => a < 7 && b < 7), true);
  const point = constellationIn3D("Ori", { from: { x: 1, y: 0, z: 0 } });
  assert.ok(near(point.viewpoint.earth[0], -3.261563777, 1e-6));
});

test("bad input is named", () => {
  assert.throws(() => constellationIn3D("Nowhere"), RangeError);
  assert.throws(() => constellationIn3D("Ori", { from: "No Such Star" }), /not a star this package knows/);
  const noDistance = stars().find((star) => !(star.parallaxMas > 0))!;
  assert.throws(() => constellationIn3D("Ori", { from: noDistance }), /no distance/);
  assert.throws(() => constellationIn3D("Ori", { from: { x: Number.NaN, y: 0, z: 0 } }), RangeError);
});

test("distanceQualityTable: one row for each of the 88, and the counts add up to the figures' stars", () => {
  const table = distanceQualityTable();
  assert.equal(table.length, 88);
  for (const row of table) {
    assert.equal(row.stars, figureOf(row.abbreviation).stars.length, row.abbreviation);
    assert.equal(Object.values(row.counts).reduce((a, b) => a + b, 0), row.stars, row.abbreviation);
  }
  const orion = table.find((row) => row.abbreviation === "Ori")!;
  assert.deepEqual(orion.counts, { good: 0, fair: 1, rough: 6, none: 1 });
  assert.ok(table.reduce((total, row) => total + row.counts.good, 0) > 0);
  assert.equal(table.every((row) => row.stars > 0), true);
});
