// What the quiz asks about, for each sky: the 88, the Japanese sky's figures, the Chinese mansions with enough stars; names are the data's own, and the wrong names for a figure with no borders are the ones nearest it.
import assert from "node:assert/strict";
import { test } from "node:test";
import { distractors, nearestTies } from "../demo/quiz-pick.ts";
import { chineseFigureLevels, figureLevelOf, itemNamed, itemsFor, levelIdsFor, mansionIdsOf, otherMansions, TRANCHE_SIZE } from "../demo/quiz-items.ts";
import { FIELD_RADIUS, marksSvg, middleOf } from "../demo/quiz-star.ts";
import { quizChoiceOf } from "../demo/quiz-code.ts";
import { chinese } from "../src/cultures/chinese.ts";
import { figures } from "../src/lines.ts";

test("the Western sky is the 88, each with stars, a middle and a name in two languages", () => {
  const all = itemsFor("western");
  assert.equal(all.length, 88);
  const orion = all.find((item) => item.id === "Ori")!;
  assert.equal(orion.label("en"), "Orion");
  assert.match(orion.label("ja"), /座$/);
  assert.ok(orion.stars.length >= 5 && orion.light > 0);
});

test("the Japanese sky: only figures with three stars and two lines, named in Japanese and in English, the old star patterns with their readings", () => {
  const all = itemsFor("japanese");
  assert.ok(all.length >= 80 && all.length <= 106, String(all.length));
  assert.ok(all.every((item) => item.stars.length >= 3));
  const subaru = all.find((item) => item.id === "subaru")!;
  assert.equal(subaru.label("ja"), "昴 (すばる)");
  assert.equal(subaru.label("en"), "Subaru");
  assert.equal(new Set(all.map((item) => item.label("ja"))).size, all.length, "no two with the same name");
  assert.equal(new Set(all.map((item) => item.label("en"))).size, all.length);
});

test("the Chinese sky's mansions come first, in the data's order: the 21 with at least three stars, named in characters for Japanese and with the English name or the pinyin for English", () => {
  const all = itemsFor("chinese");
  const mansions = chinese.asterisms().filter((a) => a.kind === "mansion").map((a) => a.id);
  const first = all.slice(0, 21);
  assert.equal(all.filter((item) => mansionIdsOf().has(item.id) && item.ask === "figure").length, 21);
  assert.ok(first.every((item) => mansions.includes(item.id) && item.stars.length >= 3), "the first 21 are mansions, so a q= of an old address names the same one");
  for (const item of first) {
    const a = chinese.asterisms().find((x) => x.id === item.id)!;
    assert.equal(item.label("ja"), a.name);
    assert.equal(item.label("en"), `${a.name} (${a.names.en ?? a.readings.zh})`);
  }
  assert.ok(all.find((item) => item.id === "kui2-xiu4"), "奎宿 has 14 stars");
});

test("the Chinese sky also asks the star officials: every figure has three stars and two lines, and no two have one name", () => {
  const all = itemsFor("chinese");
  assert.equal(all.length, 146, "21 mansions, 118 star officials and the 7 small mansions, last");
  assert.deepEqual(all.slice(-7).map((item) => item.ask), Array(7).fill("star"));
  const lines = new Map(figures(chinese).map((f) => [f.asterism.id, f.segments.length] as const));
  for (const item of all.filter((one) => one.ask === "figure")) {
    assert.ok(item.stars.length >= 3, `${item.id}: three stars`);
    assert.ok((lines.get(item.id) ?? 0) >= 2, `${item.id}: two lines`);
  }
  assert.equal(new Set(all.map((item) => item.label("en"))).size, all.length, "no two with one English label");
  assert.equal(new Set(all.map((item) => item.label("ja"))).size, all.length, "no two with one name in characters");
  assert.equal(new Set(all.map((item) => item.id)).size, all.length);
  assert.equal(itemNamed("chinese", "五諸侯"), undefined, "two asterisms of one name are neither asked");
});

