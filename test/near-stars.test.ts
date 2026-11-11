// The near-star table: the systems within 20 light-years, spot-checked against published values for Proxima Centauri, Barnard's Star and Sirius, the order and the limits, a source on every value,
// the Japanese names, the companions typed in, and that no value is read from Gaia, Hipparcos or Tycho.
import assert from "node:assert/strict";
import { test } from "node:test";
import { NEAR_STAR_ROWS } from "../src/data/near-stars.ts";
import { NEAR_STAR_LIMIT_LY, nearStarByName, nearStars } from "../src/near-stars.ts";
import { nearbyStarByName } from "../src/nearby.ts";
import { starByName } from "../src/stars.ts";

const all = nearStars();
const KATAKANA_OR_KANJI = /[぀-ヿ一-鿿]/;

test("Proxima Centauri is 4.24 light-years away and in the Alpha Centauri system, at its published place", () => {
  // Published: parallax 768.5 mas, so 4.2465 light-years; J2000 14h 29m 42.95s, -62d 40m 46.1s. The Yale catalogue gives 769.8 +- 6.1 mas.
  const system = nearStarByName("Proxima Centauri")!;
  assert.equal(system.id, "alpha-centauri");
  const proxima = system.members.find((m) => m.name === "Proxima Centauri")!;
  assert.ok(Math.abs(proxima.lightYears! - 4.2465) < 0.1, `${proxima.lightYears}`);
  assert.ok(Math.abs(proxima.rightAscension! - (14 + 29 / 60 + 42.95 / 3600) * 15) < 0.003);
  assert.ok(Math.abs(proxima.declination! - -(62 + 40 / 60 + 46.1 / 3600)) < 0.003);
  assert.equal(proxima.spectralType, "M5.5eV");
  assert.equal(proxima.luminosityClass, "V");
  assert.equal(proxima.source, "GCTP");
  assert.equal(system.starsAtLeast, 3);
  assert.deepEqual(system.members.map((m) => m.role), ["primary", "companion", "companion"]);
  assert.equal(nearStarByName("Rigil Kentaurus")!.id, "alpha-centauri");
  assert.equal(nearStarByName("alpha centauri")!.nameJa, "ケンタウルス座α星");
  assert.ok(Math.abs(system.lightYears - 4.35) < 0.1, "the system's own distance is that of Rigil Kentaurus");
});

test("Barnard's Star is 5.96 light-years away, in Ophiuchus, an M dwarf that moves 10.3 arc-seconds a year", () => {
  // Published: parallax 546.98 mas (5.9629 light-years), J2000 17h 57m 48.5s, +04d 41m 36s, proper motion -798.6, +10328 mas a year. The Yale catalogue gives 545.6 +- 1.3 mas.
  const star = nearStarByName("Barnard's Star")!;
  assert.ok(Math.abs(star.lightYears - 5.9629) < 3 * star.lightYearsError! + 0.03, `${star.lightYears} +- ${star.lightYearsError}`);
  assert.ok(Math.abs(star.rightAscension - (17 + 57 / 60 + 48.5 / 3600) * 15) < 0.003);
  assert.ok(Math.abs(star.declination - (4 + 41 / 60 + 36 / 3600)) < 0.003);
  assert.equal(star.constellation, "Oph");
  assert.equal(star.luminosityClass, "V");
  assert.ok(Math.abs(Math.hypot(star.properMotionRaMas, star.properMotionDecMas) - 10358) < 100);
  assert.equal(star.nameJa, "バーナード星");
  assert.deepEqual(star.sources, { position: "2MASS", distance: "GCTP", spectralType: "GCTP", magnitude: "GCTP", properMotion: "GCTP" });
});

test("Sirius is 8.6 light-years away, an A star of magnitude -1.46 with a white dwarf companion, and has the Bright Star Catalogue's position", () => {
  // Published: parallax 379.2 mas (8.60 light-years), J2000 6h 45m 8.92s, -16d 42m 58s, V -1.46. The Yale catalogue gives 381.6 +- 2.2 mas.
  const sirius = nearStarByName("Sirius")!;
  assert.ok(Math.abs(sirius.lightYears - 8.6) < 3 * sirius.lightYearsError! + 0.05, `${sirius.lightYears}`);
  assert.ok(Math.abs(sirius.rightAscension - (6 + 45 / 60 + 8.92 / 3600) * 15) < 0.002);
  assert.ok(Math.abs(sirius.declination - -(16 + 42 / 60 + 58 / 3600)) < 0.002);
  assert.equal(sirius.magnitude, -1.46);
  assert.equal(sirius.spectralType, "A1Vm");
  assert.equal(sirius.luminosityClass, "V");
  assert.equal(sirius.sources.position, "BSC");
  assert.equal(sirius.nameJa, "シリウス");
  assert.equal(sirius.starsAtLeast, 2);
  assert.equal(nearStarByName("Sirius B"), sirius);
  const b = sirius.members.find((m) => m.name === "Sirius B")!;
  assert.deepEqual([b.role, b.source, b.spectralType, b.rightAscension, b.note], ["companion", "typed", "DA2", undefined, "a white dwarf"]);
  // The same star as the bright-star table holds it.
  const bright = starByName("Sirius")!;
  assert.ok(Math.abs(sirius.rightAscension - bright.rightAscension) < 1e-6);
  assert.equal(sirius.parallaxMas, bright.parallaxMas);
});

