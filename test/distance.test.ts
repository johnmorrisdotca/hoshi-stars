// The sky out to a distance: the bands, a limit that keeps the nearer things, a rough distance kept apart in its own band with the range its error allows, a thing with no distance counted and never placed, and the slider and the address.
import assert from "node:assert/strict";
import { test } from "node:test";
import { QUALITY_LIMITS, distanceQuality } from "../src/constellation-3d.ts";
import { deepSkyObject, galaxyDistance, messier } from "../src/deep-sky.ts";
import {
  bandOf,
  CERTAINTY_LIMITS,
  certaintyOf,
  DISTANCE_ATTRIBUTE,
  DISTANCE_LIMITS,
  deepSkyInput,
  layersByDistance,
  limitAtSlider,
  limitFromText,
  limitText,
  nearbyInput,
  SLIDER_RANGE,
  sliderOfLimit,
  starInput,
  stepLimit,
  type DistanceInput,
} from "../src/distance.ts";
import { nearbyStarByName, nearbyStars } from "../src/nearby.ts";
import { starByName, stars } from "../src/stars.ts";

const thing = (id: string, lightYears: number | undefined, certainty: DistanceInput["certainty"] = "good", low = lightYears, high = lightYears): DistanceInput => ({ id, kind: "star", name: id, rightAscension: 0, declination: 0, magnitude: 3, lightYears, low, high, certainty });

test("a distance is in the band of its edge, the nearer one at exactly an edge", () => {
  assert.deepEqual([4.2, 10, 10.01, 50, 99.9, 100, 444, 1000, 1000.1, 2_500_000].map(bandOf), [0, 0, 1, 1, 2, 2, 3, 4, 5, 5]);
  assert.deepEqual([...DISTANCE_LIMITS], [10, 50, 100, 500, 1000]);
});

test("the certainty limits are the constellation in 3D's, so a star is as certain in both", () => {
  assert.deepEqual({ ...CERTAINTY_LIMITS }, { ...QUALITY_LIMITS });
  assert.deepEqual([0.01, 0.0499, 0.05, 0.2, 0.21, undefined, -1].map(certaintyOf), ["good", "good", "fair", "fair", "rough", "rough", "rough"]);
  for (const star of stars()) {
    const input = starInput(star);
    const quality = distanceQuality(star);
    assert.equal(input.certainty, quality === "none" ? undefined : quality === "fair" && star.parallaxErrorMas === undefined ? "rough" : quality);
  }
});

test("a limit keeps the things nearer than it, nearest first, each counted in its band", () => {
  const layers = layersByDistance([thing("c", 120), thing("a", 4), thing("b", 40), thing("d", 700)], { limit: 100 });
  assert.deepEqual(layers.things.map((one) => one.id), ["a", "b"]);
  assert.deepEqual(layers.counts, [1, 1, 0, 0, 0, 0]);
  assert.deepEqual(layers.things.map((one) => one.band), [0, 1]);
  assert.equal(layers.limit, 100);
  const all = layersByDistance([thing("c", 120), thing("a", 4), thing("d", 700)]);
  assert.equal(all.things.length, 3);
  assert.equal(all.limit, Number.POSITIVE_INFINITY);
  assert.deepEqual(all.counts, [1, 0, 0, 1, 1, 0]);
});

test("a thing with no distance is counted and never placed, whatever the limit", () => {
  for (const limit of [10, 1000, undefined]) {
    const layers = layersByDistance([thing("a", 5), thing("none", undefined, undefined), thing("zero", 0, "good")], { limit });
    assert.deepEqual(layers.things.map((one) => one.id), ["a"]);
    assert.equal(layers.unknown, 2);
  }
});

test("a rough distance is kept apart as uncertain, in no band, when the nearest its error allows is inside the limit", () => {
  const rigel = starInput(starByName("Rigel")!);
  assert.equal(rigel.certainty, "rough");
  assert.ok(Math.abs(rigel.low! - 593) < 5 && Math.abs(rigel.high! - 1483) < 10);
  const at300 = layersByDistance([rigel], { limit: 700 });
  assert.equal(at300.things.length, 1, "its range reaches inside 700 light-years");
  assert.equal(at300.things[0]!.uncertain, true);
  assert.equal(at300.uncertain, 1);
  assert.deepEqual(at300.counts, [0, 0, 0, 0, 0, 0], "and it is in no band");
  assert.equal(layersByDistance([rigel], { limit: 500 }).things.length, 0, "it cannot be inside 500");
  const lone = thing("wide", 40, "rough", 20, Number.POSITIVE_INFINITY);
  assert.equal(layersByDistance([lone], { limit: 30 }).uncertain, 1);
  assert.equal(layersByDistance([lone], { limit: 15 }).uncertain, 0);
});

