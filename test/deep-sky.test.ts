// The deep-sky objects: the 110 Messier objects at `/deep-sky` and the Messier, NGC and IC objects at `/deep-sky/ngc-ic`. Positions are Wikidata's (CC0), read on 2026-11-08 and checked against NASA/IPAC NED; the
// NED numbers below were read from NED's object-lookup service on that day and are fixed here, so the test never calls the network. Messier magnitudes and sizes are NASA HEASARC's Messier table.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { gzipSync } from "node:zlib";
import { constellationAt } from "../src/boundaries.ts";
import { constellation, starsIn } from "../src/constellations.ts";
import { deepSky, deepSkyObject, messier } from "../src/deep-sky.ts";
import { deepSky as deepSkyAll, deepSkyObject as deepSkyObjectAll } from "../src/deep-sky-ngc-ic.ts";

function hms(h: number, m: number, s: number): number {
  return (h + m / 60 + s / 3600) * 15;
}
function dms(sign: 1 | -1, d: number, m: number, s: number): number {
  return sign * (d + m / 60 + s / 3600);
}
const ARC_MINUTE = 1 / 60;

function separationArcmin(a: { rightAscension: number; declination: number }, ra: number, dec: number): number {
  const [ra1, dec1, ra2, dec2] = [a.rightAscension, a.declination, ra, dec].map((x) => (x * Math.PI) / 180) as [number, number, number, number];
  const h = Math.sin((dec2 - dec1) / 2) ** 2 + Math.cos(dec1) * Math.cos(dec2) * Math.sin((ra2 - ra1) / 2) ** 2;
  return ((2 * Math.asin(Math.min(1, Math.sqrt(h))) * 180) / Math.PI) * 60;
}

const all = messier();

test("there are exactly 110 Messier objects, M1 to M110 in order, each frozen and with one id", () => {
  assert.equal(all.length, 110);
  assert.deepEqual(
    all.map((o) => o.messier),
    Array.from({ length: 110 }, (_, i) => `M${i + 1}`),
  );
  assert.deepEqual(
    all.map((o) => o.id),
    all.map((o) => o.messier),
  );
  assert.equal(new Set(all.map((o) => o.id)).size, 110);
  assert.ok(all.every((o) => Object.isFrozen(o)));
  all.pop();
  assert.equal(messier().length, 110, "a fresh array each call");
});

test("every Messier object has a position, a type, a constellation and a magnitude, and they are in range", () => {
  for (const o of messier()) {
    assert.ok(o.rightAscension >= 0 && o.rightAscension < 360, o.id);
    assert.ok(o.declination >= -90 && o.declination <= 90, o.id);
    assert.ok(["galaxy", "globular cluster", "open cluster", "nebula", "planetary nebula", "supernova remnant", "other"].includes(o.type), o.id);
    assert.ok(o.magnitude !== undefined && o.magnitude > 0 && o.magnitude < 12, `${o.id} magnitude ${o.magnitude}`);
    assert.ok(o.sizeArcmin === undefined || (o.sizeArcmin > 0 && o.sizeArcmin < 200), o.id);
    assert.ok(o.constellation !== undefined && constellation(o.constellation) !== undefined, `${o.id} constellation ${o.constellation}`);
  }
  assert.equal(messier().filter((o) => o.sizeArcmin === undefined).length, 3, "M40, M73 and M102 have no size");
});

test("known answers: where M31, M42 and M1 are, and what they are", () => {
  const m31 = deepSkyObject("M31")!;
  assert.ok(Math.abs(m31.rightAscension - hms(0, 42, 44)) < ARC_MINUTE && Math.abs(m31.declination - dms(1, 41, 16, 0)) < ARC_MINUTE);
  assert.deepEqual({ type: m31.type, name: m31.name, ngc: m31.ngc, constellation: m31.constellation }, { type: "galaxy", name: "Andromeda Galaxy", ngc: "NGC 224", constellation: "And" });
  assert.equal(m31.magnitude, 3.4);
  assert.equal(m31.sizeArcmin, 178);
  const m42 = deepSkyObject("M42")!;
  assert.ok(Math.abs(m42.rightAscension - hms(5, 35, 17)) < ARC_MINUTE && Math.abs(m42.declination - dms(-1, 5, 23, 0)) < ARC_MINUTE);
  assert.deepEqual({ type: m42.type, name: m42.name, ngc: m42.ngc, constellation: m42.constellation }, { type: "nebula", name: "Orion Nebula", ngc: "NGC 1976", constellation: "Ori" });
  const m1 = deepSkyObject("M1")!;
  assert.equal(m1.type, "supernova remnant");
  assert.equal(m1.name, "Crab Nebula");
  assert.equal(m1.constellation, "Tau");
  assert.ok(Math.abs(m1.rightAscension - hms(5, 34, 32)) < ARC_MINUTE && Math.abs(m1.declination - dms(1, 22, 0, 52)) < ARC_MINUTE);
  const m13 = deepSkyObject("M13")!;
  assert.equal(m13.type, "globular cluster");
  assert.equal(m13.constellation, "Her");
  assert.equal(deepSkyObject("M57")!.type, "planetary nebula");
  assert.equal(deepSkyObject("M45")!.type, "open cluster");
  assert.equal(deepSkyObject("M45")!.magnitude, 1.2);
});

