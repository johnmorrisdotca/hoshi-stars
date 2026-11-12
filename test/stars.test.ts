// The bright-star table against published values: positions from SIMBAD and the Yale catalogue's own rows (J2000, to the catalogue's 0.1 s and 1 arc-second), counts by magnitude, proper motion over decades,
// and the colour of the hot and cool ends. The table is read, never fitted.
import assert from "node:assert/strict";
import { test } from "node:test";
import { blackBodyColour, starByHr, starByName, starColour, luminosityClass, starDistance, starDistanceLightYears, starPosition, starTemperatureK, stars } from "../src/index.ts";

function hms(h: number, m: number, s: number): number {
  return (h + m / 60 + s / 3600) * 15;
}
function dms(sign: 1 | -1, d: number, m: number, s: number): number {
  return sign * (d + m / 60 + s / 3600);
}
const ARC_SECOND = 1 / 3600;

test("the brightest stars are where the catalogue puts them, to its resolution", () => {
  const expected: Array<[string, number, number]> = [
    ["Sirius", hms(6, 45, 8.9), dms(-1, 16, 42, 58)],
    ["Vega", hms(18, 36, 56.3), dms(1, 38, 47, 1)],
    ["Arcturus", hms(14, 15, 39.7), dms(1, 19, 10, 57)],
    ["Betelgeuse", hms(5, 55, 10.3), dms(1, 7, 24, 25)],
    ["Rigel", hms(5, 14, 32.3), dms(-1, 8, 12, 6)],
    ["Polaris", hms(2, 31, 48.7), dms(1, 89, 15, 51)],
    ["Canopus", hms(6, 23, 57.1), dms(-1, 52, 41, 45)],
    ["Antares", hms(16, 29, 24.4), dms(-1, 26, 25, 55)],
  ];
  for (const [name, ra, dec] of expected) {
    const star = starByName(name);
    assert.ok(star, name);
    // 0.1 s of time is 1.5 arc-seconds of right ascension at the equator, so allow 1.5 and 1 arc-seconds for the rounding of each
    assert.ok(Math.abs(star.rightAscension - ra) < 1.6 * ARC_SECOND, `${name} RA ${star.rightAscension} vs ${ra}`);
    assert.ok(Math.abs(star.declination - dec) < 1.1 * ARC_SECOND, `${name} Dec ${star.declination} vs ${dec}`);
  }
});

test("the table holds the stars to magnitude 6.0 and no more, brightest first", () => {
  assert.equal(stars().length, 5080);
  const counts: Array<[number, number]> = [[1, 15], [2, 50], [3, 174], [4, 518], [5, 1630], [6, 5080]];
  for (const [limit, count] of counts) assert.equal(stars({ magnitude: limit }).length, count, `magnitude ${limit}`);
  const all = stars();
  for (let i = 1; i < all.length; i += 1) assert.ok(all[i - 1]!.magnitude <= all[i]!.magnitude, `order at ${i}`);
  assert.ok(all.at(-1)!.magnitude <= 6);
  assert.equal(all[0]!.name, "Sirius");
  assert.throws(() => stars({ magnitude: Number.NaN }), TypeError);
});

test("every star has an HR number nobody else has, and names and designations find the star", () => {
  const all = stars();
  assert.equal(new Set(all.map((s) => s.hr)).size, all.length);
  const names = all.flatMap((s) => (s.name === undefined ? [] : [s.name]));
  assert.equal(new Set(names).size, names.length);
  assert.ok(names.length >= 100);
  assert.equal(starByHr(2491)?.name, "Sirius");
  assert.equal(starByName("sirius"), starByHr(2491));
  assert.equal(starByName(" α CMa "), starByHr(2491));
  assert.equal(starByName("α1 Cen")?.name, "Rigil Kentaurus");
  assert.equal(starByName("no such star"), undefined);
  assert.equal(starByHr(0), undefined);
});

