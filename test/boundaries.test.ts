// Which constellation a point is in, and the boundary lines: N. G. Roman's own test positions, every bright star's catalogue constellation, the poles, the 0 h seam, Serpens in two pieces, the areas, bad input, size and speed.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { gzipSync } from "node:zlib";
import { boundaries, boundaryOf, constellationAt } from "../src/boundaries.ts";
import { BOUNDARY_RINGS } from "../src/data/boundaries.ts";
import { constellation, constellations } from "../src/constellations.ts";
import { stars, starByName } from "../src/stars.ts";

const DEGREES = Math.PI / 180;
type Point = { rightAscension: number; declination: number };

// B1950.0 is JD 2433282.4235 (Meeus, Astronomical Algorithms, chapter 21); Unix milliseconds are (JD - 2440587.5) days.
const B1950 = (2433282.4235 - 2440587.5) * 86_400_000;

test("Roman's own eight test positions (equinox 1950) are in the constellations her program prints", () => {
  // VizieR VI/42 test.in and out.dat: position in hours and degrees, the answer in the last column.
  const cases: Array<[number, number, string]> = [
    [9.0, 65.0, "UMa"],
    [23.5, -20.0, "Aqr"],
    [5.12, 9.12, "Ori"],
    [9.4555, -19.9, "Hya"],
    [12.8888, 22.0, "Com"],
    [15.6687, -12.1234, "Lib"],
    [19.0, -40.0, "CrA"],
    [6.2222, -81.1234, "Men"],
  ];
  for (const [hours, declination, expected] of cases) assert.equal(constellationAt({ rightAscension: hours * 15, declination }, B1950).abbreviation, expected, `${hours} h ${declination}`);
});

test("every one of the 5,080 bright stars has the constellation the boundaries give, and the 2,736 the catalogue names agree", () => {
  const all = stars();
  assert.equal(all.length, 5080);
  const wrong = all.filter((star) => constellationAt(star).abbreviation !== star.constellation).map((star) => `HR ${star.hr} is ${star.constellation}, the boundaries give ${constellationAt(star).abbreviation}`);
  assert.deepEqual(wrong, []);
  const named = all.filter((star) => star.designation !== undefined);
  assert.equal(named.length, 2736);
  assert.ok(named.every((star) => star.designation!.endsWith(` ${star.constellation}`)));
});

test("the celestial poles are in Ursa Minor and Octans, at every right ascension", () => {
  for (const ra of [0, 1, 90, 180, 270, 359.999, 360, -20]) {
    assert.equal(constellationAt({ rightAscension: ra, declination: 90 }).abbreviation, "UMi", `north, ${ra}`);
    assert.equal(constellationAt({ rightAscension: ra, declination: -90 }).abbreviation, "Oct", `south, ${ra}`);
  }
  assert.equal(constellationAt(starByName("Polaris")!).abbreviation, "UMi");
  assert.equal(constellationAt({ rightAscension: 0, declination: 89.5 }, B1950).abbreviation, "UMi");
});

test("right ascension wraps: both sides of 0 h, and any whole number of turns", () => {
  const pisces = { rightAscension: 0, declination: 5 };
  for (const ra of [359.5, 359.9, 0, 0.1, 0.5]) assert.equal(constellationAt({ ...pisces, rightAscension: ra }).abbreviation, "Psc", String(ra));
  assert.equal(constellationAt({ rightAscension: 2.1, declination: 29.1 }).abbreviation, "And");
  assert.equal(constellationAt({ rightAscension: 359.0, declination: 59.15 }).abbreviation, "Cas");
  assert.equal(constellationAt({ rightAscension: 2.3, declination: 59.15 }).abbreviation, "Cas");
  for (const declination of [-80, -30, 0, 30, 60]) {
    const a = constellationAt({ rightAscension: 123.4, declination });
    assert.equal(constellationAt({ rightAscension: 123.4 + 360, declination }), a);
    assert.equal(constellationAt({ rightAscension: 123.4 - 720, declination }), a);
  }
  assert.equal(constellationAt({ rightAscension: -0.5, declination: 5 }), constellationAt({ rightAscension: 359.5, declination: 5 }));
  assert.equal(constellationAt({ rightAscension: -1e-18, declination: 5 }).abbreviation, "Psc");
});

