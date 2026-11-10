// The pictures of the Japanese and Chinese skies' own figures: one for each figure in both looks, every star of the figure inside the frame, no boundary drawn, and the files small and Pages only. And the cards the demo builds from them.
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { chinese } from "../src/cultures/chinese.ts";
import { japanese } from "../src/cultures/japanese.ts";
import { western } from "../src/cultures/western.ts";
import { figures } from "../src/lines.ts";
import { thumbnailSvg, THUMBNAIL_UNITS } from "../src/thumbnails.ts";
import { CULTURE_SIZES, THEMES, figureThumbnailSvg, ownPictureFigures, writeCultureThumbnails } from "../scripts/thumbnail-files.ts";
import { cardAnswers, cardsOf, faceOf, mixOf, pictureOf } from "../demo/culture-cards.ts";

const mineOf = (figure: { stars: ReadonlyArray<{ hr: number }> }): Set<number> => new Set(figure.stars.map((star) => star.hr));

const dots = (svg: string): Array<{ x: number; y: number; hr?: number }> =>
  [...svg.matchAll(/<circle cx="([-\d.]+)" cy="([-\d.]+)" r="[\d.]+" fill="#[0-9a-f]{6}"(?: data-hr="(\d+)")?\/>/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]), ...(m[3] === undefined ? {} : { hr: Number(m[3]) }) }));

test("every Chinese figure and every traditional Japanese one has a picture in both looks, with all of its stars inside the frame", () => {
  for (const culture of [chinese, japanese]) {
    for (const figure of ownPictureFigures(culture)) {
      for (const theme of THEMES) {
        const svg = figureThumbnailSvg(figure, culture, theme);
        const own = dots(svg).filter((dot) => dot.hr !== undefined);
        assert.deepEqual(own.map((dot) => dot.hr!).filter((hr) => mineOf(figure).has(hr)).sort((a, b) => a - b), figure.stars.map((s) => s.hr).sort((a, b) => a - b), `${culture.id} ${figure.asterism.id} ${theme}: every star is drawn once`);
        for (const dot of own) assert.ok(dot.x >= 0 && dot.x <= THUMBNAIL_UNITS && dot.y >= 0 && dot.y <= THUMBNAIL_UNITS, `${figure.asterism.id}: HR ${dot.hr} is inside the frame`);
        assert.ok(!svg.includes("<text"), "no text, so a picture needs no font");
        assert.ok(svg.includes("our own joins"), "the picture says its lines are our own joins");
      }
    }
  }
});

test("the Chinese sky has 238 figures with pictures, the Japanese sky the 18 that are not one of the 88, and the Western sky none", () => {
  assert.equal(ownPictureFigures(chinese).length, 238);
  assert.equal(ownPictureFigures(japanese).length, 18);
  assert.equal(ownPictureFigures(western).length, 0);
  assert.equal(figures(japanese).length, 106);
});

test("a figure with no boundary is framed on the frame it is given, and one with neither is refused", () => {
  const svg = thumbnailSvg({ title: "Two stars", outlines: [], frame: [{ rightAscension: 88, declination: 7 }, { rightAscension: 83, declination: -1 }], segments: [], owns: () => false });
  assert.ok(svg.startsWith("<svg") && !svg.includes("stroke-dasharray"));
  assert.throws(() => thumbnailSvg({ title: "none", outlines: [], frame: [], segments: [], owns: () => true }), RangeError);
});

