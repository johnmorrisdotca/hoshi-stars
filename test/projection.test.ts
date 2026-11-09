// Map projections against their definitions (Snyder, USGS Professional Paper 1395): the centre, round trips, the known radii and outlines, equal area, the sky's east-left convention, hidden points, and bad input.
import assert from "node:assert/strict";
import { test } from "node:test";
import { PROJECTIONS, project, unproject, type Projection, type ProjectionOptions, type SkyPoint } from "../src/projection.ts";

const DEG = 180 / Math.PI;
const centres: SkyPoint[] = [
  { rightAscension: 0, declination: 0 },
  { rightAscension: 83.8, declination: -5.4 },
  { rightAscension: 279.2, declination: 38.8 },
  { rightAscension: 350, declination: -70 },
  { rightAscension: 12, declination: 89 },
];

function gap(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
}
function far(a: SkyPoint, b: SkyPoint): number {
  const r = Math.PI / 180;
  const vector = (p: SkyPoint): number[] => [Math.cos(p.declination * r) * Math.cos(p.rightAscension * r), Math.cos(p.declination * r) * Math.sin(p.rightAscension * r), Math.sin(p.declination * r)];
  const [p, q] = [vector(a), vector(b)];
  // the angle from the chord, which stays exact for points very close together
  return 2 * Math.asin(Math.min(1, Math.hypot(p[0]! - q[0]!, p[1]! - q[1]!, p[2]! - q[2]!) / 2)) * DEG;
}
function close(actual: number, expected: number, tolerance: number, what: string): void {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${what}: ${actual} vs ${expected}`);
}

test("the centre maps to (0, 0) for every kind, and back", () => {
  for (const kind of PROJECTIONS) {
    for (const centre of centres) {
      const options: ProjectionOptions = { centre, scale: 37 };
      assert.deepEqual(project(kind, centre, options), { x: 0, y: 0 }, `${kind} ${JSON.stringify(centre)}`);
      const back = unproject(kind, { x: 0, y: 0 }, options)!;
      close(gap(back.rightAscension, centre.rightAscension), 0, 1e-9, `${kind} RA`);
      close(back.declination, centre.declination, 1e-9, `${kind} dec`);
    }
  }
});

test("project then unproject returns the point within 1e-9 degrees, over a grid, for every kind", () => {
  let tried = 0;
  for (const kind of PROJECTIONS) {
    for (const centre of centres) {
      for (const [scale, rotation, mirror] of [[1, 0, false], [250, 33, true]] as const) {
        const options: ProjectionOptions = { centre, scale, rotation, mirror };
        for (let ra = 0; ra < 360; ra += 7.5) {
          for (let dec = -89.5; dec <= 89.5; dec += 7.25) {
            const point = { rightAscension: ra, declination: dec };
            const there = project(kind, point, options);
            if (there === undefined) continue;
            const back = unproject(kind, there, options);
            assert.ok(back, `${kind} ${ra} ${dec} came back undefined`);
            // gnomonic and stereographic stretch without limit near their edge, so only the range they are meant for is held to the bound
            // and the orthographic disc is edge-on at its rim, where a position is only known to about the square root of rounding (1e-6 degrees)
            const distance = far(point, centre);
            if ((kind === "gnomonic" && distance > 80) || (kind === "stereographic" && distance > 175) || (kind === "orthographic" && distance > 89.99)) continue;
            tried += 1;
            const where = `${kind} centre ${JSON.stringify(centre)} point ${ra} ${dec}`;
            // near a pole right ascension means nothing, so compare positions on the sphere
            close(far(point, back), 0, 1e-9, where);
          }
        }
      }
    }
  }
  assert.ok(tried > 20000, `only ${tried} points tried`);
});

test("round trip keeps right ascension and declination individually away from the poles", () => {
  const options: ProjectionOptions = { centre: { rightAscension: 100, declination: 20 }, scale: 3 };
  for (const kind of PROJECTIONS) {
    const point = { rightAscension: 130.123456, declination: 41.654321 };
    const back = unproject(kind, project(kind, point, options)!, options)!;
    close(back.rightAscension, point.rightAscension, 1e-9, `${kind} RA`);
    close(back.declination, point.declination, 1e-9, `${kind} dec`);
  }
});

test("stereographic: 90 degrees from the centre is at radius 2 times the scale", () => {
  const options = { centre: { rightAscension: 0, declination: 0 }, scale: 10 };
  const p = project("stereographic", { rightAscension: 90, declination: 0 }, options)!;
  close(Math.hypot(p.x, p.y), 20, 1e-12, "radius");
  const q = project("stereographic", { rightAscension: 0, declination: 90 }, options)!;
  close(Math.hypot(q.x, q.y), 20, 1e-12, "radius to the pole");
  close(Math.hypot(project("stereographic", { rightAscension: 60, declination: 0 }, { ...options, scale: 1 })!.x, 0), 2 * Math.tan(30 * Math.PI / 180), 1e-12, "2 tan(c / 2)");
});

test("orthographic: radius exactly the scale at 90 degrees, sin(c) inside", () => {
  const options = { centre: { rightAscension: 0, declination: 0 }, scale: 10 };
  const edge = project("orthographic", { rightAscension: 90, declination: 0 }, options)!;
  assert.equal(Math.hypot(edge.x, edge.y), 10);
  const edgeN = project("orthographic", { rightAscension: 0, declination: 90 }, options)!;
  assert.equal(Math.hypot(edgeN.x, edgeN.y), 10);
  const p = project("orthographic", { rightAscension: 30, declination: 0 }, { ...options, scale: 1 })!;
  close(Math.hypot(p.x, p.y), Math.sin(Math.PI / 6), 1e-15, "sin 30");
});

test("gnomonic and equidistant distances from the centre are tan(c) and c", () => {
  const options = { centre: { rightAscension: 40, declination: 30 }, scale: 1 };
  const point = { rightAscension: 40, declination: 70 };
  const g = project("gnomonic", point, options)!;
  close(Math.hypot(g.x, g.y), Math.tan(40 / DEG), 1e-12, "tan 40");
  const a = project("equidistant", point, options)!;
  close(Math.hypot(a.x, a.y), 40 / DEG, 1e-12, "40 degrees in radians");
  const anti = project("equidistant", { rightAscension: 220, declination: -30 }, options)!;
  close(Math.hypot(anti.x, anti.y), Math.PI, 1e-12, "the antipode is the rim, radius pi");
});

test("equirectangular: with scale 180 / pi, x and y are the degree offsets (x counted toward decreasing right ascension)", () => {
  const options = { centre: { rightAscension: 100, declination: 10 }, scale: DEG };
  const p = project("equirectangular", { rightAscension: 130, declination: 25 }, options)!;
  close(p.x, -30, 1e-12, "x");
  close(p.y, 15, 1e-12, "y");
  const m = project("equirectangular", { rightAscension: 130, declination: 25 }, { ...options, mirror: true })!;
  close(m.x, 30, 1e-12, "mirrored x");
  const wrapped = project("equirectangular", { rightAscension: 350, declination: 10 }, { ...options, centre: { rightAscension: 10, declination: 10 } })!;
  close(wrapped.x, 20, 1e-12, "350 is 20 degrees west of 10");
});

test("Mollweide and Hammer: the whole sphere fits the 2 sqrt(2) by sqrt(2) ellipse and the rim is reached", () => {
  for (const kind of ["mollweide", "hammer"] as const) {
    for (const centre of centres) {
      const options = { centre, scale: 1 };
      let widest = 0;
      for (let ra = 0; ra < 360; ra += 3) {
        for (let dec = -90; dec <= 90; dec += 3) {
          const p = project(kind, { rightAscension: ra, declination: dec }, options)!;
          assert.ok(p, `${kind} always lands somewhere`);
          const inside = (p.x * p.x) / 8 + (p.y * p.y) / 2;
          assert.ok(inside <= 1 + 1e-12, `${kind} ${ra} ${dec} is outside the ellipse (${inside})`);
          widest = Math.max(widest, inside);
        }
      }
      assert.ok(widest > 0.99, `${kind} rim reached (${widest})`);
    }
    const side = project(kind, { rightAscension: 180, declination: 0 }, { centre: { rightAscension: 0, declination: 0 } })!;
    close(Math.abs(side.x), 2 * Math.SQRT2, 1e-12, `${kind} half-width`);
    const top = project(kind, { rightAscension: 0, declination: 90 }, { centre: { rightAscension: 0, declination: 0 } })!;
    close(top.y, Math.SQRT2, 1e-12, `${kind} half-height`);
    assert.equal(unproject(kind, { x: 2 * Math.SQRT2 + 0.01, y: 0 }, { centre: centres[0]! }), undefined, `${kind} outside the oval`);
    assert.equal(unproject(kind, { x: 2.2, y: 1.2 }, { centre: centres[0]! }), undefined, `${kind} outside the oval, corner`);
  }
});

test("Mollweide and Hammer are equal-area: a small cell takes cos(declination) of its sphere area", () => {
  const cell = 0.2;
  for (const kind of ["mollweide", "hammer"] as const) {
    for (const [ra, dec] of [[0, 0], [30, 20], [-60, -45], [120, 70], [-150, 10], [170, -80]] as const) {
      const options = { centre: { rightAscension: 0, declination: 0 } };
      const corners = [[ra, dec], [ra + cell, dec], [ra + cell, dec + cell], [ra, dec + cell]].map(([a, d]) => project(kind, { rightAscension: (a! + 360) % 360, declination: d! }, options)!);
      let twice = 0;
      for (let i = 0; i < 4; i += 1) {
        const a = corners[i]!;
        const b = corners[(i + 1) % 4]!;
        twice += a.x * b.y - b.x * a.y;
      }
      const mapped = Math.abs(twice) / 2;
      const sphere = ((cell / DEG) * (cell / DEG) * (Math.sin((dec + cell) / DEG) - Math.sin(dec / DEG))) / (cell / DEG);
      assert.ok(Math.abs(mapped / sphere - 1) < 2e-3, `${kind} at ${ra},${dec}: map ${mapped} vs sphere ${sphere}`);
    }
  }
});

test("the sky is seen looking up: east is to the left, and mirror gives east on the right", () => {
  const options = { centre: { rightAscension: 100, declination: 0 } };
  for (const kind of PROJECTIONS) {
    const east = project(kind, { rightAscension: 110, declination: 0 }, options)!;
    const west = project(kind, { rightAscension: 90, declination: 0 }, options)!;
    const north = project(kind, { rightAscension: 100, declination: 10 }, options)!;
    assert.ok(east.x < 0 && west.x > 0, `${kind}: east left`);
    close(east.x, -west.x, 1e-12, `${kind} symmetric`);
    assert.ok(north.y > 0 && Math.abs(north.x) < 1e-12, `${kind}: north up`);
    const mirrored = project(kind, { rightAscension: 110, declination: 0 }, { ...options, mirror: true })!;
    assert.ok(mirrored.x > 0, `${kind}: mirror puts east right`);
    close(mirrored.x, -east.x, 1e-15, `${kind} mirror`);
    close(mirrored.y, east.y, 1e-15, `${kind} mirror y`);
  }
});

test("rotation turns the chart anticlockwise, scale multiplies it", () => {
  const point = { rightAscension: 100, declination: 10 };
  const base = { centre: { rightAscension: 100, declination: 0 } };
  const up = project("orthographic", point, base)!;
  const turned = project("orthographic", point, { ...base, rotation: 90 })!;
  close(turned.x, -up.y, 1e-15, "north goes to the left");
  close(turned.y, up.x, 1e-15, "y");
  const big = project("orthographic", point, { ...base, scale: 40 })!;
  close(big.y, up.y * 40, 1e-12, "scale");
});

test("hidden points are undefined: the far side of the orthographic and gnomonic, the stereographic antipode", () => {
  const options = { centre: { rightAscension: 0, declination: 0 } };
  assert.equal(project("orthographic", { rightAscension: 120, declination: 0 }, options), undefined);
  assert.equal(project("orthographic", { rightAscension: 180, declination: 0 }, options), undefined);
  assert.ok(project("orthographic", { rightAscension: 89, declination: 0 }, options));
  assert.equal(project("gnomonic", { rightAscension: 90, declination: 0 }, options), undefined);
  assert.equal(project("gnomonic", { rightAscension: 130, declination: 20 }, options), undefined);
  assert.ok(project("gnomonic", { rightAscension: 80, declination: 0 }, options));
  assert.equal(project("stereographic", { rightAscension: 180, declination: 0 }, options), undefined);
  assert.ok(project("stereographic", { rightAscension: 179, declination: 0 }, options));
  assert.ok(project("stereographic", { rightAscension: 120, declination: 0 }, options));
  for (const kind of ["equidistant", "equirectangular", "mollweide", "hammer"] as const) assert.ok(project(kind, { rightAscension: 180, declination: 0 }, options), `${kind} shows everything`);
});

test("unproject is undefined outside the map", () => {
  const options = { centre: { rightAscension: 0, declination: 0 } };
  assert.equal(unproject("orthographic", { x: 1.01, y: 0 }, options), undefined);
  assert.equal(unproject("orthographic", { x: 0.8, y: 0.8 }, options), undefined);
  assert.equal(unproject("equidistant", { x: 3.2, y: 0 }, options), undefined);
  assert.equal(unproject("equirectangular", { x: 3.2, y: 0 }, options), undefined);
  assert.equal(unproject("equirectangular", { x: 0, y: 1.6 }, options), undefined);
  assert.ok(unproject("stereographic", { x: 1e6, y: 0 }, options), "the stereographic plane is unbounded");
  assert.ok(unproject("gnomonic", { x: 1e6, y: 0 }, options), "so is the gnomonic");
});

test("the poles and the wrap at 0 and 360 behave", () => {
  const options = { centre: { rightAscension: 0, declination: 0 } };
  for (const kind of PROJECTIONS) {
    const a = project(kind, { rightAscension: 0, declination: 20 }, options)!;
    const b = project(kind, { rightAscension: 360, declination: 20 }, options)!;
    const c = project(kind, { rightAscension: -360, declination: 20 }, options)!;
    close(a.x, b.x, 1e-12, `${kind} 0 vs 360`);
    close(a.y, c.y, 1e-12, `${kind} 0 vs -360`);
    const near = project(kind, { rightAscension: 359.9999, declination: 5 }, options)!;
    const just = project(kind, { rightAscension: 0.0001, declination: 5 }, options)!;
    assert.ok(Math.abs(near.x - just.x) < 1e-5 && near.x > 0 !== just.x > 0, `${kind} the seam is smooth`);
    // every right ascension is the same point at a pole (a gnomonic chart centred on the equator cannot show it)
    const poleA = project(kind, { rightAscension: 10, declination: 90 }, options);
    const poleB = project(kind, { rightAscension: 250, declination: 90 }, options);
    const south = project(kind, { rightAscension: 77, declination: -90 }, options);
    if (kind === "gnomonic") {
      assert.equal(poleA, undefined);
      continue;
    }
    assert.ok(poleA && poleB && south, kind);
    // the plain right ascension and declination plot draws a pole as its whole top edge, so only its height is one value
    if (kind !== "equirectangular") close(poleA.x, poleB.x, 1e-12, `${kind} pole x`);
    close(poleA.y, poleB.y, 1e-12, `${kind} pole y`);
    if (kind !== "orthographic" && kind !== "equirectangular") close(unproject(kind, south, options)!.declination, -90, 1e-6, `${kind} south pole comes back`);
  }
  const back = unproject("hammer", project("hammer", { rightAscension: 10, declination: 90 }, options)!, options)!;
  close(back.declination, 90, 1e-6, "north pole round trip");
  // unproject answers right ascension in 0 up to 360, never 360
  for (let x = -0.9; x <= 0.9; x += 0.05) for (const kind of PROJECTIONS) {
    const s = unproject(kind, { x, y: 0.1 }, options);
    if (s) assert.ok(s.rightAscension >= 0 && s.rightAscension < 360, `${kind} ${x}: ${s.rightAscension}`);
  }
});

test("bad input throws a RangeError that names the value", () => {
  const options = { centre: { rightAscension: 0, declination: 0 } };
  const ok = { rightAscension: 10, declination: 10 };
  assert.throws(() => project("stereographic", { rightAscension: Number.NaN, declination: 0 }, options), (e: Error) => e instanceof RangeError && /point\.rightAscension.*NaN/.test(e.message));
  assert.throws(() => project("stereographic", { rightAscension: 0, declination: Number.NaN }, options), (e: Error) => e instanceof RangeError && /point\.declination.*NaN/.test(e.message));
  assert.throws(() => project("mollweide", { rightAscension: Number.POSITIVE_INFINITY, declination: 0 }, options), (e: Error) => e instanceof RangeError && /Infinity/.test(e.message));
  assert.throws(() => project("mollweide", { rightAscension: 0, declination: 90.5 }, options), (e: Error) => e instanceof RangeError && /-90 and 90.*90\.5/.test(e.message));
  assert.throws(() => project("mollweide", { rightAscension: 0, declination: -100 }, options), (e: Error) => e instanceof RangeError && /-100/.test(e.message));
  assert.throws(() => project("mercator" as Projection, ok, options), (e: Error) => e instanceof RangeError && /"mercator"/.test(e.message) && /stereographic/.test(e.message));
  assert.throws(() => unproject("mercator" as Projection, { x: 0, y: 0 }, options), (e: Error) => e instanceof RangeError && /"mercator"/.test(e.message));
  assert.throws(() => project("hammer", ok, { centre: { rightAscension: 0, declination: 91 } }), (e: Error) => e instanceof RangeError && /options\.centre\.declination.*91/.test(e.message));
  assert.throws(() => project("hammer", ok, { centre: { rightAscension: Number.NaN, declination: 0 } }), (e: Error) => e instanceof RangeError && /options\.centre\.rightAscension.*NaN/.test(e.message));
  assert.throws(() => project("hammer", ok, { ...options, scale: 0 }), (e: Error) => e instanceof RangeError && /scale.*0/.test(e.message));
  assert.throws(() => project("hammer", ok, { ...options, scale: -2 }), (e: Error) => e instanceof RangeError && /-2/.test(e.message));
  assert.throws(() => project("hammer", ok, { ...options, rotation: Number.NaN }), (e: Error) => e instanceof RangeError && /rotation.*NaN/.test(e.message));
  assert.throws(() => unproject("hammer", { x: Number.NaN, y: 0 }, options), (e: Error) => e instanceof RangeError && /point\.x.*NaN/.test(e.message));
  assert.throws(() => unproject("hammer", { x: 0, y: Number.POSITIVE_INFINITY }, options), (e: Error) => e instanceof RangeError && /point\.y.*Infinity/.test(e.message));
  assert.throws(() => project("hammer", undefined as unknown as SkyPoint, options), TypeError);
  assert.throws(() => project("hammer", ok, undefined as unknown as ProjectionOptions), TypeError);
});

test("speed: 1,000,000 random points through each kind stay inside a stated budget", () => {
  // Measured on the author's Mac (Node 24): 50 to 110 ms per million projections for every kind but Mollweide (about 230 ms, its Newton iteration). A shared CI
  // machine runs it about four times slower and varies from run to run (Mollweide once took 1,039 ms there), so each kind is timed three times and the fastest
  // counts, and the budget is 2000 ms, about nine times the slowest on the Mac: enough to catch a real slowdown, not a busy machine.
  const BUDGET_MS = 2000;
  let seed = 12345;
  const random = (): number => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const points: SkyPoint[] = [];
  for (let i = 0; i < 1_000_000; i += 1) points.push({ rightAscension: random() * 360, declination: Math.asin(random() * 2 - 1) * DEG });
  const options = { centre: { rightAscension: 120, declination: 25 }, scale: 300 };
  const times: string[] = [];
  for (const kind of PROJECTIONS) {
    let landed = 0;
    let took = Number.POSITIVE_INFINITY;
    for (let run = 0; run < 3; run += 1) {
      const start = performance.now();
      landed = 0;
      for (const point of points) if (project(kind, point, options) !== undefined) landed += 1;
      took = Math.min(took, performance.now() - start);
    }
    times.push(`${kind} ${took.toFixed(0)} ms`);
    assert.ok(landed > 400_000, `${kind} landed ${landed}`);
    assert.ok(took < BUDGET_MS, `${kind} took ${took.toFixed(0)} ms (fastest of 3) for 1,000,000 points; the budget is ${BUDGET_MS} ms`);
  }
  console.log(`1,000,000 projections each: ${times.join(", ")}`);
});
