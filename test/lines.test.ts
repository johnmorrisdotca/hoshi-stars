// The constellation figures: every star is a catalogue star inside its constellation, no line twice, all 88 present, the famous shapes where they should be, and the data stays small.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { gzipSync } from "node:zlib";
import { constellationAt } from "../src/boundaries.ts";
import { constellations } from "../src/constellations.ts";
import { LINE_ROWS } from "../src/data/lines.ts";
import { figureOf, figures } from "../src/lines.ts";
import { starByHr, starByName } from "../src/stars.ts";

function joined(abbreviation: string, a: number, b: number): boolean {
  return figureOf(abbreviation).segments.some(([x, y]) => (x.hr === a && y.hr === b) || (x.hr === b && y.hr === a));
}

function named(name: string): number {
  return starByName(name)!.hr;
}

test("all 88 constellations have a figure, in the order of constellations()", () => {
  assert.equal(figures().length, 88);
  assert.deepEqual(figures().map((f) => f.constellation.abbreviation), constellations().map((c) => c.abbreviation));
  assert.equal(LINE_ROWS.split("\n").length, 88);
});

test("every figure has stars; a figure of more than one star has lines, and one star has none", () => {
  for (const f of figures()) {
    assert.ok(f.stars.length >= 1, f.constellation.name);
    assert.equal(f.segments.length === 0, f.stars.length === 1, f.constellation.name);
  }
});

test("every star of every figure is in the catalogue and lies inside its own constellation", () => {
  for (const row of LINE_ROWS.split("\n")) {
    const [abbreviation, chains] = row.split("|") as [string, string];
    for (const hr of chains.split(/[-;]/).map(Number)) {
      const star = starByHr(hr);
      assert.ok(star, `HR ${hr} of ${abbreviation} is not a catalogue star`);
      assert.equal(constellationAt(star).abbreviation, abbreviation, `HR ${hr} lies in ${constellationAt(star).abbreviation}, not ${abbreviation}`);
    }
  }
  for (const f of figures()) for (const [a, b] of f.segments) for (const star of [a, b]) assert.equal(constellationAt(star).abbreviation, f.constellation.abbreviation);
});

test("no line joins a star to itself or is drawn twice, in either direction", () => {
  for (const f of figures()) {
    const seen = new Set<string>();
    for (const [a, b] of f.segments) {
      assert.notEqual(a.hr, b.hr, `${f.constellation.name} joins HR ${a.hr} to itself`);
      const key = a.hr < b.hr ? `${a.hr}-${b.hr}` : `${b.hr}-${a.hr}`;
      assert.ok(!seen.has(key), `${f.constellation.name} has HR ${key} twice`);
      seen.add(key);
    }
  }
});

test("a figure's stars are exactly the stars its lines touch, each once", () => {
  for (const f of figures()) {
    const hrs = f.stars.map((s) => s.hr);
    assert.equal(new Set(hrs).size, hrs.length, f.constellation.name);
    if (f.segments.length > 0) assert.deepEqual([...new Set(f.segments.flat().map((s) => s.hr))].sort((a, b) => a - b), [...hrs].sort((a, b) => a - b), f.constellation.name);
  }
});

test("Orion: the shoulders, the belt, the belt to the shoulders and the feet", () => {
  const [betelgeuse, bellatrix, rigel, saiph, alnitak, alnilam, mintaka] = ["Betelgeuse", "Bellatrix", "Rigel", "Saiph", "Alnitak", "Alnilam", "Mintaka"].map(named) as [number, number, number, number, number, number, number];
  assert.ok(joined("Ori", betelgeuse, bellatrix));
  assert.ok(joined("Ori", mintaka, alnilam) && joined("Ori", alnilam, alnitak));
  assert.ok(joined("Ori", betelgeuse, alnitak) && joined("Ori", bellatrix, mintaka));
  assert.ok(joined("Ori", alnitak, saiph) && joined("Ori", mintaka, rigel));
  assert.ok(!joined("Ori", betelgeuse, rigel));
});

test("the Big Dipper: its seven stars from the bowl's Dubhe round to the handle's Alkaid, and the bowl closes", () => {
  const order = ["Dubhe", "Merak", "Phecda", "Megrez", "Alioth", "Mizar", "Alkaid"].map(named);
  for (let i = 1; i < order.length; i++) assert.ok(joined("UMa", order[i - 1]!, order[i]!), `${order[i - 1]} to ${order[i]}`);
  assert.ok(joined("UMa", named("Megrez"), named("Dubhe")), "the bowl closes");
});

test("Cassiopeia's W: Caph, Schedar, Navi, Ruchbah and Segin in a row, and nothing across the W", () => {
  const order = [21, 168, 264, 403, 542];
  assert.deepEqual(order.map((hr) => starByHr(hr)!.designation), ["β Cas", "α Cas", "γ Cas", "δ Cas", "ε Cas"]);
  for (let i = 1; i < order.length; i++) assert.ok(joined("Cas", order[i - 1]!, order[i]!));
  assert.equal(figureOf("Cas").segments.length, 4);
});

test("the Southern Cross: Gacrux to Acrux down the long arm, Mimosa across to delta Crucis", () => {
  const acrux = starByHr(4730)!;
  assert.equal(acrux.designation, "α1 Cru");
  assert.ok(joined("Cru", named("Gacrux"), acrux.hr));
  assert.ok(joined("Cru", named("Mimosa"), 4656));
  assert.equal(figureOf("Cru").segments.length, 2);
});

test("the Northern Cross, the Little Dipper and the sickle of Leo", () => {
  assert.ok(joined("Cyg", named("Deneb"), named("Sadr")) && joined("Cyg", named("Sadr"), starByHr(7417)!.hr));
  assert.ok(joined("Cyg", 7528, named("Sadr")) && joined("Cyg", named("Sadr"), 7949));
  assert.ok(joined("UMi", named("Polaris"), 6789) && joined("UMi", 5563, 5735) && joined("UMi", 5563, 5903));
  assert.ok(joined("Leo", named("Regulus"), 3975) && joined("Leo", 3975, 4057) && joined("Leo", 4057, 4031));
});

test("a figure is found by any of the constellation's names, and a bad name says so", () => {
  assert.equal(figureOf("Orion"), figureOf("Ori"));
  assert.equal(figureOf("おおぐま座"), figureOf("UMa"));
  assert.throws(() => figureOf("Argo"), RangeError);
  assert.throws(() => figureOf(5 as unknown as string), TypeError);
});

test("figures() hands out a fresh list, and the figures are frozen", () => {
  const list = figures();
  list.pop();
  assert.equal(figures().length, 88);
  const orion = figureOf("Ori");
  assert.ok(Object.isFrozen(orion) && Object.isFrozen(orion.segments) && Object.isFrozen(orion.stars));
});

test("the data stays small: under 2,500 bytes gzipped", () => {
  const bytes = gzipSync(readFileSync(new URL("../src/data/lines.ts", import.meta.url))).byteLength;
  assert.ok(bytes < 2500, `the figure data is ${bytes} bytes gzipped`);
});
