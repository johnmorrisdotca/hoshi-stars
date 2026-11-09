// The fallback build, made without the Yale GCTP parallaxes (MODULES-779; scripts/data-source.mjs), against the build that ships: the counts, the named stars, and that nothing throws or prints NaN.
// Both builds are run in their own node (test/no-gctp-probe.ts with the resolve hook), so this file passes whichever one is the default. The numbers are pinned on purpose: when the data changes they must.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const hook = ["--import", join(root, "scripts", "data-source-hook.mjs")];

function run(args: string[], gctp: boolean): string {
  const child = spawnSync(process.execPath, [...hook, ...args], { cwd: root, encoding: "utf8", env: { ...process.env, HOSHI_NO_GCTP: gctp ? "0" : "1" }, maxBuffer: 64 * 1024 * 1024 });
  if (child.status !== 0) throw new Error(`${args.join(" ")} (${gctp ? "Yale GCTP" : "fallback"}) failed: ${child.stderr}`);
  return child.stdout;
}

interface Named {
  name: string;
  parallaxMas: number;
  parallaxErrorMas: number | null;
  parallaxSource: string | null;
  lightYears: number | null;
  lightYearsError: number | null;
  lightYearsRange: (number | null)[] | null;
  luminosity: { value: number | null; low: number | null; high: number | null } | null;
  radius: { value: number | null; basis: string } | null;
  unknown: Record<string, string>;
}
interface Report {
  stars: number;
  bySource: Record<string, number>;
  withDistance: number;
  withError: number;
  unknownRadius: number;
  unknownLuminosity: number;
  radiusFromParallax: number;
  portraits: number;
  comparisons: number;
  fixedDigest: string;
  named: Named[];
  nearby: { count: number; withDistance: number; tight: number; proxima: number | null; barnard: number | null; unknownNameError: string | null };
  space: Record<string, { skipped: number; rows: { hr: number; distance: number; error: number | null }[] }>;
  skies: Record<string, { count: number; skipped: number; first: { id: string; magnitude: number; lightYears: number }[] }>;
  qualities: Record<string, number>;
  figures3d: Record<string, { stars: number; counts: Record<string, number>; placed: number; errors: number }>;
  bright30ly: number;
  bright50ly: number;
  nan: number;
  thrown: number;
  problems: string[];
}
const yale = JSON.parse(run(["test/no-gctp-probe.ts"], true)) as Report;
const fallback = JSON.parse(run(["test/no-gctp-probe.ts"], false)) as Report;
const by = (report: Report, name: string): Named => report.named.find((one) => one.name === name)!;

test("the counts: the same 5,080 stars, 2,329 lose their Yale parallax and every error range, 2,299 keep a distance and 30 lose it", () => {
  assert.equal(yale.stars, 5080);
  assert.equal(fallback.stars, 5080);
  assert.deepEqual(yale.bySource, { GCTP: 2329, BSC: 71, dynamical: 163, none: 2517 });
  assert.deepEqual(fallback.bySource, { BSC: 2370, dynamical: 163, none: 2547 });
  assert.equal(yale.withDistance, 2563);
  assert.equal(fallback.withDistance, 2533);
  assert.equal(yale.withDistance - fallback.withDistance, 30, "the 30 Yale stars the Bright Star Catalogue gives no parallax");
  assert.equal(yale.withError, 2329);
  assert.equal(fallback.withError, 0);
  assert.equal(fallback.bySource.BSC! - yale.bySource.BSC!, 2299, "the Yale stars that keep a distance on the catalogue's own parallax");
  assert.equal(fallback.fixedDigest, yale.fixedDigest, "everything else about a star (position, motion, magnitude, colour, type, names) is the same");
});

test("what a profile gains and loses: ranges are narrower, so more stars get a luminosity and a radius from the parallax", () => {
  // The fallback allows half a milliarcsecond of error, the Bright Star Catalogue's rounding; the Yale errors are a median 9.7 milliarcseconds. See docs/research/no-gctp.md.
  assert.equal(yale.unknownLuminosity, 3720);
  assert.equal(fallback.unknownLuminosity, 2616);
  assert.equal(yale.radiusFromParallax, 696);
  assert.equal(fallback.radiusFromParallax, 2217);
  assert.equal(yale.bright30ly, 48);
  assert.equal(fallback.bright30ly, 47);
  assert.equal(yale.bright50ly, 129);
  assert.equal(fallback.bright50ly, 137);
});

