// The names index: one row for a star however it is named, one for a deep-sky object however it is named, every id unique and address-safe and found again, Japanese where the package has it, and the NGC and IC chunk.
import assert from "node:assert/strict";
import { test } from "node:test";
import { constellation } from "../src/constellations.ts";
import { stars } from "../src/stars.ts";
import { messier } from "../src/deep-sky.ts";
import { deepSky } from "../src/deep-sky-ngc-ic.ts";
import { findName, nameRowById, nameRows, NAME_KINDS, searchNames, slugOf } from "../src/names.ts";
import { findNgcIc, ngcIcRowById, ngcIcRows, searchNgcIc } from "../src/names-ngc-ic.ts";

test("Betelgeuse by name, by Bayer designation spelt three ways, by HR number and by katakana give one row", () => {
  const row = findName("Betelgeuse")!;
  assert.equal(row.id, "betelgeuse");
  for (const text of ["betelgeuse", "alpha Ori", "α Ori", "α Orionis", "alpha Orionis", "Alp Ori", "HR 2061", "hr2061", "HR  2061", "ベテルギウス"]) assert.equal(findName(text), row, text);
  assert.equal(row.kind, "star");
  assert.equal(row.hr, 2061);
  assert.equal(row.constellation, "Ori");
  assert.deepEqual(row.constellationName, { en: "Orion", ja: "オリオン座" });
  assert.equal(row.pick, "S:2061");
  assert.equal(row.name.ja, "ベテルギウス");
  assert.ok(Math.abs(row.rightAscension - 88.79) < 0.01 && Math.abs(row.declination - 7.407) < 0.01);
  assert.ok(row.otherNames.includes("alpha Orionis") && row.otherNames.includes("Alp Ori") && !row.otherNames.includes("Betelgeuse"));
});

test("a star with only a Flamsteed number is found by its number and constellation, spelt out too", () => {
  const star = stars().find((s) => s.name === undefined && /^\d+ \S+$/.test(s.designation ?? ""))!;
  const [number, abbreviation] = star.designation!.split(" ") as [string, string];
  const row = findName(star.designation!)!;
  assert.equal(row.hr, star.hr);
  assert.equal(findName(`${number} ${constellation(abbreviation)!.genitive}`), row);
  assert.ok(row.id.startsWith(`${number}-`), row.id);
  assert.equal(row.constellation, abbreviation);
});

test("M31, NGC 224, Messier 31 and the Andromeda Galaxy give one row, with an id for the address", () => {
  const row = findName("M31")!;
  for (const text of ["m 31", "Messier 31", "NGC 224", "ngc0224", "Andromeda Galaxy", "Andromeda Nebula"]) assert.equal(findName(text), row, text);
  assert.equal(row.id, "m31");
  assert.equal(row.kind, "galaxy");
  assert.equal(row.pick, "D:M31");
  assert.equal(row.constellation, "And");
  assert.equal(row.hr, undefined);
  assert.equal(row.magnitude, 3.4);
  assert.ok(row.designations.includes("NGC 224"));
  assert.equal(nameRowById("m31"), row);
});

test("the HD number of a bright star is a documented gap: the package holds none for the 5,080 (MODULES-1224)", () => {
  assert.equal(findName("HD 39801"), undefined);
  assert.ok(nameRows({ kinds: ["star"] }).every((row) => row.designations.every((text) => !text.startsWith("HD "))));
});

test("every id is address-safe and unique, and every row is found again by its id and its first designation", () => {
  const rows = nameRows();
  assert.equal(rows.length, stars().length + messier().length);
  assert.equal(new Set(rows.map((row) => row.id)).size, rows.length);
  for (const row of rows) {
    assert.match(row.id, /^[a-z0-9]+(-[a-z0-9]+)*$/, row.id);
    assert.equal(nameRowById(row.id), row);
    assert.equal(slugOf(row.id), row.id, `${row.id} round-trips`);
    assert.ok(row.rightAscension >= 0 && row.rightAscension < 360 && Math.abs(row.declination) <= 90);
    assert.ok(Number.isFinite(row.weight));
  }
  assert.equal(nameRowById("not-a-row"), undefined);
});

