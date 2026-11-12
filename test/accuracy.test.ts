// The accuracy record: the source of each field of a bright and of a nearby star, the stated error or the resolution, the rules of the grade at their edges, and the counts the guide prints.
import assert from "node:assert/strict";
import { test } from "node:test";
import { GRADE_RULES, STAR_GRADES, gradeAtLeast, starAccuracy, type StarGrade } from "../src/accuracy.ts";
import { QUALITY_LIMITS, distanceQuality } from "../src/constellation-3d.ts";
import { nearbyStarByName, nearbyStars } from "../src/nearby.ts";
import { starByName, stars } from "../src/stars.ts";

test("a bright star names the catalogue each field is from", () => {
  const sirius = starAccuracy(starByName("Sirius")!);
  assert.equal(sirius.layer, "bright");
  assert.equal(sirius.position.source, "BSC");
  assert.equal(sirius.magnitude.source, "BSC");
  assert.equal(sirius.colour.source, "BSC");
  assert.equal(sirius.parallax.source, "GCTP");
  assert.equal(sirius.properMotion.source, "BSC");
});

test("position: the resolution is the catalogue's last digit, and no error is made up", () => {
  const equator = starAccuracy(stars().reduce((best, star) => (Math.abs(star.declination) < Math.abs(best.declination) ? star : best)));
  assert.ok(Math.abs(equator.position.resolution! - 1.5) < 0.01, `${equator.position.resolution}`);
  assert.equal(equator.position.error, undefined);
  const polar = starAccuracy(starByName("Polaris")!);
  assert.equal(polar.position.resolution, 1);
  for (const star of stars()) assert.equal(starAccuracy(star).position.error, undefined);
  assert.equal(starAccuracy(starByName("Sirius")!).position.unit, "arcsec");
});

test("magnitude and colour: a hundredth, no error, and no colour where the catalogue has none", () => {
  const sirius = starAccuracy(starByName("Sirius")!);
  assert.equal(sirius.magnitude.resolution, 0.01);
  assert.equal(sirius.magnitude.error, undefined);
  assert.equal(sirius.colour.resolution, 0.01);
  const noColour = stars().find((star) => star.colourIndex === undefined)!;
  const record = starAccuracy(noColour).colour;
  assert.deepEqual([record.source, record.resolution, record.error], [undefined, undefined, undefined]);
});

test("parallax: the stated error, the source's step and the note of a paper's distance", () => {
  const sirius = starByName("Sirius")!;
  const a = starAccuracy(sirius).parallax;
  assert.equal(a.error, sirius.parallaxErrorMas);
  assert.equal(a.resolution, 0.1);
  assert.equal(a.unit, "mas");
  const betelgeuse = starAccuracy(starByName("Betelgeuse")!).parallax;
  assert.equal(betelgeuse.source, "literature");
  assert.equal(betelgeuse.resolution, 0.01);
  assert.match(betelgeuse.note!, /Joyce/);
  const bsc = stars().find((star) => star.parallaxSource === "BSC")!;
  assert.equal(starAccuracy(bsc).parallax.resolution, 1);
  assert.equal(starAccuracy(bsc).parallax.error, undefined);
  const none = stars().find((star) => star.parallaxSource === undefined)!;
  const noParallax = starAccuracy(none);
  assert.equal(noParallax.parallax.source, undefined);
  assert.equal(noParallax.parallax.resolution, undefined);
  assert.equal(noParallax.distance.quality, "none");
  assert.equal(noParallax.grade, "C");
});

test("proper motion: a whole milliarcsecond a year from the bright catalogue", () => {
  const record = starAccuracy(starByName("Arcturus")!).properMotion;
  assert.deepEqual([record.source, record.resolution, record.unit, record.error], ["BSC", 1, "mas/yr", undefined]);
});

test("the grade rules sit where the distance bands do", () => {
  assert.equal(GRADE_RULES.distance.good, QUALITY_LIMITS.good);
  assert.equal(GRADE_RULES.distance.fair, QUALITY_LIMITS.rough);
  assert.deepEqual([...STAR_GRADES], ["A", "B", "C"]);
});

