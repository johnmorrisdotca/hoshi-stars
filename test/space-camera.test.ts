// The camera of the constellation in 3D: at no turn it sits at the viewpoint and looks at the middle of the figure with north up (so the picture is the sky chart), a turn carries it round the figure and out, the drag rule
// (the near side follows the hand), and the numbers the layout needs.
import assert from "node:assert/strict";
import { test } from "node:test";
import { constellationIn3D } from "../src/constellation-3d.ts";
import { project } from "../src/projection.ts";
import { cameraFor, frontTan, RESTING_POSE, sideDistance, SIDE_TAN, type Fit } from "../demo/space-camera.ts";
import { displayFar, layoutOf, niceStep, shapeOf, sizeOf } from "../demo/space-scene.ts";

const near = (a: number, b: number, tolerance = 1e-9): boolean => Math.abs(a - b) <= tolerance;
const dot = (a: readonly number[], b: readonly number[]): number => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
const sub = (a: readonly number[], b: readonly number[]): [number, number, number] => [a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!];
const cross = (a: readonly number[], b: readonly number[]): [number, number, number] => [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!];
const fitOf = (abbreviation: string, aspect = 1.5): Fit => {
  const figure = constellationIn3D(abbreviation);
  const layout = layoutOf(figure);
  return { centre: figure.frame.centre, up: figure.frame.up, radius: figure.radius, middle: layout.middle, reach: layout.reach, lateral: layout.lateral, aspect, height: 600 };
};

test("at no turn the camera is at the viewpoint, looking at the middle of the figure with north up, as wide as the figure needs", () => {
  const fit = fitOf("Ori");
  const spec = cameraFor(fit, RESTING_POSE);
  assert.ok(Math.hypot(...spec.position) < 1e-6, "at the viewpoint");
  const forward = sub(spec.target, spec.position);
  const length = Math.hypot(...forward);
  for (let i = 0; i < 3; i += 1) assert.ok(near(forward[i]! / length, fit.centre[i]!, 1e-9));
  assert.ok(near(dot(spec.up, fit.up), 1, 1e-9));
  assert.equal(spec.across, 0);
  assert.ok(near(spec.tanHalf, frontTan(fit.radius, fit.aspect)));
  // east is on the left, as on a chart: the camera's right is celestial west
  const right = cross(sub(spec.target, spec.position).map((n) => n / length), spec.up);
  const east = cross([0, 0, 1], fit.centre);
  assert.ok(dot(right, east) < 0, "east is on the left");
});

test("a turn of 90 degrees looks across the lines of sight from the side, with the Earth at one end of the view", () => {
  const fit = fitOf("Ori");
  const spec = cameraFor(fit, { ...RESTING_POSE, yaw: -90 });
  assert.ok(near(spec.across, 1, 1e-9));
  assert.ok(near(spec.tanHalf, SIDE_TAN, 1e-9));
  const forward = sub(spec.target, spec.position);
  const length = Math.hypot(...forward);
  assert.ok(Math.abs(dot(forward.map((n) => n / length), fit.centre)) < 1e-9, "looking square to the lines of sight");
  assert.ok(near(length, sideDistance(fit), 1e-6));
  // the Earth is on the left and distance runs to the right when turned by -90
  const right = cross(forward.map((n) => n / length), spec.up);
  assert.ok(dot(right, fit.centre) > 0.99, "distance runs to the right");
  // the view holds the Earth and the farthest star
  const half = spec.tanHalf * fit.aspect * length;
  assert.ok(half >= fit.reach / 2, `half the view ${half} holds half the reach ${fit.reach / 2}`);
});

test("the camera moves smoothly: the nearer the front, the nearer the viewpoint", () => {
  const fit = fitOf("UMa");
  let last = -1;
  for (let yaw = 0; yaw <= 90; yaw += 10) {
    const spec = cameraFor(fit, { ...RESTING_POSE, yaw: -yaw });
    const away = Math.hypot(...spec.position);
    assert.ok(away >= last - 1e-9, `${yaw}`);
    last = away;
    assert.ok(spec.across >= 0 && spec.across <= 1);
  }
});

test("the drag rule: a positive yaw carries the near side to the right, a positive tilt carries it up", () => {
  const fit = fitOf("UMa");
  const point = (spec: ReturnType<typeof cameraFor>, p: readonly number[]): { x: number; y: number } => {
    const f = sub(spec.target, spec.position);
    const l = Math.hypot(...f);
    const fwd = f.map((n) => n / l);
    const right = cross(fwd, spec.up);
    const rel = sub(p, spec.position);
    return { x: dot(rel, right) / dot(rel, fwd), y: dot(rel, spec.up) / dot(rel, fwd) };
  };
  // a point on the near side of the figure: between the viewpoint and its middle
  const nearSide = fit.centre.map((n) => n * fit.middle * 0.5);
  const base = cameraFor(fit, RESTING_POSE);
  const turned = cameraFor(fit, { ...RESTING_POSE, yaw: 20 });
  assert.ok(point(turned, nearSide).x > point(base, nearSide).x, "yaw right");
  const tipped = cameraFor(fit, { ...RESTING_POSE, tilt: 20 });
  assert.ok(point(tipped, nearSide).y > point(base, nearSide).y, "tilt up");
});

