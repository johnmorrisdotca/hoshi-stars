import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { stars } from "../src/stars.ts";
import { nearbyStars } from "../src/nearby.ts";

const names = ["stars", "nearby-stars", "constellations", "constellation-facts", "constellation-lines", "boundaries", "messier", "ngc-ic", "star-names"];
test("the data export has matching schemas, counts and checksums", () => {
  const dir = mkdtempSync(join(tmpdir(), "hoshi-export-"));
  try {
    execFileSync(process.execPath, ["scripts/export-data.ts", dir], { cwd: process.cwd() });
    const files = readdirSync(dir);
    assert.equal(readdirSync(join(dir, "thumbnails", "svg", "dark")).length, 88);
    for (const name of names) {
      assert.ok(files.includes(`${name}.csv`));
      assert.ok(files.includes(`${name}.schema.json`));
      const schema = JSON.parse(readFileSync(join(dir, `${name}.schema.json`), "utf8")) as { rows: number; columns: { name: string; type: string; unit: string | null; meaning: string; source: string }[] };
      const csv = readFileSync(join(dir, `${name}.csv`), "utf8");
      assert.deepEqual(csv.slice(0, csv.indexOf("\n")).split(","), schema.columns.map((c) => c.name));
      assert.equal(csv.trimEnd().split("\n").length - 1, schema.rows);
      for (const col of schema.columns) { assert.ok(col.name && col.type && col.meaning && col.source); assert.ok("unit" in col); }
      if (name === "stars") assert.equal(schema.rows, stars().length);
      if (name === "nearby-stars") assert.equal(schema.rows, nearbyStars().length);
    }
    assert.equal(stars().length, 5080);
    assert.equal(nearbyStars().length, 5565);
    const sirius = readFileSync(join(dir, "stars.csv"), "utf8").split("\n")[1]!.split(",");
    assert.equal(Number(sirius[0]), 2491);
    assert.equal(sirius[1], "Sirius");
    assert.ok(Math.abs(Number(sirius[7]) + 1.46) < 0.001);
    assert.ok(files.includes("LICENCE-DATA.md"));
    const sums = readFileSync(join(dir, "SHA256SUMS"), "utf8").trim().split("\n");
    assert.equal(sums.length, names.length * 2 + 1 + 176);
    for (const line of sums) { const [hash, file] = line.split("  "); assert.equal(createHash("sha256").update(readFileSync(join(dir, file!))).digest("hex"), hash); }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
