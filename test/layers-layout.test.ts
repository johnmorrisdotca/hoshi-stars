// Where the layers go in space: a thing at its direction and its true distance out to 1,000 light-years, an uncertain thing as a streak and never a dot, the shells where they belong, and compressed distances (said so) beyond.
import assert from "node:assert/strict";
import { test } from "node:test";
import { layersByDistance, starInput, nearbyInput, deepSkyInput, type DistanceInput } from "../src/distance.ts";
import { deepSkyObject, galaxyDistance, messier } from "../src/deep-sky.ts";
import { nearbyStars } from "../src/nearby.ts";
import { starByName, stars } from "../src/stars.ts";
import { direction, edgeOf, layoutLayers } from "../demo/layers-layout.ts";

const thing = (id: string, ra: number, dec: number, lightYears: number | undefined, certainty: DistanceInput["certainty"] = "good", low = lightYears, high = lightYears): DistanceInput => ({ id, kind: "star", name: id, rightAscension: ra, declination: dec, magnitude: 3, lightYears, low, high, certainty });
const length = (v: Float32Array, i: number): number => Math.hypot(v[i * 3]!, v[i * 3 + 1]!, v[i * 3 + 2]!);

test("a direction is a unit vector on the equatorial axes", () => {
  assert.deepEqual(direction(0, 0).map((n) => Math.round(n * 1e9) / 1e9 + 0), [1, 0, 0]);
  assert.deepEqual(direction(90, 0).map((n) => Math.round(n * 1e9) / 1e9 + 0), [0, 1, 0]);
  assert.deepEqual(direction(123, 90).map((n) => Math.round(n * 1e9) / 1e9 + 0), [0, 0, 1]);
});

test("out to 1,000 light-years the scale is true: a radius is the distance over the limit, and the shells are at the steps", () => {
  const layout = layoutLayers(layersByDistance([thing("a", 10, 20, 50), thing("b", 200, -40, 25)], { limit: 100 }));
  assert.equal(layout.scale, "linear");
  assert.equal(layout.edge, 100);
  assert.deepEqual(layout.shells.map((s) => [s.lightYears, s.radius]), [[10, 0.1], [50, 0.5], [100, 1]]);
  assert.equal(layout.dots.count, 2);
  assert.ok(Math.abs(length(layout.dots.positions, 0) - 0.25) < 1e-6, "the nearer is first, at 25 of 100");
  assert.ok(Math.abs(length(layout.dots.positions, 1) - 0.5) < 1e-6);
  const [x, y, z] = direction(10, 20);
  assert.ok(Math.abs(layout.dots.positions[3]! - x * 0.5) < 1e-6 && Math.abs(layout.dots.positions[4]! - y * 0.5) < 1e-6 && Math.abs(layout.dots.positions[5]! - z * 0.5) < 1e-6);
  assert.deepEqual([...layout.dots.bands], [1, 1]);
});

test("an uncertain thing is a streak from the nearest to the farthest its error allows and has no dot, cut at the edge", () => {
  const layout = layoutLayers(layersByDistance([thing("u", 83, 7, 400, "rough", 225, 640), thing("a", 10, 20, 50)], { limit: 500 }));
  assert.equal(layout.dots.count, 1);
  assert.equal(layout.streaks.count, 1);
  assert.ok(Math.abs(length(layout.streaks.near, 0) - 225 / 500) < 1e-6);
  assert.ok(Math.abs(length(layout.streaks.far, 0) - 1) < 1e-6, "640 is cut at the 500 edge");
  const open = layoutLayers(layersByDistance([thing("u", 83, 7, 40, "rough", 30, Number.POSITIVE_INFINITY)], { limit: 100 }));
  assert.ok(Math.abs(length(open.streaks.far, 0) - 1) < 1e-6, "no upper limit runs to the edge");
});

test("a thing with no distance has no place at all", () => {
  const layout = layoutLayers(layersByDistance([thing("n", 5, 5, undefined, undefined), thing("a", 10, 20, 50)], { limit: 100 }));
  assert.equal(layout.dots.count + layout.streaks.count, 1);
});

test("beyond 1,000 light-years the distances are compressed, each decade the same step, and the shells are the decades", () => {
  const layers = layersByDistance([thing("near", 0, 0, 5), thing("m", 0, 0, 4000), thing("far", 0, 0, 2_500_000)]);
  const layout = layoutLayers(layers);
  assert.equal(layout.scale, "log");
  assert.equal(layout.edge, 10_000_000);
  assert.deepEqual(layout.shells.map((s) => s.lightYears), [10, 100, 1000, 10_000, 100_000, 1_000_000, 10_000_000]);
  const steps = layout.shells.slice(1).map((s, i) => s.radius - layout.shells[i]!.radius);
  assert.ok(steps.every((step) => Math.abs(step - steps[0]!) < 1e-9), "each decade is the same step");
  assert.ok(layout.radial(5) < layout.radial(4000) && layout.radial(4000) < layout.radial(2_500_000) && layout.radial(2_500_000) < 1);
  assert.ok(layout.radial(5) > 0.05, "the nearest is not on the Earth");
  assert.equal(edgeOf(layersByDistance([thing("a", 0, 0, 800)], { limit: 1000 })), 1000);
  assert.equal(edgeOf(layersByDistance([thing("a", 0, 0, 800)], { limit: 5000 })), 5000, "a limit past 1,000 is the edge");
  assert.equal(edgeOf(layersByDistance([thing("a", 0, 0, 800), thing("b", 0, 0, 30_000)])), 100_000, "with no limit the edge is the decade over the farthest thing");
});

test("the real sky lays out: every certain thing a dot inside the unit sphere, every uncertain thing a streak", () => {
  const inputs = [...stars().map(starInput), ...nearbyStars().map(nearbyInput), ...messier().map((o) => deepSkyInput(o, galaxyDistance(o)))];
  for (const limit of [10, 100, 1000, Number.POSITIVE_INFINITY]) {
    const layers = layersByDistance(inputs, { limit });
    const layout = layoutLayers(layers);
    assert.equal(layout.dots.count, layers.counts.reduce((a, b) => a + b, 0));
    assert.equal(layout.streaks.count, layers.uncertain);
    for (let i = 0; i < layout.dots.count; i += 1) assert.ok(length(layout.dots.positions, i) <= 1 + 1e-6);
    for (let i = 0; i < layout.streaks.count; i += 1) assert.ok(length(layout.streaks.near, i) <= length(layout.streaks.far, i) + 1e-6);
  }
  const m31 = layoutLayers(layersByDistance([deepSkyInput(deepSkyObject("M31")!, galaxyDistance(deepSkyObject("M31")!))]));
  assert.deepEqual([...m31.dots.kinds], [1]);
  const rigel = layoutLayers(layersByDistance([starInput(starByName("Rigel")!)], { limit: 1000 }));
  assert.equal(rigel.dots.count, 0);
  assert.equal(rigel.streaks.count, 1);
  const betelgeuse = layoutLayers(layersByDistance([starInput(starByName("Betelgeuse")!)], { limit: 1000 }));
  assert.equal(betelgeuse.dots.count, 1, "Betelgeuse's paper distance is known to 15%: a dot");
  assert.equal(betelgeuse.streaks.count, 0);
});
