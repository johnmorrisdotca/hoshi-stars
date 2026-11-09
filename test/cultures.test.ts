// The sky cultures: every member star exists, every figure joins real stars, each culture has the count it should, the names are found in every language, and the main tiers do not carry the culture data.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { gzipSync } from "node:zlib";
import { constellation, constellations, starsIn } from "../src/constellations.ts";
import type { Culture } from "../src/culture.ts";
import { chinese } from "../src/cultures/chinese.ts";
import { japanese } from "../src/cultures/japanese.ts";
import { western } from "../src/cultures/western.ts";
import { CONSTELLATION_NAMES_ZH } from "../src/data/constellation-names-zh.ts";
import { CHINESE_ROWS } from "../src/data/culture-chinese.ts";
import { JAPANESE_ROWS } from "../src/data/culture-japanese.ts";
import { WESTERN_ASTERISM_ROWS } from "../src/data/culture-western.ts";
import { figureOf, figures } from "../src/lines.ts";
import { starByHr } from "../src/stars.ts";

const cultures: ReadonlyArray<Culture> = [western, japanese, chinese];

function separation(a: { rightAscension: number; declination: number }, b: { rightAscension: number; declination: number }): number {
  const rad = Math.PI / 180;
  const c = Math.sin(a.declination * rad) * Math.sin(b.declination * rad) + Math.cos(a.declination * rad) * Math.cos(b.declination * rad) * Math.cos((a.rightAscension - b.rightAscension) * rad);
  return Math.acos(Math.max(-1, Math.min(1, c))) / rad;
}

test("each culture has the figures it should", () => {
  assert.equal(western.asterisms().length, 88 + WESTERN_ASTERISM_ROWS.split("\n").length);
  assert.equal(western.asterisms().filter((a) => a.kind === "constellation").length, 88);
  assert.equal(japanese.asterisms().length, 88 + JAPANESE_ROWS.split("\n").length);
  assert.equal(japanese.asterisms().filter((a) => a.kind === "constellation").length, 88);
  assert.equal(chinese.asterisms().length, CHINESE_ROWS.split("\n").length);
  assert.equal(chinese.asterisms().length, 238);
  assert.equal(chinese.asterisms().filter((a) => a.kind === "mansion").length, 28);
  for (const group of ["azure-dragon", "black-tortoise", "white-tiger", "vermilion-bird"]) assert.equal(chinese.asterisms().filter((a) => a.group === group).length, 7, group);
  assert.equal(figures(western).length, western.asterisms().length);
});

test("the 88 constellations are the western and Japanese cultures' first figures, in the order of constellations()", () => {
  for (const culture of [western, japanese]) assert.deepEqual(culture.asterisms().slice(0, 88).map((a) => a.id), constellations().map((c) => c.abbreviation));
  assert.equal(japanese.asterisms()[0]!.name, "アンドロメダ座");
  assert.equal(western.asterisms()[0]!.name, "Andromeda");
});

test("every member star of every figure is a star of the catalogue", () => {
  for (const culture of cultures) {
    for (const a of culture.asterisms()) {
      assert.ok(a.chains.length >= 1, a.id);
      for (const hr of a.chains.flat()) assert.ok(starByHr(hr), `${culture.id} ${a.id}: HR ${hr} is not a catalogue star`);
    }
  }
});

test("every figure joins real stars: no line to itself or twice, an asterism's lines make one piece, and a single star has none", () => {
  for (const culture of cultures) {
    for (const f of figures(culture)) {
      const where = `${culture.id} ${f.asterism.id}`;
      assert.ok(f.stars.length >= 1, where);
      assert.equal(f.segments.length === 0, f.stars.length === 1, where);
      const seen = new Set<string>();
      const parent = new Map(f.stars.map((s) => [s.hr, s.hr]));
      const find = (x: number): number => (parent.get(x) === x ? x : find(parent.get(x)!));
      for (const [a, b] of f.segments) {
        assert.notEqual(a.hr, b.hr, `${where} joins HR ${a.hr} to itself`);
        assert.ok(parent.has(a.hr) && parent.has(b.hr), where);
        const key = a.hr < b.hr ? `${a.hr}-${b.hr}` : `${b.hr}-${a.hr}`;
        assert.ok(!seen.has(key), `${where} draws ${key} twice`);
        seen.add(key);
        parent.set(find(a.hr), find(b.hr));
      }
      if (f.asterism.kind !== "constellation") assert.equal(new Set(f.stars.map((s) => find(s.hr))).size, 1, `${where} is not one piece`);
    }
  }
});

test("a Chinese asterism's lines are a tree: as many lines as stars less one", () => {
  for (const f of figures(chinese)) assert.equal(f.segments.length, f.stars.length - 1, f.asterism.id);
});

