// The small first chunk of the names index (`/names/named`): the 335 named stars and the Messier objects, the same rows as `/names`, found the same way, and the table it reads is what its generator writes.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { stars } from "../src/stars.ts";
import { findName, nameRowById, nameRows, searchNames } from "../src/names.ts";
import * as small from "../src/names-named.ts";

const named = stars().filter((star) => star.name !== undefined);

test("the small chunk holds the 335 named stars and the 110 Messier objects, and no other row", () => {
  const rows = small.nameRows();
  assert.equal(named.length, 335);
  assert.equal(rows.filter((row) => row.kind === "star").length, 335);
  assert.equal(rows.filter((row) => row.pick.startsWith("D:")).length, 110);
  assert.equal(rows.length, 445);
  assert.deepEqual(new Set(rows.filter((row) => row.kind === "star").map((row) => row.hr)), new Set(named.map((star) => star.hr)));
  assert.equal(small.nameRowById("hr-2"), undefined);
});

test("every row of the small chunk equals the row of the same id in /names: names, designations, position and all", () => {
  const full = new Map(nameRows().map((row) => [row.id, row]));
  for (const row of small.nameRows()) assert.deepEqual(row, full.get(row.id), row.id);
  assert.deepEqual(small.nameRows().map((row) => row.id), nameRows().filter((row) => small.nameRowById(row.id) !== undefined).map((row) => row.id), "the same order");
});

test("findName gives the same row in the small chunk as in /names for every name, designation and id of a named star and a Messier object", () => {
  let tried = 0;
  for (const row of small.nameRows()) {
    for (const text of [row.name.en, row.name.ja, ...row.otherNames, ...row.designations, row.id]) {
      if (text === undefined) continue;
      const there = findName(text);
      // a text that /names takes for one row of the small chunk is the same row here; a text a second row of the full table shares (alpha Cen) finds none there, and may find the one row here
      if (there !== undefined) assert.equal(small.findName(text)?.id, there.id, text);
      else assert.ok(small.findName(text) === undefined || small.findName(text)!.id === row.id, text);
      tried += 1;
    }
  }
  assert.ok(tried > 4000, String(tried));
  for (const [text, id] of [["Betelgeuse", "betelgeuse"], ["alpha Ori", "betelgeuse"], ["α Orionis", "betelgeuse"], ["HR 2061", "betelgeuse"], ["ベテルギウス", "betelgeuse"], ["M31", "m31"], ["NGC 224", "m31"], ["Andromeda Galaxy", "m31"], ["Messier 42", "m42"]] as const) {
    assert.equal(small.findName(text)?.id, id, text);
    assert.equal(findName(text)?.id, id, text);
  }
});

test("searchNames gives the same top results in the small chunk as in /names for each named star's name and for the Messier objects", () => {
  const inSmall = (row: { id: string }): boolean => small.nameRowById(row.id) !== undefined;
  for (const row of small.nameRows()) {
    assert.equal(small.searchNames(row.name.en, { limit: 1 })[0]?.id, searchNames(row.name.en, { limit: 1 })[0]?.id, row.name.en);
  }
  for (const text of ["sirius", "rigel", "vega", "andro", "orion", "pleiades", "crab", "whirlpool", "m3", "ngc 224", "ベテル", "alpha ori"]) {
    const here = small.searchNames(text, { limit: 5 }).map((r) => r.id);
    const there = searchNames(text, { limit: 500 }).filter(inSmall).slice(0, 5).map((r) => r.id);
    assert.deepEqual(here, there, text);
  }
  assert.deepEqual(small.searchNames("m31", { limit: 1 }).map((r) => r.id), ["m31"]);
  assert.equal(small.searchNames("galaxy", { kinds: ["galaxy"], limit: 2 }).length, 2);
  assert.deepEqual(small.searchNames("", {}), []);
});

test("the table of the named stars is what scripts/make-names-named.ts writes: running it again changes nothing", () => {
  const run = spawnSync(process.execPath, ["scripts/make-names-named.ts", "--check"], { encoding: "utf8", timeout: 120_000 });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /holds the 335 named stars/);
});

test("the small chunk's lookup by id is the way back from every id", () => {
  for (const row of small.nameRows()) assert.equal(small.nameRowById(row.id), row);
  assert.equal(nameRowById("betelgeuse")?.hr, small.nameRowById("betelgeuse")?.hr);
});
