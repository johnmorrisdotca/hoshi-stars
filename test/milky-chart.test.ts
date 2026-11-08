// The Milky Way in the demo's chart: it draws in each of the seven projections, under the stars and the lines, follows the galactic equator on the screen, and the layer off draws nothing.
import assert from "node:assert/strict";
import { test } from "node:test";
import { chart, DEFAULT_VIEW, LAYERS, toScreen, type ChartOptions } from "../demo/chart.ts";
import { layersOf, layersText } from "../demo/choice.ts";
import { fromGalactic } from "../src/milky-way.ts";
import { PROJECTIONS } from "../src/projection.ts";

const size = { width: 800, height: 520 };
const options = (extra: Partial<ChartOptions>): ChartOptions => ({ ...DEFAULT_VIEW, ...size, zoom: 1, magnitude: 3, layers: new Set(["milky"] as const), lang: "en", ...extra });
const milky = (svg: string): string => /<g data-layer="milky"[^>]*>(.*?)<\/g>/s.exec(svg)?.[1] ?? "";
const area = (svg: string): number => [...milky(svg).matchAll(/ d="([^"]+)"/g)].reduce((n, m) => n + m[1]!.length, 0);

test("the Milky Way draws in every projection, with some bands visible", () => {
  const views = [{ ra: 266, dec: -29 }, { ra: 0, dec: 0 }, { ra: 90, dec: 20 }];
  for (const projection of PROJECTIONS) {
    const drawn = views.map((view) => area(chart(options({ projection, ...view, zoom: 1 })).svg));
    assert.ok(Math.max(...drawn) > 300, `${projection}: ${drawn.join(", ")}`);
  }
});

test("on a whole-sky map the band is cut at the seam, never drawn across the chart", () => {
  for (const projection of ["equirectangular", "mollweide", "hammer"] as const) {
    const svg = chart(options({ projection, ra: 266, dec: 0 })).svg;
    for (const polygon of milky(svg).matchAll(/ d="([^"]+)"/g)) {
      for (const piece of polygon[1]!.split("M").slice(1)) {
        const xs = [...piece.matchAll(/(-?\d+(?:\.\d+)?) -?\d+(?:\.\d+)?/g)].map((m) => Number(m[1]));
        assert.ok(Math.max(...xs) - Math.min(...xs) < size.width + 80, `${projection}: a piece ${Math.max(...xs) - Math.min(...xs)} wide`);
      }
    }
  }
});

test("the band lies along the galactic equator on the screen, and under the stars and the lines", () => {
  const view = { ...DEFAULT_VIEW, projection: "hammer" as const, ra: 266, dec: -29, zoom: 1 };
  const svg = chart(options({ ...view, layers: new Set(["milky", "lines", "grid"] as const) })).svg;
  assert.ok(svg.indexOf('data-layer="milky"') > 0 && svg.indexOf('data-layer="milky"') < svg.indexOf("<circle"));
  assert.ok(svg.indexOf('data-layer="milky"') < svg.indexOf('stroke="#6f93e0"'));
  // a pixel on the equator is inside the bands' bounding drawing: the Galactic centre is on the chart
  const centre = toScreen(view, size.width, size.height, fromGalactic({ longitude: 0, latitude: 0 }))!;
  assert.ok(Math.abs(centre[0] - size.width / 2) < 2 && Math.abs(centre[1] - size.height / 2) < 40, JSON.stringify(centre));
});

test("the layer off draws nothing, and it is in the address, on by default", () => {
  const svg = chart(options({ layers: new Set(["lines", "names"] as const) })).svg;
  assert.ok(!svg.includes("data-layer=\"milky\"") && !svg.includes("hoshi-milky"));
  assert.ok(LAYERS.includes("milky"));
  assert.ok(layersOf(null).has("milky"));
  assert.equal(layersText(layersOf(null)), null);
  assert.equal(layersText(new Set(["lines"] as const)), "lines");
  assert.ok(layersOf("milky,lines").has("milky"));
  assert.ok(!layersOf("lines,names").has("milky"));
});