test("every designation is a Greek letter (with its number, no space) or a Flamsteed number, then the constellation", () => {
  const bad = stars().filter((star) => star.designation !== undefined && !/^(\p{Script=Greek}\d?|\d+) [A-Z][A-Za-z]{2}$/u.test(star.designation));
  assert.deepEqual(bad.map((star) => `${star.hr} ${star.designation}`), []);
  assert.equal(starByName("μ1 Sco")?.hr, 6247);
  assert.equal(starByName("ξ2 Cet")?.hr, 718);
  assert.equal(starByName("ν1 Dra")?.hr, 6554);
  assert.equal(starByName("π3 Ori")?.hr, 1543);
});

test("proper motion moves a star by the catalogue's rate, in a straight line", () => {
  const arcturus = starByName("Arcturus")!;
  const atJ2000 = starPosition(arcturus);
  assert.equal(atJ2000.declination, arcturus.declination);
  assert.ok(Math.abs(atJ2000.rightAscension - arcturus.rightAscension) < 1e-12);
  // Arcturus moves -1.998 arc-seconds a year in declination: 100 Julian years is -199.8 arc-seconds
  const later = starPosition(arcturus, Date.UTC(2100, 0, 1, 12));
  assert.ok(Math.abs((later.declination - arcturus.declination) * 3600 + 199.8) < 0.05);
  // and -1.093 arc-seconds a year in right ascension on the sky, which is longer in right ascension by 1 / cos(dec)
  const expectedRa = (-1.093 * 100) / Math.cos((arcturus.declination * Math.PI) / 180) / 3600;
  assert.ok(Math.abs(later.rightAscension - arcturus.rightAscension - expectedRa) < 1e-4);
  // going back is the same distance the other way
  const earlier = starPosition(arcturus, Date.UTC(1900, 0, 1, 12));
  assert.ok(Math.abs(earlier.declination - arcturus.declination - (arcturus.declination - later.declination)) < 1e-4);
  assert.throws(() => starPosition(arcturus, Number.NaN), RangeError);
});

test("near a pole the right ascension stays finite and between 0 and 360", () => {
  const polaris = starByName("Polaris")!;
  const far = starPosition(polaris, Date.UTC(3000, 0, 1));
  assert.ok(Number.isFinite(far.rightAscension) && far.rightAscension >= 0 && far.rightAscension < 360);
  assert.ok(far.declination <= 90);
});

test("distance comes from parallax, and is unknown without one", () => {
  const sirius = starByName("Sirius")!;
  assert.ok(Math.abs(starDistanceLightYears(sirius)! - 8.55) < 0.02, "the Yale parallax of 381.6 milliarcseconds");
  const rigil = starByName("Rigil Kentaurus")!;
  assert.ok(Math.abs(starDistanceLightYears(rigil)! - 4.3) < 0.1);
  assert.equal(starDistanceLightYears({ ...sirius, parallaxMas: 0 }), undefined);
});

test("a distance has its uncertainty: Sirius is 8.6 light-years within its error, not 8.7; Betelgeuse's range is the paper's", () => {
  const sirius = starDistance(starByName("Sirius")!)!;
  assert.equal(sirius.lightYears, starDistanceLightYears(starByName("Sirius")!));
  assert.ok(Math.abs(sirius.lightYears - 8.6) < 2 * sirius.lightYearsError!, "the modern 8.60 is within two standard errors");
  assert.ok(Math.abs(sirius.lightYears - 8.7) > 2 * sirius.lightYearsError!, "the old 8.7 is not");
  assert.ok(sirius.lightYearsError! < 0.1 && sirius.lightYearsRange![0] < sirius.lightYears && sirius.lightYears < sirius.lightYearsRange![1]);
  const betelgeuse = starDistance(starByName("Betelgeuse")!)!;
  const [near, far] = betelgeuse.lightYearsRange!;
  assert.ok(near > 450 && far < 700 && far / near < 1.5, `${near} to ${far}`);
  assert.equal(starDistance({ parallaxMas: 0, parallaxErrorMas: 1 }), undefined);
  assert.equal(starDistance({ parallaxMas: -3, parallaxErrorMas: undefined }), undefined);
  assert.deepEqual(starDistance({ parallaxMas: 100, parallaxErrorMas: undefined }), { lightYears: 3261.563777 / 100, lightYearsError: undefined, lightYearsRange: undefined });
  assert.equal(starDistance({ parallaxMas: 5, parallaxErrorMas: 5 })!.lightYearsRange![1], Number.POSITIVE_INFINITY);
  assert.equal(starDistance({ parallaxMas: 5, parallaxErrorMas: 9 })!.lightYearsRange![1], Number.POSITIVE_INFINITY);
});