test("the files are PNGs at 160 and 480 in both looks, named by the figure's id, small, and only in the folder for the Pages build", () => {
  const dir = mkdtempSync(join(tmpdir(), "hoshi-culture-thumbs-"));
  try {
    const made = writeCultureThumbnails(dir, chinese) + writeCultureThumbnails(dir, japanese);
    assert.equal(made, (238 + 18) * 2 * CULTURE_SIZES.length);
    let total = 0;
    for (const culture of [chinese, japanese]) {
      for (const theme of THEMES) {
        for (const size of CULTURE_SIZES) {
          const folder = join(dir, culture.id, "png", String(size), theme);
          assert.equal(readdirSync(folder).length, ownPictureFigures(culture).length);
          for (const figure of ownPictureFigures(culture)) {
            const file = join(folder, `${figure.asterism.id}.png`);
            const png = readFileSync(file);
            assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
            assert.equal(png.readUInt32BE(16), size);
            assert.ok(statSync(file).size < 90_000, `${file} is ${statSync(file).size} bytes`);
            total += statSync(file).size;
          }
        }
      }
    }
    assert.ok(total < 18_000_000, `the figures' pictures are ${total} bytes`);
    assert.ok(!existsSync(join(dir, "svg")), "no SVG files");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  // the npm folder is made by `writeThumbnails` alone: nothing of a culture goes in it
  const shipped = readFileSync(new URL("../scripts/make-thumbnails.ts", import.meta.url), "utf8");
  assert.ok(!/writeCultureThumbnails/.test(shipped));
});

test("each culture's cards: the 88 for the Western sky, 106 for the Japanese, 238 for the Chinese, each with a picture, a name and an id that opens its figure", () => {
  assert.equal(cardsOf("western").length, 88);
  assert.equal(cardsOf("japanese").length, 106);
  assert.equal(cardsOf("chinese").length, 238);
  for (const id of ["western", "japanese", "chinese"] as const) {
    const culture = { western, japanese, chinese }[id];
    const ids = new Set(figures(culture).map((f) => f.asterism.id));
    const seen = new Set<string>();
    for (const card of cardsOf(id)) {
      assert.ok(ids.has(card.id) || id === "western", `${id} ${card.id} is a figure of the culture`);
      assert.ok(!seen.has(card.id), `${card.id} once`);
      seen.add(card.id);
      for (const look of ["light", "dark"] as const) for (const size of [160, 480] as const) assert.match(pictureOf(card, size, look), id === "western" || card.constellation !== undefined ? /^thumbnails\/png\/\d+\/(light|dark)\/[A-Za-z]+\.png$/ : new RegExp(`^thumbnails/${id}/png/${size}/${look}/[a-z0-9-]+\\.png$`));
      for (const lang of ["en", "ja"] as const) assert.ok(faceOf(card, lang).name.length > 0 && faceOf(card, lang).label.length > 0);
    }
  }
});

test("the names on a card are copied from the package's data: the characters, the pinyin, the English where the data has one, and how many stars are missing", () => {
  const horn = cardsOf("chinese").find((card) => card.id === "jiao3-xiu4")!;
  assert.deepEqual(faceOf(horn, "en"), { name: "角宿", sub: "jiǎo xiù · Horn", reading: "jiǎo xiù", english: "Horn", missing: 0, missingText: "", label: "角宿, jiǎo xiù, Horn" });
  const root = faceOf(cardsOf("chinese").find((card) => card.id === "di1-xiu4")!, "en");
  assert.equal(root.missing, 3);
  assert.equal(root.missingText, "3+ fainter stars not shown");
  assert.equal(faceOf(cardsOf("chinese").find((card) => card.id === "di1-xiu4")!, "ja").missingText, "暗い星3個以上は描いていません");
  const dipper = faceOf(cardsOf("chinese").find((card) => card.id === "bei3-dou3")!, "en");
  assert.equal(dipper.name, "北斗");
  assert.equal(dipper.english, "", "no English name is made up where the data has none");
  const subaru = faceOf(cardsOf("japanese")[0]!, "en");
  assert.deepEqual([subaru.name, subaru.reading, subaru.english], ["昴", "すばる", "the Pleiades"]);
  const orion = faceOf(cardsOf("japanese").find((card) => card.id === "Ori")!, "en");
  assert.deepEqual([orion.name, orion.reading, orion.english], ["オリオン座", "おりおんざ", "Orion"]);
  assert.deepEqual(mixOf("chinese"), [28, 210]);
  assert.deepEqual(mixOf("japanese"), [88, 18]);
  assert.equal(mixOf("western"), undefined);
});

test("a card is found by Chinese in either writing, pinyin with or without tone marks and spaces, kana, katakana, romaji and English", () => {
  const find = (id: "chinese" | "japanese", text: string): string[] => cardsOf(id).filter((card) => cardAnswers(card, text)).map((card) => card.id);
  assert.ok(find("chinese", "北斗").includes("bei3-dou3"));
  assert.ok(find("chinese", "beidou").includes("bei3-dou3"));
  assert.ok(find("chinese", "běi dǒu").includes("bei3-dou3"));
  assert.ok(find("chinese", "虚宿").includes("xu1-xiu4"), "Simplified");
  assert.ok(find("chinese", "虛宿").includes("xu1-xiu4"), "Traditional");
  assert.deepEqual(find("chinese", "Horn"), ["jiao3-xiu4"]);
  assert.deepEqual(find("japanese", "すばる").slice(0, 1), ["subaru"]);
  assert.ok(find("japanese", "スバル").includes("subaru"), "katakana against hiragana");
  assert.ok(find("japanese", "Pleiades").includes("subaru"));
  assert.ok(find("japanese", "昴").includes("subaru"));
  assert.ok(find("japanese", "おおぐま").includes("UMa"));
  assert.ok(find("japanese", "Ursa Major").includes("UMa"));
  assert.equal(find("chinese", "zzzz").length, 0);
  assert.equal(find("chinese", "").length, 238);
});
