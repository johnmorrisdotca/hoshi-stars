// The chart's uncertainty: the grade and the ± a pick carries, which stars the "show uncertainty" look draws dimmer, and that chartSvg draws the same picture as before unless it is asked.
import assert from "node:assert/strict";
import { test } from "node:test";
import { starGrade } from "../src/accuracy.ts";
import { chartSvg, dimsForUncertainty, pickAccuracy, UNCERTAIN_OPACITY } from "../src/chart/index.ts";
import { starByName, starDistance, stars } from "../src/stars.ts";

test("a pick carries the grade, the distance range and the position resolution", () => {
  const sirius = pickAccuracy(starByName("Sirius")!);
  assert.equal(sirius.grade, "A");
  assert.deepEqual(sirius.lightYearsRange, starDistance(starByName("Sirius")!)!.lightYearsRange);
  assert.ok(sirius.positionResolutionArcsec >= 1 && sirius.positionResolutionArcsec <= 1.5);
  const betelgeuse = pickAccuracy(starByName("Betelgeuse")!);
  assert.equal(betelgeuse.grade, "B");
  assert.ok(Math.abs(betelgeuse.lightYearsRange![0] - 480) < 15 && Math.abs(betelgeuse.lightYearsRange![1] - 640) < 15);
});

test("a star with no distance has no range, and the grade is the /accuracy grade for every star", () => {
  const none = stars().find((s) => !(s.parallaxMas > 0))!;
  assert.equal(pickAccuracy(none).lightYearsRange, null);
  assert.equal(pickAccuracy(none).grade, "C");
  for (const star of stars().slice(0, 400)) assert.equal(pickAccuracy(star).grade, starGrade(star));
});

test("only grade C stars dim", () => {
  assert.equal(dimsForUncertainty(starByName("Sirius")!), false);
  assert.equal(dimsForUncertainty(starByName("Betelgeuse")!), false);
  assert.equal(dimsForUncertainty(starByName("Rigel")!), true);
  for (const star of stars().slice(0, 400)) assert.equal(dimsForUncertainty(star), starGrade(star) === "C");
});

test("chartSvg dims grade C stars only when asked, and leaves the picture as it was otherwise", () => {
  const options = { width: 640, height: 400, layers: [] } as const;
  const plain = chartSvg(options);
  assert.equal(chartSvg({ ...options, showUncertainty: false }), plain);
  assert.ok(!plain.includes("data-uncertain"));
  const shown = chartSvg({ ...options, showUncertainty: true });
  const dim = shown.match(/data-uncertain="C"/g)?.length ?? 0;
  const all = shown.match(/<circle/g)?.length ?? 0;
  assert.ok(dim > 0 && dim < all, `${dim} of ${all}`);
  assert.ok(shown.includes(`fill-opacity="${UNCERTAIN_OPACITY}"`));
  assert.equal(shown.replace(/ fill-opacity="[\d.]+" data-uncertain="C"/g, ""), plain);
});
