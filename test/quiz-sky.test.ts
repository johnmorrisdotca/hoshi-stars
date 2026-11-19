// The quiz's sky by latitude: what a reader at a latitude can see on the evening of the 15th. Pure, no browser.
import assert from "node:assert/strict";
import { test } from "node:test";
import { askedLatitude, isSeen, isSeenIn, latitudeOf, LATITUDE, MAX_LATITUDE, seenIn } from "../demo/quiz-sky.ts";
import { figureOf } from "../src/lines.ts";

const stars = (abbreviation: string) => figureOf(abbreviation).stars;

test("a latitude is a whole number of degrees from -90 to 90: decimals are rounded, the rest is no latitude", () => {
  assert.equal(MAX_LATITUDE, 90);
  assert.equal(latitudeOf("40"), 40);
  assert.equal(latitudeOf(" -35 "), -35);
  assert.equal(latitudeOf("49.28"), 49);
  assert.equal(latitudeOf("-34.6"), -35);
  assert.equal(latitudeOf("+12"), 12);
  assert.equal(Object.is(latitudeOf("-0.2"), 0), true, "not minus zero");
  assert.equal(latitudeOf("90"), 90);
  assert.equal(latitudeOf("-90"), -90);
  for (const bad of ["90.1", "-91", "100", "abc", "", "  ", "4e1", "40 N", "NaN", "Infinity", null, undefined]) assert.equal(latitudeOf(bad), null, String(bad));
});

test("the old hemisphere is 40 or -40, and a latitude wins over it", () => {
  assert.deepEqual(LATITUDE, { north: 40, south: -40 });
  assert.equal(askedLatitude(null, "north"), 40);
  assert.equal(askedLatitude(null, "south"), -40);
  assert.equal(askedLatitude(null, "east"), null);
  assert.equal(askedLatitude(null, null), null);
  assert.equal(askedLatitude("12", "north"), 12);
  assert.equal(askedLatitude("0", "south"), 0);
  assert.equal(askedLatitude("200", "south"), -40, "a bad latitude is ignored");
  assert.equal(askedLatitude("200", null), null);
});

test("the Southern Cross is out at +40 and in at -35 (May evening); Polaris and the Little Bear are out at -40", () => {
  const cross = stars("Cru");
  assert.ok(cross.length >= 4);
  assert.equal(isSeenIn(cross, 40, 0), false, "never, at any time of the year, at +40");
  assert.equal(isSeenIn(cross, 40, 5), false);
  assert.equal(isSeen(cross, -35, 5), true);
  assert.equal(isSeenIn(cross, -35, 0), true);
  const bear = stars("UMi");
  assert.equal(isSeenIn(bear, -40, 0), false, "the Little Bear never comes up at -40");
  assert.equal(isSeenIn(bear, 40, 0), true);
  assert.ok(seenIn(40, 1).includes("Ori") && !seenIn(40, 1).includes("Cru"));
  assert.ok(seenIn(-35, 5).includes("Cru"));
  assert.ok(!seenIn(-40, 0 + 1).includes("UMi"));
});

test("at the poles only one side of the sky is up: the stars' declination is their altitude", () => {
  const north = seenIn(90, 1);
  const south = seenIn(-90, 1);
  assert.ok(north.includes("UMa") && north.includes("UMi") && north.includes("Cas"));
  assert.ok(!north.includes("Cru") && !north.includes("Oct"));
  assert.ok(south.includes("Oct") && south.includes("Cru") && !south.includes("UMi"));
  // at the equator the whole sky comes up in the year, so every figure is seen at some time
  assert.equal(isSeenIn(stars("UMi"), 0, 0), true, "even the Little Bear's tail reaches 10 degrees at the equator");
  assert.equal(isSeenIn(stars("Oct"), 0, 0), false, "Octans stays below 10 degrees at the equator");
});

test("the same figure and month give a different pool at a different latitude, and the pool is cached by latitude", () => {
  const a = seenIn(60, 6);
  const b = seenIn(-60, 6);
  assert.notDeepEqual(a, b);
  assert.equal(seenIn(60, 6), a, "the same list again");
  assert.ok(seenIn(45, 3).length > 20 && seenIn(0, 3).length > seenIn(80, 3).length, "more of the sky is up at the equator than at 80 degrees over a year");
});