test("the Messier objects come out as Messier's list does: 40 galaxies, 29 globular clusters, 4 planetary nebulae and one supernova remnant", () => {
  const counts: Record<string, number> = {};
  for (const o of messier()) counts[o.type] = (counts[o.type] ?? 0) + 1;
  assert.deepEqual(counts, { galaxy: 40, "globular cluster": 29, "open cluster": 26, nebula: 7, "planetary nebula": 4, "supernova remnant": 1, other: 3 });
  assert.deepEqual(deepSky({ type: "planetary nebula" }).map((o) => o.id), ["M27", "M57", "M76", "M97"]);
  assert.deepEqual(deepSky({ type: "nebula" }).map((o) => o.id), ["M8", "M16", "M17", "M20", "M42", "M43", "M78"]);
});

test("M40 and M73 are not deep-sky objects in the usual sense, and M102 is NGC 5866", () => {
  // M40 is a double star (Winnecke 4) and M73 four stars; Messier listed them, so they are there as "other", and neither is in the NGC.
  assert.deepEqual(deepSky({ type: "other" }).map((o) => o.id), ["M24", "M40", "M73"]);
  assert.equal(deepSkyObject("M40")!.ngc, undefined);
  assert.equal(deepSkyObject("M40")!.sizeArcmin, undefined);
  assert.equal(deepSkyObject("M73")!.ngc, "NGC 6994");
  // M24 is a star cloud in Sagittarius with an IC number. M102 is the galaxy NGC 5866 here, in Draco; the Messier text matches M101, and NED's "M102" is M101.
  assert.equal(deepSkyObject("M24")!.ic, "IC 4715");
  const m102 = deepSkyObject("M102")!;
  assert.equal(m102.ngc, "NGC 5866");
  assert.equal(m102.type, "galaxy");
  assert.equal(m102.constellation, "Dra");
  assert.ok(Math.abs(m102.rightAscension - hms(15, 6, 29.5)) < ARC_MINUTE && Math.abs(m102.declination - dms(1, 55, 45, 48)) < ARC_MINUTE);
  assert.equal(deepSkyObject("NGC 5866"), m102);
  assert.notEqual(deepSkyObject("M101"), m102);
});

test("cross-identifications: the NGC and IC numbers of the Messier objects", () => {
  const known: Array<[string, string | undefined, string | undefined]> = [
    ["M31", "NGC 224", undefined],
    ["M32", "NGC 221", undefined],
    ["M33", "NGC 598", undefined],
    ["M42", "NGC 1976", undefined],
    ["M43", "NGC 1982", undefined],
    ["M44", "NGC 2632", undefined],
    ["M51", "NGC 5194", undefined],
    ["M81", "NGC 3031", undefined],
    ["M104", "NGC 4594", undefined],
    ["M110", "NGC 205", undefined],
    ["M16", "NGC 6611", "IC 4703"],
    ["M24", undefined, "IC 4715"],
    ["M25", undefined, "IC 4725"],
    ["M45", undefined, undefined],
  ];
  for (const [id, ngc, ic] of known) {
    const o = deepSkyObject(id)!;
    assert.equal(o.ngc, ngc, id);
    assert.equal(o.ic, ic, id);
    if (ngc !== undefined) assert.equal(deepSkyObject(ngc), o, ngc);
    if (ic !== undefined) assert.equal(deepSkyObject(ic), o, ic);
  }
  assert.equal(deepSky({ catalogue: "messier" }).length, 110);
  assert.equal(deepSky({ catalogue: "ngc" }).length, 106, "M24, M25, M40 and M45 have no NGC number");
  assert.equal(deepSky({ catalogue: "ic" }).length, 3);
  assert.equal(deepSkyObject("M76")!.otherIds.join(), "NGC 651", "M76 is NGC 650 and NGC 651, one object");
});