test("a star's distance is the parallax's, with its range one error each way and none above where the error is as large as the parallax", () => {
  const sirius = starInput(starByName("Sirius")!);
  assert.ok(Math.abs(sirius.lightYears! - 8.6) < 0.1);
  assert.equal(sirius.certainty, "good");
  assert.equal(sirius.id, "hr-2491");
  const noError = starInput({ hr: 1, name: undefined, rightAscension: 0, declination: 0, magnitude: 5, parallaxMas: 10, parallaxErrorMas: undefined });
  assert.equal(noError.certainty, "rough");
  assert.equal(noError.low, noError.lightYears);
  const huge = starInput({ hr: 2, name: undefined, rightAscension: 0, declination: 0, magnitude: 5, parallaxMas: 5, parallaxErrorMas: 6 });
  assert.equal(huge.high, Number.POSITIVE_INFINITY);
  const none = starInput({ hr: 3, name: undefined, rightAscension: 0, declination: 0, magnitude: 5, parallaxMas: 0, parallaxErrorMas: 2 });
  assert.equal(none.lightYears, undefined);
  assert.equal(none.certainty, undefined);
});

test("the real sky: Proxima is in the first layer, Andromeda only in the last, and every thing counted once", () => {
  const proxima = nearbyInput(nearbyStarByName("Proxima Centauri")!);
  assert.ok(Math.abs(proxima.lightYears! - 4.24) < 0.1);
  assert.equal(layersByDistance([proxima], { limit: 10 }).counts[0], 1);
  const m31 = deepSkyObject("M31")!;
  const andromeda = deepSkyInput(m31, galaxyDistance(m31));
  assert.ok(andromeda.lightYears! > 2_000_000 && andromeda.lightYears! < 3_000_000);
  assert.equal(andromeda.kind, "deep-sky");
  assert.equal(layersByDistance([andromeda], { limit: 1000 }).things.length, 0);
  assert.equal(layersByDistance([andromeda]).things.length, 1);
  assert.equal(deepSkyInput(deepSkyObject("M42")!, null).lightYears, undefined);
  const inputs = [...stars().map(starInput), ...nearbyStars().map(nearbyInput), ...messier().map((object) => deepSkyInput(object, galaxyDistance(object)))];
  const everything = layersByDistance(inputs);
  assert.equal(everything.things.length + everything.unknown, inputs.length);
  assert.equal(everything.counts.reduce((sum, n) => sum + n, 0) + everything.uncertain, everything.things.length);
  let before = 0;
  for (const limit of [10, 50, 100, 500, 1000, Number.POSITIVE_INFINITY]) {
    const layers = layersByDistance(inputs, { limit });
    assert.ok(layers.things.length >= before, "stepping out only adds");
    before = layers.things.length;
    assert.ok(layers.things.every((one) => (one.uncertain ? one.low : one.lightYears) <= limit));
  }
});

test("stepping the limit goes 10, 50, 100, 500, 1,000, all, and back", () => {
  assert.deepEqual([10, 50, 100, 500, 1000].map((limit) => stepLimit(limit, 1)), [50, 100, 500, 1000, Number.POSITIVE_INFINITY]);
  assert.equal(stepLimit(Number.POSITIVE_INFINITY, 1), Number.POSITIVE_INFINITY);
  assert.deepEqual([Number.POSITIVE_INFINITY, 1000, 100, 50, 10].map((limit) => stepLimit(limit, -1)), [1000, 500, 50, 10, 10]);
  assert.equal(stepLimit(70, 1), 100);
  assert.equal(stepLimit(70, -1), 50);
  assert.equal(stepLimit(3, 1), 10);
});

test("the free slider is a log scale from 4 light-years to 3 million and its end is all", () => {
  assert.equal(limitAtSlider(0), SLIDER_RANGE[0]);
  assert.equal(limitAtSlider(1), Number.POSITIVE_INFINITY);
  assert.ok(limitAtSlider(0.999) < SLIDER_RANGE[1] && limitAtSlider(0.999) > 1_000_000);
  for (const limit of [4, 10, 50, 100, 500, 1000, 250_000]) assert.ok(Math.abs(limitAtSlider(sliderOfLimit(limit)) / limit - 1) < 1e-9);
  assert.equal(sliderOfLimit(Number.POSITIVE_INFINITY), 1);
  assert.equal(sliderOfLimit(1), 0);
  assert.ok(limitAtSlider(0.2) < limitAtSlider(0.4));
  assert.equal(limitAtSlider(-5), SLIDER_RANGE[0]);
});

test("the limit attribute is off when missing, and a number of light-years or all otherwise", () => {
  assert.equal(DISTANCE_ATTRIBUTE, "distance-limit");
  assert.equal(limitFromText(null), undefined);
  assert.equal(limitFromText(undefined), undefined);
  assert.equal(limitFromText(""), undefined);
  assert.equal(limitFromText("far"), undefined);
  assert.equal(limitFromText("-5"), undefined);
  assert.equal(limitFromText("0"), undefined);
  assert.equal(limitFromText("100"), 100);
  assert.equal(limitFromText(" 12.5 "), 12.5);
  assert.equal(limitFromText("ALL"), Number.POSITIVE_INFINITY);
  assert.equal(limitFromText("99999999"), SLIDER_RANGE[1]);
  assert.deepEqual([100, 10, Number.POSITIVE_INFINITY, 137.9, 12.04].map(limitText), ["100", "10", "all", "140", "12"]);
  for (const limit of [10, 50, 100, 500, 1000, Number.POSITIVE_INFINITY]) assert.equal(limitFromText(limitText(limit)), limit);
});