test("Serpens is one constellation, Ser, in two pieces", () => {
  const head = constellationAt({ rightAscension: 236.07, declination: 6.43 });
  const tail = constellationAt({ rightAscension: 275.33, declination: -2.9 });
  assert.equal(head.abbreviation, "Ser");
  assert.equal(tail, head);
  assert.equal(boundaryOf("Ser").outlines.length, 2);
  for (const b of boundaries()) if (b.constellation.abbreviation !== "Ser") assert.equal(b.outlines.length, 1, b.constellation.name);
  assert.ok(stars().filter((star) => star.constellation === "Ser").every((star) => constellationAt(star).abbreviation === "Ser"));
});

test("a position of date is precessed: the same J2000 point named by a Date or milliseconds, and the J2000 default", () => {
  const point = { rightAscension: 88.79, declination: 7.41 };
  const j2000 = Date.UTC(2000, 0, 1, 12);
  assert.equal(constellationAt(point, j2000), constellationAt(point));
  assert.equal(constellationAt(point, new Date(j2000)), constellationAt(point));
  assert.equal(constellationAt(point, new Date(Date.UTC(2026, 10, 8))).abbreviation, "Ori");
  // 1875 is the frame of the table: a corner of Crux (11h 50m, -64) is in Crux there and just outside Crux one corner step away.
  const b1875 = (2405889.25855 - 2440587.5) * 86_400_000;
  assert.equal(constellationAt({ rightAscension: 11.84 * 15, declination: -63.9 }, b1875).abbreviation, "Cru");
  assert.notEqual(constellationAt({ rightAscension: 11.82 * 15, declination: -63.9 }, b1875).abbreviation, "Cru");
});

test("precession agrees with Herget's, the one Roman's program uses, to under 5 arc-seconds from 1875 to 2000", () => {
  // Port of the subroutine HGTPRC in VizieR VI/42 program.f (Herget 1948, Publ. Cincinnati Obs. 24, p. 9), the Newcomb-based precession of the table's day.
  function herget(ra: number, dec: number, from: number, to: number): Point {
    const csr = DEGREES / 3600;
    const t = 0.001 * (to - from);
    const st = 0.001 * (from - 1900);
    const a = csr * t * (23042.53 + st * (139.75 + 0.06 * st) + t * (30.23 - 0.27 * st + 18.0 * t));
    const b = csr * t * t * (79.27 + 0.66 * st + 0.32 * t) + a;
    const c = csr * t * (20046.85 - st * (85.33 + 0.37 * st) + t * (-42.67 - 0.37 * st - 41.8 * t));
    const [sa, sb, sc, ca, cb, cc] = [Math.sin(a), Math.sin(b), Math.sin(c), Math.cos(a), Math.cos(b), Math.cos(c)] as const;
    const x = [Math.cos(dec * DEGREES) * Math.cos(ra * DEGREES), Math.cos(dec * DEGREES) * Math.sin(ra * DEGREES), Math.sin(dec * DEGREES)] as const;
    const r = [
      [ca * cb * cc - sa * sb, -ca * sb - sa * cb * cc, -cb * sc],
      [sa * cb + ca * sb * cc, ca * cb - sa * sb * cc, -sb * sc],
      [ca * sc, -sa * sc, cc],
    ] as const;
    const y = r.map((row) => row[0] * x[0] + row[1] * x[1] + row[2] * x[2]) as [number, number, number];
    return { rightAscension: ((Math.atan2(y[1], y[0]) / DEGREES) + 360) % 360, declination: Math.asin(y[2]) / DEGREES };
  }
  // The first point of an outline is the table's own first corner (hours, degrees at B1875.0) carried to J2000 by this package.
  let worst = 0;
  for (const line of BOUNDARY_RINGS.split("\n")) {
    const [abbreviation, rings] = line.split("|") as [string, string];
    const [hours, declination] = rings.split("/")[0]!.split(" ")[0]!.split(",").map(Number) as [number, number];
    const got = boundaryOf(abbreviation).outlines[0]![0]!;
    const expected = herget(hours * 15, declination, 1875, 2000);
    const gap = Math.hypot((((got.rightAscension - expected.rightAscension + 540) % 360) - 180) * Math.cos(declination * DEGREES), got.declination - expected.declination) * 3600;
    worst = Math.max(worst, gap);
    assert.ok(gap < 5, `${abbreviation}: the corner is ${gap.toFixed(2)} arc-seconds from Herget's`);
  }
  assert.ok(worst > 0.1, "the two precessions are different formulas, so they should not agree exactly");
});

