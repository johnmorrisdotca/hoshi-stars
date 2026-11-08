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
  for (const need of ["LICENSE", "NOTICE.md", "README.md", "dist/index.js", "dist/index.d.ts", "dist/constellations.js", "dist/constellations.d.ts"]) if (!files.includes(need)) throw new Error(`${need} is missing from the npm package`);
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
let required = false;
try { createRequire(import.meta.url)(${JSON.stringify(pkg.name)}); required = true; } catch (error) { assert.equal(error.code, "ERR_REQUIRE_ESM"); }
console.log("package ok: " + esm.stars().length + " stars" + (required ? ", also by require" : ""));
`,
  );
  process.stdout.write(run("node", ["check.mjs"], scratch));
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