test("the table: 73 systems, nearest first, within 20 light-years, each distance known to 10%, each id and name once", () => {
  assert.equal(all.length, 73);
  assert.equal(NEAR_STAR_ROWS.length, 73);
  assert.equal(NEAR_STAR_LIMIT_LY, 20);
  assert.deepEqual(all.map((s) => s.lightYears), [...all.map((s) => s.lightYears)].sort((a, b) => a - b));
  // The nearest system is Alpha Centauri; sorting is by its nearest star, so Proxima's 4.24 puts it first although its primary is at 4.35.
  assert.equal(all[0]!.name, "Alpha Centauri");
  assert.ok(all.every((s) => s.lightYears <= 20 && (s.lightYearsError === undefined || s.lightYearsError / s.lightYears <= 0.1)));
  assert.equal(new Set(all.map((s) => s.id)).size, all.length);
  assert.equal(new Set(all.map((s) => s.name)).size, all.length);
  assert.ok(all.every((s) => s.rightAscension >= 0 && s.rightAscension < 360 && s.declination >= -90 && s.declination <= 90 && /^[A-Z][A-Za-z]{2}$/.test(s.constellation)));
  assert.deepEqual(nearStars({ maxLightYears: 10 }).map((s) => s.name), ["Alpha Centauri", "Barnard's Star", "Wolf 359", "Lalande 21185", "Sirius", "UV Ceti", "Ross 154"]);
  assert.equal(nearStars({ maxLightYears: 1 }).length, 0);
  assert.throws(() => nearStars({ maxLightYears: "ten" as unknown as number }), TypeError);
});

test("every value has its source, and none is Gaia, Hipparcos or Tycho", () => {
  const allowed = new Set(["BSC", "GCTP", "2MASS", "typed"]);
  for (const s of all) {
    assert.ok(allowed.has(s.sources.position) && (s.sources.spectralType === undefined ? s.spectralType === undefined : allowed.has(s.sources.spectralType)), s.name);
    assert.ok(["GCTP", "BSC", "dynamical"].includes(s.sources.distance), s.name);
    assert.equal(s.sources.magnitude === undefined, s.magnitude === undefined, s.name);
    assert.equal(s.sources.properMotion === undefined, s.properMotionRaMas === 0 && s.properMotionDecMas === 0, s.name);
    assert.equal(s.flags.coarsePosition, s.sources.position === "GCTP", s.name);
    for (const m of s.members) assert.ok(allowed.has(m.source), `${s.name} ${m.name}`);
    assert.equal(s.members[0]!.role, "primary");
    assert.equal(s.members.filter((m) => m.role === "primary").length, 1);
    assert.ok(s.members.length <= s.starsAtLeast || s.starsAtLeast === 1);
  }
  // The only typed values are companions that neither Yale table holds, and they carry no position or distance of their own.
  const typed = all.flatMap((s) => s.members.filter((m) => m.source === "typed"));
  assert.ok(typed.length >= 6);
  assert.ok(typed.every((m) => m.role === "companion" && m.rightAscension === undefined && m.lightYears === undefined));
  assert.ok(all.every((s) => s.sources.position !== "typed" && s.sources.spectralType !== "typed"));
  assert.equal(all.filter((s) => s.spectralType === undefined).map((s) => s.name).join(), "LPP 731-58");
  assert.ok(!JSON.stringify(NEAR_STAR_ROWS).toLowerCase().match(/gaia|hipparcos|tycho/));
});

test("the distances agree with the Yale tables the package already holds, and the flags say what to take care over", () => {
  const proxima = nearbyStarByName("Proxima Centauri")!;
  assert.equal(nearStarByName("Proxima Centauri")!.members[2]!.lightYears!.toFixed(3), proxima.lightYears!.toFixed(3));
  for (const name of ["Barnard's Star", "Wolf 359", "Ross 128"]) assert.equal(nearStarByName(name)!.parallaxMas, nearbyStarByName(name)!.parallaxMas, name);
  assert.equal(nearStarByName("Lalande 21185")!.flags.coarsePosition, true);
  assert.equal(nearStarByName("Barnard's Star")!.flags.coarsePosition, false);
  assert.equal(nearStarByName("Barnard's Star")!.positionErrorArcsec, 0.1);
});

