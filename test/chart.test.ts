// The chart entry (`/chart`): `chartSvg` draws the same string for the same options, in every projection, within the zoom limits, and the entry reads the data of a layer only when the layer is asked for.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { chartSvg, defaultZoom, fromScreen, loadChartData, toScreen, ZOOM_MAX, ZOOM_MIN, type ChartSvgOptions } from "../src/chart.ts";
import { PROJECTIONS } from "../src/projection.ts";

const fixed: ChartSvgOptions = { width: 480, height: 360, projection: "stereographic", ra: 84, dec: 0, zoom: 2, magnitude: 5, layers: ["lines", "names", "grid"], lang: "en" };
const count = (svg: string, text: string): number => svg.split(text).length - 1;

test("a layer whose data is not read yet says so, and the layers the entry carries need nothing", () => {
  assert.ok(chartSvg(fixed).startsWith("<svg"));
  assert.throws(() => chartSvg({ ...fixed, layers: ["milky-way"] }), /loadChartData/);
  assert.throws(() => chartSvg({ ...fixed, layers: ["deep-sky"] }), /loadChartData/);
  assert.throws(() => chartSvg({ ...fixed, constellation: "Ori" }), /loadChartData/);
  assert.throws(() => chartSvg({ ...fixed, near: "S:2491" }), /loadChartData/);
});

test("the same options draw the same string, sized as asked", () => {
  const first = chartSvg(fixed);
  assert.equal(chartSvg({ ...fixed }), first);
  assert.ok(first.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 360" width="480" height="360" role="img" aria-label="A chart of the sky">'));
  assert.ok(first.endsWith("</svg>"));
  assert.ok(count(first, "<circle") > 100);
  assert.ok(first.includes(">Betelgeuse<") && first.includes(">Rigel<"));
  assert.ok(chartSvg({ ...fixed, width: 800, height: 600, zoom: 1 }).includes(">Orion<"));
  assert.ok(!first.includes('data-layer="milky"'));
  assert.notEqual(chartSvg({ ...fixed, ra: 90 }), first);
  assert.notEqual(chartSvg({ ...fixed, magnitude: 3 }), first);
  assert.ok(count(chartSvg({ ...fixed, magnitude: 3 }), "<circle") < count(first, "<circle"));
});

test("Japanese names, when asked for", () => {
  const ja = chartSvg({ ...fixed, width: 800, height: 600, zoom: 1, lang: "ja" });
  assert.ok(ja.includes(">オリオン座<") && !ja.includes(">Orion<"));
  assert.ok(ja.includes('aria-label="星空の図"'));
});

test("every projection draws, and the seven look different", () => {
  const seen = new Set<string>();
  for (const projection of PROJECTIONS) {
    const svg = chartSvg({ ...fixed, projection, zoom: 1, layers: ["lines", "grid"] });
    assert.ok(count(svg, "<circle") > 50, projection);
    assert.equal(chartSvg({ ...fixed, projection, zoom: 1, layers: ["lines", "grid"] }), svg, projection);
    seen.add(svg);
  }
  assert.equal(seen.size, PROJECTIONS.length);
  assert.equal(chartSvg({ ...fixed, projection: "nonsense" as never }), chartSvg({ ...fixed, projection: "stereographic" }));
});

test("the zoom stays between 0.1 and 500, and a missing or bad zoom is the opening view", () => {
  assert.equal(ZOOM_MIN, 0.1);
  assert.equal(ZOOM_MAX, 500);
  assert.equal(chartSvg({ ...fixed, zoom: 0 }), chartSvg({ ...fixed, zoom: 0.1 }));
  assert.equal(chartSvg({ ...fixed, zoom: -5 }), chartSvg({ ...fixed, zoom: 0.1 }));
  assert.equal(chartSvg({ ...fixed, zoom: 1e9 }), chartSvg({ ...fixed, zoom: 500 }));
  const opening = chartSvg({ ...fixed, zoom: defaultZoom("stereographic", 480, 360) });
  assert.equal(chartSvg({ ...fixed, zoom: undefined }), opening);
  assert.equal(chartSvg({ ...fixed, zoom: Number.NaN }), opening);
  assert.notEqual(chartSvg({ ...fixed, zoom: 0.1 }), chartSvg({ ...fixed, zoom: 500 }));
  // At 500 the chart is under a degree across: a handful of stars, and the whole sky at 0.1 is a few hundred pixels of the map.
  assert.ok(count(chartSvg({ ...fixed, zoom: 500, ra: 200.98, dec: 54.92 }), "<circle") < count(chartSvg({ ...fixed, zoom: 0.1 }), "<circle"));
});

test("the magnitude and the middle are held to their ranges, and a right ascension wraps", () => {
  assert.equal(chartSvg({ ...fixed, magnitude: 99 }), chartSvg({ ...fixed, magnitude: 6 }));
  assert.equal(chartSvg({ ...fixed, magnitude: -3 }), chartSvg({ ...fixed, magnitude: 2 }));
  assert.equal(chartSvg({ ...fixed, ra: 84 + 720 }), chartSvg(fixed));
  assert.equal(chartSvg({ ...fixed, dec: 400 }), chartSvg({ ...fixed, dec: 90 }));
});

test("the screen maths agree with the drawing and go both ways", () => {
  const view = { projection: "stereographic", ra: 84, dec: 0, zoom: 1 } as const;
  assert.deepEqual(toScreen(view, 800, 600, { rightAscension: 84, declination: 0 }), [400, 300]);
  const at = toScreen(view, 800, 600, { rightAscension: 90, declination: 10 })!;
  const back = fromScreen(view, 800, 600, at[0], at[1])!;
  assert.ok(Math.abs(back.rightAscension - 90) < 1e-6 && Math.abs(back.declination - 10) < 1e-6);
  assert.equal(toScreen({ ...view, projection: "orthographic" }, 800, 600, { rightAscension: 264, declination: 0 }), undefined);
});

test("the layers that need data work once it is read, and not before", async () => {
  await loadChartData({ layers: ["milky-way", "deep-sky", "boundaries"], constellation: "Ori", near: "S:2491" });
  const all = chartSvg({ ...fixed, zoom: 1, layers: ["milky-way", "lines", "boundaries", "names", "deep-sky", "grid"] });
  assert.ok(all.includes('data-layer="milky"'));
  assert.ok(all.indexOf('data-layer="milky"') < all.indexOf("<circle"));
  assert.ok(all.includes(">M42<") || all.includes(">M31<") || all.includes('stroke="#e0a458"'));
  assert.ok(all.includes("stroke-dasharray"));
  // The same names as the embed page's address, `milky` and `deep`.
  assert.equal(chartSvg({ ...fixed, layers: ["milky", "deep"] }), chartSvg({ ...fixed, layers: ["milky-way", "deep-sky"] }));
  assert.equal(chartSvg({ ...fixed, layers: [] }).includes("<path"), false);
});

test("a constellation is drawn brighter with its boundary, and what is near a pick is ringed", async () => {
  await loadChartData({ constellation: "Ori", near: "S:2491" });
  const plain = chartSvg({ ...fixed, layers: ["lines"] });
  const bright = chartSvg({ ...fixed, layers: ["lines"], constellation: "Ori" });
  const loud = /<path d="M[^"]+" fill="none" stroke="#ffd86b"/;
  assert.ok(!loud.test(plain) && loud.test(bright));
  const picked = chartSvg({ ...fixed, layers: ["names"], near: "S:2491", zoom: 1, ra: 101, dec: -16 });
  assert.ok(picked.includes('stroke="#ff7a59"'), "the picked star is ringed");
  assert.ok(count(picked, 'stroke="#5fe0c4"') >= 5, "its nearest stars are ringed");
  const space = chartSvg({ ...fixed, layers: ["names"], near: "S:2491", by: "space", zoom: 1, ra: 101, dec: -16 });
  assert.notEqual(space, picked);
  assert.ok(chartSvg({ ...fixed, near: "C:Ori", layers: [] }).includes('stroke="#5fe0c4"'));
  assert.equal(chartSvg({ ...fixed, near: "not a key", layers: ["lines"] }), chartSvg({ ...fixed, layers: ["lines"] }));
});

