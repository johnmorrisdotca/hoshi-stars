// Where the objects and the names come from (MODULES-665): who found a Messier, NGC or IC object and when (Wikidata), the day the IAU approved a star's name and the language it comes from. The tables are generated, so these tests pin what no
// run of the generator may change without a reader seeing it: shapes, counts, a handful of facts checked by hand, the notes where a source disagrees, and that every row is an object or star the package holds.
import assert from "node:assert/strict";
import { test } from "node:test";
import { deepSky } from "../src/deep-sky-ngc-ic.ts";
import { DISCOVERERS, MESSIER_DISCOVERY } from "../src/data/discovery-messier.ts";
import { NGC_IC_DISCOVERY } from "../src/data/discovery-ngc-ic.ts";
import { STAR_NAMES } from "../src/data/stars.ts";
import * as small from "../src/provenance.ts";
import * as big from "../src/provenance-ngc-ic.ts";
import { CATALOGUE_ORIGINS, PROVENANCE_SOURCES } from "../src/provenance.ts";

const everything = deepSky();

test("the Messier objects: who found M1, M42 and M44, and when, as Wikidata has it", () => {
  const crab = small.objectDiscovery("M1")!;
  assert.deepEqual(crab.discoverers, [{ name: "John Bevis", wikidata: "Q437582" }]);
  assert.deepEqual(crab.date, { value: "1731", grain: "year", year: 1731 });
  assert.equal(crab.catalogue, CATALOGUE_ORIGINS.messier);
  assert.equal(crab.source, "wikidata");
  assert.deepEqual(small.objectDiscovery("M42")!.date, { value: "1610-11-26", grain: "day", year: 1610 });
  assert.equal(small.objectDiscovery("M42")!.discoverers[0]!.name, "Nicolas-Claude Fabri de Peiresc");
  const cluster = small.objectDiscovery("M44")!;
  assert.equal(cluster.discoverers[0]!.name, "Aratus");
  assert.deepEqual(cluster.date, { value: "-0259", grain: "year", year: -259 });
});

test("the id is read in any case and spacing; an id that is no Messier object has no answer", () => {
  assert.equal(small.objectDiscovery("m1")!.id, "M1");
  assert.equal(small.objectDiscovery(" M 1 ")!.id, "M1");
  assert.equal(small.objectDiscovery("M999"), undefined);
  assert.equal(small.objectDiscovery("NGC 7000"), undefined, "the small tier holds only the Messier objects");
});

test("a date that cannot be a discovery is shown as Wikidata has it, with a note that says why", () => {
  const andromeda = small.objectDiscovery("M31")!;
  assert.equal(andromeda.date!.year, 1964);
  assert.equal(andromeda.notes.length, 1);
  assert.match(andromeda.notes[0]!, /later than the catalogue/);
  assert.deepEqual(small.objectDiscovery("M1")!.notes, []);
});

test("every object that has a note has a flag in its row, and every flag has its text", () => {
  for (const line of `${MESSIER_DISCOVERY}\n${NGC_IC_DISCOVERY}`.split("\n")) {
    const [id, who, when, flags] = line.split("|");
    assert.ok(id !== undefined && flags !== undefined, line);
    assert.match(flags, /^[mcx]*$/, id);
    assert.equal(big.objectDiscovery(id.replace(/^N/, "NGC ").replace(/^I/, "IC "))!.notes.length, flags.length, id);
    assert.match(when!, /^(-?\d{4}(-\d{2}(-\d{2})?)?)?$/, id);
    for (const n of who === "" ? [] : who!.split(",")) assert.ok(DISCOVERERS[Number(n)] !== undefined, `${id}: discoverer ${n}`);
    assert.ok(who !== "" || when !== "", `${id}: a row with neither a discoverer nor a date is not written`);
  }
});

test("the discoverers are people: each name is a Wikidata item, none twice", () => {
  assert.equal(DISCOVERERS.length, 106);
  assert.equal(new Set(DISCOVERERS.map(([, q]) => q)).size, DISCOVERERS.length);
  assert.ok(DISCOVERERS.some(([name]) => name === "William Herschel"));
  for (const [name, q] of DISCOVERERS) assert.ok(name.length > 2 && Number.isInteger(q) && q > 0, name);
});

