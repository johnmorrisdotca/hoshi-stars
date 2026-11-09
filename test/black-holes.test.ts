// The black holes at `/black-holes`: stellar-mass ones from BlackCAT (Corral-Santana et al. 2016, read from its online version on 2026-11-09), the quiet ones from their discovery papers, the supermassive
// ones from the table of van den Bosch (2016) with NED's positions. The numbers asserted below were read from the papers named beside them and are fixed here, so the test never calls the network.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { gzipSync } from "node:zlib";
import { constellationAt } from "../src/boundaries.ts";
import { BLACK_HOLE_FOUND, BLACK_HOLE_KINDS, blackHole, blackHoles, type BlackHole } from "../src/black-holes.ts";

function hms(h: number, m: number, s: number): number {
  return (h + m / 60 + s / 3600) * 15;
}
function dms(sign: 1 | -1, d: number, m: number, s: number): number {
  return sign * (d + m / 60 + s / 3600);
}
function separationArcsec(a: BlackHole, ra: number, dec: number): number {
  const [ra1, dec1, ra2, dec2] = [a.rightAscension, a.declination, ra, dec].map((x) => (x * Math.PI) / 180) as [number, number, number, number];
  const h = Math.sin((dec2 - dec1) / 2) ** 2 + Math.cos(dec1) * Math.cos(dec2) * Math.sin((ra2 - ra1) / 2) ** 2;
  return ((2 * Math.asin(Math.min(1, Math.sqrt(h))) * 180) / Math.PI) * 3600;
}
const named = (name: string): BlackHole => {
  const found = blackHole(name);
  assert.ok(found, `${name} is in the table`);
  return found;
};

const all = blackHoles();

test("BLACK_HOLE_KINDS and BLACK_HOLE_FOUND are the fixed lists the table indexes into", () => {
  assert.deepEqual([...BLACK_HOLE_KINDS], ["stellar", "quiet", "supermassive"]);
  assert.deepEqual([...BLACK_HOLE_FOUND], ["x-rays", "orbit", "microlensing", "stars", "gas", "masers", "echoes", "image"]);
});

test("blackHoles() lists 301 black holes: 78 stellar, 5 quiet and 218 supermassive, each frozen with a unique id, stellar first", () => {
  assert.equal(all.length, 301);
  assert.deepEqual(BLACK_HOLE_KINDS.map((kind) => blackHoles({ kind }).length), [78, 5, 218]);
  assert.equal(new Set(all.map((b) => b.id)).size, all.length);
  assert.ok(all.every((b) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(b.id) && Object.isFrozen(b) && Object.isFrozen(b.sources)));
  const order = all.map((b) => BLACK_HOLE_KINDS.indexOf(b.kind));
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  assert.equal(blackHoles({}).length, 301);
});

test("blackHoles() filters by kind, status, how it was found and constellation, and refuses a value it does not know", () => {
  const stellar = blackHoles({ kind: "stellar" });
  assert.equal(blackHoles({ status: "confirmed", kind: "stellar" }).length, stellar.filter((b) => b.status === "confirmed").length);
  assert.equal(blackHoles({ status: "candidate", kind: "stellar" }).length + blackHoles({ status: "confirmed", kind: "stellar" }).length, 78);
  assert.ok(blackHoles({ status: "confirmed", kind: "stellar" }).length >= 20 && blackHoles({ status: "candidate", kind: "stellar" }).length >= 40);
  assert.deepEqual(blackHoles({ foundBy: "microlensing" }).map((b) => b.name), ["OGLE-2011-BLG-0462"]);
  assert.deepEqual(blackHoles({ foundBy: "image" }).map((b) => b.name), ["M87*"]);
  assert.deepEqual(blackHoles({ kind: "quiet" }).map((b) => b.name).sort(), ["Gaia BH1", "Gaia BH2", "Gaia BH3", "OGLE-2011-BLG-0462", "VFTS 243"]);
  assert.ok(blackHoles({ constellation: "Sgr" }).some((b) => b.name === "Sagittarius A*"));
  assert.throws(() => blackHoles({ kind: "tiny" as never }), RangeError);
  assert.throws(() => blackHoles({ status: "maybe" as never }), RangeError);
  assert.throws(() => blackHoles({ foundBy: "magic" as never }), RangeError);
  assert.throws(() => blackHoles({ constellation: 5 as never }), TypeError);
});

