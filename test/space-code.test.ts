// The code the 3D page hands out: the module's own lines are run here, against the package, and the picture they make is the one the demo previews; a star with no distance is a dotted line of sight and one with a wide
// error bar has no dot; the address of the embed page holds only what differs from the defaults.
import assert from "node:assert/strict";
import { test } from "node:test";
import { spaceCode, spaceFrameAddress, spaceHeightFor, spaceLines, spaceQuery, spaceSvg, type SpaceChoice } from "../demo/space-code.ts";
import { constellationIn3D } from "../src/constellation-3d.ts";
import { starByHr, starColour } from "../src/stars.ts";

const orion: SpaceChoice = { c: "Ori", from: undefined, yaw: 0, tilt: 0, lang: "en" };

/** Runs the module's lines against the package and returns the SVG they make. */
function run(choice: SpaceChoice, width: number): string {
  const { body } = spaceLines(choice, width);
  return new Function("constellationIn3D", "starByHr", "starColour", `${body}\nreturn spaceView();`)(constellationIn3D, starByHr, starColour) as string;
}

test("the copied lines make the picture the demo previews, for several constellations and a viewpoint", () => {
  for (const choice of [orion, { ...orion, c: "UMa" }, { ...orion, c: "CMa" }, { ...orion, c: "Cas", from: 5459 }, { ...orion, c: "Cru" }]) {
    assert.equal(run(choice, 480), spaceSvg(choice, 480), `${choice.c} from ${choice.from ?? "the Earth"}`);
  }
});

test("Orion: Alnilam is a dotted line of sight, the other seven are streaks with no dot in the middle", () => {
  const svg = run(orion, 480);
  assert.equal((svg.match(/stroke-dasharray="2 4"/g) ?? []).length, 1, "one star with no distance");
  assert.equal((svg.match(/<circle /g) ?? []).length, 1, "Betelgeuse's paper distance is known to 15%: one dot; every other star of Orion has an error bar wider than its distance");
  assert.equal((svg.match(/stroke-width="5"/g) ?? []).length, 6);
});

test("a star with a good distance has a dot and a thin bar", () => {
  const svg = run({ ...orion, c: "CMa" }, 480);
  const figure = constellationIn3D("CMa");
  const dots = figure.stars.filter((one) => one.position !== undefined && !one.wide).length;
  assert.ok(dots >= 1);
  assert.equal((svg.match(/<circle /g) ?? []).length, dots);
  assert.ok(svg.includes(`fill="${starColour(figure.stars.find((one) => one.star.name === "Sirius")!.star)}"`));
});

test("every way a page is made names the package's imports and calls spaceView", () => {
  for (const kind of ["html", "module", "react", "vue", "angular", "svelte"]) {
    const code = spaceCode(kind, orion, 480)!;
    assert.ok(code.includes("spaceView()"), kind);
    assert.ok(code.includes("hoshi-stars"), kind);
    assert.ok(code.includes("constellation-3d"), kind);
  }
  assert.equal(spaceCode("nothing", orion, 480), undefined);
  assert.ok(spaceLines({ ...orion, from: 5459 }, 480).imports.some((one) => one.names.includes("starByHr")));
  assert.ok(!spaceLines(orion, 480).imports.some((one) => one.names.includes("starByHr")));
});

test("the embed page's address holds only what differs from the defaults", () => {
  assert.equal(spaceQuery(orion), "c=Ori");
  assert.equal(spaceQuery({ c: "UMa", from: 5459, yaw: -90, tilt: 10, lang: "ja" }), "c=UMa&from=HR5459&yaw=-90&tilt=10&lang=ja");
  assert.equal(spaceFrameAddress("https://example.test/", orion), "https://example.test/embed-3d.html?c=Ori");
  assert.equal(spaceHeightFor(480), 360);
});