test("the stars of a Chinese asterism lie together on the sky, and `missing` is the count of stars we cannot hold", () => {
  for (const f of figures(chinese)) {
    let far = 0;
    for (const a of f.stars) for (const b of f.stars) far = Math.max(far, separation(a, b));
    assert.ok(far < 65, `${f.asterism.id} spreads ${far.toFixed(0)} degrees`);
    assert.ok(Number.isInteger(f.asterism.missing) && f.asterism.missing >= 0, f.asterism.id);
  }
  assert.equal(chinese.find("北斗")!.missing, 0);
  assert.ok(chinese.find("羽林軍")!.missing >= 30, "the Palace Guard has about 45 stars");
});

test("the ids of a culture are ASCII, and none is used twice", () => {
  for (const culture of cultures) {
    const ids = culture.asterisms().map((a) => a.id);
    assert.equal(new Set(ids).size, ids.length, culture.id);
    for (const id of ids) assert.match(id, /^[A-Za-z0-9-]+$/, `${culture.id} ${id}`);
  }
});

test("the 88 constellations have Chinese names in Simplified and Traditional characters, with pinyin", () => {
  const rows = CONSTELLATION_NAMES_ZH.split("\n");
  assert.equal(rows.length, 88);
  assert.deepEqual(rows.map((r) => r.split("|")[0]), constellations().map((c) => c.abbreviation));
  for (const row of rows) {
    const [abbreviation, hant, hans, pinyin] = row.split("|") as [string, string, string, string];
    assert.match(hant, /座$/, abbreviation);
    assert.match(hans, /座$/, abbreviation);
    assert.match(pinyin, /zuò$/, abbreviation);
    assert.equal(pinyin.split(" ").length >= 2, true, abbreviation);
  }
  const orion = western.find("Ori")!;
  assert.equal(orion.names["zh-Hant"], "獵戶座");
  assert.equal(orion.names["zh-Hans"], "猎户座");
  assert.equal(orion.readings.zh, "liè hù zuò");
  assert.equal(western.find("Aqr")!.names["zh-Hans"], "宝瓶座");
  assert.equal(western.find("Cha")!.names["zh-Hans"], "蝘蜓座");
});

test("a figure is found by every name it has, in every language, and by its reading", () => {
  assert.equal(constellation("天龍座", western)?.id, "Dra");
  assert.equal(constellation("天龙座", western)?.id, "Dra");
  assert.equal(constellation("tiān lóng zuò", western)?.id, "Dra");
  assert.equal(constellation("Tian Long Zuo", western)?.id, "Dra");
  assert.equal(constellation("りゅう座", western)?.id, "Dra");
  assert.equal(constellation("Draco", western)?.id, "Dra");
  assert.equal(constellation("Dragon", western)?.id, "Dra");
  assert.equal(constellation("summer triangle", western)?.id, "summer-triangle");
  assert.equal(constellation("夏の大三角", western)?.id, "summer-triangle");
  assert.equal(constellation("すばる", japanese)?.id, "subaru");
  assert.equal(constellation("スバル", japanese)?.id, "subaru");
  assert.equal(constellation("六連星", japanese)?.id, "subaru");
  assert.equal(constellation("Subaru", japanese)?.id, "subaru");
  assert.equal(constellation("北斗七星", japanese)?.id, "hokuto-shichisei");
  assert.equal(constellation("つづみぼし", japanese)?.id, "tsuzumi-boshi");
  assert.equal(constellation("オリオン座", japanese)?.id, "Ori");
  assert.equal(constellation("北斗", chinese)?.readings.zh, "běi dǒu");
  assert.equal(constellation("北斗", chinese)?.id, constellation("beidou", chinese)?.id);
  assert.equal(constellation("角宿", chinese)?.names.en, "Horn");
  assert.equal(constellation("jiǎo xiù", chinese)?.name, "角宿");
  assert.equal(constellation("Horn", chinese)?.group, "azure-dragon");
  assert.equal(constellation("婁宿", chinese)?.names["zh-Hans"], "娄宿");
  assert.equal(constellation("娄宿", chinese)?.names["zh-Hant"], "婁宿");
  assert.equal(constellation("nothing like it", chinese), undefined);
  assert.equal(constellation("天田", chinese), undefined, "a name used by two asterisms finds neither");
  assert.equal(figureOf("天龙座", western).asterism.id, "Dra");
  assert.equal(starsIn("Subaru", japanese).length, 6);
  assert.throws(() => figureOf("nothing", chinese), RangeError);
  assert.throws(() => starsIn("nothing", chinese), RangeError);
  assert.throws(() => constellation(1 as unknown as string, chinese), TypeError);
});

test("the Western asterisms are made of the stars they are named for", () => {
  const designations = (text: string): Array<string | undefined> => starsIn(text, western).map((s) => s.designation).sort();
  assert.deepEqual(designations("Summer Triangle"), ["α Aql", "α Cyg", "α Lyr"]);
  assert.deepEqual(designations("Winter Triangle"), ["α CMa", "α CMi", "α Ori"]);
  assert.deepEqual(designations("Great Square of Pegasus"), ["α And", "α Peg", "β Peg", "γ Peg"]);
  assert.deepEqual(designations("Big Dipper"), ["α UMa", "β UMa", "γ UMa", "δ UMa", "ε UMa", "ζ UMa", "η UMa"]);
  assert.deepEqual(designations("Orion's Belt"), ["δ Ori", "ε Ori", "ζ Ori"]);
  assert.deepEqual(designations("Spring Triangle"), ["α Boo", "α Vir", "β Leo"]);
  assert.equal(figureOf("Northern Cross", western).stars.length, 5);
  for (const a of western.asterisms().filter((one) => one.kind === "asterism")) assert.ok(a.about !== "", a.id);
});

