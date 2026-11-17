// What makes a pan frame cheap, and that it changes nothing drawn: the projection set up once for a frame gives the very numbers `project` does, the labels are placed as they were with the
// chart's four long edges tested outright, a star the chart cannot show is passed by without being placed, and a frame at zoom 80 over Cygnus costs a few milliseconds, not thirty.
import assert from "node:assert/strict";
import { test } from "node:test";
import { chart, nearEnough, toScreen, type View } from "../src/chart/chart.ts";
import { overlaps, placeLabels, type Box } from "../src/chart/labels.ts";
import { PROJECTIONS, project, projector, type SkyPoint } from "../src/projection.ts";
import { stars } from "../src/stars.ts";

/** The bar for a frame's median in this test: measured at 1 to 1.5 ms here, thirty before the labels were placed as they are now; the margin is the speed of a slow runner. */
const LIMIT_MS = 10;

/** A small deterministic stream of numbers from 0 up to 1. */
function stream(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

test("projector gives exactly the numbers project gives, hidden points and all", () => {
  const next = stream(7);
  for (const kind of PROJECTIONS) {
    for (const options of [{ centre: { rightAscension: 305, declination: 38 }, scale: 4000 }, { centre: { rightAscension: 0, declination: -89 }, scale: 120, rotation: 33, mirror: true }]) {
      const place = projector(kind, options);
      for (let i = 0; i < 200; i++) {
        const point: SkyPoint = { rightAscension: next() * 360, declination: next() * 180 - 90 };
        assert.deepEqual(place(point), project(kind, point, options), `${kind} at ${JSON.stringify(point)}`);
      }
    }
  }
});

test("projector checks its kind and options once, and its points as project does", () => {
  const centre = { rightAscension: 0, declination: 0 };
  assert.throws(() => projector("flat" as never, { centre }), RangeError);
  assert.throws(() => projector("hammer", { centre, scale: 0 }), RangeError);
  assert.throws(() => projector("hammer", { centre: { rightAscension: 0, declination: 91 } }), RangeError);
  assert.throws(() => projector("hammer", { centre })({ rightAscension: 0, declination: 91 }), RangeError);
});

test("placeLabels with the chart's long edges as obstacles places as a plain test of every box does", () => {
  const next = stream(11);
  const edges: Box[] = [{ x0: -1e4, y0: -1e4, x1: 0, y1: 1e4 }, { x0: 640, y0: -1e4, x1: 1e4, y1: 1e4 }, { x0: -1e4, y0: -1e4, x1: 1e4, y1: 0 }, { x0: -1e4, y0: 400, x1: 1e4, y1: 1e4 }];
  const obstacles: Box[] = [...edges];
  for (let i = 0; i < 60; i++) {
    const x = next() * 700 - 30;
    const y = next() * 450 - 30;
    obstacles.push({ x0: x, y0: y, x1: x + 3 + next() * 12, y1: y + 3 + next() * 12 });
  }
  const labels: Box[][] = [];
  for (let i = 0; i < 200; i++) {
    const x = next() * 760 - 60;
    const y = next() * 520 - 60;
    const w = 20 + next() * 60;
    labels.push([{ x0: x, y0: y, x1: x + w, y1: y + 12 }, { x0: x, y0: y - 12, x1: x + w, y1: y }, { x0: x - w, y0: y, x1: x, y1: y + 12 }]);
  }
  const taken: Box[] = [...obstacles];
  const expected = labels.map((places) => {
    const at = places.findIndex((place) => !taken.some((other) => overlaps(place, other)));
    if (at < 0) return undefined;
    taken.push(places[at]!);
    return at;
  });
  assert.deepEqual(placeLabels(labels, obstacles), expected);
  assert.ok(expected.some((at) => at === undefined) && expected.some((at) => at !== undefined), "some labels fit and some do not");
});

test("nearEnough turns away only stars that could not land inside the chart's margin", () => {
  const all = stars();
  const next = stream(3);
  const random = Array.from({ length: 40 }, () => [next() * 360, next() * 170 - 85, 2 + next() * 30, 400 + Math.floor(next() * 800), 300 + Math.floor(next() * 400)] as const);
  for (const projection of ["stereographic", "gnomonic", "orthographic", "equidistant"] as const) {
    for (const [ra, dec, zoom, width, height] of [[305, 38, 80, 1000, 600], [83.8, -5.4, 4, 390, 500], [0, 89, 30, 640, 400], [180, -60, 1, 800, 800], ...random] as const) {
      const view: View = { projection, ra, dec, zoom };
      const near = nearEnough(view, width, height);
      if (near === undefined) continue;
      let turned = 0;
      for (const star of all) {
        if (near(star)) continue;
        turned += 1;
        const at = toScreen(view, width, height, star);
        assert.ok(at === undefined || at[0] <= -24 || at[0] >= width + 24 || at[1] <= -24 || at[1] >= height + 24, `${projection} ${ra} ${dec} ${zoom}: star ${star.hr} at ${String(at)} was turned away`);
      }
      // at zoom 80 nearly the whole catalogue is turned away; the chart never asks for more than the few it can show
      if (zoom === 80) assert.ok(turned > all.length - 60, `${turned} of ${all.length} turned away`);
    }
  }
  assert.equal(nearEnough({ projection: "hammer", ra: 0, dec: 0, zoom: 1 }, 640, 400), undefined);
});

test("a pan frame at zoom 80 over Cygnus draws in a few milliseconds", () => {
  const frame = (i: number): void => {
    chart({ projection: "stereographic", ra: 305 + Math.sin(i / 15) * 3, dec: 38 + Math.cos(i / 15) * 1.5, zoom: 80, width: 1000, height: 600, magnitude: 5, layers: new Set(["milky", "lines", "names", "pictures", "grid"]), lang: "en" });
  };
  for (let i = 0; i < 10; i++) frame(i);
  const times: number[] = [];
  for (let i = 0; i < 60; i++) {
    const start = performance.now();
    frame(i);
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  const median = times[times.length >> 1]!;
  console.log(`pan frame: median ${median.toFixed(2)} ms, 95th percentile ${times[Math.floor(times.length * 0.95)]!.toFixed(2)} ms`);
  assert.ok(median < LIMIT_MS, `median ${median.toFixed(2)} ms against ${LIMIT_MS}`);
});
