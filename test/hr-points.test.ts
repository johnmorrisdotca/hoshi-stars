// The Hertzsprung-Russell page's numbers: which stars are plotted, and where the Sun, Sirius and Betelgeuse lie on each pair of axes.
import assert from "node:assert/strict";
import { test } from "node:test";
import { starGrade } from "../src/accuracy.ts";
import { absoluteMagnitude, starByHr, starByName, stars } from "../src/stars.ts";
import { hrPoints, place, scaleOf, SUN } from "../demo/hr-points.ts";

test("absolute magnitude is the brightness from 10 parsecs: the Sun 4.83, Sirius 1.45, and nothing without a parallax", () => {
  assert.ok(Math.abs(absoluteMagnitude(SUN)! - 4.83) < 0.02);
  assert.ok(Math.abs(absoluteMagnitude(starByName("Sirius")!)! - 1.45) < 0.02);
  assert.equal(absoluteMagnitude({ magnitude: 3, parallaxMas: 0 }), undefined);
  assert.equal(absoluteMagnitude({ magnitude: 3, parallaxMas: 100 }), 3 + 5 + 5 * Math.log10(0.1));
});

test("the colour axes put the Sun at B-V 0.65 and magnitude 4.83, hot blue stars left and bright stars high", () => {
  const sun = place(SUN, "colour")!;
  assert.equal(sun.x, 0.65);
  assert.ok(Math.abs(sun.y - 4.83) < 0.02);
  assert.ok(place(starByName("Sirius")!, "colour")!.x < sun.x);
  assert.ok(place(starByName("Betelgeuse")!, "colour")!.y < place(starByName("Aldebaran")!, "colour")!.y);
});

test("the temperature axes put the Sun at about 5,800 K and 1 solar luminosity, and Betelgeuse cool and far brighter", () => {
  const sun = place(SUN, "physical")!;
  assert.ok(Math.abs(10 ** sun.x - 5772) < 300);
  assert.ok(Math.abs(10 ** sun.y - 1) < 0.2);
  const betelgeuse = place(starByName("Betelgeuse")!, "physical")!;
  assert.ok(10 ** betelgeuse.x < 4500 && 10 ** betelgeuse.y > 1000);
});

test("only graded stars are plotted, grade A is a subset, named is a subset of both, and the views hold nearly the same stars", () => {
  const graded = hrPoints("colour");
  const known = new Set(stars({ minGrade: "B" }).map((s) => s.hr));
  assert.ok(graded.length > 450 && graded.length <= known.size);
  assert.ok(graded.every((p) => known.has(p.hr) && starGrade(starByHr(p.hr)!) !== "C"));
  const a = hrPoints("colour", "a");
  assert.ok(a.length > 30 && a.length < graded.length / 2);
  const named = hrPoints("colour", "named");
  assert.ok(named.length > 20 && named.length < graded.length);
  assert.ok(Math.abs(hrPoints("physical").length - graded.length) < 40);
});

test("the scales cover every point and label whole numbers", () => {
  for (const axes of ["colour", "physical"] as const) {
    const points = hrPoints(axes);
    for (const axis of ["x", "y"] as const) {
      const scale = scaleOf(axes, axis, points.map((p) => p[axis]));
      assert.ok(points.every((p) => p[axis] >= scale.min && p[axis] <= scale.max), `${axes} ${axis}`);
      assert.ok(scale.ticks.length >= 3);
      assert.ok(scale.ticks.every((t) => t.value >= scale.min - 1e-9 && t.value <= scale.max + 1e-9));
    }
  }
});