test("every black hole has a place inside the constellation it names, a known way it was found, and a source for its position, mass and distance", () => {
  for (const b of all) {
    assert.ok(b.rightAscension >= 0 && b.rightAscension < 360 && b.declination >= -90 && b.declination <= 90, b.name);
    assert.ok(Math.abs(b.rightAscension * 10000 - Math.round(b.rightAscension * 10000)) < 1e-6, `${b.name} is given to 0.0001 degree`);
    assert.equal(constellationAt({ rightAscension: b.rightAscension, declination: b.declination })?.abbreviation, b.constellation, `${b.name} is in ${b.constellation}`);
    assert.ok(BLACK_HOLE_FOUND.includes(b.foundBy));
    assert.ok(b.sources.position.length > 0, `${b.name} has a source for its place`);
    for (const list of Object.values(b.sources)) for (const source of list) assert.ok(source.key !== "" && source.citation !== "", `${b.name}: a source with no citation`);
    if (b.kind !== "supermassive") assert.ok(b.year !== undefined || ["LMC X-1", "LMC X-3", "M33 X-7", "1E 1740.7-2942"].includes(b.name), `${b.name} has a year`);
    if (b.massSuns !== undefined) assert.ok(b.sources.mass.length > 0, `${b.name} has a mass and a source for it`);
    if (b.distanceParsecs !== undefined) assert.ok(b.sources.distance.length > 0, `${b.name} has a distance and a source for it`);
  }
});

test("a range never runs backwards, a limit has one end only, and every confirmed mass is one a black hole can have", () => {
  for (const b of all) {
    for (const m of [b.massSuns, b.distanceParsecs]) {
      if (m === undefined) continue;
      if (m.low !== undefined && m.high !== undefined) assert.ok(m.low <= m.high, b.name);
      if (m.value !== undefined && m.low !== undefined && m.limit === undefined) assert.ok(m.low <= m.value * (1 + 1e-9), b.name);
      if (m.value !== undefined && m.high !== undefined && m.limit === undefined) assert.ok(m.high >= m.value * (1 - 1e-9), b.name);
      if (m.limit !== undefined) assert.ok(m.low === undefined && m.high === undefined && m.value !== undefined, `${b.name}: a limit is a value alone`);
    }
    if (b.kind === "supermassive") assert.ok(b.massSuns!.value! >= 1e4 && b.massSuns!.value! < 1e11, `${b.name} ${b.massSuns!.value}`);
    if (b.kind === "quiet") assert.ok(b.massSuns!.value! > 5, b.name);
  }
});

test("Cygnus X-1 is Miller-Jones et al. 2021: 21.2 +/- 2.2 Suns at 2.22 kpc, with HDE 226868, within 2 arc-seconds of the radio position 19h58m21.68s +35d12m05.8s", () => {
  const b = named("Cygnus X-1");
  assert.deepEqual([b.kind, b.status, b.constellation, b.foundBy, b.year], ["stellar", "confirmed", "Cyg", "x-rays", 1964]);
  assert.equal(b.massSuns?.value, 21.2);
  assert.ok(Math.abs(b.massSuns!.low! - 19) < 0.2 && Math.abs(b.massSuns!.high! - 23.4) < 0.2);
  assert.equal(b.distanceParsecs?.value, 2220);
  assert.equal(b.companion, "HDE 226868");
  assert.ok(separationArcsec(b, hms(19, 58, 21.68), dms(1, 35, 12, 5.8)) < 2);
  assert.equal(b.sources.mass[0]!.citation, "Miller-Jones 2021, Science 371, 1046");
  assert.equal(b.sources.mass[0]!.link, "https://ui.adsabs.harvard.edu/abs/2021Sci...371.1046M");
});

