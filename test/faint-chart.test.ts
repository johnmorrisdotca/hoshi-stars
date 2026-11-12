// The faint layer of the demo's chart: a view never draws more than the cap, the brightest first, and says how deep it is complete; the layer is a few paths, never a node a star; off, it draws nothing.
import assert from "node:assert/strict";
import { test } from "node:test";
import { chart, DEFAULT_VIEW, FAINT_DOT_CAP, faintDepthOf, FAINT_FROM, type FaintDraw } from "../src/chart/chart.ts";
import { DEFAULT_LAYERS } from "../demo/choice.ts";
import type { FaintStar } from "../src/faint.ts";

const options = { ...DEFAULT_VIEW, zoom: 40, width: 800, height: 600, magnitude: 5, lang: "en" as const };

/** `count` stars spread over the part of the sky the view shows, one every 0.0003 magnitude from 8 up (9,000 reach 10.7). */
function crowd(count: number): FaintStar[] {
  return Array.from({ length: count }, (_, i): FaintStar => ({ rightAscension: DEFAULT_VIEW.ra + ((i * 7919) % 1000) / 1000 * 2 - 1, declination: DEFAULT_VIEW.dec + ((i * 104729) % 1000) / 1000 * 1.4 - 0.7, magnitude: 8 + i * 0.0003, colourIndex: i % 5 === 0 ? undefined : (i % 17) / 10 - 0.2 }));
}

test("the faint layer is a few paths, and says how many stars it drew and how deep", () => {
  const faint: FaintDraw = { stars: crowd(300), depth: 11 };
  const out = chart({ ...options, layers: new Set(DEFAULT_LAYERS), faint });
  assert.equal(out.faint?.drawn, 300);
  assert.equal(out.faint?.depth, 11);
  const group = /<g data-layer="faint">(.*?)<\/g>/.exec(out.svg)![1]!;
  assert.ok((group.match(/<path /g) ?? []).length <= 24);
  assert.ok(!group.includes("<circle"));
  assert.equal((group.match(/M/g) ?? []).length, 300);
});

test("a crowd is cut at the cap, brightest first, and the depth drops to the magnitude of the cut", () => {
  const faint: FaintDraw = { stars: crowd(FAINT_DOT_CAP + 3000), depth: 12 };
  const out = chart({ ...options, layers: new Set(DEFAULT_LAYERS), faint });
  assert.equal(out.faint?.drawn, FAINT_DOT_CAP);
  assert.ok(out.faint!.depth < 12 && out.faint!.depth > 8);
  assert.equal((/<g data-layer="faint">(.*?)<\/g>/.exec(out.svg)![1]!.match(/M/g) ?? []).length, FAINT_DOT_CAP);
});

test("with the layer off, or no stars handed in, or the sky seen from another star, nothing is drawn and nothing said", () => {
  const faint: FaintDraw = { stars: crowd(50), depth: 11 };
  assert.ok(!chart({ ...options, layers: new Set(["milky", "lines"] as const), faint }).svg.includes('data-layer="faint"'));
  assert.equal(chart({ ...options, layers: new Set(DEFAULT_LAYERS) }).faint, undefined);
  assert.equal(chart({ ...options, layers: new Set(["faint"] as const), faint: { stars: [], depth: 9 } }).faint?.drawn, 0);
});

test("the depth follows the telescope rule up to magnitude 12, jumps past UCAC4's thin 6.5 to 8 band once zoomed in (chart zoom 8, about 3x on the readout), and the layer starts past 7", () => {
  assert.equal(faintDepthOf(5, 1), 5);
  assert.equal(faintDepthOf(5, 2), 5.75);
  assert.equal(faintDepthOf(5, 7.9), 7.24);
  assert.equal(faintDepthOf(5, 8), 8.5);
  assert.equal(faintDepthOf(5, 28), 9.86);
  assert.equal(faintDepthOf(5, 140), 11.61);
  assert.equal(faintDepthOf(5, 280), 12);
  assert.equal(faintDepthOf(6, 1000), 12);
  assert.equal(faintDepthOf(6, 500), 12);
  assert.equal(FAINT_FROM, 7);
});