test("lookups ignore case, spacing and the long form of Messier, and find names and other names", () => {
  const m31 = deepSkyObject("M31");
  for (const text of ["m31", "M 31", "  m   31 ", "Messier 31", "MESSIER31", "NGC 224", "ngc224", "NGC 0224", "Andromeda Galaxy", "andromeda  galaxy", "Andromeda Nebula", "Andromeda"]) assert.equal(deepSkyObject(text), m31, text);
  assert.equal(deepSkyObject("Pleiades")?.id, "M45");
  assert.equal(deepSkyObject("Seven Sisters")?.id, "M45");
  assert.equal(deepSkyObject("Praesepe")?.id, "M44");
  assert.equal(deepSkyObject("Beehive Cluster")?.id, "M44");
  assert.equal(deepSkyObject("Ring Nebula")?.id, "M57");
  assert.equal(deepSkyObject("Whirlpool Galaxy")?.id, "M51");
  assert.equal(deepSkyObject("Sombrero Galaxy")?.id, "M104");
  assert.equal(deepSkyObject("Omega Nebula")?.id, "M17");
  assert.equal(deepSkyObject("M110")?.id, "M110");
  assert.equal(deepSkyObject("M1")?.id, "M1");
  for (const o of messier()) {
    assert.equal(deepSkyObject(o.id), o);
    if (o.name !== undefined) assert.equal(deepSkyObject(o.name), o, o.name);
  }
});

test("a text that names no Messier object gives undefined, and a non-string throws", () => {
  for (const text of ["", "  ", "M0", "M111", "M 1000", "NGC 7000", "IC 434", "Horsehead", "Andromeda Galaxyy", "Sirius", "31"]) assert.equal(deepSkyObject(text), undefined, text);
  assert.throws(() => deepSkyObject(undefined as unknown as string), { name: "TypeError", message: /text must be a string/ });
  assert.throws(() => deepSkyObject(31 as unknown as string), TypeError);
  assert.throws(() => deepSkyObject(null as unknown as string), TypeError);
});

test("deepSky narrows by catalogue, magnitude and type, in catalogue order", () => {
  assert.equal(deepSky().length, 110);
  assert.equal(deepSky({}).length, 110);
  assert.deepEqual(deepSky({ magnitude: 4 }).map((o) => o.id), ["M7", "M31", "M42", "M44", "M45"]);
  assert.deepEqual(deepSky({ magnitude: 3.4 }).map((o) => o.id), ["M7", "M31", "M44", "M45"], "an object of exactly that magnitude is in");
  assert.equal(deepSky({ magnitude: 0 }).length, 0);
  assert.equal(deepSky({ magnitude: 12 }).length, 110);
  assert.equal(deepSky({ type: "globular cluster" }).length, 29);
  assert.equal(deepSky({ type: "galaxy", magnitude: 8 }).length, deepSky({ type: "galaxy" }).filter((o) => o.magnitude! <= 8).length);
  assert.ok(deepSky({ type: "galaxy", magnitude: 8 }).length > 5);
  assert.deepEqual(deepSky({ type: "supernova remnant", catalogue: "ngc", magnitude: 9 }).map((o) => o.id), ["M1"]);
  const bright = deepSky({ magnitude: 6.5 });
  const sorted = [...bright].sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
  assert.deepEqual(bright, sorted);
  assert.notEqual(deepSky(), deepSky(), "a fresh array each call");
});

test("deepSky rejects options it does not know", () => {
  assert.throws(() => deepSky({ catalogue: "caldwell" as "ngc" }), { name: "RangeError", message: /catalogue must be/ });
  assert.throws(() => deepSky({ type: "star" as "galaxy" }), { name: "RangeError", message: /type must be one of/ });
  assert.throws(() => deepSky({ magnitude: "bright" as unknown as number }), { name: "TypeError", message: /magnitude must be a number/ });
  assert.throws(() => deepSky({ magnitude: Number.NaN }), TypeError);
});

