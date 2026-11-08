// The code the demo hands out draws the stars of the chart it sits beside: the module's own lines are run here, against the package, and their circles are the chart's.
import assert from "node:assert/strict";
import { test } from "node:test";
import { chart, DEFAULT_VIEW } from "../demo/chart.ts";
import { chartLines, embedCode, heightFor } from "../demo/embed-code.ts";
import type { Choice } from "../demo/choice.ts";
import { figures } from "../src/lines.ts";
import { project } from "../src/projection.ts";
import { starColour, stars } from "../src/stars.ts";

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
