// What the quiz asks about, for each sky: the 88, the Japanese sky's figures, the Chinese mansions with enough stars; names are the data's own, and the wrong names for a figure with no borders are the ones nearest it.
import assert from "node:assert/strict";
import { test } from "node:test";
import { distractors, nearestTies } from "../demo/quiz-pick.ts";
import { itemNamed, itemsFor } from "../demo/quiz-items.ts";
import { chinese } from "../src/cultures/chinese.ts";

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

test("the Chinese level is the mansions with at least three stars: characters for a reader of Japanese, characters with the English name or the pinyin for English", () => {
  const all = itemsFor("chinese");
  const mansions = chinese.asterisms().filter((a) => a.kind === "mansion").map((a) => a.id);
  assert.ok(all.length >= 15 && all.length <= 28, String(all.length));
  assert.ok(all.every((item) => mansions.includes(item.id) && item.stars.length >= 3));
  for (const item of all) {
    const a = chinese.asterisms().find((x) => x.id === item.id)!;
    assert.equal(item.label("ja"), a.name);
    assert.equal(item.label("en"), `${a.name} (${a.names.en ?? a.readings.zh})`);
  }
  assert.equal(new Set(all.map((item) => item.label("en"))).size, all.length);
  assert.ok(all.find((item) => item.id === "kui2-xiu4"), "奎宿 has 14 stars");
});

test("a hand-written name finds its item, in its own sky only", () => {
  assert.equal(itemNamed("western", "Orion"), "Ori");
  assert.equal(itemNamed("western", "Ori"), "Ori");
  assert.equal(itemNamed("japanese", "昴"), "subaru");
  assert.equal(itemNamed("chinese", "奎宿"), "kui2-xiu4");
  assert.equal(itemNamed("chinese", "Orion"), undefined);
  assert.equal(itemNamed("chinese", "氐宿"), undefined, "one star held: not asked");
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
