// The shapes' build script, run for real on saved answers (test/data/shapes: a few rows of RC3 and NED's diameters answers for seven galaxies, so no network): the build with RC3, the NED-only build
// (`--no-rc3`) and the build without NED (`--no-ned`) all run, each holds only its own sources, and none reads NGC 2000.0 or the Sky Catalog. The scripts that used NED's web pages refuse to ask
// them, which is tested before any network call: each stops at once, says why, and writes nothing.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const ONLY = "M31,NGC 253,NGC 891,NGC 4565,M104,M51,NGC 5128";

function build(extra: string[]): { messier: string[]; ngcIc: string[]; log: string } {
  const out = mkdtempSync(join(tmpdir(), "hoshi-shapes-"));
  const run = spawnSync("python3", ["-I", "scripts/make-deep-sky-shapes.py", "--from", "test/data/shapes", "--out", out, "--only", ONLY, ...extra], { encoding: "utf8", timeout: 60_000 });
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

test("the build without NED keeps RC3's rows as they are and leaves out every NED row", () => {
  const full = build([]);
  const noNed = build(["--no-ned"]);
  assert.match(noNed.log, /ned off/);
  assert.match(full.log, /ned on/);
  assert.deepEqual(noNed.messier, full.messier.filter((row) => !row.endsWith("|d")));
  assert.deepEqual(noNed.ngcIc, full.ngcIc.filter((row) => !row.endsWith("|d")));
  assert.ok(![...noNed.messier, ...noNed.ngcIc].some((row) => row.endsWith("|d")));
  assert.ok(!noNed.ngcIc.some((row) => row.startsWith("N5128|")), "NGC 5128 has only NED's shape, so none: it is drawn as the dotted symbol");
});

function refused(args: string[]): void {
  const out = mkdtempSync(join(tmpdir(), "hoshi-refuse-"));
  const run = spawnSync("python3", ["-I", ...args.map((a) => (a === "OUT" ? out : a))], { encoding: "utf8", timeout: 10_000 });
  assert.equal(run.error, undefined, String(run.error));
  assert.equal(run.status, 1, run.stdout + run.stderr);
  assert.match(run.stderr, /does not ask NASA\/IPAC NED's web pages \(MODULES-839\)/);
  assert.match(run.stderr, /robots\.txt/);
  assert.deepEqual(readdirSync(out), [], "nothing is written");
}

test("the scripts that used NED's web pages refuse to ask them: the shapes build without saved answers, the position check without a full cache", () => {
  refused(["scripts/make-deep-sky-shapes.py", "--out", "OUT"]);
  refused(["scripts/make-deep-sky-shapes.py", "--no-rc3", "--out", "OUT"]);
  refused(["scripts/check-deep-sky-ned.py", "--write", "OUT/positions.tsv"]);
  refused(["scripts/check-deep-sky-ned.py", "--cache", "OUT/none.json", "--write", "OUT/positions.tsv"]);
  const cache = join(mkdtempSync(join(tmpdir(), "hoshi-cache-")), "partial.json");
  writeFileSync(cache, JSON.stringify({ "NGC 224": [10.68, 41.27, "G"] }));
  refused(["scripts/check-deep-sky-ned.py", "--cache", cache, "--write", "OUT/positions.tsv"]);
});

test("the shapes build stops when --from has no folder of NED's saved answers, and counts the galaxies with none saved", () => {
  const empty = mkdtempSync(join(tmpdir(), "hoshi-no-ned-"));
  const out = mkdtempSync(join(tmpdir(), "hoshi-refuse-"));
  const run = spawnSync("python3", ["-I", "scripts/make-deep-sky-shapes.py", "--from", empty, "--no-rc3", "--out", out], { encoding: "utf8", timeout: 10_000 });
  assert.equal(run.status, 1, run.stdout + run.stderr);
  assert.match(run.stderr, /is not a folder of NED's saved answers/);
  assert.deepEqual(readdirSync(out), [], "nothing is written");
  assert.match(build([]).log, /no saved NED answer for 0 of 7 galaxies/);
});

test("no script holds an address of NED's /srs/ or /cgi-bin/ pages, and the black-hole build stops rather than ask NED", () => {
  for (const file of readdirSync("scripts").filter((name) => name.endsWith(".py"))) {
    const code = readFileSync(join("scripts", file), "utf8");
    assert.doesNotMatch(code, /["']https?:\/\/ned\.ipac\.caltech\.edu\/(srs|cgi-bin)\//, `${file} holds an address of NED's pages that robots.txt keeps scripts out of`);
  }
  const blackHoles = readFileSync("scripts/make-black-hole-data.py", "utf8");
  assert.match(/def ned_lookup\(name: str\):\n(.*)\n/.exec(blackHoles)![1]!, /raise SystemExit\(f"\{REFUSE_NED\}/);
  assert.match(blackHoles, /REFUSE_NED = \("make-black-hole-data\.py does not ask NASA\/IPAC NED's web pages \(MODULES-839\)/);
});
