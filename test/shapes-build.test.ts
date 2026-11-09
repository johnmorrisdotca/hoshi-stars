// The shapes' build script, run for real on saved answers (test/data/shapes: a few rows of RC3 and NED's diameters answers for seven galaxies, so no network): the build with RC3 and the NED-only build
// (`--no-rc3`) both run, the second holds no RC3 number, and neither reads NGC 2000.0 or the Sky Catalog.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const ONLY = "M31,NGC 253,NGC 891,NGC 4565,M104,M51,NGC 5128";

function build(extra: string[]): { messier: string[]; ngcIc: string[]; log: string } {
  const out = mkdtempSync(join(tmpdir(), "hoshi-shapes-"));
  const run = spawnSync("python3", ["-I", "scripts/make-deep-sky-shapes.py", "--from", "test/data/shapes", "--out", out, "--only", ONLY, ...extra], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  const rows = (name: string): string[] => /= `(.*)`;/s.exec(readFileSync(join(out, name), "utf8"))![1]!.split("\n").filter((row) => row !== "" && !row.startsWith("//") && !row.startsWith("/**"));
  assert.deepEqual(readdirSync(out).sort(), ["deep-sky-shapes-messier.ts", "deep-sky-shapes-ngc-ic.ts"]);
  return { messier: rows("deep-sky-shapes-messier.ts"), ngcIc: rows("deep-sky-shapes-ngc-ic.ts"), log: run.stdout };
}

test("the build with RC3 gives the galaxies RC3's major axis, ratio and angle, and NED's where RC3 has none", () => {
  const { messier, ngcIc, log } = build([]);
  assert.deepEqual(messier, ["M31|1905|617|35|r", "M51|112|69|163|r", "M104|87|35|90|r"]);
  assert.ok(ngcIc.some((row) => row.startsWith("N253|") && row.endsWith("|r")));
  const centaurus = ngcIc.find((row) => row.startsWith("N5128|"))!;
  assert.ok(centaurus.endsWith("|d"), `NGC 5128 is not in the RC3 rows saved here, so NED's: ${centaurus}`);
  assert.match(log, /rc3 on/);
});

test("the NED-only build holds no RC3 number, no row marked r, and the numbers are NED's", () => {
  const { messier, ngcIc, log } = build(["--no-rc3"]);
  assert.match(log, /rc3 off/);
  assert.ok([...messier, ...ngcIc].every((row) => row.endsWith("|d")), [...messier, ...ngcIc].join("\n"));
  assert.equal(messier.length + ngcIc.length, 7, "NED has a diameter for each of the seven");
  const m31 = messier.find((row) => row.startsWith("M31|"))!;
  assert.notEqual(m31, "M31|1905|617|35|r");
  const [, major, minor, angle] = m31.split("|").map(Number) as [number, number, number, number, number];
  assert.ok(major > 1500 && minor < major && angle === 35, `NED's M31: ${m31}`);
});

test("the two builds differ only in where the numbers come from: the same objects, never an RC3 row in the NED-only one", () => {
  const withRc3 = build([]);
  const ned = build(["--no-rc3"]);
  const ids = (rows: string[]): string[] => rows.map((row) => row.split("|")[0]!).sort();
  assert.deepEqual(ids([...withRc3.messier, ...withRc3.ngcIc]), ids([...ned.messier, ...ned.ngcIc]));
  assert.ok(![...ned.messier, ...ned.ngcIc].some((row) => row.endsWith("|r")));
});

test("the script reads neither NGC 2000.0 nor the Sky Catalog's Messier table, and the shipped data has only RC3 and NED rows", () => {
  const script = readFileSync("scripts/make-deep-sky-shapes.py", "utf8");
  assert.doesNotMatch(script, /heasarc_ngc2000|heasarc_messier|ngc2000\.tdat/);
  for (const file of ["src/data/deep-sky-shapes-messier.ts", "src/data/deep-sky-shapes-ngc-ic.ts"]) {
    const rows = /= `(.*)`;/s.exec(readFileSync(file, "utf8"))![1]!.split("\n");
    assert.ok(rows.length > 0 && rows.every((row) => /^[MNI]\d+[A-Z]?\|\d+\|\d*\|\d*\|[rd]$/.test(row)), `${file} has a row that is not RC3's or NED's`);
  }
});
