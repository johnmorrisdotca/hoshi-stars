// The SVG the demo writes for names and lines: no setting, whether from the address or a stylesheet, can close an attribute or open a tag.
import assert from "node:assert/strict";
import { test } from "node:test";
import { escapeXml, figureLinesSvg, figureNameSvg, starNamesSvg } from "../demo/sky-labels-svg.ts";
import { createFigureLines, createStarNames, type SkyProjector } from "../src/sky-labels.ts";

const project: SkyProjector = (ra, dec, out) => {
  out.x = 640 - (ra - 84) * 8;
  out.y = 360 - dec * 8;
  return Math.abs(ra - 84) < 70;
};
const VIEW = { width: 1280, height: 720 };
const evil = `red" onload="alert(1)' x='<script>&`;

test("every character that could end an attribute or open a tag is escaped", () => {
  assert.equal(escapeXml(`a"b'c<d>e&f`), "a&quot;b&#39;c&lt;d&gt;e&amp;f");
});

test("a look from the address cannot inject an attribute into the names", () => {
  const names = createStarNames({ count: 6, style: { colour: evil, halo: evil, ringColour: evil, leaderColour: evil, designationColour: evil, font: evil, designationFont: evil, leader: 10 } });
  names.update(project, VIEW);
  const svg = starNamesSvg(names);
  assert.ok(svg.includes("&quot;"));
  assert.ok(!/" onload=/.test(svg) && !svg.includes("<script"));
  const attributes = svg.match(/\s[\w-]+="[^"]*"/g) ?? [];
  assert.ok(attributes.every((one) => !/^\sonload=/.test(one)), "no attribute the look did not name");
});

test("a look from the address cannot inject an attribute into the figure's name or lines", () => {
  const lines = createFigureLines({ strength: 0.16, style: { colour: evil, halo: evil, font: evil } });
  lines.update(project, VIEW);
  const orion = lines.figures.find((figure) => figure.abbreviation === "Ori")!;
  lines.point(lines.segments[orion.start * 4]!, lines.segments[orion.start * 4 + 1]!);
  for (const svg of [figureLinesSvg(lines), figureNameSvg(lines)]) {
    assert.ok(svg.length > 0);
    assert.ok(!/" onload=/.test(svg) && !svg.includes("<script"));
  }
  assert.ok(figureNameSvg(lines).includes("&quot;"));
});
