// The code the 3D page hands out draws the sky by distance the page shows: the module's own lines are run here, against the package, and its circles are the panel's picture; the address of the embed page round-trips.
import assert from "node:assert/strict";
import { test } from "node:test";
import { BAND_COLOURS, UNCERTAIN_COLOUR } from "../demo/distance-layers.ts";
import { layersChoiceOf, layersCode, layersFrameAddress, layersHeightFor, layersLines, layersQuery, layersSvg, type LayersChoice } from "../demo/layers-code.ts";
import { layersByDistance, starInput } from "../src/distance.ts";
import { project } from "../src/projection.ts";
import { stars } from "../src/stars.ts";

const choice: LayersChoice = { limit: 100, yaw: 0, tilt: 0, lang: "en" };

function run(c: LayersChoice, width: number): string {
  const { body } = layersLines(c, width);
  return new Function("stars", "layersByDistance", "starInput", "project", `${body}\nreturn distanceSky();`)(stars, layersByDistance, starInput, project) as string;
}

test("the module's lines make the panel's picture, circle for circle", () => {
  for (const limit of [10, 100, Number.POSITIVE_INFINITY]) {
    const c = { ...choice, limit };
    assert.equal(run(c, 480), layersSvg(c, 480), `out to ${limit}`);
  }
});

test("the picture has every bright star with a distance within the limit, a ring for an uncertain one, and none that has no distance", () => {
  const svg = run(choice, 480);
  const layers = layersByDistance(stars().map(starInput), { limit: 100 });
  const circles = svg.match(/<circle [^>]*\/>/g) ?? [];
  assert.equal(circles.length, layers.things.length);
  assert.equal(circles.filter((one) => one.includes(`stroke="${UNCERTAIN_COLOUR}"`)).length, layers.uncertain);
  for (const colour of BAND_COLOURS.slice(0, 3)) assert.ok(svg.includes(`fill="${colour}"`), colour);
  assert.ok(!svg.includes(`fill="${BAND_COLOURS[5]}"`), "nothing beyond 100 light-years");
  assert.ok(svg.includes(`height="${layersHeightFor(480)}"`));
});

test("every way a page is made names the package's imports and calls distanceSky", () => {
  for (const kind of ["html", "module", "react", "vue", "angular", "svelte"]) {
    const code = layersCode(kind, choice, 480)!;
    assert.ok(code.includes("distanceSky()"), kind);
    assert.ok(code.includes("hoshi-stars"), kind);
    assert.ok(code.includes("layersByDistance"), kind);
  }
  assert.equal(layersCode("nothing", choice, 480), undefined);
  assert.ok(layersCode("module", { ...choice, limit: Number.POSITIVE_INFINITY }, 480)!.includes("limit: Infinity"));
});

test("the embed page's address round-trips and keeps only what differs from the defaults", () => {
  assert.equal(layersQuery(choice), "dist=100");
  assert.equal(layersQuery({ limit: Number.POSITIVE_INFINITY, yaw: -90, tilt: 10, lang: "ja" }), "dist=all&yaw=-90&tilt=10&lang=ja");
  for (const c of [choice, { limit: 500, yaw: 45, tilt: -20, lang: "ja" as const }, { limit: Number.POSITIVE_INFINITY, yaw: 0, tilt: 0, lang: "en" as const }]) assert.deepEqual(layersChoiceOf(new URLSearchParams(layersQuery(c))), c);
  assert.deepEqual(layersChoiceOf(new URLSearchParams("dist=far&yaw=900&tilt=-900")), { limit: 100, yaw: 180, tilt: -85, lang: "en" });
  assert.equal(layersFrameAddress("https://x.test/", choice), "https://x.test/embed-layers.html?dist=100");
});