test("the large tier: 7,918 of the 11,898 objects have a fact, and it agrees with the small tier for every Messier object", () => {
  assert.equal(everything.length, 11898);
  assert.equal(big.DISCOVERY_OBJECT_COUNT, 7918);
  const found = everything.filter((object) => big.objectDiscovery(object.id) !== undefined);
  assert.equal(found.length, 7918, "every row is an object of the package's deep-sky table, by its own id");
  assert.equal(found.filter((object) => big.objectDiscovery(object.id)!.discoverers.length > 0).length, 7765);
  assert.equal(found.filter((object) => big.objectDiscovery(object.id)!.date !== null).length, 7646);
  for (const object of everything.filter((o) => o.messier !== undefined)) assert.deepEqual(big.objectDiscovery(object.id), small.objectDiscovery(object.id), object.id);
});

test("NGC 7000 and IC 434: the catalogue of an object's own number, and Dreyer's years", () => {
  const nebula = big.objectDiscovery("NGC 7000")!;
  assert.equal(nebula.id, "NGC 7000");
  assert.equal(big.objectDiscovery("ngc7000")!.id, "NGC 7000");
  assert.deepEqual(nebula.discoverers.map((one) => one.name), ["William Herschel"]);
  assert.equal(nebula.date!.value, "1786-10-24");
  assert.equal(nebula.catalogue, CATALOGUE_ORIGINS.ngc);
  const horsehead = big.objectDiscovery("IC 434")!;
  assert.equal(horsehead.discoverers[0]!.name, "Williamina Fleming");
  assert.equal(horsehead.catalogue, CATALOGUE_ORIGINS.ic);
  assert.deepEqual(CATALOGUE_ORIGINS.ngc.years, [1888]);
  assert.deepEqual(CATALOGUE_ORIGINS.ic.years, [1895, 1908]);
  assert.deepEqual(CATALOGUE_ORIGINS.messier.years, [1774, 1781]);
});

test("every catalogue and every fact names a source that exists, with an address, a day it was read and a licence", () => {
  for (const [key, origin] of Object.entries(CATALOGUE_ORIGINS)) assert.ok(origin.source in PROVENANCE_SOURCES, key);
  for (const [key, source] of Object.entries(PROVENANCE_SOURCES)) {
    assert.match(source.address, /^https:\/\//, key);
    assert.match(source.read, /^2026-11-\d\d$/, key);
    assert.ok(source.licence.length > 0 && source.name.length > 0, key);
  }
  assert.equal(small.objectDiscovery("M1")!.source, "wikidata");
  assert.equal(small.starNameFacts(2061)!.sources.approved, "iau-csn");
});

test("star names: Betelgeuse and Sirius were approved by the IAU on 2016-06-30, the first Arabic and the second Greek", () => {
  const betelgeuse = small.starNameFacts("Betelgeuse")!;
  assert.deepEqual({ hr: betelgeuse.hr, approved: betelgeuse.approved, origin: betelgeuse.origin, notes: betelgeuse.notes }, { hr: 2061, approved: "2016-06-30", origin: "Arabic", notes: [] });
  assert.equal(small.starNameFacts(2491)!.origin, "Greek");
  assert.equal(small.starNameFacts("  sirius ")!.hr, 2491);
  assert.deepEqual(small.starNameFacts("betelgeuse"), small.starNameFacts(2061));
  assert.equal(small.starNameFacts("Vega not a name"), undefined);
  assert.equal(small.starNameFacts(1), undefined, "HR 1 has no common name");
});

test("every one of the 335 named stars has a row, with an approval day and an origin, except the three the IAU list does not hold", () => {
  const hrs = Object.keys(STAR_NAMES).map(Number);
  assert.equal(hrs.length, 335);
  assert.deepEqual([...small.NAMED_STAR_FACT_IDS].sort((a, b) => a - b), hrs.sort((a, b) => a - b));
  const without = hrs.filter((hr) => small.starNameFacts(hr)!.approved === null);
  assert.deepEqual(without.map((hr) => small.starNameFacts(hr)!.name).sort(), ["Men", "Navi", "Rutilicus"]);
  for (const hr of hrs) {
    const facts = small.starNameFacts(hr)!;
    assert.equal(facts.name, STAR_NAMES[hr]);
    assert.ok(facts.approved === null || /^20\d\d-\d\d-\d\d$/.test(facts.approved), facts.name);
    assert.equal(facts.notes.length, facts.approved === null ? 1 : 0, facts.name);
  }
  assert.match(small.starNameFacts("Navi")!.notes[0]!, /does not hold this name/);
});