test("the constellation in 3D: no distance is 'good' any more, no star has an error bar, and every figure still draws", () => {
  // Counted over the stars of all 88 figures (a star in two figures counts twice).
  assert.deepEqual(yale.qualities, { good: 25, fair: 108, rough: 370, none: 90 });
  assert.deepEqual(fallback.qualities, { good: 0, fair: 11, rough: 489, none: 93 });
  assert.deepEqual(yale.figures3d.UMa, { stars: 9, counts: { good: 0, fair: 5, rough: 4, none: 0 }, placed: 9, errors: 9 });
  assert.deepEqual(fallback.figures3d.UMa, { stars: 9, counts: { good: 0, fair: 0, rough: 9, none: 0 }, placed: 9, errors: 0 });
  assert.deepEqual(fallback.figures3d.Ori, { stars: 8, counts: { good: 0, fair: 0, rough: 7, none: 1 }, placed: 7, errors: 0 });
});

test("the named stars that change most, with their parallax before and after", () => {
  // name: [Yale parallax, its error, Yale distance, fallback parallax, fallback distance] in milliarcseconds and light-years; null where there is none.
  const expected: Record<string, [number, number, number | null, number, number | null]> = {
    Mimosa: [2, 11.9, 1630.8, 0, null],
    Nunki: [8.1, 15, 402.7, 0, null],
    Marfik: [21.7, 1.9, 150.3, 10, 326.2],
    Betelgeuse: [9.8, 4.7, 332.8, 5, 652.3],
    Pherkad: [0.2, 6.8, 16307.8, 3, 1087.2],
    Miram: [0.7, 10.2, 4659.4, 6, 543.6],
    Saclateni: [1.4, 7.3, 2329.7, 5, 652.3],
    Azmidi: [1, 12.7, 3261.6, 3, 1087.2],
    Brachium: [24, 7.3, 135.9, 64, 51],
    Tianguan: [3.3, 7.3, 988.4, 8, 407.7],
    Sirius: [381.6, 2.2, 8.5, 375, 8.7],
    Alioth: [8.6, 15, 379.3, 9, 362.4],
    Procyon: [286.7, 2.1, 11.4, 288, 11.3],
    Vega: [129.7, 1.6, 25.1, 123, 26.5],
    Rigel: [9.3, 6.2, 350.7, 13, 250.9],
  };
  for (const [name, [plx, error, ly, plxAfter, lyAfter]] of Object.entries(expected)) {
    const before = by(yale, name);
    const after = by(fallback, name);
    assert.deepEqual([before.parallaxMas, before.parallaxErrorMas, before.lightYears, before.parallaxSource], [plx, error, ly, "GCTP"], `${name} on the Yale data`);
    assert.deepEqual([after.parallaxMas, after.parallaxErrorMas, after.lightYears, after.parallaxSource], [plxAfter, null, lyAfter, plxAfter > 0 ? "BSC" : null], `${name} on the fallback`);
    assert.equal(after.lightYearsError, null, `${name} has no distance error to give`);
    assert.equal(after.lightYearsRange, null, `${name} has no distance range to give`);
    assert.ok(plxAfter === 0 ? after.unknown.luminosity === "no-parallax" : true, `${name}: no parallax says why`);
  }
  // Betelgeuse's luminosity and radius, before and after: about twice as far, so about four times as bright and twice as wide.
  assert.ok(Math.abs(by(yale, "Betelgeuse").radius!.value! - 336) < 1 && Math.abs(by(fallback, "Betelgeuse").radius!.value! - 659) < 1);
  // A star whose Yale parallax was too poor for a luminosity gets one on the fallback (Alioth, Rigel), and a star that loses its parallax says so.
  assert.deepEqual(by(yale, "Alioth").unknown, { luminosity: "poor-parallax", radius: "poor-parallax" });
  assert.deepEqual(by(fallback, "Alioth").unknown, {});
  assert.deepEqual(by(fallback, "Mimosa").unknown, { luminosity: "no-parallax", radius: "no-parallax" });
});