test("every star has its whole spectral type and a parallax with a source; the error comes with the Yale ones", () => {
  const all = stars();
  assert.equal(all.length, 5080);
  assert.ok(all.every((s) => s.spectralType !== "" && s.spectralType === s.spectralType.trim()));
  assert.ok(all.every((s) => /^[OBAFGKMCRNS][0-9]?/.test(s.spectralType) ? s.spectralClass === /^[OBAFGKMCRNS][0-9]?/.exec(s.spectralType)![0] : s.spectralClass === ""));
  assert.ok(all.every((s) => (s.parallaxMas > 0) === (s.parallaxSource !== undefined)));
  assert.ok(all.every((s) => (s.parallaxErrorMas !== undefined) === (s.parallaxSource === "GCTP" || s.parallaxSource === "literature") && (s.parallaxErrorMas === undefined || s.parallaxErrorMas > 0)));
  assert.equal(all.filter((s) => s.parallaxMas > 0).length, 2563);
  assert.equal(all.filter((s) => s.parallaxSource === "GCTP").length, 2326);
  assert.equal(all.filter((s) => s.parallaxSource === "literature").length, 3);
  assert.equal(all.filter((s) => s.parallaxSource === "dynamical").length, 163);
  assert.ok(all.filter((s) => s.parallaxSource === "GCTP").some((s) => !Number.isInteger(s.parallaxMas)));
  assert.equal(all.filter((s) => s.luminosityClass === undefined).length, 265);
  const alpha = [starByName("α1 Cen")!, starByName("α2 Cen")!];
  assert.equal(alpha[0]!.parallaxMas, alpha[1]!.parallaxMas, "the two stars of a pair share the parallax of the pair");
});

test("Sirius, Betelgeuse, Vega and Rigel: the whole spectral type, the luminosity class, the parallax and its error", () => {
  const sirius = starByName("Sirius")!;
  assert.deepEqual([sirius.spectralType, sirius.spectralClass, sirius.luminosityClass, sirius.parallaxMas, sirius.parallaxErrorMas, sirius.parallaxSource], ["A1Vm", "A1", "V", 381.6, 2.2, "GCTP"]);
  const betelgeuse = starByName("Betelgeuse")!;
  assert.equal(betelgeuse.spectralType, "M1-2Ia-Iab");
  assert.equal(betelgeuse.spectralClass, "M1");
  assert.ok(betelgeuse.luminosityClass === "Ia" || betelgeuse.luminosityClass === "Iab");
  assert.deepEqual([betelgeuse.parallaxMas, betelgeuse.parallaxErrorMas, betelgeuse.parallaxSource], [5.95, 0.85, "literature"]);
  const vega = starByName("Vega")!;
  assert.ok(vega.spectralType.startsWith("A0"));
  assert.equal(vega.luminosityClass, "V");
  assert.equal(starByName("Rigel")!.luminosityClass, "Ia");
  assert.equal(starByName("Polaris")!.luminosityClass, "Ib");
  assert.equal(starByName("Arcturus")!.luminosityClass, "III");
});

test("luminosityClass reads the first class a spectral type names", () => {
  const cases: [string, string | undefined][] = [
    ["M1-2Ia-Iab", "Ia"], ["A0Va", "V"], ["A1Vm", "V"], ["F5IV-V", "IV"], ["K1.5IIIFe-0.5", "III"], ["K2.5IIIaCH-3Ba0.5", "III"], ["G8Ib-II", "Ib"], ["B2Iab", "Iab"], ["F2II-III", "II"],
    ["K5I:", "I"], ["M5.5eV", "V"], ["K2 V", "V"], ["G8   IIIF*4", "III"], ["B2IV-V", "IV"], ["DA2", "D"], ["gK2", "III"], ["dM3e", "V"], ["sdM1", "VI"], ["K2+Iab", "Iab"],
    ["Am", undefined], ["K0", undefined], ["A0pSi", undefined], ["", undefined], ["C5,5", undefined],
  ];
  for (const [type, expected] of cases) assert.equal(luminosityClass(type), expected, type);
  assert.throws(() => luminosityClass(5 as never), TypeError);
  const counts = new Map<string | undefined, number>();
  for (const s of stars()) counts.set(s.luminosityClass, (counts.get(s.luminosityClass) ?? 0) + 1);
  assert.equal(counts.get("V"), 1520);
  assert.equal(counts.get("III"), 2228);
});

