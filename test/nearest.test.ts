// What is near what: the answers against a brute-force reference written here, the known pairs (Mizar and Alcor, the Pleiades, Alpha Centauri, Sirius and Procyon), Orion's neighbours, the poles, the 0 and 360 seam,
// the antipode, a date, bad input, the neighbour table against a grid of the whole sky, and the time of one query over all the stars.
import assert from "node:assert/strict";
import { test } from "node:test";
import { constellationAt } from "../src/boundaries.ts";
import { constellations } from "../src/constellations.ts";
import { deepSkyObject, messier } from "../src/deep-sky.ts";
import { neighbouringConstellations, nearest, within } from "../src/nearest.ts";
import { starByName, starDistanceLightYears, starPosition, stars } from "../src/stars.ts";

const RADIANS = Math.PI / 180;
type Point = { rightAscension: number; declination: number };

/** The haversine: a second way to the angle, in degrees. */
function haversine(a: Point, b: Point): number {
  const dec1 = a.declination * RADIANS;
  const dec2 = b.declination * RADIANS;
  const h = Math.sin((dec2 - dec1) / 2) ** 2 + Math.cos(dec1) * Math.cos(dec2) * Math.sin(((b.rightAscension - a.rightAscension) * RADIANS) / 2) ** 2;
  return (2 * Math.asin(Math.min(1, Math.sqrt(h)))) / RADIANS;
}

/** The law of cosines on two distances and the angle between: a second way to the distance in space. */
function lawOfCosines(a: Point, aLy: number, b: Point, bLy: number): number {
  const angle = haversine(a, b) * RADIANS;
  return Math.sqrt(Math.max(0, aLy * aLy + bLy * bLy - 2 * aLy * bLy * Math.cos(angle)));
}

const sirius = starByName("Sirius")!;

test("by angle it matches a brute-force haversine over every star, for ten targets", () => {
  const targets = ["Sirius", "Mizar", "Polaris", "Betelgeuse", "Alcyone", "Antares", "Vega", "Acrux", "σ Oct", "Altair"].map((name) => starByName(name)!);
  for (const target of targets) {
    const reference = stars()
      .filter((star) => star.hr !== target.hr)
      .map((star) => ({ star, angle: haversine(target, star) }))
      .sort((a, b) => a.angle - b.angle)
      .slice(0, 25);
    const found = nearest(target, { count: 25 });
    assert.equal(found.length, 25);
    found.forEach((answer, index) => {
      assert.ok(Math.abs(answer.angle - reference[index]!.angle) < 1e-9, `${target.hr} no. ${index}`);
    });
    assert.deepEqual(found.map((answer) => answer.angle).slice().sort((a, b) => a - b), found.map((answer) => answer.angle));
    assert.ok(found.every((answer) => answer.thing !== target));
  }
});