test("each Messier object lies near the bright stars of its constellation, so the constellation is plausible", () => {
  // The constellation names are Wikidata's, and NASA HEASARC's Messier table agrees with every one (the generator checks). Here each object is within 35 degrees of a bright star of its constellation.
  for (const o of messier()) {
    const stars = starsIn(o.constellation!);
    assert.ok(stars.length > 0, o.id);
    const nearest = Math.min(...stars.map((s) => separationArcmin(o, s.rightAscension, s.declination))) / 60;
    assert.ok(nearest < 35, `${o.id} in ${o.constellation} is ${nearest.toFixed(1)} degrees from its nearest bright star`);
  }
  const expected: Record<string, string> = { M1: "Tau", M2: "Aqr", M3: "CVn", M4: "Sco", M5: "Ser", M8: "Sgr", M11: "Sct", M13: "Her", M15: "Peg", M27: "Vul", M31: "And", M33: "Tri", M35: "Gem", M42: "Ori", M44: "Cnc", M45: "Tau", M51: "CVn", M57: "Lyr", M64: "Com", M81: "UMa", M87: "Vir", M104: "Vir", M110: "And" };
  for (const [id, abbreviation] of Object.entries(expected)) assert.equal(deepSkyObject(id)!.constellation, abbreviation, id);
});

// The NED cross-check. NED's preferred position for each Messier object (looked up by its NGC or IC name, else its Messier name), in degrees J2000, read on 2026-11-08 with
// scripts/check-deep-sky-ned.py. Each is the number NED answered; the table is checked against them.
const NED_MESSIER: Array<[string, number, number]> = [
  ["M1", 83.6331, 22.0145], ["M2", 323.3626, -0.8233], ["M3", 205.5484, 28.3773], ["M4", 245.8967, -26.5257],
  ["M5", 229.6384, 2.0810], ["M6", 265.0864, -32.2542], ["M7", 268.4633, -34.7928], ["M8", 270.9219, -24.3802],
  ["M9", 259.7991, -18.5162], ["M10", 254.2877, -4.1003], ["M11", 282.7750, -6.2700], ["M12", 251.8113, -1.9477],
  ["M13", 250.4234, 36.4615], ["M14", 264.3999, -3.2460], ["M15", 322.4935, 12.1667], ["M16", 274.7007, -13.8072],
  ["M17", 275.1963, -16.1715], ["M18", 274.9937, -17.1020], ["M19", 255.6570, -26.2679], ["M20", 270.6755, -22.9719],
  ["M21", 271.0560, -22.4900], ["M22", 279.0997, -23.9047], ["M23", 269.2699, -18.9853], ["M24", 274.2338, -18.5146],
  ["M25", 277.9449, -19.1150], ["M26", 281.3277, -9.3836], ["M27", 299.9016, 22.7211], ["M28", 276.1370, -24.8698],
  ["M29", 305.9907, 38.5077], ["M30", 325.0920, -23.1788], ["M31", 10.6848, 41.2691], ["M32", 10.6744, 40.8654],
  ["M33", 23.4620, 30.6602], ["M34", 40.5308, 42.7462], ["M35", 92.2714, 24.3384], ["M36", 84.0739, 34.1407],
  ["M37", 88.0764, 32.5530], ["M38", 82.1770, 35.8549], ["M39", 322.9513, 48.4382], ["M40", 185.5673, 58.0845],
  ["M41", 101.4997, -20.7542], ["M42", 83.8187, -5.3897], ["M43", 83.8807, -5.2674], ["M44", 130.0925, 19.6721],
  ["M45", 56.8691, 24.1053], ["M46", 115.4451, -14.8100], ["M47", 114.1459, -14.4826], ["M48", 123.4299, -5.7505],
  ["M49", 187.4448, 8.0005], ["M50", 105.6686, -8.3640], ["M51", 202.4696, 47.1952], ["M52", 351.2017, 61.5932],
  ["M53", 198.2300, 18.1695], ["M54", 283.7639, -30.4799], ["M55", 294.9971, -30.9618], ["M56", 289.1473, 30.1851],
  ["M57", 283.3959, 33.0286], ["M58", 189.4313, 11.8182], ["M59", 190.5094, 11.6470], ["M60", 190.9166, 11.5526],
  ["M61", 185.4788, 4.4738], ["M62", 255.3025, -30.1124], ["M63", 198.9554, 42.0293], ["M64", 194.1820, 21.6830],
  ["M65", 169.7330, 13.0923], ["M66", 170.0625, 12.9916], ["M67", 132.8339, 11.8120], ["M68", 189.8666, -26.7441],
  ["M69", 277.8462, -32.3481], ["M70", 280.8031, -32.2922], ["M71", 298.4421, 18.7784], ["M72", 313.3662, -12.5373],
  ["M73", 314.7332, -12.6355], ["M74", 24.1741, 15.7837], ["M75", 301.5203, -21.9222], ["M76", 25.5820, 51.5749],
  ["M77", 40.6696, -0.0133], ["M78", 86.6909, 0.0793], ["M79", 81.0442, -24.5245], ["M80", 244.2600, -22.9761],
  ["M81", 148.8882, 69.0653], ["M82", 148.9705, 69.6795], ["M83", 204.2540, -29.8654], ["M84", 186.2656, 12.8870],
  ["M85", 186.3502, 18.1911], ["M86", 186.5490, 12.9462], ["M87", 187.7059, 12.3911], ["M88", 187.9965, 14.4203],
  ["M89", 188.9159, 12.5563], ["M90", 189.2075, 13.1629], ["M91", 188.8602, 14.4964], ["M92", 259.2808, 43.1359],
  ["M93", 116.1218, -23.8531], ["M94", 192.7211, 41.1205], ["M95", 160.9906, 11.7037], ["M96", 161.6904, 11.8200],
  ["M97", 168.6988, 55.0191], ["M98", 183.4512, 14.9005], ["M99", 184.7068, 14.4165], ["M100", 185.7286, 15.8216],
  ["M101", 210.8023, 54.3490], ["M102", 226.6229, 55.7632], ["M103", 23.3409, 60.6580], ["M104", 189.9976, -11.6231],
  ["M105", 161.9567, 12.5816], ["M106", 184.7396, 47.3040], ["M107", 248.1336, -13.0532], ["M108", 167.8788, 55.6743],
  ["M109", 179.3999, 53.3747], ["M110", 10.0920, 41.6854],
];

