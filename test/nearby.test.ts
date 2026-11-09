// The nearby-star table: the three famous stars at their distances with their errors, no star in both the bright and the nearby set, a sample of 2MASS positions against the Yale catalogue's own rows
// (carried to J2000 here by a second method), the counts, the grades of distance, the flags, and `nearest` by space with the nearby stars included.
import assert from "node:assert/strict";
import { test } from "node:test";
import { nearbyStarByName, nearbyStars, type NearbyStar } from "../src/nearby.ts";
import { nearest } from "../src/nearest.ts";
import { starByName, stars } from "../src/stars.ts";

const RADIANS = Math.PI / 180;
const all = nearbyStars();
// The counts the build printed (scripts/make-nearby-data.py): a change in the data changes these on purpose.
const GRADES = { under: 329, fair: 1188, rough: 3552, none: 496 };
const FLAGS = { coarse: 1213, excluded: 496, ambiguous: 1029 };

function haversine(a: { rightAscension: number; declination: number }, b: { rightAscension: number; declination: number }): number {
  const h = Math.sin(((b.declination - a.declination) * RADIANS) / 2) ** 2 + Math.cos(a.declination * RADIANS) * Math.cos(b.declination * RADIANS) * Math.sin(((b.rightAscension - a.rightAscension) * RADIANS) / 2) ** 2;
  return (2 * Math.asin(Math.min(1, Math.sqrt(h)))) / RADIANS;
}

test("a nearby star has its luminosity class: Proxima Centauri and Barnard's Star are dwarfs", () => {
  const proxima = nearbyStarByName("Proxima Centauri")!;
  assert.deepEqual([proxima.spectralType, proxima.luminosityClass], ["M5.5eV", "V"]);
  assert.equal(nearbyStarByName("Barnard's Star")!.luminosityClass, "V");
  assert.ok(all.every((s) => s.spectralType !== "" || s.luminosityClass === undefined));
  assert.ok(all.filter((s) => s.luminosityClass === "V").length > 1000);
});

test("Proxima Centauri, Barnard's Star and Wolf 359 are there, at 4.2, 6.0 and 7.9 light-years within their errors", () => {
  // The figures are those of the ticket, to a tenth; the Yale parallaxes give 4.24, 5.98 and 7.78. Allow 3 sigma and the tenth's own rounding.
  for (const [name, ly, gctp, gliese] of [["Proxima Centauri", 4.2, "3278", "GJ 551"], ["Barnard's Star", 6.0, "4098", "GJ 699"], ["Wolf 359", 7.9, "2553", "GJ 406"]] as const) {
    const star = nearbyStarByName(name)!;
    assert.ok(star, name);
    assert.equal(star.gctp, gctp);
    assert.equal(star.gliese, gliese);
    assert.ok(star.lightYearsError! > 0 && star.lightYearsError! < 0.1, `${name} error ${star.lightYearsError}`);
    assert.ok(Math.abs(star.lightYears! - ly) <= 3 * star.lightYearsError! + 0.05, `${name} ${star.lightYears} ± ${star.lightYearsError}`);
    assert.ok(Math.abs(star.parsecs! * 3.261563777 - star.lightYears!) < 1e-9);
    assert.ok(star.relativeError! < 0.05);
    assert.equal(star.properMotionSource, "GCTP");
    assert.equal(star.magnitudeSource, "GCTP");
  }
  assert.equal(nearbyStarByName("Proxima Centauri")!.twoMass, "2MASS J14294291-6240465");
  assert.equal(nearbyStarByName("proxima cen")!.name, "Proxima Centauri");
  assert.equal(nearbyStarByName("Gliese 699")!.name, "Barnard's Star");
  assert.equal(nearbyStarByName("GJ 406")!.name, "Wolf 359");
  assert.equal(nearbyStarByName("HD 95735")!.name, "Lalande 21185");
  assert.equal(nearbyStarByName("2MASS J14294291-6240465")!.gctp, "3278");
  assert.equal(nearbyStarByName("no such star"), undefined);
});