test("the light theme is ink on paper and the night sky is the default", () => {
  assert.ok(chartSvg(fixed).includes('fill="#0b1020"'));
  const paper = chartSvg({ ...fixed, theme: "light" });
  assert.ok(paper.includes('fill="#f8f6ef"') && !paper.includes('fill="#0b1020"'));
  assert.equal(chartSvg({ ...fixed, theme: "dark" }), chartSvg(fixed));
});

test("names that would sit on a keep-clear box are moved off it", () => {
  const free = chartSvg({ ...fixed, layers: ["names"] });
  const box = { x0: 0, y0: 0, x1: 480, y1: 360 };
  assert.ok(count(chartSvg({ ...fixed, layers: ["names"], keepClear: [box] }), "<text") < count(free, "<text"));
});

// The size rule: the entry carries the stars, the constellation names and the lines, and nothing of the boundaries, the Messier objects, the Milky Way or the nearby tables unless a layer asks (a dynamic `import()`).
test("the entry imports none of the optional data statically", () => {
  const dynamicOnly = ["boundaries", "deep-sky", "deep-sky-core", "deep-sky-ngc-ic", "milky-way", "nearest", "nearby"];
  const files = [new URL("../src/chart.ts", import.meta.url), ...readdirSync(new URL("../src/chart/", import.meta.url)).map((name) => new URL(`../src/chart/${name}`, import.meta.url))];
  const dynamic = new Set<string>();
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(/^(?:import|export)\s+(type\s+)?[^;]*?from\s+"([^"]+)"/gm)) {
      if (match[1] !== undefined) continue;
      const name = match[2]!.replace(/^.*\//, "").replace(/\.ts$/, "");
      const isThis = file.pathname.endsWith("/chart/nearby.ts");
      assert.ok(isThis || !dynamicOnly.includes(name), `${file.pathname} imports ${match[2]} statically`);
    }
    for (const match of text.matchAll(/import\("([^"]+)"\)/g)) dynamic.add(match[1]!.replace(/^.*\//, "").replace(/\.ts$/, ""));
  }
  for (const name of ["boundaries", "deep-sky", "milky-way", "nearby"]) assert.ok(dynamic.has(name), `${name} is read with import()`);
});
