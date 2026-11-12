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
