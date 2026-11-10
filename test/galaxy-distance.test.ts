// The distance to a galaxy: Wikidata's (CC0) distance statements, read on 2026-11-10, as the median in light-years and parsecs with the spread, the count, the error and the flag for sources that disagree.
// The build script is run for real on a saved answer (test/data/galaxy-distances: fifteen statements for seven galaxies), so no network.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { gzipSync } from "node:zlib";
import { deepSky, deepSkyObject, galaxyDistance } from "../src/deep-sky-ngc-ic.ts";
import { galaxyDistance as messierDistance, deepSkyObject as messierObject } from "../src/deep-sky.ts";
import { distanceTable } from "../src/galaxy-distance-core.ts";

const LY_PER_PC = 3.261563777;
const ROWS = /= `(.*)`;/s;

function build(): { messier: string[]; ngcIc: string[]; log: string } {
  const out = mkdtempSync(join(tmpdir(), "hoshi-distances-"));
  const run = spawnSync("python3", ["-I", "scripts/make-galaxy-distances.py", "--from", "test/data/galaxy-distances", "--out", out], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  const rows = (name: string): string[] => ROWS.exec(readFileSync(join(out, name), "utf8"))![1]!.split("\n");
  return { messier: rows("galaxy-distances-messier.ts"), ngcIc: rows("galaxy-distances-ngc-ic.ts"), log: run.stdout };
}

test("the build turns parsecs, kiloparsecs, megaparsecs and light-years into one median in parsecs", () => {
  const { ngcIc } = build();
  assert.equal(ngcIc.find((row) => row.startsWith("N253|")), "N253|2347|3.5e+06|3.5e+06|3.5e+06|4|", "3.5 Mpc, 3,500 kpc, 3,500,000 pc and 11,415,473.2 ly are one distance, four statements");
});

test("the build keeps the median, the lowest, the highest, the count and the error as half the bounds' width", () => {
  const { ngcIc } = build();
  assert.equal(ngcIc.find((row) => row.startsWith("N891|")), "N891|2328|9e+06|8e+06|1.2e+07|3|500000", "8, 9 (8.5 to 9.5) and 12 Mpc");
  assert.ok(ngcIc.find((row) => row.startsWith("N4565|"))!.endsWith("|2|"), "no bounds, no error");
});

test("the build leaves out a deprecated statement, one under 20 kpc and one in an unknown unit, and counts them", () => {
  const { messier, ngcIc, log } = build();
  assert.equal(messier.find((row) => row.startsWith("M51|")), "M51|13957|7.6e+06|7.6e+06|7.6e+06|1|", "the deprecated 4 Mpc is not in");
  assert.ok(![...messier, ...ngcIc].some((row) => row.startsWith("N6469|") || row.startsWith("N1068|")), "a 550 pc distance and an unknown unit give no row");
  assert.match(log, /1 deprecated, 1 in another unit/);
  assert.match(log, /1 statements under 20 kpc/);
});

test("an item with two catalogue codes is one galaxy and one statement (M31 is also NGC 224)", () => {
  const { messier, ngcIc } = build();
  assert.equal(messier.find((row) => row.startsWith("M31|")), "M31|2469|820000|820000|820000|1|");
  assert.ok(!ngcIc.some((row) => row.startsWith("N224|")));
});

test("galaxyDistance gives light-years and parsecs, the spread and the count", () => {
  const table = distanceTable(["M31|2469|820000|790000|880000|3|50000"]);
  const d = table.distanceOf(deepSkyObject("M31")!)!;
  assert.equal(d.parsecs, 820000);
  assert.ok(Math.abs(d.lightYears - 820000 * LY_PER_PC) < 1);
  assert.deepEqual([d.spread.low.parsecs, d.spread.high.parsecs, d.count], [790000, 880000, 3]);
  assert.equal(d.error!.parsecs, 50000);
  assert.ok(Math.abs(d.error!.lightYears - 50000 * LY_PER_PC) < 1);
  assert.equal(d.method, "compiled, method not stated");
  assert.deepEqual(d.sources, [{ name: "Wikidata", licence: "CC0 1.0", items: ["Q2469"], values: 3 }]);
});

test("the disagree flag is set when the highest is more than 1.2 times the lowest, and not at exactly 1.2 or for one value", () => {
  const flag = (row: string): boolean => distanceTable([row]).distanceOf(deepSkyObject("M31")!)!.disagree;
  assert.equal(flag("M31|1|9000000|8000000|12000000|3|"), true, "12 over 8 is 1.5");
  assert.equal(flag("M31|1|11000000|10000000|12000000|2|"), false, "exactly 1.2");
  assert.equal(flag("M31|1|11000000|10000000|12000001|2|"), true, "just over");
  assert.equal(flag("M31|1|820000|820000|820000|1|"), false, "one statement");
});

test("no error is null, not a made-up error", () => {
  assert.equal(distanceTable(["M31|1|820000|820000|820000|1|"]).distanceOf(deepSkyObject("M31")!)!.error, null);
});

test("an object that is not a galaxy, or one with no distance, gets null", () => {
  assert.equal(galaxyDistance(deepSkyObject("M42")!), null, "the Orion Nebula");
  assert.equal(galaxyDistance(deepSkyObject("M13")!), null, "a globular cluster");
  assert.equal(messierDistance(deepSkyObject("NGC 253")!), null, "the Messier-only tier holds the Messier galaxies only");
});

test("the data rows are all well-formed, with a Wikidata item, a median between the lowest and the highest and no galaxy nearer than 20 kpc", () => {
  for (const file of ["src/data/galaxy-distances-messier.ts", "src/data/galaxy-distances-ngc-ic.ts"]) {
    for (const row of ROWS.exec(readFileSync(file, "utf8"))![1]!.split("\n")) {
      assert.match(row, /^[MNI]\d+[A-Z]?\|\d+(,\d+)*\|[\d.e+]+\|[\d.e+]+\|[\d.e+]+\|\d+\|[\d.e+]*$/, row);
      const [, , median, low, high, count, error] = row.split("|") as [string, string, string, string, string, string, string];
      assert.ok(Number(low) >= 20000 && Number(low) <= Number(median) && Number(median) <= Number(high) && Number(count) >= 1, row);
      assert.ok(error === "" || Number(error) < Number(median), row);
    }
  }
});

test("every distance is a galaxy's, and the table covers about six in ten of the galaxies", () => {
  const galaxies = deepSky({ type: "galaxy" });
  const withDistance = galaxies.filter((g) => galaxyDistance(g) !== null);
  assert.equal(galaxies.length, 10282);
  assert.equal(withDistance.length, 6202, "6,202 of 10,282 galaxies");
  assert.equal(deepSky().filter((o) => o.type !== "galaxy" && galaxyDistance(o) !== null).length, 0);
  assert.equal(withDistance.filter((g) => galaxyDistance(g)!.disagree).length, 22);
  assert.equal(messierObject("M31") !== undefined && messierDistance(messierObject("M31")!) !== null, true);
});

// The six check galaxies against MODULES-838's research (Handoff/hoshi-stars/RESEARCH-838-galaxy-distances.md, 2026-11-10): the range of all of Wikidata's statements for each, in Mpc (the
// research counted the deprecated ones too), and the newest NED-D value of the best method there, kept here only as a cross-check of the order of magnitude (nothing of NED-D is in the package).
const CHECKS: [string, number, number, number][] = [
  ["M31", 0.7, 0.82, 0.78],
  ["M33", 0.75, 0.93, 0.85],
  ["M51", 6.2, 8.4, 8.58],
  ["M81", 3.39, 4.3, 3.63],
  ["M87", 16.5, 19.7, 16.0],
  ["M101", 4.94, 8.28, 6.71],
];
for (const [id, low, high, reference] of CHECKS) {
  test(`${id}: the distance lies in the research's Wikidata range and within 15 per cent of the best measurement there`, () => {
    const d = galaxyDistance(deepSkyObject(id)!)!;
    const mpc = d.parsecs / 1e6;
    assert.ok(mpc >= low - 1e-9 && mpc <= high + 1e-9, `${id}: ${mpc} Mpc, research range ${low} to ${high}`);
    assert.ok(Math.abs(mpc / reference - 1) < 0.15, `${id}: ${mpc} Mpc against ${reference}`);
    assert.ok(Math.abs(d.lightYears / d.parsecs - LY_PER_PC) < 1e-6);
    assert.equal(d.sources[0]!.items.length >= 1, true);
    assert.equal(messierDistance(deepSkyObject(id)!)!.parsecs, d.parsecs, "the small tier gives the same number");
  });
}

test("the Andromeda Galaxy's numbers, as the headline gives them", () => {
  const d = galaxyDistance(deepSkyObject("M31")!)!;
  assert.deepEqual([Math.round(d.lightYears / 1e4) / 100, d.error, d.disagree, d.sources[0]!.items], [2.67, null, false, ["Q2469"]]);
});

test("the Messier tier's distances are tiny and the NGC and IC tier's are the large one", () => {
  const size = (file: string): number => gzipSync(readFileSync(file)).length;
  assert.ok(size("src/data/galaxy-distances-messier.ts") < 2000);
  assert.ok(size("src/data/galaxy-distances-ngc-ic.ts") < 80000);
});