test("BlackCAT's best-measured systems: A0620-00 6.6 +/- 0.3 Suns (Cantrell 2010), V404 Cygni 9.0 (+0.2 -0.6) at 2.39 kpc (Khargharia 2010, Miller-Jones 2009), GRO J1655-40 6.0 +/- 0.4 (Shahbaz 2003)", () => {
  const a = named("A0620-00");
  assert.deepEqual([a.massSuns?.value, a.massSuns?.low, a.massSuns?.high], [6.6, 6.3, 6.9]);
  assert.equal(a.distanceParsecs?.value, 1060);
  assert.deepEqual([a.companion, a.year, a.status], ["V616 Mon", 1975, "confirmed"]);
  assert.ok(separationArcsec(a, hms(6, 22, 44.5), dms(-1, 0, 20, 44.72)) < 1);
  assert.equal(blackHole("3A 0620-003"), a);
  assert.equal(a.sources.mass[0]!.key, "Cantrell2010");
  assert.equal(a.sources.mass[0]!.citation, "Cantrell 2010, ApJ 710, 1127");
  const v = named("V404 Cyg");
  assert.equal(v, blackHole("GS 2023+338"));
  assert.equal(v.name, "V404 Cygni");
  assert.deepEqual([v.massSuns?.value, v.massSuns?.low, v.massSuns?.high], [9, 8.4, 9.2]);
  assert.equal(v.distanceParsecs?.value, 2390);
  assert.equal(v.companionType, "K3 III");
  const j = named("GRO J1655-40");
  assert.deepEqual([j.massSuns?.value, j.massSuns?.low, j.massSuns?.high, j.constellation], [6, 5.6, 6.4, "Sco"]);
});

test("a range with no best value, a lower limit and a candidate are told apart", () => {
  const range = named("XTE J1118+480");
  assert.deepEqual([range.massSuns?.value, range.massSuns?.low, range.massSuns?.high], [undefined, 6.9, 8.2]);
  const limit = named("GX 339-4");
  assert.deepEqual([limit.distanceParsecs?.value, limit.distanceParsecs?.limit], [5000, "lower"]);
  const minimum = named("GS 1354-64");
  assert.equal(minimum.massSuns?.limit, "lower");
  const candidate = named("MAXI J1744-294");
  assert.deepEqual([candidate.status, candidate.massSuns], ["candidate", undefined]);
  const probable = named("GRS 1716-249");
  assert.deepEqual([probable.status, probable.note], ["candidate", "Not dynamically confirmed, but a mass function or a mass points to a black hole."]);
});

test("the quiet ones are the discovery papers' numbers: Gaia BH1 9.62 +/- 0.18 Suns at 480 pc (El-Badry 2023), BH2 8.9 +/- 0.3 at 1.16 kpc, BH3 32.70 +/- 0.82 at 590 pc (Gaia Collaboration 2024), VFTS 243 10.1 (+2.0 -2.1)", () => {
  const one = named("Gaia BH1");
  assert.deepEqual([one.kind, one.massSuns?.value, one.distanceParsecs?.value, one.foundBy, one.constellation, one.year], ["quiet", 9.62, 480, "orbit", "Oph", 2023]);
  assert.ok(separationArcsec(one, hms(17, 28, 41.1), dms(-1, 0, 34, 52)) < 2, "inside the paper's 17:28:41.1 -00:34:52");
  assert.equal(one.companion, "Gaia DR3 4373465352415301632");
  const two = named("Gaia BH2");
  assert.deepEqual([two.massSuns?.value, two.distanceParsecs?.value, two.constellation, two.companionType], [8.9, 1160, "Cen", "red giant"]);
  assert.equal(two.rightAscension, 207.5697);
  assert.equal(two.declination, -59.239);
  const three = named("Gaia BH3");
  assert.deepEqual([three.massSuns?.value, three.massSuns?.low, three.massSuns?.high, three.distanceParsecs?.value, three.constellation], [32.7, 31.88, 33.52, 590, "Aql"]);
  assert.ok(separationArcsec(three, hms(19, 39, 18.72), dms(1, 14, 55, 54.2)) < 2, "inside the paper's 2MASS J19391872+1455542");
  const orbit = named("VFTS 243");
  assert.deepEqual([orbit.massSuns?.value, orbit.massSuns?.low, orbit.massSuns?.high, orbit.companionType, orbit.constellation], [10.1, 8, 12.1, "O7 V", "Dor"]);
  const lens = named("OGLE-2011-BLG-0462");
  assert.deepEqual([lens.massSuns?.value, lens.distanceParsecs?.value, lens.foundBy, lens.companion], [7.1, 1580, "microlensing", undefined]);
  assert.match(lens.note ?? "", /disputed/);
  assert.ok(separationArcsec(lens, hms(17, 51, 40.208), dms(-1, 29, 53, 26.5)) < 0.5);
});

