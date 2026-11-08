// The 88 constellations: the IAU's list (abbreviations with their real capitals, Latin names and genitives, English names) and the National Astronomical Observatory of Japan's Japanese names.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { gzipSync } from "node:zlib";
import { constellation, constellations, starsIn } from "../src/constellations.ts";
import { stars } from "../src/index.ts";

const all = constellations();

test("there are exactly 88, alphabetical by Latin name, and each is frozen", () => {
  assert.equal(all.length, 88);
  const fold = (s: string): string => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
  const names = all.map((c) => fold(c.name));
  assert.deepEqual(names, [...names].sort());
  assert.equal(all[0]!.name, "Andromeda");
  assert.equal(all.at(-1)!.name, "Vulpecula");
  assert.ok(all.every((c) => Object.isFrozen(c)));
  all.pop();
  assert.equal(constellations().length, 88, "a fresh array each call");
});

test("abbreviations, Latin names, English names and Japanese names are each unique, and every other name is spelled the way its kind is", () => {
  for (const pick of [(c: (typeof all)[number]) => c.abbreviation, (c: (typeof all)[number]) => c.name, (c: (typeof all)[number]) => c.genitive, (c: (typeof all)[number]) => c.japanese, (c: (typeof all)[number]) => c.reading]) {
    const values = constellations().map(pick);
    assert.equal(new Set(values).size, 88);
  }
  // The IAU gives both Circinus and Pyxis the English name "the Compass", and it is the one English name shared.
  const english = constellations().map((c) => c.english);
  assert.deepEqual(english.filter((e, i) => english.indexOf(e) !== i), ["Compass"]);
  for (const c of constellations()) {
    assert.match(c.abbreviation, /^[A-Z][A-Za-z]{2}$/, c.name);
    assert.match(c.japanese, /^[ぁ-ゖァ-ヺー]+座$/, c.name);
    assert.match(c.reading, /^[ぁ-ゖー]+ざ$/, c.name);
    assert.equal(c.reading.length, c.japanese.length, c.name);
    assert.ok(c.english.length > 0 && !c.english.startsWith("the "), c.name);
  }
});

test("the abbreviations with capitals inside are the IAU's own, and the irregular ones are kept", () => {
  const withCapital = constellations().filter((c) => /[A-Z]/.test(c.abbreviation.slice(1))).map((c) => c.abbreviation);
  assert.deepEqual(withCapital, ["CVn", "CMa", "CMi", "CrA", "CrB", "LMi", "PsA", "TrA", "UMa", "UMi"].sort((a, b) => abbreviationOrder(a) - abbreviationOrder(b)));
  assert.equal(constellation("Hydrus")?.abbreviation, "Hyi");
  assert.equal(constellation("Sagitta")?.abbreviation, "Sge");
  assert.equal(constellation("Serpens")?.abbreviation, "Ser");
});

function abbreviationOrder(abbreviation: string): number {
  return all.findIndex((c) => c.abbreviation === abbreviation);
}

test("every constellation the 5,080 bright stars name is one of the 88", () => {
  const known = new Set(constellations().map((c) => c.abbreviation));
  const used = new Set<string>();
  for (const star of stars()) if (star.constellation !== undefined) used.add(star.constellation);
  assert.ok(used.size >= 80, `only ${used.size} used`);
  for (const abbreviation of used) assert.ok(known.has(abbreviation), `${abbreviation} is not an IAU constellation`);
});

