// The code the demo hands out draws the stars of the chart it sits beside: the module's own lines are run here, against the package, and their circles are the chart's.
import assert from "node:assert/strict";
import { test } from "node:test";
import { chart, DEFAULT_VIEW } from "../demo/chart.ts";
import { chartLines, embedCode, heightFor } from "../demo/embed-code.ts";
import type { Choice } from "../demo/choice.ts";
import { chinese } from "../src/cultures/chinese.ts";
import { cultureOf } from "../demo/cultures.ts";
import { figures } from "../src/lines.ts";
import { project } from "../src/projection.ts";
import { skyFrom } from "../src/sky-from.ts";
import { blackBodyColour, starByHr, starColour, starTemperatureK, stars } from "../src/stars.ts";
import { BAND_COLOURS } from "../demo/distance-layers.ts";
import { layersByDistance, starInput } from "../src/distance.ts";

const choice: Choice = { ...DEFAULT_VIEW, magnitude: 4, layers: new Set(["lines"]), lang: "en" };

/** Runs the module's lines against the package and returns the SVG they make. */
function run(c: Choice, width: number): string {
  const { body } = chartLines(c, width);
  return new Function("stars", "starColour", "figures", "project", `${body}\nreturn skyChart();`)(stars, starColour, figures, project) as string;
}

test("the module's circles are the chart's circles, the same stars in the same places", () => {
  const width = 480;
  const mine = run(choice, width).match(/<circle [^>]*\/>/g) ?? [];
  const theirs = chart({ ...choice, width, height: heightFor(width) }).svg.match(/<circle [^>]*\/>/g) ?? [];
  assert.ok(theirs.length > 100);
  const have = new Set(mine);
  for (const circle of theirs) assert.ok(have.has(circle), `the chart draws ${circle} and the code does not`);
});

test("the module's lines are the chart's lines, and the code with no lines has none", () => {
  const width = 480;
  const path = (svg: string): string => /<path d="([^"]*)" fill="none" stroke="#6f93e0"/.exec(svg)?.[1] ?? "";
  const mine = path(run(choice, width)).split("M").filter(Boolean);
  const theirs = path(chart({ ...choice, width, height: heightFor(width) }).svg).split("M").filter(Boolean);
  assert.ok(theirs.length > 5);
  const have = new Set(mine);
  for (const piece of theirs) assert.ok(have.has(piece), `the chart draws ${piece} and the code does not`);
  assert.ok(!run({ ...choice, layers: new Set() }, width).includes("stroke="));
  assert.ok(!chartLines({ ...choice, layers: new Set() }, width).imports.some((one) => one.sub === "/lines"));
});

test("every way a page is made names the package's imports and calls skyChart", () => {
  for (const kind of ["html", "module", "react", "vue", "angular", "svelte"]) {
    const code = embedCode(kind, choice, 480)!;
    assert.ok(code.includes("skyChart()"), kind);
    assert.ok(code.includes("hoshi-stars"), kind);
  }
  assert.equal(embedCode("nothing", choice, 480), undefined);
});

test("seen from another star the code moves the stars with skyFrom, and its circles and lines are the chart's", () => {
  const width = 480;
  const from: Choice = { ...choice, from: "HR5459" };
  const { body, imports } = chartLines(from, width);
  assert.ok(imports.some((one) => one.sub === "/sky-from" && one.names === "skyFrom"));
  const svg = new Function("skyFrom", "starByHr", "blackBodyColour", "starTemperatureK", "figures", "project", `${body}\nreturn skyChart();`)(skyFrom, starByHr, blackBodyColour, starTemperatureK, figures, project) as string;
  const sky = skyFrom(starByHr(5459)!, { magnitude: from.magnitude });
  const theirs = chart({ ...from, width, height: heightFor(width), sky }).svg;
  const mine = svg.match(/<circle [^>]*\/>/g) ?? [];
  const drawn = theirs.match(/<circle [^>]*\/>/g) ?? [];
  assert.ok(drawn.length > 100);
  const have = new Set(mine);
  for (const circle of drawn) assert.ok(have.has(circle), `the chart draws ${circle} and the code does not`);
  const path = (text: string): string => /<path d="([^"]*)" fill="none" stroke="#6f93e0"/.exec(text)?.[1] ?? "";
  const lines = new Set(path(svg).split("M").filter(Boolean));
  // the code leaves out a line half a chart long or more, as it does for the Earth's sky
  const short = path(theirs).split("M").filter(Boolean).filter((piece) => { const [a, b] = piece.split("L").map((point) => point.split(" ").map(Number)); return Math.hypot(b![0]! - a![0]!, b![1]! - a![1]!) < width / 2; });
  assert.ok(short.length > 5);
  for (const piece of short) assert.ok(lines.has(piece), `the chart draws ${piece} and the code does not`);
  assert.notEqual(path(theirs), path(chart({ ...from, width, height: heightFor(width) }).svg));
});

test("in a sky culture the code imports it and draws its figures, the chart's own lines", () => {
  const width = 480;
  const culture: Choice = { ...choice, cultureId: "chinese", ra: 190, dec: 55, zoom: 4 };
  const { body, imports } = chartLines(culture, width);
  assert.ok(imports.some((one) => one.sub === "/cultures/chinese" && one.names === "chinese"));
  assert.ok(body.includes("figures(chinese)"));
  const svg = new Function("stars", "starColour", "figures", "chinese", "project", `${body}\nreturn skyChart();`)(stars, starColour, figures, chinese, project) as string;
  const path = (text: string): string => /<path d="([^"]*)" fill="none" stroke="#6f93e0"/.exec(text)?.[1] ?? "";
  const mine = new Set(path(svg).split("M").filter(Boolean));
  const theirs = path(chart({ ...culture, culture: cultureOf("chinese"), width, height: heightFor(width) }).svg).split("M").filter(Boolean);
  assert.ok(theirs.length > 5);
  for (const piece of theirs) assert.ok(mine.has(piece), `the chart draws ${piece} and the code does not`);
  assert.ok(!chartLines({ ...choice, cultureId: "western" }, width).body.includes("chinese"));
});

test("with a limit in light-years the code draws the bright stars within it by band, a ring for an uncertain one, and none with no distance", () => {
  const width = 480;
  const limited: Choice = { ...choice, layers: new Set(), projection: "hammer", ra: 180, dec: 0, zoom: 1, limit: 100 };
  const { body, imports } = chartLines(limited, width);
  assert.ok(imports.some((one) => one.sub === "/distance" && one.names === "layersByDistance, starInput"));
  assert.ok(!imports.some((one) => one.names.includes("starColour")), "the colour is the band's, not the star's");
  const svg = new Function("stars", "layersByDistance", "starInput", "project", `${body}\nreturn skyChart();`)(stars, layersByDistance, starInput, project) as string;
  const layers = layersByDistance(stars().map(starInput), { limit: 100 });
  const circles = svg.match(/<circle [^>]*\/>/g) ?? [];
  assert.equal(circles.length, layers.things.length, "every thing within 100 light-years, and no other");
  assert.equal(circles.filter((one) => one.includes('fill="none"')).length, layers.uncertain, "a ring for each uncertain one");
  assert.ok(circles.some((one) => one.includes(BAND_COLOURS[0]!)), "the nearest band's colour");
  for (const kind of ["html", "module", "react", "vue", "angular", "svelte"]) assert.ok(embedCode(kind, limited, width)!.includes("layersByDistance"), kind);
  assert.ok(!embedCode("module", choice, width)!.includes("layersByDistance"), "no limit, no layers");
});