test("the table's counts: 5,565 stars, none twice, and the bright stars are not among them", () => {
  assert.equal(all.length, 5565);
  assert.equal(new Set(all.map((s) => s.id)).size, all.length);
  assert.equal(new Set(all.map((s) => s.gctp)).size, all.length);
  assert.equal(stars().length + all.length, 5080 + 5565);
  // HD numbers of well-known bright stars the Yale parallax catalogue also holds: Sirius, Alpha Centauri A, Procyon, 61 Cygni A, Epsilon Eridani, Tau Ceti, 70 Ophiuchi, Altair, Fomalhaut, Vega.
  const bright = new Set([48915, 128620, 61421, 201091, 22049, 10700, 165341, 187642, 216956, 172167]);
  assert.ok(all.every((s) => s.hd === undefined || !bright.has(s.hd)));
  // A second way: no nearby star sits on a bright star of nearly the same magnitude. The build matched by HD number and then by position; this looks at positions only.
  const near: Array<[NearbyStar, string]> = [];
  for (const star of all) {
    if (star.magnitude === undefined || star.flags.ambiguousMatch) continue;
    for (const b of stars({ magnitude: 6.5 })) {
      if (Math.abs(b.declination - star.declination) < 0.003 && haversine(star, b) < 10 / 3600 && Math.abs(b.magnitude - star.magnitude) < 0.7) near.push([star, b.designation ?? String(b.hr)]);
    }
  }
  assert.deepEqual(near.map(([s, b]) => `${s.gctp} ${b}`), []);
});

test("the grades of distance: under 5%, 5 to 20% and over 20%, and the stars with none", () => {
  const under = all.filter((s) => s.relativeError !== undefined && s.relativeError < 0.05);
  const fair = all.filter((s) => s.relativeError !== undefined && s.relativeError >= 0.05 && s.relativeError <= 0.2);
  const rough = all.filter((s) => s.relativeError !== undefined && s.relativeError > 0.2);
  const none = all.filter((s) => s.relativeError === undefined);
  assert.deepEqual([under.length, fair.length, rough.length, none.length], [GRADES.under, GRADES.fair, GRADES.rough, GRADES.none]);
  assert.equal(nearbyStars({ maxRelativeError: 0.05 }).length, under.length);
  assert.equal(nearbyStars({ maxRelativeError: 0.2 }).length, under.length + fair.length);
  assert.equal(nearbyStars({ withDistance: true }).length, all.length - none.length);
  assert.ok(all.every((s) => (s.lightYears === undefined) === s.flags.excludedFromSpace));
  assert.equal(all.filter((s) => s.flags.excludedFromSpace).length, FLAGS.excluded);
  assert.equal(all.filter((s) => s.flags.coarsePosition).length, FLAGS.coarse);
  assert.equal(all.filter((s) => s.flags.ambiguousMatch).length, FLAGS.ambiguous);
  assert.equal(all.filter((s) => s.positionSource === "2MASS").length, all.length - FLAGS.coarse);
  assert.ok(nearbyStars({ magnitude: 10 }).every((s) => s.magnitude! <= 10));
  assert.throws(() => nearbyStars({ magnitude: "x" as never }), TypeError);
  assert.throws(() => nearbyStars({ withDistance: 1 as never }), TypeError);
});

test("every star keeps its units: distances sorted, errors positive, coordinates in range", () => {
  const withDistance = all.filter((s) => s.lightYears !== undefined);
  assert.deepEqual(withDistance.map((s) => s.lightYears), withDistance.map((s) => s.lightYears).sort((a, b) => a! - b!));
  for (const s of all) {
    assert.ok(s.rightAscension >= 0 && s.rightAscension < 360 && s.declination >= -90 && s.declination <= 90, s.gctp);
    assert.ok(s.positionErrorArcsec > 0, s.gctp);
    assert.equal(s.twoMass === undefined, s.positionSource === "GCTP");
    assert.equal(s.twoMass === undefined, s.gctpOffsetArcsec === undefined);
    if (s.lightYears !== undefined) assert.ok(Math.abs(s.lightYears * s.parallaxMas - 3261.563777) < 1e-6);
  }
});