test("the Japanese figures are the stars the old names are for", () => {
  const stars = (text: string): string[] => starsIn(text, japanese).map((s) => s.designation ?? "").sort();
  assert.ok(starsIn("昴", japanese).every((s) => s.constellation === "Tau"));
  assert.deepEqual(stars("三つ星"), ["δ Ori", "ε Ori", "ζ Ori"]);
  assert.deepEqual(stars("彦星"), ["α Aql"]);
  assert.deepEqual(stars("織姫"), ["α Lyr"]);
  assert.deepEqual(stars("真珠星"), ["α Vir"]);
  assert.deepEqual(stars("麦星"), ["α Boo"]);
  assert.deepEqual(stars("一つ星"), ["α CMa"]);
  assert.deepEqual(stars("北極星"), ["α UMi"]);
  assert.deepEqual(stars("源氏星"), ["β Ori"]);
  assert.deepEqual(stars("平家星"), ["α Ori"]);
  assert.deepEqual(stars("鼓星"), ["α Ori", "β Ori", "γ Ori", "δ Ori", "ε Ori", "ζ Ori", "κ Ori"]);
  assert.deepEqual(stars("山形星"), ["α Cas", "β Cas", "γ Cas", "δ Cas", "ε Cas"]);
  assert.equal(japanese.find("昴")!.readings.ja, "すばる");
  assert.equal(japanese.find("北斗七星")!.aka.includes("四三の星"), true);
  for (const a of japanese.asterisms().filter((one) => one.kind === "asterism")) {
    assert.match(a.readings.ja!, /^[ぁ-ゟー]+$/, `${a.id} reading is hiragana`);
    assert.ok(a.names.en && /^[A-Za-z' -]+$/.test(a.names.en), `${a.id} has a romaji name`);
  }
});

test("the Chinese mansions are where the tradition puts them, and their determinative stars are stars of them", () => {
  const spica = starByHr(5056)!;
  assert.ok(figureOf("角宿", chinese).stars.includes(spica), "角宿一 is Spica");
  assert.ok(figureOf("心宿", chinese).stars.some((s) => s.name === "Antares"));
  assert.ok(figureOf("昴宿", chinese).stars.some((s) => s.name === "Alcyone"));
  assert.ok(figureOf("斗宿", chinese).stars.every((s) => s.constellation === "Sgr"));
  assert.ok(figureOf("織女", chinese).stars.some((s) => s.name === "Vega"));
  assert.ok(figureOf("河鼓", chinese).stars.some((s) => s.name === "Altair"));
  assert.equal(figureOf("北斗", chinese).stars.length, 7);
  assert.equal(chinese.find("天狼")!.chains.flat()[0], 2491);
  assert.equal(chinese.find("老人")!.chains.flat()[0], 2326);
});

test("every asterism name is in its own writing: Traditional and Simplified characters, no rare characters, and pinyin with tone marks", () => {
  for (const a of chinese.asterisms()) {
    assert.ok(a.names["zh-Hant"] && a.names["zh-Hans"], a.id);
    for (const ch of a.name) assert.ok(ch.codePointAt(0)! <= 0xffff, `${a.id} has a rare character`);
    assert.match(a.readings.zh!, /^[a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü ]+$/, a.id);
    assert.equal([...a.name].length, a.readings.zh!.split(" ").length, `${a.id} has one syllable a character`);
  }
});

test("the main tiers do not carry the culture data, and a culture's data stays small", () => {
  for (const file of ["src/constellations.ts", "src/lines.ts", "src/stars.ts", "src/index.ts"]) assert.doesNotMatch(readFileSync(file, "utf8"), /^import .*(cultures\/|data\/culture|constellation-names-zh)/m, file);
  assert.ok(gzipSync(CHINESE_ROWS).length < 9_000, `Chinese rows are ${gzipSync(CHINESE_ROWS).length} bytes gzipped`);
  assert.ok(gzipSync(JAPANESE_ROWS + WESTERN_ASTERISM_ROWS + CONSTELLATION_NAMES_ZH).length < 4_000);
});

test("without a culture nothing changes: 88 constellations and 88 figures", () => {
  assert.equal(constellations().length, 88);
  assert.equal(figures().length, 88);
  assert.equal(constellation("Ori")?.english, "Hunter");
  assert.equal(figureOf("Ori").constellation.abbreviation, "Ori");
  assert.equal(constellation("天龍座"), undefined, "Chinese names are looked up through a culture");
});