test("the levels of star officials: the Purple Forbidden 14 and the Heavenly Market 8 where Wikidata says so, the rest in tranches of about 30, brightest first, and no figure in two levels", () => {
  const all = itemsFor("chinese");
  const levels = chineseFigureLevels();
  const by = (id: string) => levels.find((level) => level.id === id)!;
  assert.equal(by("purple-forbidden").ids.length, 14);
  assert.equal(by("heavenly-market").ids.length, 8);
  assert.ok(by("purple-forbidden").ids.every((id) => all.find((item) => item.id === id)!.part === "purple-forbidden"));
  assert.ok(by("heavenly-market").ids.every((id) => all.find((item) => item.id === id)!.part === "heavenly-market"));
  const tranches = levels.filter((level) => level.kind === "officials");
  assert.deepEqual(tranches.map((level) => level.id), ["officials-1", "officials-2", "officials-3", "officials-4"]);
  assert.deepEqual(tranches.map((level) => level.ids.length), [24, 24, 24, 24]);
  assert.ok(tranches.every((level) => level.ids.length <= TRANCHE_SIZE));
  // the Supreme Palace's two (too few for a level) and the one that is part of a mansion are with the officials
  const rest = new Set(tranches.flatMap((level) => level.ids));
  for (const id of ["chang2-chen2", "lang2-wei4", "jiu3-you2"]) assert.ok(rest.has(id), id);
  // each tranche is dimmer than the one before
  const light = (id: string) => all.find((item) => item.id === id)!.light;
  for (let i = 1; i < tranches.length; i += 1) assert.ok(Math.min(...tranches[i - 1]!.ids.map(light)) >= Math.max(...tranches[i]!.ids.map(light)), `tranche ${i} is brighter than ${i + 1}`);
  // every star official is in one level, none in two, and none is a mansion
  const placed = levels.flatMap((level) => level.ids);
  assert.equal(new Set(placed).size, placed.length, "no figure in two levels");
  assert.deepEqual([...placed].filter((id) => !by("small-mansions").ids.includes(id)).sort(), all.filter((item) => !mansionIdsOf().has(item.id)).map((item) => item.id).sort(), "the levels cover all of the star officials, and the small mansions, and nothing else");
  assert.equal(placed.length, 118 + 7);
  // the wrong names of a question are of its own level, the nearest first
  const ties = nearestTies(all, 4);
  for (const level of levels) for (const id of level.ids) {
    const got = distractors(id, level.ids, 5, Math.random, ties);
    assert.equal(got.length, 5, `${level.id}: ${id}`);
    assert.ok(got.every((one) => level.ids.includes(one) && one !== id));
  }
});

test("the level ids: the old ones still resolve, and the Chinese sky adds the new", () => {
  assert.deepEqual(levelIdsFor("western"), ["12", "30", "88"]);
  assert.deepEqual(levelIdsFor("japanese"), ["12", "30", "88"]);
  assert.deepEqual(levelIdsFor("chinese"), ["12", "88", "small-mansions", "purple-forbidden", "heavenly-market", "officials-1", "officials-2", "officials-3", "officials-4"]);
  // `level=88` of an old Chinese address is the mansions ("All 21"): not a set of star officials
  assert.equal(figureLevelOf("chinese", "88"), undefined);
  assert.equal(figureLevelOf("chinese", "12"), undefined);
  assert.equal(figureLevelOf("japanese", "purple-forbidden"), undefined);
  for (const level of ["12", "30", "88", "purple-forbidden", "heavenly-market", "officials-2"]) assert.equal(quizChoiceOf(new URLSearchParams(`culture=chinese&level=${level}`)).level, level);
  assert.equal(quizChoiceOf(new URLSearchParams("level=officials-x")).level, "12", "a level that is not one is the default");
});

test("a hand-written name finds its item, in its own sky only", () => {
  assert.equal(itemNamed("western", "Orion"), "Ori");
  assert.equal(itemNamed("western", "Ori"), "Ori");
  assert.equal(itemNamed("japanese", "昴"), "subaru");
  assert.equal(itemNamed("chinese", "奎宿"), "kui2-xiu4");
  assert.equal(itemNamed("chinese", "Orion"), undefined);
  assert.equal(itemNamed("chinese", "華蓋") !== undefined, true, "a star official of the Purple Forbidden Enclosure is asked now");
});

test("for a sky with no borders the wrong names are the nearest in the sky first, then of the same group", () => {
  const all = itemsFor("chinese");
  const ties = nearestTies(all, 4);
  for (const item of all) {
    const near = ties.near(item.id);
    assert.equal(near.size, 4);
    assert.ok(!near.has(item.id));
    const got = distractors(item.id, all.map((x) => x.id), 5, Math.random, ties);
    assert.equal(got.length, 5);
    assert.equal(new Set(got).size, 5);
    assert.ok(!got.includes(item.id));
    assert.equal(got.filter((one) => near.has(one)).length >= 3, true, `${item.id}: three of its four nearest lead`);
  }
});

