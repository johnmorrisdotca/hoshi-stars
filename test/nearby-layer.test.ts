// The chart's Nearby layer: a ring on each nearby star in view from a close zoom, its dot unless the faint layer draws it, its name when it has one; off, too wide, or with no data, nothing is drawn.
import assert from "node:assert/strict";
import { test } from "node:test";
import { chart, DEFAULT_VIEW, NEARBY_FROM_ZOOM, type NearbyMark } from "../src/chart/chart.ts";
import { nearbyStars } from "../src/nearby.ts";

const options = { ...DEFAULT_VIEW, zoom: 20, width: 800, height: 600, magnitude: 5, lang: "en" as const };
const here = (offset: number, extra: Partial<NearbyMark> = {}): NearbyMark => ({ id: `gctp-${offset}`, rightAscension: DEFAULT_VIEW.ra + offset * 0.1, declination: DEFAULT_VIEW.dec + 0.2, magnitude: 11, ...extra });
const rings = (svg: string): number => (svg.match(/data-nearby-ring=/g) ?? []).length;
const dots = (svg: string): number => (svg.match(/data-nearby="/g) ?? []).length;
const layers = new Set(["nearby"] as const);

test("each nearby star in view is a ring with its dot, and the chart says how many", () => {
  const nearby = [here(1), here(2), here(3, { magnitude: undefined }), { ...here(4), rightAscension: DEFAULT_VIEW.ra + 170 }];
  const out = chart({ ...options, layers, nearby });
  assert.equal(out.nearby?.drawn, 3);
  assert.equal(rings(out.svg), 3);
  assert.equal(dots(out.svg), 2);
});

test("nothing is drawn with the layer off, no data, a zoom short of NEARBY_FROM_ZOOM, or the sky seen from another star", () => {
  const nearby = [here(1), here(2)];
  assert.equal(chart({ ...options, layers: new Set(["lines"] as const), nearby }).nearby, undefined);
  assert.equal(chart({ ...options, layers }).nearby, undefined);
  assert.equal(chart({ ...options, layers, nearby, zoom: NEARBY_FROM_ZOOM - 0.5 }).nearby, undefined);
  assert.equal(chart({ ...options, layers, nearby, zoom: NEARBY_FROM_ZOOM }).nearby?.drawn, 2);
  assert.equal(chart({ ...options, layers, nearby, sky: Object.assign([], { skipped: 0 }) }).nearby, undefined);
});

test("a star the faint layer draws keeps only its ring, one the faint layer does not reach gets its own dot", () => {
  const nearby = [here(1, { inFaint: true, magnitude: 10 }), here(2, { inFaint: true, magnitude: 13 }), here(3, { magnitude: 10 })];
  const faint = { stars: [], depth: 11 };
  const out = chart({ ...options, layers: new Set(["nearby", "faint"] as const), nearby, faint });
  assert.equal(rings(out.svg), 3);
  assert.equal(dots(out.svg), 2);
  assert.ok(!out.svg.includes('data-nearby="gctp-1"'));
  const without = chart({ ...options, layers, nearby });
  assert.equal(dots(without.svg), 3);
});

test("a named star is named when names are on", () => {
  const nearby = [here(1, { name: "Proxima Centauri" })];
  assert.ok(chart({ ...options, layers: new Set(["nearby", "names"] as const), nearby }).svg.includes("Proxima Centauri"));
  assert.ok(!chart({ ...options, layers, nearby }).svg.includes("Proxima Centauri"));
});

test("the whole table works as the layer's data: Proxima Centauri is a ring, named, in its own field", () => {
  const stars = nearbyStars();
  const proxima = stars.find((star) => star.name === "Proxima Centauri")!;
  const nearby = stars.map((star) => ({ id: star.id, name: star.name, rightAscension: star.rightAscension, declination: star.declination, magnitude: star.magnitude }));
  const out = chart({ ...options, ra: proxima.rightAscension, dec: proxima.declination, zoom: 40, layers: new Set(["nearby", "names"] as const), nearby });
  assert.ok(out.nearby!.drawn >= 1);
  assert.ok(out.svg.includes(`data-nearby-ring="${proxima.id}"`));
  assert.ok(out.svg.includes("Proxima Centauri"));
});
