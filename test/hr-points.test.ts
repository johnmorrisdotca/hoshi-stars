// The Hertzsprung-Russell page's numbers: which stars are plotted, and where the Sun, Sirius and Betelgeuse lie on each pair of axes.
import assert from "node:assert/strict";
import { test } from "node:test";
import { starGrade } from "../src/accuracy.ts";
import { absoluteMagnitude, starByHr, starByName, stars } from "../src/stars.ts";
import { hrPoints, place, placeable, scaleOf, SUN } from "../demo/hr-points.ts";

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

test("a parallax the catalogue rounds to a whole milliarcsecond is not plotted when the rounding alone is over 20%: Adhara is left off, Aldebaran and Betelgeuse stay", () => {
  const adhara = starByName("Adhara")!;
  assert.equal(adhara.parallaxMas, 1);
  assert.equal(placeable(adhara), false);
  assert.equal(hrPoints("colour").some((p) => p.hr === adhara.hr), false);
  assert.equal(hrPoints("physical").some((p) => p.hr === adhara.hr), false);
  for (const name of ["Aldebaran", "Betelgeuse"]) assert.ok(hrPoints("colour").some((p) => p.hr === starByName(name)!.hr), name);
  for (const axes of ["colour", "physical"] as const) {
    for (const p of hrPoints(axes)) {
      const star = starByHr(p.hr)!;
      assert.ok(star.parallaxSource === "GCTP" || star.parallaxSource === "literature" || star.parallaxMas >= 2.5, `${star.hr} ${star.parallaxMas}`);
    }
    // nothing on the diagram is brighter than -6 in magnitude or above half a million suns, which no star of this catalogue's good distances is
    assert.ok(hrPoints(axes).every((p) => (axes === "colour" ? p.y > -6 : p.y < 5.7)));
  }
});

test("hot is left and bright is up on both views: Sirius is hotter and brighter than the Sun and Betelgeuse cooler and brighter", () => {
  const at = (star: Parameters<typeof place>[0], axes: "colour" | "physical") => place(star, axes)!;
  for (const axes of ["colour", "physical"] as const) {
    const sun = at(SUN, axes);
    const sirius = at(starByName("Sirius")!, axes);
    const betelgeuse = at(starByName("Betelgeuse")!, axes);
    const hotter = (a: { x: number }, b: { x: number }) => (axes === "colour" ? a.x < b.x : a.x > b.x);
    const brighter = (a: { y: number }, b: { y: number }) => (axes === "colour" ? a.y < b.y : a.y > b.y);
    assert.ok(hotter(sirius, sun) && brighter(sirius, sun), `Sirius ${axes}`);
    assert.ok(hotter(sun, betelgeuse) && brighter(betelgeuse, sun), `Betelgeuse ${axes}`);
  }
});
