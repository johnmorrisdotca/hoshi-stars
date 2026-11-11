// The shapes of deep-sky objects: sizes, axis ratios and angles from RC3, the Messier table and NGC 2000.0 (NASA's HEASARC; the numbers below were read from those tables on 2026-11-09 and are fixed here, so
// the test never calls the network), the outline on the sky, and what is measured.
import assert from "node:assert/strict";
import { test } from "node:test";
import { gzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { deepSky, deepSkyObject } from "../src/deep-sky-ngc-ic.ts";
import { messier } from "../src/deep-sky.ts";
import { deepSkyOutline, deepSkyShape, measuredParts, offsetOnSky } from "../src/deep-sky-shape.ts";
import { deepSkyShape as deepSkyShapeAll } from "../src/deep-sky-shape-ngc-ic.ts";
import { shapeTable } from "../src/deep-sky-shape-core.ts";
import { MESSIER_SHAPES } from "../src/data/deep-sky-shapes-messier.ts";
import { NGC_IC_SHAPES } from "../src/data/deep-sky-shapes-ngc-ic.ts";

const separation = (a: { rightAscension: number; declination: number }, b: { rightAscension: number; declination: number }): number => {
  const [r1, d1, r2, d2] = [a.rightAscension, a.declination, b.rightAscension, b.declination].map((x) => (x * Math.PI) / 180) as [number, number, number, number];
  return (Math.acos(Math.min(1, Math.sin(d1) * Math.sin(d2) + Math.cos(d1) * Math.cos(d2) * Math.cos(r1 - r2))) * 180) / Math.PI;
};

test("deepSkyShape gives Andromeda RC3's major axis, axis ratio and angle", () => {
  const shape = deepSkyShape(deepSkyObject("M31")!);
  assert.equal(shape.source, "RC3");
  assert.ok(Math.abs(shape.majorArcmin! - 190.5) < 0.1, "10^3.28 tenths of an arc-minute");
  assert.ok(Math.abs(shape.majorArcmin! / shape.minorArcmin! - 3.09) < 0.05, "log R25 0.49");
  assert.equal(shape.positionAngle, 35);
  assert.deepEqual(measuredParts(shape), { size: true, ratio: true, angle: true, oval: true });
});

test("a Messier nebula or cluster has only the one diameter its own row carries, no ratio and no angle: nothing is invented, and no Sky Catalog second diameter is added", () => {
  const m42 = deepSkyShape(deepSkyObject("M42")!);
  assert.deepEqual({ ...m42 }, { majorArcmin: 66, minorArcmin: undefined, positionAngle: undefined, source: "Catalogue row" });
  assert.deepEqual(measuredParts(m42), { size: true, ratio: false, angle: false, oval: false });
  const m13 = deepSkyShape(deepSkyObject("M13")!);
  assert.deepEqual([m13.majorArcmin, m13.minorArcmin, m13.positionAngle], [17, undefined, undefined]);
  assert.equal(deepSkyShape(deepSkyObject("M8")!).minorArcmin, undefined, "the Sky Catalog's 90 by 40 is not carried");
});

test("M51, M101 and M104 are RC3 galaxies, M101 round enough to have no angle", () => {
  const m51 = deepSkyShape(deepSkyObject("M51")!);
  assert.deepEqual([m51.source, m51.positionAngle], ["RC3", 163]);
  assert.equal(deepSkyShape(deepSkyObject("M101")!).positionAngle, undefined);
  assert.equal(deepSkyShape(deepSkyObject("M104")!).positionAngle, 90);
});

test("M45 has the 110 arc-minutes its row carries, and M40 has no size at all", () => {
  assert.equal(deepSkyShape(deepSkyObject("M45")!).majorArcmin, 110);
  const m40 = deepSkyShape(deepSkyObject("M40")!);
  assert.deepEqual([m40.majorArcmin, m40.source], [undefined, undefined]);
  assert.deepEqual(measuredParts(m40), { size: false, ratio: false, angle: false, oval: false });
});

test("the large table gives 9,787 of the 11,898 objects a size and 7,286 an angle: RC3's for 7,013 galaxies, NED's for 2,698 more, and no angle for anything that is not a galaxy", () => {
  const all = deepSky();
  const shapes = all.map((o) => deepSkyShapeAll(o));
  assert.equal(shapes.filter((x) => x.majorArcmin !== undefined).length, 9787);
  assert.equal(shapes.filter((x) => x.positionAngle !== undefined).length, 7286);
  assert.equal(shapes.filter((x) => x.source === "RC3").length, 7013);
  assert.equal(shapes.filter((x) => x.source === "NED").length, 2698);
  assert.deepEqual([...new Set(shapes.map((x) => x.source))].sort(), ["Catalogue row", "NED", "RC3", undefined].sort());
  const ngc253 = deepSkyShapeAll(deepSkyObject("NGC 253")!);
  assert.equal(ngc253.source, "RC3");
  assert.ok(ngc253.majorArcmin! > 25 && ngc253.majorArcmin! < 35, "NGC 253 is about 30 arc-minutes long at D25");
  assert.ok(ngc253.positionAngle !== undefined && ngc253.minorArcmin! < ngc253.majorArcmin! / 3);
  assert.equal(all.filter((o) => deepSkyShapeAll(o).positionAngle !== undefined && o.type !== "galaxy").length, 0, "only galaxies have an angle");
  assert.equal(all.filter((o) => o.type !== "galaxy" && deepSkyShapeAll(o).source !== "Catalogue row" && deepSkyShapeAll(o).source !== undefined).length, 0, "an object that is not a galaxy has only the size its row carries");
  assert.ok(all.every((o) => Object.isFrozen(deepSkyShapeAll(o))));
});

test("the fallback without NED (`--no-ned`, not shipped): RC3's 7,013 galaxies keep their shape, the 2,706 that had NED's have none and are drawn dotted, and nothing else changes", () => {
  const noNed = (rows: string): string => rows.split("\n").filter((row) => !row.endsWith("|d")).join("\n");
  const fallback = shapeTable([noNed(MESSIER_SHAPES), noNed(NGC_IC_SHAPES)]);
  const all = deepSky();
  const shapes = all.map((o) => fallback.shapeOf(o));
  assert.equal(shapes.filter((x) => x.source === "NED").length, 0);
  assert.equal(shapes.filter((x) => x.source === "RC3").length, 7013);
  assert.equal(shapes.filter((x) => x.majorArcmin !== undefined).length, 7089);
  assert.equal(shapes.filter((x) => x.positionAngle !== undefined).length, 4736);
  assert.equal(all.filter((o, i) => o.type === "galaxy" && shapes[i]!.majorArcmin === undefined).length, 3269, "no galaxy row carries a size of its own, so these are dotted");
  const kept = all.filter((o) => deepSkyShapeAll(o).source !== "NED");
  assert.deepEqual(kept.map((o) => ({ ...fallback.shapeOf(o) })), kept.map((o) => ({ ...deepSkyShapeAll(o) })));
  assert.deepEqual({ ...fallback.shapeOf(deepSkyObject("NGC 4676")!) }, { majorArcmin: undefined, minorArcmin: undefined, positionAngle: undefined, source: undefined });
});

test("a galaxy RC3 does not cover has NED's shape: the Mice, NGC 4676", () => {
  const mice = deepSkyShapeAll(deepSkyObject("NGC 4676")!);
  assert.deepEqual({ ...mice }, { majorArcmin: 3.5, minorArcmin: 1.9, positionAngle: 3, source: "NED" });
});

test("the Messier table alone holds the Messier galaxies' shapes, and another object gets only the size its own row carries", () => {
  assert.equal(deepSkyShape(deepSkyObject("NGC 253")!).majorArcmin, undefined);
  assert.equal(messier().filter((o) => deepSkyShape(o).majorArcmin !== undefined).length, 108);
  assert.equal(messier().filter((o) => deepSkyShape(o).positionAngle !== undefined).length, 32);
});

test("shapeTable reads a row of the data", () => {
  const table = shapeTable(["M31|1905|617|35|r"]);
  assert.deepEqual({ ...table.shapeOf(deepSkyObject("M31")!) }, { majorArcmin: 190.5, minorArcmin: 61.7, positionAngle: 35, source: "RC3" });
});

test("offsetOnSky moves a given distance on the sky: north 60 arc-minutes is one degree, and east is shortened by the cosine of the declination", () => {
  const centre = { rightAscension: 10.68, declination: 60 };
  const north = offsetOnSky(centre, 0, 60);
  assert.ok(Math.abs(north.declination - 61) < 0.002 && Math.abs(north.rightAscension - 10.68) < 1e-9);
  const east = offsetOnSky(centre, 60, 0);
  assert.ok(Math.abs(separation(centre, east) - 1) < 0.002, "one degree away");
  assert.ok(east.rightAscension > centre.rightAscension + 1.9 && east.rightAscension < centre.rightAscension + 2.1, "two degrees of right ascension at declination 60");
  const wrapped = offsetOnSky({ rightAscension: 359.9, declination: 0 }, 30, 0);
  assert.ok(wrapped.rightAscension > 0 && wrapped.rightAscension < 1, "right ascension wraps");
});

test("deepSkyOutline is an ellipse of the right size round the centre, the major axis at the position angle", () => {
  const m31 = deepSkyObject("M31")!;
  const shape = deepSkyShape(m31);
  const ring = deepSkyOutline(m31, shape, 48)!;
  assert.equal(ring.length, 49);
  assert.deepEqual(ring[0], ring[48]);
  const distances = ring.slice(0, 48).map((p) => separation(m31, p) * 60);
  assert.ok(Math.abs(Math.max(...distances) - 95.25) < 0.3, "half the major axis");
  assert.ok(Math.abs(Math.min(...distances) - 30.85) < 0.3, "half the minor axis");
  const tip = ring[0]!;
  assert.ok(tip.rightAscension > m31.rightAscension && tip.declination > m31.declination, "the major axis points north-east at 35 degrees");
  const bearing = (Math.atan2((tip.rightAscension - m31.rightAscension) * Math.cos((m31.declination * Math.PI) / 180), tip.declination - m31.declination) * 180) / Math.PI;
  assert.ok(Math.abs(bearing - 35) < 1, `bearing ${bearing}`);
});

test("without a measured ratio and angle the outline is a circle of the major diameter", () => {
  const m42 = deepSkyObject("M42")!;
  const ring = deepSkyOutline(m42, deepSkyShape(m42), 16)!;
  for (const p of ring.slice(0, 16)) assert.ok(Math.abs(separation(m42, p) * 60 - 33) < 0.05);
  assert.equal(deepSkyOutline(m42, deepSkyShape(deepSkyObject("M40")!)), undefined);
  assert.throws(() => deepSkyOutline(m42, deepSkyShape(m42), 4), RangeError);
});

test("the shape tables are small", () => {
  assert.ok(gzipSync(readFileSync(new URL("../src/data/deep-sky-shapes-messier.ts", import.meta.url))).length < 1500);
  assert.ok(gzipSync(readFileSync(new URL("../src/data/deep-sky-shapes-ngc-ic.ts", import.meta.url))).length < 60_000);
});