test("all 88 constellations have a boundary: closed, in range, one per constellation, in the order of constellations()", () => {
  const all = boundaries();
  assert.equal(all.length, 88);
  assert.deepEqual(all.map((b) => b.constellation), constellations());
  for (const { constellation: c, outlines } of all) {
    assert.ok(outlines.length >= 1, c.name);
    for (const outline of outlines) {
      assert.ok(outline.length >= 5, `${c.name} has ${outline.length} points`);
      assert.deepEqual(outline[0], outline.at(-1), `${c.name} is closed`);
      for (const p of outline) assert.ok(p.rightAscension >= 0 && p.rightAscension < 360 && p.declination >= -90 && p.declination <= 90, `${c.name} ${JSON.stringify(p)}`);
    }
  }
  assert.equal(boundaryOf("Orion").constellation, constellation("Ori"));
  assert.deepEqual(boundaryOf("ori"), boundaryOf("Ori"));
});

function vector(p: Point): [number, number, number] {
  const c = Math.cos(p.declination * DEGREES);
  return [c * Math.cos(p.rightAscension * DEGREES), c * Math.sin(p.rightAscension * DEGREES), Math.sin(p.declination * DEGREES)];
}

/** Square degrees inside a closed outline: the signed areas of the triangles from its first point (Van Oosterom and Strackee 1983), added. */
function area(outline: Point[]): number {
  const v = outline.map(vector);
  const o = v[0]!;
  const dot = (a: number[], b: number[]): number => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
  let sum = 0;
  for (let i = 1; i < v.length - 2; i++) {
    const a = v[i]!;
    const b = v[i + 1]!;
    const cross = [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!];
    sum += 2 * Math.atan2(dot(o, cross), 1 + dot(o, a) + dot(a, b) + dot(b, o));
  }
  return Math.abs(sum) / (DEGREES * DEGREES);
}

test("the outlines tile the whole sky, and the areas are the IAU's", () => {
  const areas = new Map(boundaries({ step: 0.25 }).map((b) => [b.constellation.abbreviation, b.outlines.reduce((n, o) => n + area(o), 0)]));
  const total = [...areas.values()].reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(total - 41252.96) < 0.05, `the sky is ${total} square degrees`);
  // The IAU's areas in square degrees (Delporte's boundaries): the largest, a small one, and the two that hold a pole.
  for (const [abbreviation, expected] of [["Hya", 1302.844], ["Vir", 1294.428], ["UMa", 1279.66], ["Cru", 68.447], ["Equ", 71.641], ["Sge", 79.932]] as const) {
    assert.ok(Math.abs(areas.get(abbreviation)! - expected) < expected * 0.001, `${abbreviation} is ${areas.get(abbreviation)} square degrees, expected ${expected}`);
  }
  const sorted = [...areas.entries()].sort((a, b) => b[1] - a[1]);
  assert.equal(sorted[0]![0], "Hya");
  assert.equal(sorted.at(-1)![0], "Cru");
});

test("each outline encloses just what constellationAt says: 100,000 evenly spread points land in the constellation whose area they fill", () => {
  const count = 100_000;
  const golden = Math.PI * (3 - Math.sqrt(5));
  const hits = new Map<string, number>();
  for (let i = 0; i < count; i++) {
    const c = constellationAt({ rightAscension: ((i * golden) / DEGREES) % 360, declination: Math.asin(1 - (2 * (i + 0.5)) / count) / DEGREES }).abbreviation;
    hits.set(c, (hits.get(c) ?? 0) + 1);
  }
  const perPoint = 41252.96 / count;
  for (const b of boundaries({ step: 0.25 })) {
    const expected = b.outlines.reduce((n, o) => n + area(o), 0);
    const counted = (hits.get(b.constellation.abbreviation) ?? 0) * perPoint;
    assert.ok(Math.abs(counted - expected) < 2 + expected * 0.01, `${b.constellation.name}: ${counted.toFixed(1)} counted, ${expected.toFixed(1)} enclosed`);
  }
});

