// `pnpm build`: clears dist/ and compiles src/ with tsc, as it always did; then, when the fallback parallax data is in (scripts/data-source.mjs), writes the fallback tables over
// dist/data/stars.js and dist/data/nearby.js. The declarations need no change: the fallback tables export the same names with the same types.
import { spawnSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { SWAPPED, noGctp } from "./data-source.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
rmSync(join(root, "dist"), { recursive: true, force: true });
const tsc = spawnSync(process.execPath, [join(root, "node_modules", "typescript", "bin", "tsc"), "-p", "tsconfig.json"], { cwd: root, stdio: "inherit" });
if (tsc.status !== 0) process.exit(tsc.status ?? 1);
if (noGctp()) {
  for (const { name, fallbackPath } of SWAPPED) writeFileSync(join(root, "dist", "data", `${name}.js`), stripTypeScriptTypes(readFileSync(fallbackPath, "utf8")));
  console.log("dist/ holds the fallback parallax data (no Yale GCTP)");
}
