// The Messier fallback (MODULES-781): the magnitudes and sizes the package would carry if NASA HEASARC's Messier table (Sky Catalog 2000.0) had to come out. The fallback is
// data-no-sky-catalogue/messier.ts, built by `scripts/make-deep-sky-data.py --no-sky-catalogue` from Wikidata's V magnitudes (CC0), scripts/data/messier-fixes.tsv and
// scripts/data/messier-sizes.tsv. This test compares it with the data that ships today, which also audits today's data: where the two disagree is where one of them is wrong or
// uses a different measure. The comparison, object by object, and the causes are in docs/research/messier-no-sky-catalogue.md. Nothing here calls the network.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { gzipSync } from "node:zlib";
import { MESSIER_ROWS as FALLBACK_ROWS } from "../data-no-sky-catalogue/messier.ts";
import { deepSkyTable, type DeepSkyObject } from "../src/deep-sky-core.ts";
import { MESSIER_ROWS as TODAY_ROWS } from "../src/data/messier.ts";

const today = deepSkyTable([TODAY_ROWS]).all();
const fallback = deepSkyTable([FALLBACK_ROWS]).all();
const byId = (list: DeepSkyObject[], id: string): DeepSkyObject => list.find((o) => o.id === id)!;

function tsv(name: string): Record<string, string>[] {
  const [head, ...lines] = readFileSync(new URL(`../scripts/data/${name}`, import.meta.url), "utf8").split("\n").filter((line) => line !== "");
  const names = head!.split("\t");
  return lines.map((line) => Object.fromEntries(line.split("\t").map((value, i) => [names[i]!, value])));
}
const fixes = tsv("messier-fixes.tsv");
const sizes = tsv("messier-sizes.tsv");

// The objects with no value in the fallback. A magnitude is missing where no clean source was found (the planetary nebulae's value on Wikidata is the central star's), a size where
// none of the sources has the object (the H II regions, M97, the M24 star cloud and the two asterisms).
const NO_MAGNITUDE = ["M20", "M27", "M47", "M57", "M76", "M97"];
const NO_SIZE = ["M8", "M16", "M17", "M20", "M24", "M40", "M42", "M43", "M73", "M78", "M97"];

test("the fallback is the same 110 objects as today's, with the same positions, names, types and constellations; only magnitude and size differ", () => {
  assert.equal(fallback.length, 110);
  for (const [i, o] of fallback.entries()) {
    const was = today[i]!;
    assert.deepEqual({ ...o, magnitude: 0, sizeArcmin: 0 }, { ...was, magnitude: 0, sizeArcmin: 0 }, o.id);
  }
});

test("the magnitudes: six objects have none, and none of the others is more than a magnitude from today's value", () => {
  assert.deepEqual(fallback.filter((o) => o.magnitude === undefined).map((o) => o.id), NO_MAGNITUDE);
  assert.deepEqual(today.filter((o) => o.magnitude === undefined).map((o) => o.id), [], "today every object has one");
  const differences = fallback.flatMap((o) => (o.magnitude === undefined ? [] : [{ id: o.id, was: byId(today, o.id).magnitude!, now: o.magnitude, difference: Math.round(Math.abs(o.magnitude - byId(today, o.id).magnitude!) * 100) / 100 }]));
  assert.equal(differences.length, 104);
  assert.ok(differences.every((d) => d.difference <= 1), "no object is more than a magnitude from today's value (M17, a nebula, is exactly one)");
  assert.equal(differences.filter((d) => d.difference > 0.5).length, 3, "M17, M26 and M55");
  assert.equal(differences.filter((d) => d.difference >= 0.3).length, 12);
  // The largest differences, as the research note explains each one: the nine over 0.3 (the next three, M78, M86 and M104, are exactly 0.3).
  const largest = differences.filter((d) => d.difference > 0.3).map((d) => d.id).sort();
  assert.deepEqual(largest, ["M17", "M19", "M26", "M30", "M40", "M45", "M52", "M55", "M68"]);
});