test("every Messier object is within one arc-minute of NED's position for it", () => {
  assert.equal(NED_MESSIER.length, 110);
  for (const [id, ra, dec] of NED_MESSIER) {
    const distance = separationArcmin(deepSkyObject(id)!, ra, dec);
    assert.ok(distance <= 1, `${id} is ${distance.toFixed(2)} arc-minutes from NED's position`);
  }
});

test("the Messier table stays small: under 3,500 bytes gzipped", () => {
  const bytes = gzipSync(readFileSync(new URL("../src/data/messier.ts", import.meta.url))).byteLength;
  assert.ok(bytes < 3500, `the Messier table is ${bytes} bytes gzipped`);
});

// The NGC and IC objects, at `/deep-sky/ngc-ic`.
const everything = deepSkyAll();

test("the large table holds the Messier objects first and then the NGC and IC objects, each id once", () => {
  assert.equal(everything.length, 11898);
  assert.deepEqual(everything.slice(0, 110), messier());
  assert.equal(new Set(everything.map((o) => o.id)).size, everything.length);
  const seen = new Set<string>();
  for (const o of everything) {
    for (const id of [o.messier, o.ngc, o.ic, ...o.otherIds]) {
      if (id === undefined) continue;
      assert.ok(!seen.has(id), `${id} belongs to two objects`);
      seen.add(id);
    }
    assert.ok(o.id === o.messier || (o.messier === undefined && o.id === (o.ngc ?? o.ic)), o.id);
  }
  assert.equal(deepSkyAll({ catalogue: "messier" }).length, 110);
  assert.equal(deepSkyAll({ catalogue: "ngc" }).length, 7792);
  assert.equal(deepSkyAll({ catalogue: "ic" }).length, 4363);
});

test("every row of the large table is well formed", () => {
  const types = new Set(["galaxy", "globular cluster", "open cluster", "nebula", "planetary nebula", "supernova remnant", "other"]);
  let withMagnitude = 0;
  for (const o of everything) {
    assert.ok(o.rightAscension >= 0 && o.rightAscension < 360, o.id);
    assert.ok(o.declination >= -90 && o.declination <= 90, o.id);
    assert.ok(types.has(o.type), o.id);
    assert.match(o.id, /^(M\d{1,3}|NGC \d{1,4}[A-Z]?|IC \d{1,4}[A-Z]?)$/);
    assert.ok(Object.isFrozen(o), o.id);
    assert.ok(o.constellation === undefined || constellation(o.constellation) !== undefined, `${o.id} ${o.constellation}`);
    if (o.magnitude !== undefined) {
      withMagnitude += 1;
      assert.ok(o.magnitude > -2 && o.magnitude < 25, `${o.id} magnitude ${o.magnitude}`);
    }
    assert.ok(o.sizeArcmin === undefined || o.sizeArcmin > 0, o.id);
  }
  assert.equal(withMagnitude, 7370, "about six in ten have a magnitude");
});