test("zoom narrows the view, and the front view is as wide as the figure and never wider than 140 degrees", () => {
  const fit = fitOf("Ori");
  assert.ok(near(cameraFor(fit, { ...RESTING_POSE, zoom: 2 }).tanHalf, cameraFor(fit, RESTING_POSE).tanHalf / 2));
  for (const abbreviation of ["Hya", "Eri", "Ser", "Dra", "UMi", "Oct"]) {
    const f = fitOf(abbreviation, 0.46);
    assert.ok(frontTan(f.radius, f.aspect) <= Math.tan((70 * Math.PI) / 180) + 1e-9, abbreviation);
    const spec = cameraFor(f, RESTING_POSE);
    assert.ok(Number.isFinite(spec.tanHalf) && spec.tanHalf > 0, abbreviation);
  }
});

test("the layout: a star with no distance is a ray as long as the figure reaches, and the middle is a distance among the placed stars", () => {
  const orion = constellationIn3D("Ori");
  const layout = layoutOf(orion);
  assert.ok(layout.middle > 100 && layout.middle < 500, String(layout.middle));
  assert.ok(layout.reach >= layout.rayLength && layout.rayLength >= layout.middle * 1.6);
  assert.ok(layout.extent >= layout.reach);
  // a star whose range runs on to a thousand light-years does not squeeze the rest into a tenth of the view
  const bear = layoutOf(constellationIn3D("UMa"));
  assert.ok(bear.reach < 700, String(bear.reach));
  const alnilam = orion.stars.find((one) => one.star.name === "Alnilam")!;
  assert.equal(shapeOf(alnilam), "ray");
  const saiph = orion.stars.find((one) => one.star.name === "Saiph")!;
  assert.equal(shapeOf(saiph), "streak");
  assert.ok(near(displayFar(saiph), saiph.sight.best! * 3, 1e-9), "a range with no end is shown to three times the distance");
  const sirius = constellationIn3D("CMa").stars.find((one) => one.star.name === "Sirius")!;
  assert.equal(shapeOf(sirius), "bar");
  assert.ok(displayFar(sirius) <= sirius.sight.far! + 1e-9);
  const none = layoutOf(constellationIn3D("Oct"));
  assert.ok(none.middle > 0 && none.reach > 0);
});

test("niceStep gives 1, 2 or 5 times a power of ten, and brighter stars are bigger", () => {
  assert.equal(niceStep(130), 100);
  assert.equal(niceStep(240), 200);
  assert.equal(niceStep(600), 500);
  assert.equal(niceStep(0.7), 0.5);
  assert.ok(sizeOf(-1.4) > sizeOf(0.5) && sizeOf(0.5) > sizeOf(3) && sizeOf(3) > sizeOf(5));
  assert.ok(sizeOf(-5) <= 30 && sizeOf(9) >= 7);
});

test("at no turn the picture IS the sky chart: every star lands where the package's gnomonic projection puts it, whatever its distance", () => {
  for (const abbreviation of ["Ori", "UMa", "Cas", "Cru", "Sco"]) {
    const figure = constellationIn3D(abbreviation);
    const fit = fitOf(abbreviation);
    const spec = cameraFor(fit, RESTING_POSE);
    const f = sub(spec.target, spec.position);
    const l = Math.hypot(...f);
    const forward = f.map((n) => n / l);
    const right = cross(forward, spec.up);
    const centre = { rightAscension: ((Math.atan2(fit.centre[1], fit.centre[0]) * 180) / Math.PI + 360) % 360, declination: (Math.asin(fit.centre[2]) * 180) / Math.PI };
    for (const one of figure.stars) {
      // the star at any distance along its line of sight (a ray too) lands on the same point of the picture
      for (const t of [5, one.sight.best ?? 80, 900]) {
        const p = [one.sight.direction[0] * t, one.sight.direction[1] * t, one.sight.direction[2] * t];
        const rel = sub(p, spec.position);
        const x = dot(rel, right) / dot(rel, forward);
        const y = dot(rel, spec.up) / dot(rel, forward);
        const chart = project("gnomonic", one.star, { centre, scale: 1 })!;
        assert.ok(near(x, chart.x, 1e-9) && near(y, chart.y, 1e-9), `${abbreviation} ${one.id} at ${t} ly: ${x},${y} against ${chart.x},${chart.y}`);
      }
    }
  }
});