// Rows of the Yale catalogue as printed (B1900.0, FK4): number, right ascension h m s, declination sign d m s, total proper motion in arc-seconds a year and its position angle.
const GCTP: Array<[string, number[], number[], number, number]> = [
  ["3278", [14, 22, 48.0], [-1, 62, 15, 0], 3.809, 282],
  ["4098", [17, 52, 54.0], [1, 4, 25, 0], 10.31, 356],
  ["2553", [10, 51, 36.0], [1, 7, 37, 0], 4.696, 235],
  ["2576", [10, 57, 52.3], [1, 36, 38, 25.0], 4.807, 187],
  ["4338", [18, 43, 36.0], [-1, 23, 57, 0], 0.72, 107],
  ["5736", [23, 37, 0.0], [1, 43, 39, 0], 1.617, 177],
  ["2730", [11, 42, 36.0], [1, 1, 23, 0], 1.348, 152],
  ["1181", [5, 7, 41.7], [-1, 44, 58, 51.0], 8.706, 131],
  ["5438", [22, 24, 24.0], [1, 57, 12, 0], 0.852, 243],
  ["49", [0, 12, 42.0], [1, 43, 27, 0], 2.899, 82],
  ["5584", [22, 59, 24.5], [-1, 36, 25, 44.0], 6.896, 79],
  ["1755", [7, 22, 0.0], [1, 5, 32, 0], 3.761, 171],
  ["5475", [22, 33, 0.0], [-1, 15, 52, 0], 3.254, 47],
  ["160", [0, 43, 54.0], [1, 4, 55, 0], 2.98, 156],
  ["4330", [18, 41, 40.9], [1, 59, 28, 25.0], 2.27, 324],
  ["5117", [21, 11, 24.0], [-1, 39, 15, 12.0], 3.453, 251],
  ["2390", [10, 5, 14.9], [1, 49, 57, 37.0], 1.454, 249],
  ["1509", [6, 24, 18.0], [-1, 2, 44, 0], 0.996, 135],
];

/** Precession from B1900.0 to J2000.0 by the IAU 1976 angles (J. Meeus, Astronomical Algorithms, chapter 21): a second way, without the FK4 terms, good to a fraction of an arc-second. */
function precess(ra: number, dec: number): { rightAscension: number; declination: number } {
  const T = (2415020.3135 - 2451545.0) / 36525;
  const t = (2451545.0 - 2415020.3135) / 36525;
  const zeta = (((2306.2181 + 1.39656 * T - 0.000139 * T * T) * t + (0.30188 - 0.000344 * T) * t * t + 0.017998 * t ** 3) / 3600) * RADIANS;
  const z = (((2306.2181 + 1.39656 * T - 0.000139 * T * T) * t + (1.09468 + 0.000066 * T) * t * t + 0.018203 * t ** 3) / 3600) * RADIANS;
  const theta = (((2004.3109 - 0.8533 * T - 0.000217 * T * T) * t - (0.42665 + 0.000217 * T) * t * t - 0.041833 * t ** 3) / 3600) * RADIANS;
  const a = ra * RADIANS;
  const d = dec * RADIANS;
  const A = Math.cos(d) * Math.sin(a + zeta);
  const B = Math.cos(theta) * Math.cos(d) * Math.cos(a + zeta) - Math.sin(theta) * Math.sin(d);
  const C = Math.sin(theta) * Math.cos(d) * Math.cos(a + zeta) + Math.cos(theta) * Math.sin(d);
  return { rightAscension: (((Math.atan2(A, B) + z) / RADIANS) % 360 + 360) % 360, declination: Math.asin(C) / RADIANS };
}

test("a 2MASS position lies on the track of the Yale catalogue's own row: its position carried along its proper motion for up to 140 years", () => {
  let checked = 0;
  for (const [gctp, [h, m, s], [sign, d, dm, ds], pm, pa] of GCTP) {
    const star = nearbyStarByName(`GCTP ${gctp}`)!;
    assert.ok(star, gctp);
    if (star.positionSource !== "2MASS") continue;
    const ra = (h! + m! / 60 + s! / 3600) * 15;
    const dec = sign! * (d! + dm! / 60 + ds! / 3600);
    let nearestApproach = Infinity;
    for (let years = -5; years <= 145; years += 1) {
      // the motion in the B1900 frame on its tangent plane, then precessed
      const east = (pm * Math.sin(pa * RADIANS) * years) / 3600;
      const north = (pm * Math.cos(pa * RADIANS) * years) / 3600;
      const moved = precess(ra + east / Math.cos(dec * RADIANS), dec + north);
      nearestApproach = Math.min(nearestApproach, haversine(star, moved) * 3600);
    }
    // The catalogue's digits (a whole second of time is 15 arc-seconds, an arc-minute for a ":" position) and the whole degree of the position angle: allow 60 arc-seconds.
    assert.ok(nearestApproach < 60, `${gctp} ${star.name ?? ""} ${nearestApproach.toFixed(1)} arc-seconds off the track`);
    assert.ok(Math.abs(nearestApproach - star.gctpOffsetArcsec!) < 40, `${gctp}: the table says ${star.gctpOffsetArcsec}, this says ${nearestApproach.toFixed(1)}`);
    checked++;
  }
  assert.ok(checked >= 10, `only ${checked} of the sample have a 2MASS position`);
  // The whole table: where the 2MASS position is, it is near the catalogue's track, and most within a few arc-seconds.
  const offsets = all.filter((s) => s.gctpOffsetArcsec !== undefined).map((s) => s.gctpOffsetArcsec!).sort((a, b) => a - b);
  assert.ok(offsets.length === all.length - FLAGS.coarse);
  assert.ok(offsets[Math.floor(offsets.length / 2)]! < 5, `median ${offsets[Math.floor(offsets.length / 2)]}`);
  assert.ok(offsets[offsets.length - 1]! <= 400);
});

