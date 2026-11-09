// The package as npm packs it: no source, tests or tools in it; installed into an empty folder, the entry imports and a known star is where the catalogue puts it. Run after a build (`pnpm test:package`).
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";

const root = process.cwd();
const scratch = mkdtempSync(join(tmpdir(), "hoshi-package-"));
const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { name: string };

function run(command: string, args: string[], cwd: string): string {
  const r = spawnSync(command, args, { cwd, encoding: "utf8", shell: process.platform === "win32" });
  if (r.status !== 0) throw new Error(`${command} failed: ${r.stdout}\n${r.stderr}`);
  return r.stdout;
}

try {
  const pack = JSON.parse(run("npm", ["pack", "--json", "--ignore-scripts", "--pack-destination", scratch], root)) as Array<{ filename: string; files: Array<{ path: string }> }>;
  const files = pack[0]!.files.map((f) => f.path);
  if (files.some((f) => /^(demo|docs|scripts|test|e2e|site|src)\//.test(f))) throw new Error("Source, tests or the demo entered the npm package");
  for (const need of ["LICENSE", "NOTICE.md", "README.md", "dist/index.js", "dist/index.d.ts", "dist/constellations.js", "dist/constellations.d.ts", "dist/projection.js", "dist/projection.d.ts", "dist/sky.js", "dist/sky.d.ts", "dist/milky-way.js", "dist/milky-way.d.ts", "dist/boundaries.js", "dist/boundaries.d.ts", "dist/lines.js", "dist/lines.d.ts", "dist/deep-sky.js", "dist/deep-sky.d.ts", "dist/deep-sky-ngc-ic.js", "dist/deep-sky-ngc-ic.d.ts", "dist/nearest.js", "dist/nearest.d.ts", "dist/nearby.js", "dist/nearby.d.ts"]) if (!files.includes(need)) throw new Error(`${need} is missing from the npm package`);
  run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", join(scratch, pack[0]!.filename)], scratch);
  writeFileSync(
    join(scratch, "check.mjs"),
    `import assert from "node:assert/strict";
import { createRequire } from "node:module";
const esm = await import(${JSON.stringify(pkg.name)});
assert.equal(esm.stars().length, 5080);
const sub = await import(${JSON.stringify(pkg.name + "/constellations")});
assert.equal(sub.constellations().length, 88);
assert.equal(sub.constellation("CMa").japanese, "おおいぬ座");
assert.ok(sub.starsIn("Ori").some((s) => s.name === "Rigel"));
const sirius = esm.starByName("Sirius");
assert.equal(sirius.hr, 2491);
assert.ok(Math.abs(sirius.declination + 16.7161) < 0.001);
const boundaries = await import(${JSON.stringify(pkg.name + "/boundaries")});
assert.equal(boundaries.constellationAt(esm.starByName("Betelgeuse")).abbreviation, "Ori");
assert.equal(boundaries.boundaries().length, 88);
const lines = await import(${JSON.stringify(pkg.name + "/lines")});
assert.equal(lines.figures().length, 88);
assert.ok(lines.figureOf("Ori").segments.length > 5);
const deep = await import(${JSON.stringify(pkg.name + "/deep-sky")});
assert.equal(deep.messier().length, 110);
assert.equal(deep.deepSkyObject("M31").ngc, "NGC 224");
assert.equal(deep.deepSkyObject("Crab Nebula").type, "supernova remnant");
const deepAll = await import(${JSON.stringify(pkg.name + "/deep-sky/ngc-ic")});
assert.ok(deepAll.deepSky().length > 11000);
assert.equal(deepAll.deepSkyObject("M42").id, "M42");
assert.ok(deepAll.deepSkyObject("NGC 7000"));
const projection = await import(${JSON.stringify(pkg.name + "/projection")});
assert.deepEqual(projection.project("orthographic", { rightAscension: 0, declination: 0 }, { centre: { rightAscension: 0, declination: 0 } }), { x: 0, y: 0 });
const milkyWay = await import(${JSON.stringify(pkg.name + "/milky-way")});
assert.ok(milkyWay.milkyWayBrightness({ rightAscension: 266.4, declination: -28.9 }) > milkyWay.milkyWayBrightness({ rightAscension: 192.9, declination: 27.1 }));
assert.equal(milkyWay.milkyWayBands().length, 3);
const sky = await import(${JSON.stringify(pkg.name + "/sky")});
assert.ok(Math.abs(sky.greenwichSiderealTime(Date.UTC(1987, 3, 10)) - 197.693195) < 1e-6);
const zenith = sky.horizontal({ rightAscension: sky.localSiderealTime(0, 0), declination: 40 }, { latitude: 40, longitude: 0 }, 0, { equinox: "date" });
assert.ok(Math.abs(zenith.altitude - 90) < 1e-6);
const near = await import(${JSON.stringify(pkg.name + "/nearest")});
assert.equal(near.nearest("Mizar", { count: 2 })[1].thing.name, "Alcor");
assert.deepEqual(near.neighbouringConstellations("Ori").map((c) => c.abbreviation), ["Eri", "Gem", "Lep", "Mon", "Tau"]);
const nearby = await import(${JSON.stringify(pkg.name + "/nearby")});
assert.ok(Math.abs(nearby.nearbyStarByName("Proxima Centauri").lightYears - 4.24) < 0.05);
assert.ok(nearby.nearbyStars().length > 5000);
const sheets = await import(${JSON.stringify(pkg.name + "/sheets")});
assert.ok(sheets.dotsSvg("Cas", { widthMm: 184.6, heightMm: 170 }).includes("Join the dots from 1 to"));
assert.equal(sheets.skyForLatitude(-33.9).find((e) => e.constellation.abbreviation === "UMi").standing, "never");
assert.ok(sheets.starWheelPlate(45, { widthMm: 184.6, heightMm: 195 }).includes('data-cut="window"'));
let required = false;
try { createRequire(import.meta.url)(${JSON.stringify(pkg.name)}); required = true; } catch (error) { assert.equal(error.code, "ERR_REQUIRE_ESM"); }
console.log("package ok: " + esm.stars().length + " stars" + (required ? ", also by require" : ""));
`,
  );
  process.stdout.write(run("node", ["check.mjs"], scratch));
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