test("edges are cut into pieces no longer than the step, and a smaller step gives more points", () => {
  const gap = (a: Point, b: Point): number => Math.acos(Math.min(1, vector(a).reduce((n, x, i) => n + x * vector(b)[i]!, 0))) / DEGREES;
  for (const step of [1, 0.25]) {
    for (const b of [boundaryOf("Ori", { step }), boundaryOf("UMi", { step }), boundaryOf("Oct", { step })]) {
      for (const outline of b.outlines) for (let i = 1; i < outline.length; i++) assert.ok(gap(outline[i - 1]!, outline[i]!) <= step * 1.001, `${b.constellation.name}: ${gap(outline[i - 1]!, outline[i]!)} degrees at step ${step}`);
    }
  }
  const count = (step: number): number => boundaries({ step }).reduce((n, b) => n + b.outlines.reduce((m, o) => m + o.length, 0), 0);
  assert.ok(count(0.5) > count(1) && count(1) > count(5) && count(5) > 1000);
  assert.ok(count(1) < 12_000, "about 9,000 points for the whole sky at the default step");
  assert.deepEqual(boundaries(), boundaries({ step: 1 }));
});

test("bad input throws a clear error", () => {
  const ok = { rightAscension: 10, declination: 10 };
  for (const bad of [undefined, null, "Orion", 5, {}, { rightAscension: 1 }, { rightAscension: "1", declination: 2 }, { rightAscension: 1, declination: null }, [1, 2]]) {
    assert.throws(() => constellationAt(bad as never), TypeError, String(JSON.stringify(bad)));
  }
  for (const bad of [{ rightAscension: Number.NaN, declination: 0 }, { rightAscension: Infinity, declination: 0 }, { rightAscension: 0, declination: Number.NaN }, { rightAscension: 0, declination: 90.0001 }, { rightAscension: 0, declination: -91 }]) {
    assert.throws(() => constellationAt(bad), RangeError, JSON.stringify(bad));
  }
  assert.throws(() => constellationAt(ok, "now" as never), TypeError);
  assert.throws(() => constellationAt(ok, new Date(Number.NaN)), RangeError);
  assert.throws(() => constellationAt(ok, Number.NaN), RangeError);
  assert.throws(() => boundaryOf("Atlantis"), /not one of the 88 constellations/);
  assert.throws(() => boundaryOf(7 as never), TypeError);
  for (const step of [0, -1, 0.001, 91, Number.NaN]) {
    assert.throws(() => boundaryOf("Ori", { step }), RangeError, String(step));
    assert.throws(() => boundaries({ step }), RangeError, String(step));
  }
  assert.throws(() => boundaryOf("Ori", { step: "1" as never }), TypeError);
  assert.throws(() => boundaries({ step: "1" as never }), TypeError);
});

test("the results are the shared constellations, and nothing the caller changes leaks back", () => {
  assert.equal(constellationAt(starByName("Rigel")!), constellation("Ori"));
  assert.ok(Object.isFrozen(constellationAt({ rightAscension: 10, declination: 10 })));
  const first = boundaryOf("Cru");
  first.outlines[0]!.length = 0;
  first.outlines[0] = [];
  assert.ok(boundaryOf("Cru").outlines[0]!.length > 4);
});

test("the data stays small: under 8,000 bytes gzipped (measured 7,400)", () => {
  const bytes = gzipSync(readFileSync(new URL("../src/data/boundaries.ts", import.meta.url))).byteLength;
  assert.ok(bytes < 8000, `the boundary data is ${bytes} bytes gzipped`);
});

test("100,000 lookups take under 500 ms, the fastest of three runs (measured 35 to 55 ms on a laptop; a shared CI machine is about four times slower and varies)", () => {
  const count = 100_000;
  const golden = Math.PI * (3 - Math.sqrt(5));
  const points: Point[] = [];
  for (let i = 0; i < count; i++) points.push({ rightAscension: ((i * golden) / DEGREES) % 360, declination: Math.asin(1 - (2 * (i + 0.5)) / count) / DEGREES });
  constellationAt(points[0]!);
  let elapsed = Number.POSITIVE_INFINITY;
  for (let run = 0; run < 3; run += 1) {
    const start = performance.now();
    for (const p of points) constellationAt(p);
    elapsed = Math.min(elapsed, performance.now() - start);
  }
  assert.ok(elapsed < 500, `${elapsed.toFixed(0)} ms (fastest of 3) for ${count} lookups`);
});