test("an unnamed star's id comes from its designation, else its HR number, and a clash gets both the catalogue number", () => {
  const rows = nameRows();
  assert.ok(rows.some((row) => /^alpha[0-9]*-[a-z]+$/.test(row.id) && row.name.en.startsWith("α")));
  const bare = nameRows().find((row) => row.id.startsWith("hr-"))!;
  assert.equal(nameRowById(bare.id)?.id, `hr-${bare.hr}`);
  assert.ok(rows.some((row) => /^\d+-[a-z]+$/.test(row.id)));
  assert.equal(slugOf("Boötes"), "bootes");
  assert.equal(slugOf("α1 Centauri"), "alpha1-centauri");
});

test("the rows are brightest and best known first, and Japanese is there where the package has it", () => {
  const rows = nameRows();
  assert.equal(rows[0]!.id, "sirius");
  for (let i = 1; i < rows.length; i += 1) assert.ok(rows[i - 1]!.weight >= rows[i]!.weight);
  const named = rows.filter((row) => row.kind === "star" && stars().find((s) => s.hr === row.hr)?.nameJa !== undefined);
  assert.equal(named.length, stars().filter((s) => s.nameJa !== undefined).length);
  assert.ok(named.every((row) => row.name.ja !== undefined && /[゠-ヿ]/u.test(row.name.ja)));
  assert.equal(findName("シリウス")?.id, "sirius");
  // a star with only a Bayer letter has the usual Japanese form
  assert.ok(rows.some((row) => row.name.ja === "ケンタウルス座γ星" || row.name.ja?.endsWith("座γ星") === true));
  assert.ok(rows.every((row) => row.constellationName === undefined || row.constellationName.ja.endsWith("座")));
});

test("the kinds are the five, and each deep-sky type lands in one", () => {
  assert.deepEqual([...NAME_KINDS], ["star", "cluster", "nebula", "galaxy", "other"]);
  assert.equal(nameRows({ kinds: ["star"] }).length, stars().length);
  assert.equal(findName("M13")?.kind, "cluster");
  assert.equal(findName("M42")?.kind, "nebula");
  assert.equal(findName("M1")?.kind, "nebula");
  assert.equal(findName("M40")?.kind, "other");
  assert.equal(nameRows({ kinds: ["star", "cluster", "nebula", "galaxy", "other"] }).length, nameRows().length);
});

test("a text two rows share finds none, but the search lists them best first", () => {
  assert.equal(findName("Alpha Centauri"), undefined);
  const found = searchNames("alpha centauri");
  assert.ok(found.length >= 1);
  assert.equal(searchNames("sirius")[0]!.id, "sirius");
  assert.equal(searchNames("andromeda", { limit: 2 }).length, 2);
  assert.deepEqual(searchNames("", {}), []);
  assert.ok(searchNames("orion", { kinds: ["nebula"] }).every((row) => row.kind === "nebula"));
  assert.equal(searchNames("m31", { limit: 1 })[0]!.id, "m31");
});

test("the NGC and IC chunk holds the other objects: unique ids, found by number and by name, none a Messier object", () => {
  const rows = ngcIcRows();
  assert.equal(rows.length, deepSky().length - messier().length);
  assert.equal(new Set(rows.map((row) => row.id)).size, rows.length);
  for (const row of rows) assert.match(row.id, /^(ngc|ic)[0-9]+[a-z]?$/, row.id);
  assert.equal(findNgcIc("NGC 7000"), ngcIcRowById("ngc7000"));
  assert.equal(findNgcIc("North America Nebula")?.id, "ngc7000");
  assert.equal(findNgcIc("IC 434")?.id, "ic434");
  assert.equal(findNgcIc("M31"), undefined);
  assert.ok(searchNgcIc("horsehead").length > 0);
  assert.equal(ngcIcRowById("ngc7000")?.pick, "D:NGC 7000");
});
