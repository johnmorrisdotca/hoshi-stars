// The Chinese sky's own division on the chart: an hour circle through each mansion's determinative star, its one star numbered 1, dashed like the IAU boundaries, drawn only with the mansions layer and
// only in a sky that has mansions; none where the determinative is not in our data or is given twice, so nothing is guessed.
import assert from "node:assert/strict";
import { test } from "node:test";
import { chart, mansionMeridians } from "../src/chart/chart.ts";
import { chinese } from "../src/cultures/chinese.ts";
import { japanese } from "../src/cultures/japanese.ts";
import { starByHr } from "../src/stars.ts";

const draw = (layers: string[], culture = chinese) =>
  chart({ projection: "stereographic", ra: 225, dec: -12, zoom: 3, width: 800, height: 500, magnitude: 5, layers: new Set(layers as never[]), lang: "en", culture }).svg;

test("an hour circle for each mansion whose one star 1 we hold: 23 of the 28 in this data", () => {
  const meridians = mansionMeridians(chinese);
  assert.equal(meridians.length, 23);
  const ids = new Set(meridians.map((m) => m.id));
  // 氐, 牛, 觜 and 參: Wikidata names no star 1; 斗宿: it names two
  for (const id of ["di1-xiu4", "niu2-xiu4", "zi1-xiu4", "shen1-xiu4", "dou3-xiu4"]) assert.ok(!ids.has(id), `${id} has no circle`);
  // 角宿's is through Spica (角宿一, HR 5056), at its right ascension
  const jiao = meridians.find((m) => m.id === "jiao3-xiu4")!;
  assert.equal(jiao.hr, 5056);
  assert.equal(jiao.rightAscension, starByHr(5056)!.rightAscension);
  // every one is a star of its own mansion, numbered 1 there
  for (const m of meridians) assert.equal(chinese.asterisms().find((a) => a.id === m.id)!.numbers![m.hr], 1);
  assert.deepEqual(mansionMeridians(japanese), []);
});

test("the circles are drawn dashed with the mansions layer in the Chinese sky, and not otherwise", () => {
  const on = draw(["mansions"]);
  const path = on.match(/<path d="([^"]+)" fill="none" stroke="#a8875a" stroke-width="1" stroke-dasharray="5 4" data-layer="mansions"\/>/);
  assert.ok(path !== null, "a dashed path of the mansions");
  // around Libra and Scorpius: the circles of 角, 亢, 房 and 心 are in view (氐's is not drawn)
  assert.ok((path[1]!.match(/M/g) ?? []).length >= 4);
  assert.doesNotMatch(draw([]), /data-layer="mansions"/);
  assert.doesNotMatch(draw(["mansions"], japanese), /data-layer="mansions"/);
});