test("known NGC and IC objects are where and what they should be", () => {
  const north = deepSkyObjectAll("NGC 7000")!;
  assert.deepEqual({ name: north.name, type: north.type, constellation: north.constellation }, { name: "North America Nebula", type: "nebula", constellation: "Cyg" });
  // A nebula 2 degrees across: NED puts its centre 12 arc-minutes from the usual 20h58m47s +44 20.
  assert.ok(Math.abs(north.rightAscension - hms(20, 58, 47)) < 20 * ARC_MINUTE && Math.abs(north.declination - dms(1, 44, 20, 0)) < 20 * ARC_MINUTE);
  const omega = deepSkyObjectAll("Omega Centauri")!;
  assert.ok(Math.abs(omega.rightAscension - hms(13, 26, 47)) < 2 * ARC_MINUTE && Math.abs(omega.declination - dms(-1, 47, 28, 46)) < 2 * ARC_MINUTE);
  assert.deepEqual({ id: omega.id, type: omega.type, constellation: omega.constellation }, { id: "NGC 5139", type: "globular cluster", constellation: "Cen" });
  const tuc = deepSkyObjectAll("47 Tucanae")!;
  assert.deepEqual({ id: tuc.id, type: tuc.type }, { id: "NGC 104", type: "globular cluster" });
  assert.equal(deepSkyObjectAll("IC 434")!.type, "nebula");
  assert.equal(deepSkyObjectAll("IC 434")!.constellation, "Ori");
  assert.equal(deepSkyObjectAll("NGC 253")!.name, "Sculptor Galaxy");
  assert.equal(deepSkyObjectAll("NGC 6822")!.type, "galaxy");
  assert.equal(deepSkyObjectAll("NGC 3372")!.name, "Carina Nebula");
  assert.equal(deepSkyObjectAll("NGC 2070"), deepSkyObjectAll("ngc 2070"));
  assert.equal(deepSkyObjectAll("M31"), messier()[30]);
  assert.equal(deepSkyObjectAll("NGC 224"), messier()[30]);
  assert.equal(deepSkyObjectAll("Andromeda Galaxy"), messier()[30]);
  // NGC 1051 is a second entry for NGC 961, so one object carries both numbers and is found by either.
  const twice = deepSkyObjectAll("NGC 1051")!;
  assert.equal(twice, deepSkyObjectAll("NGC 961"));
  assert.deepEqual(twice.otherIds, ["NGC 1051"]);
  assert.equal(twice.ic, "IC 249");
});

test("the large table's lookups and options behave as the small one's", () => {
  assert.equal(deepSkyObjectAll("NGC 99999"), undefined);
  assert.equal(deepSkyObjectAll(""), undefined);
  assert.throws(() => deepSkyObjectAll(1 as unknown as string), TypeError);
  assert.throws(() => deepSkyAll({ type: "comet" as "galaxy" }), RangeError);
  assert.throws(() => deepSkyAll({ catalogue: "abell" as "ngc" }), RangeError);
  assert.throws(() => deepSkyAll({ magnitude: Number.NaN }), TypeError);
  // Wikidata's magnitude for a planetary nebula is mostly its central star's, so only the four Messier ones (HEASARC's published values) have one.
  assert.deepEqual(deepSkyAll({ type: "planetary nebula", magnitude: 30 }).map((o) => o.id), ["M27", "M57", "M76", "M97"]);
  assert.equal(deepSkyAll({ type: "planetary nebula" }).length, 131);
  assert.equal(deepSkyAll({ type: "supernova remnant" }).length, 8);
  assert.equal(deepSkyAll({ type: "globular cluster", magnitude: 7 }).some((o) => o.id === "NGC 5139"), true);
});

test("the large table's counts by type", () => {
  const counts: Record<string, number> = {};
  for (const o of everything) counts[o.type] = (counts[o.type] ?? 0) + 1;
  assert.deepEqual(counts, { galaxy: 10282, "globular cluster": 149, "open cluster": 346, nebula: 220, "planetary nebula": 131, "supernova remnant": 8, other: 762 });
});