const SMALL = ["jiao3-xiu4", "di1-xiu4", "xu1-xiu4", "shi4-xiu4", "bi4-xiu4", "lou2-xiu4", "zi1-xiu4"];

test("the 7 small mansions are asked the other way round: which mansion holds the ringed star", () => {
  const all = itemsFor("chinese");
  const small = all.filter((item) => item.ask === "star");
  assert.deepEqual(small.map((item) => item.id).sort(), [...SMALL].sort());
  for (const item of small) {
    assert.ok(item.stars.length >= 1 && item.stars.length <= 2, `${item.id}: one or two stars held`);
    assert.ok(mansionIdsOf().has(item.id));
    assert.equal(item.label("ja"), chinese.asterisms().find((a) => a.id === item.id)!.name, "the name in characters alone");
  }
  assert.deepEqual([...chineseFigureLevels().find((level) => level.id === "small-mansions")!.ids].sort(), [...SMALL].sort());
  // the usual levels do not ask them, and an old address (`q=` up to the officials) is as it was
  assert.ok(all.slice(0, 139).every((item) => item.ask === "figure"));
  assert.equal(itemNamed("chinese", "氐宿"), "di1-xiu4", "a hand-written name asks it now");
});

test("the ringed stars are exactly the mansion's held stars, the neighbours' are faint and never ringed", () => {
  const small = itemsFor("chinese").filter((item) => item.ask === "star");
  for (const item of small) {
    const svg = marksSvg(item.stars, otherMansions(item.id), () => [50, 50], 100, 100, true);
    const ringed = [...svg.matchAll(/data-ring="(\d+)"/g)].map((m) => Number(m[1]));
    assert.deepEqual(ringed.sort(), item.stars.map((s) => s.hr).sort(), `${item.id}: the rings`);
    const near = [...svg.matchAll(/data-near="(\d+)"/g)].map((m) => Number(m[1]));
    assert.ok(near.length > 10 && near.every((hr) => !ringed.includes(hr)), `${item.id}: faint neighbours, none of them held`);
    assert.doesNotMatch(svg, /determinative|<text/);
    assert.doesNotMatch(marksSvg(item.stars, otherMansions(item.id), () => [50, 50], 100, 100, false), /<line/, "no neighbour lines on the plain style");
  }
  // a star off the chart is not ringed
  assert.doesNotMatch(marksSvg(small[0]!.stars, [], () => undefined, 100, 100, true), /data-ring/);
});

test("a small mansion's question has six different names, itself and five others from all 28 mansions, the nearest first", () => {
  const all = itemsFor("chinese");
  const mansions = all.filter((item) => mansionIdsOf().has(item.id));
  const ties = nearestTies(mansions, 4);
  const pool = mansions.map((item) => item.id);
  assert.equal(pool.length, 28);
  for (const id of SMALL) {
    const wrong = distractors(id, pool, 5, Math.random, ties);
    const six = [id, ...wrong];
    assert.equal(new Set(six).size, 6, id);
    assert.ok(wrong.every((one) => pool.includes(one)));
    assert.ok([...ties.near(id)].filter((one) => wrong.includes(one)).length >= 3, `${id}: its neighbours lead`);
    assert.equal(new Set(six.map((one) => all.find((item) => item.id === one)!.label("en"))).size, 6);
  }
});

test("the field is fixed, the middle of the held stars is on the sphere's shortest side, and 0 and 360 degrees do not split it", () => {
  assert.equal(FIELD_RADIUS, 20);
  const across = middleOf([{ rightAscension: 359, declination: 10 }, { rightAscension: 1, declination: 10 }]);
  assert.ok(Math.abs(across.rightAscension) < 1e-9 || Math.abs(across.rightAscension - 360) < 1e-9);
  assert.ok(Math.abs(across.declination - 10) < 0.1);
  const one = middleOf([{ rightAscension: 200.5, declination: -11.2 }]);
  assert.ok(Math.abs(one.rightAscension - 200.5) < 1e-9 && Math.abs(one.declination + 11.2) < 1e-9);
});