test("the supermassive ones: Sagittarius A* 4.297 million Suns at 8,277 pc (GRAVITY 2022), M87* 6.5 billion at 16.8 Mpc (Event Horizon Telescope 2019), M31's 1.4e8 (Bender 2005), NGC 4258's 3.8e7 by masers", () => {
  const sgr = named("Sgr A*");
  assert.deepEqual([sgr.kind, sgr.massSuns?.value, sgr.distanceParsecs?.value, sgr.constellation, sgr.foundBy], ["supermassive", 4.297e6, 8277, "Sgr", "stars"]);
  assert.ok(separationArcsec(sgr, hms(17, 45, 40.0409), dms(-1, 29, 0, 28.118)) < 1, "Reid and Brunthaler 2004");
  const m87 = named("M87");
  assert.equal(m87, blackHole("M87*"));
  assert.equal(m87, blackHole("NGC 4486"));
  assert.deepEqual([m87.massSuns?.value, m87.distanceParsecs?.value, m87.foundBy, m87.year, m87.constellation], [6.5e9, 16.8e6, "image", 2019, "Vir"]);
  assert.ok(separationArcsec(m87, hms(12, 30, 49.4234), dms(1, 12, 23, 28.043)) < 2);
  const m31 = named("M31");
  assert.ok(Math.abs(m31.massSuns!.value! / 1.4e8 - 1) < 0.02 && m31.massSuns!.low! < 1.1e8 && m31.massSuns!.high! > 2e8);
  assert.equal(m31.name, "M31*");
  assert.equal(m31, blackHole("Andromeda Galaxy"));
  assert.equal(m31.sources.mass[0]!.citation.startsWith("Bender"), true);
  const maser = named("NGC 4258");
  assert.deepEqual([maser.name, maser.foundBy, maser.constellation], ["M106*", "masers", "CVn"]);
  assert.ok(Math.abs(maser.massSuns!.value! / 3.8e7 - 1) < 0.02);
});

test("names are found ignoring case, spacing, punctuation and the star after a galaxy's name; a name two black holes share finds neither", () => {
  assert.equal(blackHole("cyg x-1"), named("Cygnus X-1"));
  assert.equal(blackHole("CYGNUSX1"), named("Cygnus X-1"));
  assert.equal(blackHole("cygnus-x-1"), named("Cygnus X-1"));
  assert.equal(blackHole("Sagittarius A*"), blackHole("sgr a"));
  assert.equal(blackHole("HDE 226868"), named("Cygnus X-1"));
  assert.equal(blackHole("Milky Way")?.name, "Sagittarius A*");
  assert.equal(blackHole("nothing at all"), undefined);
  assert.equal(blackHole(""), undefined);
  assert.throws(() => blackHole(5 as never), TypeError);
  const keys = new Map<string, number>();
  for (const b of all) for (const name of new Set([b.name, ...b.otherNames])) keys.set(name.toLowerCase().replace(/[^a-z0-9]+/g, ""), (keys.get(name.toLowerCase().replace(/[^a-z0-9]+/g, "")) ?? 0) + 1);
  for (const b of all) assert.equal(blackHole(b.id), b, `${b.id} finds itself`);
});

test("sources carry a link a reader can follow: NASA ADS for a bibcode, arXiv for a preprint, Wikidata for a place", () => {
  const links = new Set(all.flatMap((b) => Object.values(b.sources).flat().map((s) => s.link)));
  for (const link of links) assert.ok(link === undefined || /^https:\/\/(ui\.adsabs\.harvard\.edu\/abs\/|arxiv\.org\/abs\/|www\.wikidata\.org\/wiki\/Q\d+$|ned\.ipac\.caltech\.edu)/.test(link), String(link));
  assert.equal(named("Gaia BH3").sources.position[0]!.link, "https://ui.adsabs.harvard.edu/abs/2024A%26A...686L...2G");
  assert.equal(named("OGLE-2011-BLG-0462").sources.position[0]!.link, "https://arxiv.org/abs/2503.07820");
  assert.equal(named("Cygnus X-1").sources.position[0]!.link, "https://www.wikidata.org/wiki/Q332674");
});

test("the data file is the size the docs say: under 25 kB gzipped", () => {
  const gzipped = gzipSync(readFileSync(new URL("../src/data/black-holes.ts", import.meta.url))).length;
  assert.ok(gzipped < 25_000, `${gzipped} bytes gzipped`);
});