test("temperature and colour follow the colour index: hot stars blue-white, the Sun-like warm, cool stars orange", () => {
  assert.ok(Math.abs(starTemperatureK(0.65) - 5800) < 150, "the Sun's B-V of 0.65 is about 5,800 K");
  assert.ok(starTemperatureK(-0.3) > 15000, "the hottest blue stars");
  assert.ok(starTemperatureK(1.85) < 3600);
  assert.ok(starTemperatureK(0) > starTemperatureK(0.5) && starTemperatureK(0.5) > starTemperatureK(1.5));
  const rgb = (hex: string): [number, number, number] => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  const [rr, , rb] = rgb(starColour(starByName("Rigel")!));
  const [br, , bb] = rgb(starColour(starByName("Betelgeuse")!));
  assert.ok(rb >= rr, "Rigel is blue-white");
  assert.ok(br > bb + 50, "Betelgeuse is orange");
  assert.equal(blackBodyColour(6600), "#ffffff");
  assert.match(blackBodyColour(3000), /^#[0-9a-f]{6}$/);
  assert.throws(() => blackBodyColour(0), RangeError);
  assert.throws(() => starTemperatureK(Number.NaN), RangeError);
  const none = stars().find((s) => s.colourIndex === undefined)!;
  assert.equal(starColour(none), "#ffffff");
});

test("the table's size stays within its budget", async () => {
  const { gzipSync } = await import("node:zlib");
  const { readFileSync } = await import("node:fs");
  const bytes = gzipSync(readFileSync(new URL("../src/data/stars.ts", import.meta.url))).byteLength;
  assert.ok(bytes < 125_000, `the star table (with every star's whole spectral type and a parallax with its error) is ${bytes} bytes gzipped`);
});

test("every named star has a katakana name, and only a named star has one", () => {
  const named = stars().filter((s) => s.name !== undefined);
  assert.equal(named.length, 335);
  for (const s of named) {
    assert.ok(s.nameJa !== undefined, `${s.name} has no katakana name`);
    assert.match(s.nameJa, /^[゠-ヿ]+$/, `${s.name}: ${s.nameJa}`);
  }
  assert.ok(stars().every((s) => s.name !== undefined || s.nameJa === undefined));
  assert.equal(new Set(named.map((s) => s.nameJa)).size, named.length);
});

test("the IAU names of the Pleiades, the Southern Cross and Alcor are there, in English and in katakana", () => {
  const known: Array<[string, number, string]> = [
    ["Acrux", 4730, "アクルックス"], ["Alcor", 5062, "アルコル"], ["Alcyone", 1165, "アルキオネ"], ["Merope", 1156, "メロペ"], ["Electra", 1142, "エレクトラ"],
    ["Atlas", 1178, "アトラス"], ["Maia", 1149, "マイア"], ["Taygeta", 1145, "タイゲタ"], ["Pleione", 1180, "プレイオネ"], ["Celaeno", 1140, "ケライノ"],
    ["Asterope", 1151, "アステロペ"], ["Rasalas", 3905, "ラスアラス"], ["Alphecca", 5793, "アルフェッカ"],
  ];
  for (const [name, hr, ja] of known) {
    assert.equal(starByHr(hr)?.name, name, name);
    assert.equal(starByName(name.toUpperCase())?.hr, hr, name);
    assert.equal(starByName(ja)?.hr, hr, ja);
  }
  assert.equal(starByHr(4731)?.name, undefined);
});

test("the well-known stars have their usual Japanese names, found by starByName", () => {
  const known: Array<[string, string]> = [["Sirius", "シリウス"], ["Capella", "カペラ"], ["Betelgeuse", "ベテルギウス"], ["Rigel", "リゲル"], ["Vega", "ベガ"], ["Polaris", "ポラリス"]];
  for (const [name, ja] of known) {
    assert.equal(starByName(name)?.nameJa, ja, name);
    assert.equal(starByName(ja)?.name, name, ja);
  }
});

test("the supergiants whose catalogue parallax is poor: a published distance where a clear source gives one, a widened range where none does", () => {
  const LY_PER_PC = 3.261563777;
  const get = (name: string): NonNullable<ReturnType<typeof starDistance>> => starDistance(starByName(name)!)!;
  const within = (value: number, wanted: number, tolerance: number): boolean => Math.abs(value - wanted) <= tolerance;
  // Betelgeuse: Joyce et al. 2020, ApJ 902, 63: 168 (+27/-15) pc. The range holds the paper's 153 to 195 pc, and the best value is the paper's, not the old 333 light-years.
  const betelgeuse = get("Betelgeuse");
  assert.ok(within(betelgeuse.lightYears, 168 * LY_PER_PC, 2), String(betelgeuse.lightYears));
  assert.ok(betelgeuse.lightYearsRange![0] <= 153 * LY_PER_PC && betelgeuse.lightYearsRange![1] >= 195 * LY_PER_PC - 4, String(betelgeuse.lightYearsRange));
  assert.equal(starByName("Betelgeuse")!.parallaxSource, "literature");
  assert.match(starByName("Betelgeuse")!.parallaxNote!, /Joyce et al\. 2020, ApJ 902, 63/);
  // Rigel: de Almeida et al. 2022: 0.26 +/- 0.02 kpc, or 0.42 +/- 0.03 kpc for a higher luminosity; the range holds 0.24 to 0.45 kpc.
  const rigel = get("Rigel");
  assert.ok(within(rigel.lightYears, 260 * LY_PER_PC, 5), String(rigel.lightYears));
  assert.ok(rigel.lightYearsRange![0] <= 240 * LY_PER_PC && rigel.lightYearsRange![1] >= 450 * LY_PER_PC - 5, String(rigel.lightYearsRange));
  assert.equal(starByName("Rigel")!.parallaxSource, "literature");
  assert.match(starByName("Rigel")!.parallaxNote!, /de Almeida et al\. 2022/);
  // Polaris: Bond et al. 2018, ApJ 853, 55: the Hubble parallax of Polaris B, 6.26 +/- 0.24 mas, with the error widened so the range reaches 430 light-years.
  const polaris = starByName("Polaris")!;
  assert.deepEqual([polaris.parallaxMas, polaris.parallaxErrorMas, polaris.parallaxSource], [6.26, 1.33, "literature"]);
  assert.match(polaris.parallaxNote!, /Bond et al\. 2018, ApJ 853, 55/);
  const polarisRange = get("Polaris");
  assert.ok(within(polarisRange.lightYears, 521, 1) && polarisRange.lightYearsRange![0] <= 430 && polarisRange.lightYearsRange![1] >= 541, String(polarisRange.lightYearsRange));
  // Antares, Canopus and Mu Cephei: no clear-licence figure replaces the Yale parallax, so its error is at least the parallax itself: rough, with no upper limit.
  for (const hr of [6134, 2326, 8316]) {
    const star = starByHr(hr)!;
    const distance = starDistance(star)!;
    assert.equal(star.parallaxSource, "GCTP", star.name);
    assert.ok(star.parallaxErrorMas! >= star.parallaxMas, star.name);
    assert.equal(distance.lightYearsRange![1], Number.POSITIVE_INFINITY, star.name);
    assert.match(star.parallaxNote!, /Yale parallax/, star.name);
  }
  // Deneb has no parallax in the catalogue and is given none.
  assert.equal(starDistance(starByName("Deneb")!), undefined);
  // Only these six stars carry a note; every other star's distance is the catalogue's.
  assert.deepEqual(stars().filter((s) => s.parallaxNote !== undefined).map((s) => s.hr).sort((a, b) => a - b), [424, 1713, 2061, 2326, 6134, 8316]);
});