// A random sample of the NGC and IC objects: NED's position for each of 100 chosen with a fixed seed from the 11,599 that NED knew, fixed here the same way.
const NED_SAMPLE: Array<[string, number, number]> = [
  ["NGC 5519", 213.5870, 7.5160], ["NGC 7659", 351.4821, 14.2098], ["NGC 3786", 174.9271, 31.9094], ["NGC 5035", 198.7051, -16.4926],
  ["NGC 6529", 271.3703, -36.2954], ["IC 1811", 37.6591, -34.2642], ["NGC 247C", 11.9072, -20.4528], ["IC 1697", 21.2623, 0.4444],
  ["IC 4664", 267.2444, -63.2545], ["NGC 7226", 332.6121, 55.3986], ["NGC 1368", 53.7454, -15.6559], ["NGC 7218", 332.5490, -16.6610],
  ["IC 5226", 338.1259, -25.6620], ["NGC 1846", 76.8914, -67.4615], ["NGC 11", 2.1772, 37.4479], ["NGC 6305", 259.5038, -59.1721],
  ["NGC 5019", 198.1766, 4.7297], ["IC 4624", 252.8895, 17.4492], ["NGC 6854", 301.4115, -54.3755], ["IC 109", 21.3043, 2.0669],
  ["NGC 1388", 54.5501, -15.8995], ["NGC 4476", 187.4962, 12.3487], ["NGC 6323", 258.3252, 43.7825], ["IC 5056", 312.2479, -39.1809],
  ["NGC 7227", 332.8804, 38.7213], ["NGC 3", 1.8199, 8.3017], ["IC 2036", 62.4796, -39.6886], ["NGC 5668", 218.3512, 4.4505],
  ["NGC 3429", 162.8729, 9.2795], ["NGC 7344", 339.9010, -4.1590], ["NGC 6649", 278.3679, -10.4019], ["IC 521", 131.6831, 2.5374],
  ["IC 4337", 208.0804, 14.2719], ["NGC 3130", 152.0515, 9.9770], ["NGC 220", 10.1246, -73.4040], ["NGC 6794", 292.0162, -38.9187],
  ["IC 5008", 308.1870, -72.6946], ["IC 725", 175.8722, -1.6679], ["IC 4975", 303.5125, -52.7217], ["NGC 1633", 70.0380, 7.3495],
  ["NGC 7664", 351.6657, 25.0803], ["NGC 7790", 359.6011, 61.2083], ["IC 662", 164.8356, 1.5989], ["NGC 1315", 50.7775, -21.3752],
  ["IC 1913", 49.8941, -32.4652], ["NGC 6540", 271.5331, -27.7628], ["IC 4217", 199.3053, -13.1541], ["IC 1018", 217.0533, 25.8306],
  ["NGC 1447", 56.4465, -9.0187], ["NGC 1453", 56.6135, -3.9688], ["IC 3963", 194.8063, 27.7746], ["IC 5049B", 311.8493, -38.4183],
  ["IC 3991", 194.9158, 28.9266], ["NGC 6040A", 241.1114, 17.7503], ["NGC 857", 33.1539, -31.9446], ["NGC 4658", 191.1576, -10.0833],
  ["IC 663", 165.1553, 10.4372], ["NGC 2564", 124.6251, -21.8161], ["NGC 160", 9.0170, 23.9579], ["NGC 4320", 185.7405, 10.5483],
  ["IC 1173", 241.3024, 17.4229], ["NGC 6687", 279.3423, 59.6429], ["NGC 1751", 73.5527, -69.8058], ["NGC 4263", 184.9259, -12.2255],
  ["NGC 6821", 296.1003, -6.8333], ["IC 4048", 195.1590, 39.8310], ["NGC 3612", 169.5613, 26.6207], ["NGC 709", 28.2110, 36.2234],
  ["NGC 72", 4.6181, 30.0407], ["IC 982", 212.4963, 17.6961], ["IC 1726", 26.3321, 4.6185], ["NGC 6211", 250.3654, 57.7837],
  ["NGC 1629", 67.4038, -71.8383], ["NGC 2610", 128.3475, -16.1493], ["NGC 5218", 203.0434, 62.7678], ["IC 590", 151.4593, 0.6329],
  ["NGC 5592", 215.9795, -28.6878], ["NGC 2169", 92.1015, 13.9649], ["IC 1279", 272.8141, 36.0077], ["IC 76", 17.0487, -4.5545],
  ["NGC 6223", 250.7680, 61.5789], ["NGC 1887", 79.0247, -66.3186], ["NGC 7822", 0.8973, 67.1616], ["NGC 6454", 266.2359, 55.7048],
  ["NGC 65", 4.7446, -22.8804], ["IC 2518", 148.9939, 37.1555], ["NGC 4151", 182.6358, 39.4058], ["IC 1644", 17.3041, -73.1940],
  ["NGC 3628", 170.0706, 13.5894], ["NGC 4193", 183.4733, 13.1729], ["IC 4793", 284.2316, -61.3998], ["IC 305", 48.7658, 37.8600],
  ["NGC 5389", 209.0262, 59.7421], ["IC 66", 15.1353, 30.7973], ["NGC 6070", 242.4944, 0.7093], ["NGC 1166", 45.1457, 11.8427],
  ["IC 2473", 141.8480, 30.4408], ["NGC 3236", 156.7021, 61.2730], ["NGC 1553", 64.0435, -55.7800], ["NGC 4577", 189.8019, 6.0123],
];

