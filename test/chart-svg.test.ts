// The chart as an SVG string, and the element on a server: chartSvg draws the same picture each time, names itself in its language and escapes its label; the element and its define load in Node
// (a framework's server render) without a page and define nothing.
import assert from "node:assert/strict";
import { test } from "node:test";
import { CHART_LAYERS, chartSvg } from "../src/chart/index.ts";

test("chartSvg is a whole SVG of the size asked for, the same each time", () => {
  const svg = chartSvg({ width: 640, height: 400, constellation: "Ori" });
  assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400" width="640" height="400" role="img" aria-label="Star chart">'));
  assert.ok(svg.endsWith("</svg>"));
  assert.ok((svg.match(/<circle/g) ?? []).length > 100);
  assert.equal(chartSvg({ width: 640, height: 400, constellation: "Ori" }), svg);
});

test("its name follows its language, and a label of the page's own is escaped", () => {
  assert.ok(chartSvg({ width: 320, height: 200, lang: "ja" }).includes('aria-label="星図"'));
  assert.ok(chartSvg({ width: 320, height: 200, label: 'Orion "tonight" <here>' }).includes('aria-label="Orion &quot;tonight&quot; &lt;here>"'));
});

test("an unknown layer is left out, and no layers draws the stars alone", () => {
  const bare = chartSvg({ width: 320, height: 200, layers: [] });
  assert.equal(chartSvg({ width: 320, height: 200, layers: ["nonsense" as (typeof CHART_LAYERS)[number]] }), bare);
  assert.ok(chartSvg({ width: 320, height: 200 }).length > bare.length);
});

test("the element and its define load on a server and define nothing", async () => {
  assert.equal(globalThis.HTMLElement, undefined);
  const { CHART_TAG, HoshiChartElement } = await import("../src/chart/element.ts");
  const { defineChart } = await import("../src/chart/define.ts");
  assert.equal(CHART_TAG, "hoshi-chart");
  assert.equal(typeof HoshiChartElement, "function");
  assert.equal(defineChart(), false);
});

test("in every sky, a picked figure's lit lines on the map are the lines of its card, and a figure with no lines rings its stars on the map and draws none on its card", async () => {
  const { centreOfConstellation } = await import("../src/chart/chart.ts");
  const { western } = await import("../src/cultures/western.ts");
  const { japanese } = await import("../src/cultures/japanese.ts");
  const { chinese } = await import("../src/cultures/chinese.ts");
  const { figures } = await import("../src/lines.ts");
  const { constellationThumbnail, figureThumbnail } = await import("../src/thumbnails.ts");
  // the lines of a path of one stroke: one M for each line
  const linesIn = (svg: string, stroke: string): number => [...svg.matchAll(new RegExp(`<path d="([^"]*)" fill="none" stroke="${stroke}" stroke-width="2.2"`, "g"))].reduce((sum, m) => sum + (m[1]!.match(/M/g) ?? []).length, 0);
  const counted = { lit: 0, ringed: 0 };
  for (const culture of [western, japanese, chinese]) {
    for (const figure of figures(culture)) {
      const id = figure.asterism.id;
      const middle = centreOfConstellation(id, culture)!;
      // the whole hemisphere round the figure, large enough that every line of it is in view
      const map = chartSvg({ width: 1600, height: 1600, ra: middle.rightAscension, dec: middle.declination, zoom: 1, culture, constellation: id, layers: [] });
      const card = figure.asterism.kind === "constellation" ? constellationThumbnail(id, { theme: "dark" }) : figureThumbnail({ title: id, stars: figure.stars, segments: figure.segments }, { theme: "dark" });
      const where = `${culture.id} ${id}`;
      assert.equal(linesIn(map, "#ffd86b"), figure.segments.length, `${where}: the map's lit lines`);
      assert.equal(linesIn(card, "#9bb6f2"), figure.segments.length, `${where}: the card's lines`);
      const rings = (map.match(/data-figure-star="/g) ?? []).length;
      assert.equal(rings, figure.segments.length === 0 ? figure.stars.length : 0, `${where}: the stars ringed on the map`);
      counted.lit += figure.segments.length > 0 ? 1 : 0;
      counted.ringed += rings > 0 ? 1 : 0;
    }
  }
  // 397 figures with lines and 52 rung on their stars in this data: the check reached both kinds
  assert.ok(counted.lit > 350 && counted.ringed > 0, JSON.stringify(counted));
});
