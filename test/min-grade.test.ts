// `minGrade` on stars(), nearbyStars() and nearest(), and the range and the tie that a query by space gives each answer.
import assert from "node:assert/strict";
import { test } from "node:test";
import { gradeAtLeast, starAccuracy, starGrade } from "../src/accuracy.ts";
import { nearest } from "../src/nearest.ts";
import { nearbyStars } from "../src/nearby.ts";
import { starByName, stars } from "../src/stars.ts";

test("stars({ minGrade }) keeps the grade and better, in the table's order", () => {
  assert.equal(stars({ minGrade: "A" }).length, 68);
  assert.equal(stars({ minGrade: "B" }).length, 68 + 461);
  assert.equal(stars({ minGrade: "C" }).length, 5080);
  assert.equal(stars().length, 5080);
  assert.ok(stars({ minGrade: "B" }).every((star) => gradeAtLeast(starAccuracy(star).grade, "B")));
  const all = stars();
  assert.deepEqual(stars({ minGrade: "A" }), all.filter((star) => starGrade(star) === "A"));
  assert.equal(stars({ minGrade: "A", magnitude: 2 }).every((star) => star.magnitude <= 2 && starGrade(star) === "A"), true);
});

test("starGrade is the grade of starAccuracy, for every star of both tiers", () => {
  for (const star of stars()) assert.equal(starGrade(star), starAccuracy(star).grade);
  for (const star of nearbyStars()) assert.equal(starGrade(star), starAccuracy(star).grade);
});

test("nearbyStars({ minGrade }) filters the same way and combines with the other options", () => {
  assert.equal(nearbyStars({ minGrade: "A" }).length, 235);
  assert.equal(nearbyStars({ minGrade: "B" }).length, 235 + 1282);
  assert.equal(nearbyStars({ minGrade: "C" }).length, 5565);
  const both = nearbyStars({ minGrade: "A", maxRelativeError: 0.01 });
  assert.ok(both.length > 0 && both.every((star) => star.relativeError! <= 0.01 && starGrade(star) === "A"));
});

test("a bad minGrade is a RangeError that names the option", () => {
  assert.throws(() => stars({ minGrade: "D" as never }), /minGrade must be "A", "B" or "C", got D/);
  assert.throws(() => nearbyStars({ minGrade: "a" as never }), /minGrade/);
  assert.throws(() => nearest("Sirius", { minGrade: 1 as never }), /minGrade/);
});

test("nearest({ minGrade }) looks only at stars of that grade, by sky and by space", () => {
  const sky = nearest("Mizar", { count: 5, minGrade: "B" });
  assert.equal(sky.length, 5);
  assert.ok(sky.every((found) => gradeAtLeast(starGrade(found.thing), "B")));
  const space = nearest("Sirius", { by: "space", count: 10, minGrade: "A" });
  assert.ok(space.every((found) => starGrade(found.thing) === "A"));
  const unfiltered = nearest("Sirius", { by: "space", count: Infinity }).filter((found) => starGrade(found.thing) === "A").slice(0, 10);
  assert.deepEqual(space.map((found) => found.thing.hr), unfiltered.map((found) => found.thing.hr));
  const mixed = nearest("Sirius", { by: "space", count: 10, minGrade: "A", among: [...stars(), ...nearbyStars()] });
  assert.ok(mixed.every((found) => starGrade(found.thing) === "A"));
});

test("a deep-sky object has no grade: an error by kind, left out of a mixed list", () => {
  assert.throws(() => nearest("M31", { kind: "deep-sky", minGrade: "A" }), /deep-sky object has no grade/);
  const found = nearest("Mizar", { count: 3, minGrade: "C", among: [...stars().slice(0, 5), ...(nearest("Mizar", { kind: "deep-sky", count: 3 }).map((one) => one.thing))] });
  assert.ok(found.every((one) => "hr" in one.thing));
});

test("by space each answer has its range, and the range is the distance one error each way", () => {
  const found = nearest("Sirius", { by: "space", count: 5, among: [...stars(), ...nearbyStars()] });
  for (const one of found) {
    if (one.error === undefined) {
      assert.equal(one.range, undefined);
      assert.equal(one.tied, false);
    } else {
      assert.ok(Math.abs(one.range![0] - Math.max(0, one.distance - one.error)) < 1e-9);
      assert.ok(Math.abs(one.range![1] - (one.distance + one.error)) < 1e-9);
    }
  }
});

test("a tie is called when the ranges overlap, and not when they do not", () => {
  const vega = starByName("Vega")!;
  const star = (parallaxMas: number, parallaxErrorMas: number | undefined) => ({ ...vega, hr: -1, parallaxMas, parallaxErrorMas, rightAscension: 90, declination: 0 });
  // The target is a point at the origin of the sky direction with an exact distance of 10 light-years; the others lie in the same direction at 1000 / plx parsecs.
  const target = { rightAscension: 90, declination: 0, lightYears: 10 };
  // 100 mas = 32.6 ly, 90 mas = 36.2 ly, 50 mas = 65.2 ly, 20 mas = 163 ly.
  const among = [star(100, 8), star(90, 8), star(50, 0.5), star(20, 0.1), star(10, undefined)];
  const found = nearest(target, { by: "space", among, count: Infinity });
  const byParallax = found.map((one) => ({ mas: one.thing.parallaxMas, tied: one.tied, range: one.range }));
  assert.deepEqual(byParallax.map((one) => one.mas), [100, 90, 50, 20, 10]);
  assert.deepEqual(byParallax.map((one) => one.tied), [true, true, false, false, false]);
  assert.equal(byParallax[4]!.range, undefined);
  // With a count the last answer still ties with the next one beyond it.
  const two = nearest(target, { by: "space", among, count: 1 });
  assert.equal(two[0]!.tied, true);
});

test("a range never goes below 0, and a lone answer is not a tie", () => {
  const vega = starByName("Vega")!;
  const near = { ...vega, hr: -2, parallaxMas: 2, parallaxErrorMas: 3, rightAscension: 90, declination: 0 };
  const found = nearest({ rightAscension: 90, declination: 0, lightYears: 1 }, { by: "space", among: [near], count: 1 });
  assert.equal(found[0]!.range![0], 0);
  assert.equal(found[0]!.tied, false);
});