test("a random hundred NGC and IC objects are within one arc-minute of NED's positions for them", () => {
  assert.equal(NED_SAMPLE.length, 100);
  for (const [id, ra, dec] of NED_SAMPLE) {
    const found = deepSkyObjectAll(id);
    assert.ok(found, id);
    const distance = separationArcmin(found, ra, dec);
    assert.ok(distance <= 1, `${id} is ${distance.toFixed(2)} arc-minutes from NED's position`);
  }
});

// What the full comparison found, from scripts/check-deep-sky-ned.py on 2026-11-08. Every Messier object and every NGC and IC object was looked up in NED by name (NGC or IC name, else Messier name).
// Before the corrections: of the 110 Messier objects all 110 were found, 102 within 1 arc-minute (median 0.024, 95th percentile 1.05, largest 6.56 arc-minutes) and 8 over;
// of the 11,788 NGC and IC objects, 11,599 were found in NED (189 were not, nearly all lettered parts such as NGC 602A), 11,057 within 1 arc-minute (median 0.007, 95th percentile 0.90) and 542 over,
// the worst 5,857 arc-minutes (IC 2888). Each of those 550 got NED's position, listed in scripts/deep-sky-ned-positions.tsv; after, none is over 1 arc-minute (largest 0.99).
// 2026-11-09: five of them (NGC 2529, 2652, 4912, 6766, 7520) were items with two names whose first name NED keeps as a separate, untyped catalogue place; NED's
// typed entry for the other name is where Wikidata had them, so those five lines are gone and 545 remain.
test("the comparison with NED: 545 positions are NED's, and the file that lists them is the one the data was made with", () => {
  const lines = readFileSync(new URL("../scripts/deep-sky-ned-positions.tsv", import.meta.url), "utf8").trim().split("\n");
  assert.equal(lines.length, 545);
  assert.equal(lines.filter((line) => line.startsWith("M")).length, 8);
  assert.equal(lines.filter((line) => line.startsWith("NGC ") || line.startsWith("IC ")).length, 537);
  const worst = lines.map((line) => Number(line.split("\t")[5])).sort((a, b) => b - a);
  assert.equal(worst[0], 5856.97);
  for (const line of lines) {
    const [id, ra, dec, , , apart] = line.split("\t") as [string, string, string, string, string, string];
    const found = deepSkyObjectAll(id);
    assert.ok(found, id);
    assert.ok(Math.abs(found.rightAscension - Number(ra)) < 1e-9 && Math.abs(found.declination - Number(dec)) < 1e-9, `${id} has NED's position`);
    assert.ok(Number(apart) >= 1, id);
  }
});

test("the large table stays under 160,000 bytes gzipped", () => {
  const bytes = gzipSync(readFileSync(new URL("../src/data/ngc-ic.ts", import.meta.url))).byteLength;
  assert.ok(bytes < 160_000, `the NGC and IC table is ${bytes} bytes gzipped`);
});

test("an object named twice is placed by the entry NED gives a type: NGC 2974 (also NGC 2652) and NGC 6884 (also NGC 6766)", () => {
  // NED 2026-11-09: NGC 2974, galaxy, 145.6387 -3.6991; NGC 2652 is an old catalogue place with no type at 130.8067 -3.6124. NGC 6884, nebula, 302.5988 46.4608.
  for (const [name, ra, dec] of [["NGC 2974", 145.6387, -3.6991], ["NGC 2652", 145.6387, -3.6991], ["NGC 6884", 302.5988, 46.4608], ["NGC 6766", 302.5988, 46.4608]] as const) {
    const o = deepSkyObjectAll(name);
    assert.ok(o, name);
    assert.ok(Math.abs(o.rightAscension - ra) < 0.01 && Math.abs(o.declination - dec) < 0.01, `${name} at ${o.rightAscension} ${o.declination}`);
  }
  assert.equal(deepSkyObjectAll("NGC 2974")!.constellation, "Sex");
  assert.equal(deepSkyObjectAll("NGC 6884")!.constellation, "Cyg");
});

test("every object's constellation is the one its position is in, by the IAU boundaries", () => {
  const wrong = deepSkyAll().filter((o) => o.constellation !== constellationAt(o).abbreviation);
  assert.deepEqual(wrong.map((o) => `${o.id} ${o.constellation}`), []);
  assert.equal(deepSkyObjectAll("IC 2888")!.constellation, "Leo");
});