test("known answers agree across every kind of name", () => {
  const known: Array<[string, string, string, string, string, string]> = [
    ["CMa", "Canis Major", "Canis Majoris", "Great Dog", "おおいぬ座", "おおいぬざ"],
    ["Ori", "Orion", "Orionis", "Hunter", "オリオン座", "おりおんざ"],
    ["UMa", "Ursa Major", "Ursae Majoris", "Great Bear", "おおぐま座", "おおぐまざ"],
    ["CVn", "Canes Venatici", "Canum Venaticorum", "Hunting Dogs", "りょうけん座", "りょうけんざ"],
    ["Men", "Mensa", "Mensae", "Table Mountain", "テーブルさん座", "てーぶるさんざ"],
    ["Boo", "Boötes", "Boötis", "Herdsman", "うしかい座", "うしかいざ"],
  ];
  for (const [abbreviation, name, genitive, english, japanese, reading] of known) {
    const c = constellation(abbreviation)!;
    assert.deepEqual({ ...c }, { abbreviation, name, genitive, english, japanese, reading });
    for (const text of [abbreviation, name, genitive, english, japanese, reading]) assert.equal(constellation(text), c, text);
  }
});

test("lookups ignore case and spacing, the accent on Boötes, the Japanese 座 and katakana versus hiragana", () => {
  const cma = constellation("CMa");
  for (const text of ["cma", "CMA", "  canis   major ", "CANIS MAJORIS", "great dog", "おおいぬ", "おおいぬ座", "オオイヌ"]) assert.equal(constellation(text), cma, text);
  assert.equal(constellation("Bootes"), constellation("Boötes"));
  assert.equal(constellation("bootes")?.abbreviation, "Boo");
  assert.equal(constellation("おりおん座"), constellation("オリオン座"));
  assert.equal(constellation("オリオン"), constellation("Ori"));
});

test("every name of every constellation finds exactly that constellation", () => {
  for (const c of constellations()) {
    const texts = [c.abbreviation, c.name, c.genitive, c.japanese, c.reading, ...(c.english === "Compass" ? [] : [c.english])];
    for (const text of texts) assert.equal(constellation(text)?.abbreviation, c.abbreviation, `${text} for ${c.name}`);
  }
});

test("a text that names two constellations finds neither", () => {
  assert.equal(constellation("Compass"), undefined);
  assert.equal(constellation("Circinus")?.english, "Compass");
  assert.equal(constellation("Pyxis")?.english, "Compass");
});

test("text that is no constellation gives undefined, and a non-string throws", () => {
  assert.equal(constellation(""), undefined);
  assert.equal(constellation("Argo Navis"), undefined);
  assert.equal(constellation("Xyz"), undefined);
  assert.throws(() => constellation(undefined as unknown as string), { name: "TypeError", message: /text must be a string/ });
  assert.throws(() => constellation(5 as unknown as string), TypeError);
  assert.throws(() => starsIn(null as unknown as string), TypeError);
  assert.throws(() => starsIn("Argo"), { name: "RangeError", message: /not one of the 88/ });
  assert.throws(() => starsIn(""), RangeError);
});

test("starsIn lists the bright stars of a constellation, brightest first", () => {
  const orion = starsIn("Ori");
  const names = orion.map((s) => s.name);
  assert.ok(names.includes("Betelgeuse") && names.includes("Rigel"));
  assert.ok(orion.every((s) => s.constellation === "Ori"));
  for (let i = 1; i < orion.length; i += 1) assert.ok(orion[i - 1]!.magnitude <= orion[i]!.magnitude);
  assert.deepEqual(starsIn("Orion"), orion);
  assert.deepEqual(starsIn("オリオン座"), orion);
  assert.ok(starsIn("CMa").some((s) => s.name === "Sirius"));
  assert.ok(starsIn("UMa").some((s) => s.name === "Dubhe"));
  let total = 0;
  for (const c of constellations()) total += starsIn(c.abbreviation).length;
  assert.equal(total, stars().filter((s) => s.constellation !== undefined).length);
});

test("the table stays small: under 3,000 bytes gzipped", () => {
  const bytes = gzipSync(readFileSync(new URL("../src/data/constellations.ts", import.meta.url))).byteLength;
  assert.ok(bytes < 3000, `the constellation table is ${bytes} bytes gzipped`);
});
