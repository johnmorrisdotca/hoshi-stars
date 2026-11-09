// The facts for the gallery and the list: all 88, with the counts the histories give and a few known cases.
import assert from "node:assert/strict";
import { test } from "node:test";
import { constellations } from "../src/constellations.ts";
import { ASTERISM_ROWS, FACT_ROWS, SHOWER_ROWS } from "../src/data/constellation-facts.ts";
import { allConstellationFacts, constellationFacts } from "../src/constellation-facts.ts";

const count = <T>(list: T[], key: (item: T) => string): Record<string, number> => list.reduce<Record<string, number>>((out, item) => ({ ...out, [key(item)]: (out[key(item)] ?? 0) + 1 }), {});

test("all 88 have facts, in the order of constellations()", () => {
  assert.deepEqual(allConstellationFacts().map((f) => f.constellation.abbreviation), constellations().map((c) => c.abbreviation));
  assert.equal(FACT_ROWS.split("\n").length, 88);
  for (const f of allConstellationFacts()) {
    assert.ok(f.meaning.en !== "" && f.meaning.ja !== "", f.constellation.name);
    assert.ok(f.bestMonth >= 1 && f.bestMonth <= 12, f.constellation.name);
    assert.ok(f.year >= 150 && f.year <= 1756);
  }
});

test("the origins are the ones the histories give: 50 trace to Ptolemy (47 and the three parts of Argo Navis), 12 from the voyages, 14 Lacaille's", () => {
  const all = allConstellationFacts();
  assert.deepEqual(count(all, (f) => f.origin), { ancient: 50, voyages: 12, early: 12, modern: 14 });
  assert.equal(all.filter((f) => f.designer.en === "Lacaille").length, 14);
  assert.deepEqual(all.filter((f) => f.designer.en.startsWith("Ptolemy (as part")).map((f) => f.constellation.abbreviation), ["Car", "Pup", "Vel"]);
  assert.equal(constellationFacts("Cru").designer.en, "Plancius");
  assert.equal(constellationFacts("Lyn").year, 1687);
});

test("known cases: Orion, the Great Bear, the Southern Cross and the Perseus shower", () => {
  const orion = constellationFacts("Orion");
  assert.equal(orion.hemisphere, "both");
  assert.equal(orion.bestMonth, 1);
  assert.equal(orion.difficulty, "easy");
  assert.ok(orion.asterisms.some((a) => a.en === "Orion's Belt"));
  assert.deepEqual(orion.meteorShowers.map((s) => s.name.en), ["Orionids"]);
  assert.ok(constellationFacts("UMa").asterisms.some((a) => a.ja === "北斗七星"));
  assert.equal(constellationFacts("Cru").hemisphere, "south");
  assert.equal(constellationFacts("Cas").hemisphere, "north");
  assert.equal(constellationFacts("Men").difficulty, "hard");
  assert.equal(constellationFacts("Per").meteorShowers[0]!.peak, "08-12");
  assert.equal(constellationFacts("Aqr").meteorShowers.length, 2);
  for (const abbreviation of ["Lyr", "Cyg", "Aql"]) assert.ok(constellationFacts(abbreviation).asterisms.some((a) => a.en === "Summer Triangle"), abbreviation);
});

test("every asterism and shower points at real constellations, and the filters have people in every group", () => {
  const known = new Set(constellations().map((c) => c.abbreviation));
  for (const row of ASTERISM_ROWS.split("\n")) for (const abbreviation of row.split("|")[2]!.split(",")) assert.ok(known.has(abbreviation), row);
  for (const row of SHOWER_ROWS.split("\n")) assert.ok(known.has(row.split("|")[3]!), row);
  const all = allConstellationFacts();
  for (const kind of ["north", "south", "both"]) assert.ok(all.some((f) => f.hemisphere === kind), kind);
  for (const kind of ["easy", "medium", "hard"]) assert.ok(all.some((f) => f.difficulty === kind), kind);
  for (let month = 1; month <= 12; month++) assert.ok(all.some((f) => f.bestMonth === month), `month ${month}`);
  assert.ok(all.some((f) => f.asterisms.length > 0) && all.some((f) => f.meteorShowers.length > 0));
});

test("a name that is not a constellation is refused", () => {
  assert.throws(() => constellationFacts("Nope"), RangeError);
});
