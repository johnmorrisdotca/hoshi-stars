// A figure's own page serves all three skies (MODULES-828): what the page asks of the tables, answered by the same functions.
import assert from "node:assert/strict";
import { test } from "node:test";
import { neighbouringConstellations } from "../src/nearest.ts";
import { ALL_WORDS } from "../scripts/gallery-words.ts";
import { cardsOf } from "../demo/culture-cards.ts";
import { CULTURE_IDS } from "../demo/cultures.ts";
import { counterpart, figureFor, figureHref, neighboursOf, sameSky, starsOfCard, starsOfFigure } from "../demo/figure-sky.ts";

const ids = (list: ReadonlyArray<{ card: { id: string } } | { id: string }>): string[] => list.map((one) => ("card" in one ? one.card.id : one.id));

test("every figure of every sky is found by its id in its own sky, and has stars to compare", () => {
  for (const culture of CULTURE_IDS) {
    for (const card of cardsOf(culture)) {
      assert.equal(figureFor(card.id, culture)?.id, card.id, `${culture} ${card.id}`);
      assert.equal(figureFor(card.id, culture)?.culture, culture, `${culture} ${card.id}`);
      assert.ok(starsOfCard(card).length > 0, `${culture} ${card.id} has stars`);
    }
  }
  assert.equal(figureFor("Zzz", "western"), undefined);
});

test("a figure's page opens the same sky in another culture by naming the figure that has its stars", () => {
  assert.equal(counterpart("western", "Ori", "japanese")?.id, "Ori");
  assert.equal(counterpart("western", "Ori", "chinese")?.id, "shen1-xiu4");
  assert.equal(counterpart("western", "UMa", "chinese")?.id, "bei3-dou3");
  assert.equal(counterpart("japanese", "hokuto-shichisei", "chinese")?.id, "bei3-dou3");
  assert.equal(counterpart("japanese", "subaru", "western")?.id, "Tau");
  assert.equal(counterpart("chinese", "bei3-dou3", "japanese")?.id, "hokuto-shichisei");
  assert.equal(counterpart("chinese", "bei3-dou3", "western")?.id, "UMa");
  assert.equal(counterpart("chinese", "mao3-xiu4", "japanese")?.id, "subaru");
  // a sky whose figures hold none of the stars has none to name
  assert.equal(counterpart("western", "Ant", "chinese"), undefined);
  assert.equal(counterpart("western", "Ori", "western")?.id, "Ori");
});

test("the same sky in another culture lists only that culture's figures, the one with most shared stars first, and never itself", () => {
  const dipper = sameSky("chinese", "bei3-dou3", "japanese");
  assert.deepEqual(ids(dipper), ["hokuto-shichisei", "UMa"]);
  assert.deepEqual(dipper.map((one) => one.shared), [7, 7]);
  const orion = sameSky("western", "Ori", "chinese");
  assert.equal(orion[0]?.card.id, "shen1-xiu4");
  assert.ok(orion.length >= 4, "the Chinese sky has several figures in Orion");
  assert.ok(orion.every((one, at) => at === 0 || one.shared <= orion[at - 1]!.shared));
  assert.deepEqual(sameSky("western", "Ori", "western"), []);
  const pleiades = sameSky("japanese", "subaru", "chinese");
  assert.deepEqual(ids(pleiades), ["mao3-xiu4"]);
  // a Japanese figure's stars lie in a Western constellation that holds more than the figure
  assert.deepEqual(ids(sameSky("japanese", "subaru", "western")), ["Tau"]);
});

test("the nearest figures of a Western constellation are its bordering ones; of any other figure, those whose stars come nearest", () => {
  const bordering = neighbouringConstellations("And").map((c) => c.abbreviation);
  assert.deepEqual(ids(neighboursOf("western", "And")), bordering);
  assert.deepEqual(ids(neighboursOf("japanese", "And")).sort(), [...bordering].sort());
  const near = neighboursOf("japanese", "subaru");
  assert.equal(near.length, 6);
  assert.equal(near[0]!.id, "Tau", "the constellation that holds the Pleiades comes first");
  assert.ok(!ids(near).includes("subaru"));
  const chinese = neighboursOf("chinese", "bei3-dou3");
  assert.equal(chinese.length, 6);
  assert.ok(chinese.every((card) => card.culture === "chinese"));
});

test("an address that names a figure the sky does not have lands on the figure that sky has for it", () => {
  assert.equal(figureFor("Ori", "chinese")?.id, "shen1-xiu4");
  assert.equal(figureFor("subaru", "western")?.culture, "japanese");
  assert.equal(figureFor("subaru", "chinese")?.id, "mao3-xiu4");
  assert.equal(figureFor("hokuto-shichisei", "chinese")?.id, "bei3-dou3");
  assert.equal(figureHref("western", "Ori"), "constellation.html?c=Ori");
  assert.equal(figureHref("chinese", "bei3-dou3"), "constellation.html?c=bei3-dou3&culture=chinese");
  assert.equal(figureHref("japanese", "hokuto-shichisei"), "constellation.html?c=hokuto-shichisei&culture=japanese");
});

test("every traditional Japanese figure has its story in Japanese", () => {
  const ja = ALL_WORDS.ja as Record<string, string>;
  for (const card of cardsOf("japanese").filter((one) => one.kind === "asterism")) {
    assert.ok(card.asterism!.about !== "");
    assert.ok(ja[`story_${card.id.replaceAll("-", "_")}`], `${card.id} has a story`);
  }
  assert.ok(starsOfFigure("chinese", "bei3-dou3").length === 7);
});

test("the page's words exist in English and in Japanese, so no label shows as its key", () => {
  const keys = ["cp_back_japanese", "cp_back_chinese", "cp_title_figure", "cp_compare", "cp_in_western", "cp_in_japanese", "cp_in_chinese", "cp_shared", "cp_more", "cp_nomatch", "cp_noFigure", "cp_mansionNo", "cp_mansionOf", "cp_enclosure", "cp_notRecorded", "cp_noEnglish", "cp_romaji", "cp_aka", "cp_held", "cp_westernStars", "cp_neighbours_sky", "cp_limits", "cp_limit_joins", "cp_limit_faint", "cp_limit_wikidata", "cp_limit_japanese", "cp_sayZh", "fieldChinese", "fieldQuarter", "fieldLiesIn", "fieldAbout", "fieldType", "fieldEnglish", "noteMissing", "culture", "cultureWestern", "cultureJapanese", "cultureChinese"];
  for (const lang of ["en", "ja"] as const) for (const key of keys) assert.ok(key in (ALL_WORDS[lang] as object), `${lang} ${key}`);
});
