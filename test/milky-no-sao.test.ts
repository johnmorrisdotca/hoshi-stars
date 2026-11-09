// The Milky Way without the SAO star counts (MODULES-780): the fallback grid in data-no-sao/milky-way.ts, built by `scripts/make-milky-way-data.py --no-sao` from COBE DIRBE's 1.25 micron starlight,
// the IRAS and DIRBE dust and our own bulge and disk. It has the shipped grid's shape, names no catalogue, passes the Milky Way tests when it is the grid in use, and is compared with the shipped
// grid (scripts/compare-milky.ts), which also audits today's data. The numbers are in docs/research/milky-no-sao.md. After the fallback is swapped in (it is then the shipped grid) the comparison
// is of the grid with itself: delete the comparison test then.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { compareMilky, FALLBACK, readGrid, SHIPPED } from "../scripts/compare-milky.ts";
import { noSao } from "../scripts/milky-source.mjs";

const root = new URL("..", import.meta.url);
const text = readFileSync(FALLBACK, "utf8");

test("the fallback grid has the shipped grid's shape and names no star catalogue", () => {
  const shipped = readFileSync(SHIPPED, "utf8");
  for (const name of ["MILKY_WAY_COLUMNS", "MILKY_WAY_ROWS", "MILKY_WAY_LATITUDE", "MILKY_WAY_LEVELS"]) {
    assert.equal(new RegExp(`${name} = ([0-9.]+);`).exec(text)?.[1], new RegExp(`${name} = ([0-9.]+);`).exec(shipped)?.[1], name);
  }
  assert.ok(text.length <= 16_000, `${text.length} bytes of source`);
  assert.match(text, /^\/\/ Written by scripts\/make-milky-way-data\.py --no-sao: do not edit by hand\./);
  assert.match(text, /no star catalogue/);
  // the header names the sources it uses and none of the ones this package does not (NOTICE.md)
  assert.doesNotMatch(text, /SAO|HEASARC|Gaia|Hipparcos|Tycho|2MASS|HYG|Stellarium/);
  assert.match(text, /COBE DIRBE 1\.25 micron/);
});

test("the Milky Way tests pass on the fallback grid (the Coalsack aside: it is only held to not being brighter)", { skip: noSao() ? "this run already reads the fallback" : false }, () => {
  // the test runner marks the processes it starts; a run of node's runner inside one must not inherit the mark, or it reports nothing
  const env: Record<string, string | undefined> = { ...process.env, HOSHI_NO_SAO: "1" };
  delete env.NODE_TEST_CONTEXT;
  const run = spawnSync(process.execPath, ["--import", fileURLToPath(new URL("scripts/milky-source-hook.mjs", root)), "--test", "test/milky-way.test.ts", "test/milky-chart.test.ts"], {
    cwd: fileURLToPath(root),
    env,
    encoding: "utf8",
  });
  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
  assert.match(run.stdout, /pass 10\b/, run.stdout);
});

test("the fallback follows today's grid: the same band, the same core, the same centre line (the audit of today's data)", () => {
  const result = compareMilky(readGrid(SHIPPED), readGrid(FALLBACK));
  // correlation over the sky, and in the band
  assert.ok(result.correlation > 0.93, `correlation ${result.correlation}`);
  assert.ok(result.correlationNearPlane > 0.88, `correlation near the plane ${result.correlationNearPlane}`);
  assert.ok(result.meanDifference < 0.03, `mean difference ${result.meanDifference}`);
  // the band's centre line: within a degree of today's in every longitude, and on average within a third of a degree
  assert.ok(result.centreLineMean < 0.35, `centre line mean ${result.centreLineMean}`);
  assert.ok(result.centreLineMax < 1.2, `centre line largest ${result.centreLineMax} at l ${result.centreLineMaxAt}`);
  // the brightest cell is the Galactic centre's in both, and the core holds as much of the light
  for (const cell of [result.brightest.shipped, result.brightest.fallback]) assert.ok(Math.abs(((cell.longitude + 180) % 360) - 180) < 3 && Math.abs(cell.latitude) < 3, JSON.stringify(cell));
  assert.ok(Math.abs(result.coreShare.fallback - result.coreShare.shipped) < 0.03, JSON.stringify(result.coreShare));
  // the cells that differ most do not differ by more than 0.35 of the core's brightness, and there are places of it only where the dust or the bulge's top is at stake
  assert.equal(result.worstCells.length, 10);
  for (const cell of result.worstCells) assert.ok(Math.abs(cell.fallback - cell.shipped) < 0.35, JSON.stringify(cell));
  assert.equal(result.worstPlaces.length, 10);
});