test("each fix in messier-fixes.tsv is in the fallback, and the clean source agrees with today's value within half a magnitude where today has one of the 14", () => {
  assert.equal(fixes.length, 46);
  for (const fix of fixes) {
    const o = byId(fallback, fix.object!);
    if (fix.v_magnitude === "") {
      assert.equal(o.magnitude, undefined, fix.object);
      continue;
    }
    assert.equal(o.magnitude, Number(fix.v_magnitude), fix.object);
    assert.ok(fix.url!.startsWith("https://") && fix.date_read === "2026-11-09", fix.object);
    if (fix.note!.startsWith("one of the 14")) assert.ok(Math.abs(Number(fix.v_magnitude) - byId(today, fix.object!).magnitude!) < 0.5, `${fix.object}: ${fix.v_magnitude} against ${byId(today, fix.object!).magnitude}`);
  }
  assert.equal(fixes.filter((f) => f.note!.startsWith("one of the 14")).length, 14);
});

test("the sizes are exactly the ones in messier-sizes.tsv, each with a source, a measure and a date, and none is from a source this fallback must not use", () => {
  assert.equal(sizes.length, 99);
  assert.deepEqual(fallback.filter((o) => o.sizeArcmin === undefined).map((o) => o.id), NO_SIZE);
  for (const row of sizes) {
    assert.equal(byId(fallback, row.object!).sizeArcmin, Math.round(Number(row.size_arcmin) * 10) / 10, row.object);
    assert.ok(row.measure !== "" && row.source !== "" && row.url!.startsWith("https://") && row.date_read === "2026-11-09", row.object);
  }
  for (const row of [...sizes, ...fixes]) {
    const text = [row.measure, row.source, row.url].join(" ").toLowerCase();
    assert.ok(!/heasarc|sky catalog|seds\.org|wikipedia/.test(text), `${row.object}: ${text}`);
  }
});

test("the sizes are a different measure for each kind of object, so each kind is in its own range", () => {
  const range = (type: string): number[] => fallback.filter((o) => o.type === type && o.sizeArcmin !== undefined).map((o) => o.sizeArcmin!);
  const globular = range("globular cluster");
  assert.equal(globular.length, 29);
  assert.ok(Math.min(...globular) >= 0.9 && Math.max(...globular) <= 9, "twice the half-light radius: under 9 arc-minutes");
  const galaxies = range("galaxy");
  assert.equal(galaxies.length, 40);
  assert.equal(byId(fallback, "M31").sizeArcmin, 190.5, "Andromeda is 3 degrees on RC3's D_25");
  assert.ok(Math.min(...galaxies) >= 4.7 && Math.max(...galaxies) <= 191);
  assert.equal(range("open cluster").length, 26, "all 26 open clusters have one; M24, M40 and M73 are not clusters here");
  // Today's sizes are mostly of one measure; the median ratio fallback / today is near 1 for galaxies and clusters taken together and far from it for the globular clusters.
  const ratio = (o: DeepSkyObject): number => o.sizeArcmin! / byId(today, o.id).sizeArcmin!;
  const globularRatios = fallback.filter((o) => o.type === "globular cluster").map(ratio).sort((a, b) => a - b);
  assert.ok(globularRatios[14]! < 0.4, `half-light diameters are about a fifth of the book's visual sizes (median ${globularRatios[14]})`);
  const galaxyRatios = fallback.filter((o) => o.type === "galaxy" && o.sizeArcmin !== undefined && byId(today, o.id).sizeArcmin !== undefined).map(ratio).sort((a, b) => a - b);
  assert.ok(galaxyRatios[20]! > 0.6 && galaxyRatios[20]! < 1.5, `galaxy median ratio ${galaxyRatios[20]}`);
});

test("the fallback table is as small as today's: under 3,500 bytes gzipped", () => {
  const bytes = gzipSync(readFileSync(new URL("../data-no-sky-catalogue/messier.ts", import.meta.url))).byteLength;
  assert.ok(bytes < 3500, `the fallback Messier table is ${bytes} bytes gzipped`);
});