test("nothing throws and nothing prints NaN: every star's distance, profile, portrait and comparison, on both builds", () => {
  for (const report of [yale, fallback]) {
    assert.deepEqual(report.problems, []);
    assert.equal(report.thrown, 0);
    assert.equal(report.nan, 0);
    assert.equal(report.portraits, 5080, "a portrait for every star");
  }
  // The comparison with the Sun needs a radius: every star that has one gets it.
  assert.ok(fallback.comparisons > 4000);
});

test("the nearby layer is empty on the fallback, politely: no stars, no names, and the sky from a nearby star says it is unknown", () => {
  assert.deepEqual([yale.nearby.count, yale.nearby.withDistance], [5565, 5069]);
  assert.deepEqual(fallback.nearby, { count: 0, withDistance: 0, tight: 0, proxima: null, barnard: null, unknownNameError: 'RangeError: "Proxima Centauri" is not a star this package knows (pass the star or a point { x, y, z } in parsecs)' });
  // The sky from a bright star is the same whichever tier is asked, and has the same stars to see.
  assert.equal(fallback.skies.siriusNearby!.count, fallback.skies.sirius!.count);
  assert.equal(fallback.skies.siriusNearby!.skipped, fallback.skies.sirius!.skipped);
});

test("nearest by space still answers on the bright stars alone, with no error to give", () => {
  for (const name of ["sirius", "alioth", "betelgeuse"]) {
    const answer = fallback.space[name]!;
    assert.equal(answer.rows.length, 5, name);
    assert.ok(answer.rows.every((row) => Number.isFinite(row.distance) && row.distance > 0 && row.error === null), `${name}: finite distances and no error`);
    assert.equal(answer.skipped, 2547, `${name}: the stars with no distance are counted`);
  }
  assert.equal(fallback.space.sirius!.rows[0]!.hr, 2943, "Procyon is Sirius's nearest bright star on both builds");
  assert.equal(yale.space.sirius!.rows[0]!.hr, 2943);
});

test("the sky from Alpha Centauri has Alpha Centauri B at a real distance on the Yale data and at the viewpoint itself on the fallback (the demo leaves it out)", () => {
  assert.notEqual(yale.skies.rigil!.first[0]!.id, "hr-5460", "the Yale error is larger than the gap, so B is left out and counted");
  assert.equal(fallback.skies.rigil!.first[0]!.id, "hr-5460", "no error: B is 0.00004 light-years away and shines at magnitude -24; demo/from.ts drops it on this build");
  assert.ok(fallback.skies.rigil!.first[0]!.lightYears < 0.001);
});

test("the data export on the fallback: the nearby table is empty, no star has an error column value, and no cell is NaN", () => {
  const output = mkdtempSync(join(tmpdir(), "hoshi-no-gctp-"));
  try {
    run(["scripts/export-data.ts", output], false);
    const csv = (name: string): string[] => readFileSync(join(output, `${name}.csv`), "utf8").trimEnd().split("\n");
    const starsCsv = csv("stars");
    const columns = starsCsv[0]!.split(",");
    const errorColumn = columns.indexOf("parallaxErrorMas");
    assert.ok(errorColumn > 0);
    assert.equal(starsCsv.length - 1, 5080);
    const sourceColumn = columns.indexOf("parallaxSource");
    const cells = (line: string): string[] => [...line.matchAll(/("(?:[^"]|"")*"|[^,]*)(,|$)/g)].map((match) => match[1]!).slice(0, columns.length);
    for (const row of starsCsv.slice(1)) {
      const one = cells(row);
      assert.equal(one[errorColumn], "\\N", `no error in ${row.slice(0, 40)}`);
      assert.notEqual(one[sourceColumn], "GCTP");
    }
    assert.equal(csv("nearby-stars").length, 1, "the header and no rows");
    const schema = JSON.parse(readFileSync(join(output, "nearby-stars.schema.json"), "utf8")) as { rows: number };
    assert.equal(schema.rows, 0);
    for (const file of readdirSync(output).filter((name) => name.endsWith(".csv"))) assert.ok(!/NaN|undefined/.test(readFileSync(join(output, file), "utf8")), `${file} has no NaN`);
  } finally {
    rmSync(output, { recursive: true, force: true });
  }
});