test("the Yale position stays for a star with no unique 2MASS source, flagged coarse with a larger error", () => {
  const coarse = all.filter((s) => s.flags.coarsePosition);
  assert.ok(coarse.length > 0);
  const median = (list: NearbyStar[]): number => list.map((s) => s.positionErrorArcsec).sort((a, b) => a - b)[Math.floor(list.length / 2)]!;
  assert.ok(median(coarse) > median(all.filter((s) => !s.flags.coarsePosition)));
  assert.ok(all.filter((s) => !s.flags.coarsePosition).every((s) => s.positionErrorArcsec < 60));
});

test("nearest by space from the Sun, with the nearby stars in the list, finds Proxima first, then Alpha Centauri", () => {
  const among = [...stars(), ...nearbyStars()];
  const found = nearest({ x: 0, y: 0, z: 0 }, { by: "space", among, count: 6 });
  assert.equal((found[0]!.thing as NearbyStar).name, "Proxima Centauri");
  assert.ok(found[0]!.error! > 0 && found[0]!.error! < 0.1);
  assert.deepEqual([found[1]!.thing, found[2]!.thing].map((thing) => (thing as { name?: string }).name).sort(), ["Rigil Kentaurus", "Toliman"]);
  assert.equal((found[3]!.thing as NearbyStar).name, "Barnard's Star");
  assert.ok(found[1]!.error! > 0 && found[1]!.error! < 0.1);
  assert.ok(found.skipped >= FLAGS.excluded);
  assert.equal((nearest({ x: 0, y: 0, z: 0 }, { by: "space", among, count: 9 }).find((f) => (f.thing as NearbyStar).name === "Wolf 359")!.thing as NearbyStar).gctp, "2553");
  // Without them it is as it was: the bright stars only.
  assert.ok(["Rigil Kentaurus", "Toliman"].includes((nearest({ x: 0, y: 0, z: 0 }, { by: "space", count: 1 })[0]!.thing as { name?: string }).name!));
});

test("with a nearby star as the target and the nearby stars to look through, the error is worked out, with a bright star too", () => {
  const barnard = nearbyStarByName("Barnard's Star")!;
  const near = nearest(barnard, { by: "space", among: nearbyStars(), count: 3 });
  assert.ok(near.every((n) => n.error! > 0 && n.error! < 2));
  assert.ok(near.every((n) => (n.thing as NearbyStar).gctp !== "4098"));
  const fromBright = nearest(starByName("Sirius")!, { by: "space", among: nearbyStars(), count: 1 });
  assert.ok(fromBright[0]!.error! > 0 && fromBright[0]!.error! < 2);
  const noError = stars().find((star) => star.parallaxMas > 0 && star.parallaxErrorMas === undefined)!;
  assert.equal(nearest(noError, { by: "space", among: nearbyStars(), count: 1 })[0]!.error, undefined);
  // by angle, with a date: the stars are carried by their Yale proper motion
  const moved = nearest({ rightAscension: barnard.rightAscension, declination: barnard.declination }, { among: [barnard], date: Date.UTC(2100, 0, 1), count: 1 })[0]!;
  assert.ok(moved.angle > 0.25 && moved.angle < 0.32, String(moved.angle));
});