test("grade A is a good distance and a modern position; the same distance on a coarse position is B", () => {
  const sirius = starAccuracy(starByName("Sirius")!);
  assert.equal(sirius.distance.quality, "good");
  assert.equal(sirius.modernPosition, true);
  assert.equal(sirius.grade, "A");
  const proxima = starAccuracy(nearbyStarByName("Proxima Centauri")!);
  assert.equal(proxima.layer, "nearby");
  assert.equal(proxima.position.source, "2MASS");
  assert.equal(proxima.grade, "A");
  const coarse = nearbyStars({ maxRelativeError: QUALITY_LIMITS.good - 0.001 }).find((star) => star.flags.coarsePosition)!;
  const record = starAccuracy(coarse);
  assert.equal(record.distance.quality, "good");
  assert.equal(record.modernPosition, false);
  assert.equal(record.grade, "B");
  assert.ok(record.position.error! > GRADE_RULES.modernPositionArcsec);
});

test("grade B and C at the edges of the bands", () => {
  const edge = (relative: number): StarGrade => starAccuracy({ ...starByName("Sirius")!, parallaxMas: 100, parallaxErrorMas: 100 * relative }).grade;
  assert.equal(edge(0.049), "A");
  assert.equal(edge(0.05), "B");
  assert.equal(edge(0.2), "B");
  assert.equal(edge(0.201), "C");
});

test("a parallax with no error is rough, except a dynamical one, which is fair", () => {
  const sirius = starByName("Sirius")!;
  assert.equal(starAccuracy({ ...sirius, parallaxErrorMas: undefined, parallaxSource: "BSC" }).grade, "C");
  assert.equal(starAccuracy({ ...sirius, parallaxErrorMas: undefined, parallaxSource: "dynamical" }).grade, "B");
  assert.equal(starAccuracy({ ...sirius, parallaxErrorMas: undefined, parallaxSource: "dynamical" }).distance.relativeError, undefined);
});

test("known stars: Betelgeuse (a paper's distance within 20%) is B, Rigel (a range of 590 to 1,480 light-years) is C, Vega is B or better", () => {
  assert.equal(starAccuracy(starByName("Betelgeuse")!).grade, "B");
  assert.equal(starAccuracy(starByName("Rigel")!).grade, "C");
  assert.ok(gradeAtLeast(starAccuracy(starByName("Vega")!).grade, "B"));
  assert.equal(starAccuracy(starByName("Vega")!).distance.quality, distanceQuality(starByName("Vega")!));
});

test("the nearby tier: a magnitude of a rougher kind says so, and a parallax of 0 or less has no distance", () => {
  const blue = nearbyStars().find((star) => star.magnitudeKind === "blue")!;
  assert.match(starAccuracy(blue).magnitude.note!, /blue/);
  const visual = nearbyStars().find((star) => star.magnitudeKind === "visual")!;
  assert.match(starAccuracy(visual).magnitude.note!, /less accurate/);
  const none = nearbyStars().find((star) => star.flags.excludedFromSpace)!;
  const record = starAccuracy(none);
  assert.equal(record.distance.quality, "none");
  assert.equal(record.distance.relativeError, undefined);
  assert.equal(record.grade, "C");
  assert.equal(record.colour.source, undefined);
  for (const star of nearbyStars().slice(0, 400)) assert.equal(starAccuracy(star).position.error, star.positionErrorArcsec);
});

test("gradeAtLeast orders the grades", () => {
  assert.ok(gradeAtLeast("A", "A") && gradeAtLeast("A", "C") && gradeAtLeast("B", "B") && !gradeAtLeast("C", "B") && !gradeAtLeast("B", "A"));
});

test("the counts by grade that the guide prints", () => {
  const count = (list: readonly (ReturnType<typeof stars>[number] | ReturnType<typeof nearbyStars>[number])[]): Record<StarGrade, number> => {
    const counts: Record<StarGrade, number> = { A: 0, B: 0, C: 0 };
    for (const star of list) counts[starAccuracy(star).grade] += 1;
    return counts;
  };
  console.log("COUNTS bright", JSON.stringify(count(stars())), "nearby", JSON.stringify(count(nearbyStars())));
  assert.equal(Object.values(count(stars())).reduce((a, b) => a + b, 0), 5080);
  assert.equal(Object.values(count(nearbyStars())).reduce((a, b) => a + b, 0), 5565);
});