test("by space it matches a brute-force law of cosines over the stars with a parallax", () => {
  const withDistance = stars().filter((star) => starDistanceLightYears(star) !== undefined);
  for (const name of ["Sirius", "Vega", "Arcturus", "Fomalhaut"]) {
    const target = starByName(name)!;
    const reference = withDistance
      .filter((star) => star.hr !== target.hr)
      .map((star) => ({ star, distance: lawOfCosines(target, starDistanceLightYears(target)!, star, starDistanceLightYears(star)!) }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 20);
    const found = nearest(target, { by: "space", count: 20 });
    found.forEach((answer, index) => {
      assert.ok(Math.abs(answer.distance - reference[index]!.distance) < 1e-6, `${name} no. ${index}: ${answer.distance} against ${reference[index]!.distance}`);
      assert.ok(Math.abs(answer.parsecs * 3.261563777 - answer.distance) < 1e-9);
      assert.equal(answer.error, undefined);
    });
    assert.equal(found.skipped, stars().length - 1 - (withDistance.length - 1));
  }
});

test("Mizar and Alcor are about 0.2 degrees apart, and Mizar's own companion is nearer still", () => {
  const found = nearest("Mizar", { count: 3 });
  assert.equal(found[0]!.thing.designation, "ζ UMa");
  assert.ok(found[0]!.angle < 0.01);
  assert.equal(found[1]!.thing.name, "Alcor");
  assert.ok(Math.abs(found[1]!.angle - 0.197) < 0.005, String(found[1]!.angle));
  assert.equal(nearest("Alcor", { count: 2 })[1]!.thing.name, "Mizar");
});

test("the Pleiades cluster: Alcyone's nearest stars are its sisters, all within a degree, and so is M45", () => {
  const sisters = new Set(["Merope", "Atlas", "Pleione", "Maia", "Asterope", "Electra", "Taygeta", "Celaeno", "Sterope II", "Alcyone"]);
  const found = nearest("Alcyone", { count: 6 });
  for (const answer of found) assert.ok(sisters.has(answer.thing.name ?? "") && answer.angle < 1, `${answer.thing.name} ${answer.angle}`);
  const fromCluster = nearest("M45", { count: 5 });
  assert.equal(fromCluster[0]!.thing.name, "Alcyone");
  assert.ok(fromCluster.every((answer) => answer.angle < 1));
  assert.ok(within("M45", 1.5).length >= 6);
});

test("Alpha Centauri A and B are the same place in space, and Sirius and Procyon are the nearest pair of bright stars to each other", () => {
  const a = nearest("α1 Cen", { by: "space", count: 1 })[0]!;
  assert.equal(a.thing.name, "Toliman");
  assert.ok(a.distance < 0.001);
  const first = nearest(sirius, { by: "space", count: 1 })[0]!;
  assert.equal(first.thing.name, "Procyon");
  assert.ok(first.distance > 4.5 && first.distance < 6, String(first.distance));
});

test("deep-sky objects: the Messier objects nearest M31 and M45, and a list of your own", () => {
  const near = nearest("M31", { kind: "deep-sky", count: 3 });
  assert.equal(near[0]!.thing.id, "M32");
  assert.ok(near.every((answer) => answer.thing.id !== "M31"));
  assert.ok(near[0]!.angle < 1);
  const mine = nearest("M31", { among: [deepSkyObject("M110")!, deepSkyObject("M33")!], count: 5 });
  assert.deepEqual(mine.map((answer) => answer.thing.id), ["M110", "M33"]);
  assert.equal(nearest("M31", { kind: "deep-sky", count: 1000 }).length, messier().length - 1);
  assert.throws(() => nearest("M31", { by: "space", kind: "deep-sky" }), RangeError);
});

test("a point works as a target, near the poles, across 0 and 360 degrees, and at the antipode", () => {
  const poleA = nearest({ rightAscension: 0, declination: 90 }, { count: 5 });
  const poleB = nearest({ rightAscension: 123, declination: 90 }, { count: 5 });
  assert.deepEqual(poleA.map((answer) => answer.thing), poleB.map((answer) => answer.thing));
  assert.equal(poleA[0]!.thing.name, "Polaris");
  assert.ok(Math.abs(poleA[0]!.angle - (90 - starByName("Polaris")!.declination)) < 1e-9);
  const southPole = nearest({ rightAscension: 40, declination: -90 }, { count: 1 })[0]!;
  assert.equal(southPole.thing.designation, "σ Oct");
  assert.ok(Math.abs(southPole.angle - (90 + southPole.thing.declination)) < 1e-9);

  const seam = nearest({ rightAscension: 359.9, declination: 0 }, { count: 20, within: 5 });
  for (const answer of seam) assert.ok(Math.abs(answer.angle - haversine({ rightAscension: 359.9, declination: 0 }, answer.thing)) < 1e-9);
  const brute = stars().filter((star) => haversine({ rightAscension: 359.9, declination: 0 }, star) <= 5).length;
  assert.equal(within({ rightAscension: 359.9, declination: 0 }, 5).length, brute);
  assert.ok(brute > 0 && within({ rightAscension: 359.9, declination: 0 }, 5).some((answer) => answer.thing.rightAscension < 5) && within({ rightAscension: 359.9, declination: 0 }, 5).some((answer) => answer.thing.rightAscension > 355));
  assert.ok(Math.abs(nearest({ rightAscension: 0, declination: 0 }, { among: [{ ...sirius, rightAscension: 180, declination: 0 }], count: 1 })[0]!.angle - 180) < 1e-9);
  assert.equal(nearest({ rightAscension: 10, declination: 10 }, { among: [{ ...sirius, rightAscension: 10, declination: 10 }] })[0]!.angle, 0);
  assert.ok(Math.abs(nearest({ rightAscension: 0, declination: 0 }, { among: [{ ...sirius, rightAscension: 360, declination: 0 }] })[0]!.angle) < 1e-9);
});

test("within, count, the limits and minMagnitude narrow the list, nearest first", () => {
  const all = within("Sirius", 10);
  assert.ok(all.length > 20 && all.every((answer) => answer.angle <= 10));
  assert.deepEqual(within("Sirius", 10, { count: 3 }).map((a) => a.thing), all.slice(0, 3).map((a) => a.thing));
  assert.equal(nearest("Sirius", { count: 0 }).length, 0);
  assert.equal(nearest("Sirius").length, 10);
  const bright = nearest("Sirius", { count: 50, minMagnitude: 3 });
  assert.ok(bright.every((answer) => answer.thing.magnitude! <= 3));
  assert.equal(bright.length, 50);
  assert.equal(within("Sirius", 0).length, 0);
  const lightYears = within("Sirius", 12, { by: "space" });
  assert.deepEqual(lightYears.map((a) => a.thing.name), ["Procyon", "Ran", "Rigil Kentaurus", "Toliman", "Keid"]);
  assert.ok(lightYears.every((answer) => answer.distance <= 12));
  assert.equal(nearest({ rightAscension: 101.28, declination: -16.72, lightYears: starDistanceLightYears(sirius)! }, { by: "space", count: 1 })[0]!.thing.name, "Sirius");
});

test("a point in space { x, y, z } in parsecs is a target too", () => {
  const parsecs = starDistanceLightYears(sirius)! / 3.261563777;
  const ra = sirius.rightAscension * RADIANS;
  const dec = sirius.declination * RADIANS;
  const at = { x: parsecs * Math.cos(dec) * Math.cos(ra), y: parsecs * Math.cos(dec) * Math.sin(ra), z: parsecs * Math.sin(dec) };
  const found = nearest(at, { by: "space", count: 3 });
  assert.equal(found[0]!.thing, sirius);
  assert.ok(found[0]!.distance < 1e-6);
  assert.deepEqual(found.slice(1).map((a) => a.thing), nearest(sirius, { by: "space", count: 2 }).map((a) => a.thing));
  const sun = nearest({ x: 0, y: 0, z: 0 }, { by: "space", count: 1 })[0]!;
  assert.ok(Math.abs(sun.distance - Math.min(...stars().filter((s) => s.parallaxMas > 0).map((s) => starDistanceLightYears(s)!))) < 1e-9);
  assert.equal(nearest({ x: 0, y: 0, z: 5 }, { count: 1 })[0]!.thing.name, "Polaris");
  assert.throws(() => nearest({ x: 0, y: 0, z: 0 }), /direction/);
  assert.throws(() => nearest({ x: 1, y: 2 } as never), TypeError);
  assert.throws(() => nearest({ x: 1, y: 2, z: Number.NaN }), RangeError);
});

test("a date carries the stars by their proper motion, and an angle is the same either side of a precession", () => {
  const arcturus = starByName("Arcturus")!;
  const point = { rightAscension: arcturus.rightAscension, declination: arcturus.declination };
  const now = nearest(point, { count: 1 })[0]!;
  assert.equal(now.thing, arcturus);
  assert.ok(now.angle < 1e-9);
  const later = nearest(point, { count: 1, date: Date.UTC(2100, 0, 1) })[0]!;
  const moved = haversine(point, starPosition(arcturus, Date.UTC(2100, 0, 1)));
  assert.ok(Math.abs(later.angle - moved) < 1e-9);
  assert.ok(moved > 0.06 && moved < 0.07, String(moved));
  assert.deepEqual(nearest("Mizar", { count: 5, date: new Date(Date.UTC(2000, 0, 1, 12)) }).map((a) => a.thing), nearest("Mizar", { count: 5 }).map((a) => a.thing));
});

test("a target is found by name, by object or as a point, and a bad one is named", () => {
  assert.deepEqual(nearest("sirius", { count: 3 }).map((a) => a.thing), nearest(sirius, { count: 3 }).map((a) => a.thing));
  assert.deepEqual(nearest("シリウス", { count: 3 }).map((a) => a.thing), nearest(sirius, { count: 3 }).map((a) => a.thing));
  assert.deepEqual(nearest("M45", { count: 3 }).map((a) => a.thing), nearest(deepSkyObject("M45")!, { count: 3 }).map((a) => a.thing));
  assert.throws(() => nearest("Nowhere"), /not a star or a Messier object/);
  assert.throws(() => nearest({ rightAscension: 0, declination: 91 }), /declination/);
  assert.throws(() => nearest({ rightAscension: Number.NaN, declination: 0 }), /rightAscension/);
  assert.throws(() => nearest({ declination: 0 } as never), TypeError);
  assert.throws(() => nearest(null as never), TypeError);
  assert.throws(() => nearest("Sirius", { count: -1 }), /count/);
  assert.throws(() => nearest("Sirius", { count: 1.5 }), /count/);
  assert.throws(() => nearest("Sirius", { count: "3" as never }), TypeError);
  assert.throws(() => nearest("Sirius", { by: "time" as never }), /by/);
  assert.throws(() => nearest("Sirius", { kind: "planet" as never }), /kind/);
  assert.throws(() => nearest("Sirius", { within: -1 }), /within/);
  assert.throws(() => nearest("Sirius", { date: new Date(Number.NaN) }), /date/);
  assert.throws(() => nearest({ rightAscension: 0, declination: 0 }, { by: "space" }), /no distance/);
  assert.throws(() => nearest("Maia", { by: "space" }), /no distance/);
});

test("Orion's neighbours are Eridanus, Gemini, Lepus, Monoceros and Taurus", () => {
  assert.deepEqual(neighbouringConstellations("Ori").map((c) => c.abbreviation), ["Eri", "Gem", "Lep", "Mon", "Tau"]);
  assert.deepEqual(neighbouringConstellations("Orion").map((c) => c.name), ["Eridanus", "Gemini", "Lepus", "Monoceros", "Taurus"]);
  assert.deepEqual(neighbouringConstellations("オリオン座").map((c) => c.abbreviation), ["Eri", "Gem", "Lep", "Mon", "Tau"]);
});

test("the neighbour table: symmetric, never empty, Crux has two, a pole constellation goes round, Serpens has both pieces", () => {
  const abbreviations = constellations().map((c) => c.abbreviation);
  for (const a of abbreviations) {
    const list = neighbouringConstellations(a).map((c) => c.abbreviation);
    assert.ok(list.length >= 1 && !list.includes(a), a);
    for (const b of list) assert.ok(neighbouringConstellations(b).some((c) => c.abbreviation === a), `${a} and ${b}`);
  }
  assert.deepEqual(neighbouringConstellations("Cru").map((c) => c.abbreviation), ["Cen", "Mus"]);
  assert.deepEqual(neighbouringConstellations("UMi").map((c) => c.abbreviation), ["Cam", "Cep", "Dra"]);
  assert.deepEqual(neighbouringConstellations("Ser").map((c) => c.abbreviation), ["Aql", "Boo", "CrB", "Her", "Lib", "Oph", "Sgr", "Sct", "Vir"]);
  assert.throws(() => neighbouringConstellations("Atlantis"), RangeError);
  assert.throws(() => neighbouringConstellations(3 as never), TypeError);
});

test("every pair of constellations that meet on a one-degree grid of the whole sky is a pair of neighbours, and the table has no others far from the grid's reach", () => {
  const seen = new Set<string>();
  const rows = 180;
  const columns = 360;
  const grid: string[][] = [];
  for (let row = 0; row <= rows; row++) {
    const declination = Math.max(-89.999, Math.min(89.999, 90 - row));
    grid.push(Array.from({ length: columns }, (_, column) => constellationAt({ rightAscension: column + 0.5, declination }).abbreviation));
  }
  for (let row = 0; row <= rows; row++) {
    for (let column = 0; column < columns; column++) {
      const here = grid[row]![column]!;
      for (const there of [grid[row]![(column + 1) % columns]!, grid[row + 1]?.[column]]) if (there !== undefined && there !== here) seen.add([here, there].sort().join(" "));
    }
  }
  const missing = [...seen].filter((pair) => {
    const [a, b] = pair.split(" ") as [string, string];
    return !neighbouringConstellations(a).some((c) => c.abbreviation === b);
  });
  assert.deepEqual(missing, []);
  const pairs = abbreviations().flatMap((a) => neighbouringConstellations(a).map((c) => [a, c.abbreviation].sort().join(" ")));
  const table = new Set(pairs);
  // The grid cannot see a very thin border, but it sees almost all of them.
  assert.ok(seen.size > table.size * 0.9, `${seen.size} of ${table.size}`);
});

function abbreviations(): string[] {
  return constellations().map((c) => c.abbreviation);
}

test("one query over all 5,080 stars takes a few milliseconds", () => {
  const time = (run: () => void): number => {
    for (let i = 0; i < 5; i++) run();
    const started = performance.now();
    for (let i = 0; i < 50; i++) run();
    return (performance.now() - started) / 50;
  };
  const sky = time(() => nearest(sirius, { count: 10 }));
  const space = time(() => nearest(sirius, { count: 10, by: "space" }));
  const dated = time(() => nearest(sirius, { count: 10, date: Date.UTC(2100, 0, 1) }));
  console.log(`nearest over ${stars().length} stars: by sky ${sky.toFixed(2)} ms, by space ${space.toFixed(2)} ms, by sky at a date ${dated.toFixed(2)} ms`);
  assert.ok(sky < 25 && space < 25 && dated < 50, `${sky} ${space} ${dated}`);
});