test("names: Japanese where the sources or the literature give it, lookup by name, designation, alias, member or Japanese", () => {
  const ja = all.filter((s) => s.nameJa !== undefined);
  assert.ok(ja.length >= 35, `${ja.length}`);
  assert.ok(ja.every((s) => KATAKANA_OR_KANJI.test(s.nameJa!)));
  assert.equal(nearStarByName("  BARNARD'S   star ")!.id, "barnards-star");
  assert.equal(nearStarByName("Barnard’s Star")!.id, "barnards-star");
  assert.equal(nearStarByName("GJ 699")!.id, "barnards-star");
  assert.equal(nearStarByName("ウォルフ359")!.id, "wolf-359");
  assert.equal(nearStarByName("GJ 876")!.id, "gj-876");
  assert.equal(nearStarByName("procyon b")!.id, "procyon");
  assert.equal(nearStarByName("Epsilon Eridani")!.designation, "ε Eri");
  assert.equal(nearStarByName("no such star"), undefined);
  assert.equal(nearStarByName("alpha-centauri")!.name, "Alpha Centauri");
});

test("the companions of the well-known multiples", () => {
  assert.deepEqual(nearStarByName("Epsilon Indi")!.members.map((m) => `${m.name}:${m.spectralType}`), ["Epsilon Indi A:K4-5V", "Epsilon Indi Ba:T1V", "Epsilon Indi Bb:T6V"]);
  assert.deepEqual(nearStarByName("Keid")!.members.map((m) => m.role), ["primary", "companion", "companion"]);
  assert.equal(nearStarByName("61 Cygni")!.members.length, 2);
  assert.equal(nearStarByName("36 Ophiuchi")!.members.length, 3);
  assert.equal(nearStarByName("Achird")!.spectralType, "F9V+dM0");
  assert.ok(all.filter((s) => s.starsAtLeast > 1).length >= 14);
});

test("the Yale catalogue's cut-off and run-together text is put right", () => {
  // The catalogue's fixed-width columns cut "Barnard star" to "Barnard sta" and lose the space in "CD-36 15693", "V1216 Sgr" and "NSV 11288 A".
  assert.equal(nearStarByName("Barnard's Star")!.designation, "GJ 699");
  assert.equal(nearStarByName("Kapteyn's Star")!.designation, "GJ 191");
  assert.ok(nearStarByName("Kapteyn's Star")!.aliases.includes("CD-45 1841"));
  assert.ok(nearStarByName("Ross 154")!.aliases.includes("V1216 Sgr"));
  assert.ok(all.some((s) => s.aliases.includes("CD-36 15693")));
  assert.ok(all.some((s) => s.aliases.includes("NSV 11288 A")));
  for (const s of all) {
    for (const text of [s.designation, ...s.aliases]) {
      assert.ok(!/ sta$/.test(text) && text !== "van Maanen" && !/^(CD|BD|CPD)[+-]\d{2}\d{4,}/.test(text) && !/^NSV\d/.test(text) && !/^V\d+[A-Z][a-z]/.test(text), `${s.name}: ${text}`);
    }
    if (s.spectralType !== undefined) assert.ok(!/[,;:.]$/.test(s.spectralType) && !/-\d\./.test(s.spectralType) && s.spectralType.trim() === s.spectralType, `${s.name}: ${s.spectralType}`);
  }
  assert.equal(nearStarByName("GJ 1002")!.spectralType, "M5.5 V");
  assert.equal(nearStarByName("G 012-043")!.spectralType, "M5.5 Ve");
  assert.equal(nearStarByName("LPP 731-58")!.spectralType, undefined);
  assert.equal(nearStarByName("LPP 731-58")!.luminosityClass, undefined);
  assert.equal(nearStarByName("LPP 731-58")!.sources.spectralType, undefined);
});

test("Wolf 1055 is GJ 752 A and HD 180617, 19.1 light-years away", () => {
  const star = nearStarByName("GJ 752 A")!;
  assert.equal(star.name, "Wolf 1055");
  assert.equal(nearStarByName("HD 180617"), star);
  assert.equal(star.designation, "GJ 752 A");
  assert.ok(Math.abs(star.lightYears - 19.1) < 0.3);
});

test("coarse positions are flagged: eight systems must not be drawn as precise", () => {
  const coarse = all.filter((s) => s.flags.coarsePosition);
  assert.equal(coarse.length, 8);
  assert.ok(coarse.every((s) => s.sources.position === "GCTP"));
});
