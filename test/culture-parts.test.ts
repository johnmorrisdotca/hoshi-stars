// The Chinese sky's "part of" and Japanese-name columns come from data-sources/chinese-constellations-wikidata.jsonl (Wikidata, CC0, through its dump), matched to the asterisms by their labels and by nothing else.
// scripts/make-culture-parts.py writes them; this test works the match out again in its own way and holds the data to it. Pure: it only reads the file.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { chinese } from "../src/cultures/chinese.ts";

interface Item {
  id: string;
  labels: Record<string, string>;
  p31?: string[];
  p361?: string[];
}
const lines = readFileSync(new URL("../data-sources/chinese-constellations-wikidata.jsonl", import.meta.url), "utf8").trim().split("\n");
const header = JSON.parse(lines[0]!) as Record<string, string>;
const all = lines.slice(1).map((line) => JSON.parse(line) as Item);
const items = all.filter((item) => item.p31?.includes("Q1074076"));
const ENCLOSURES: Record<string, string> = { Q1145852: "purple-forbidden", Q1145944: "supreme-palace", Q1145862: "heavenly-market" };
const NOTE = /\s*[(（][^)）]*[)）]\s*$/;
const labelsOf = (item: Item): string[] => ["zh-hant", "zh", "zh-hans"].flatMap((k) => (item.labels[k] === undefined ? [] : [item.labels[k]!]));

const asterisms = chinese.asterisms();
const spellings = (a: (typeof asterisms)[number]): Set<string> => new Set([a.names["zh-Hant"]!, a.names["zh-Hans"]!]);
/** The match of the rows to the file's items, by labels only: an exact label first, else one without a bracketed note; two items, or a name another row has, match nothing. */
const matched = new Map<string, Item>();
for (const a of asterisms) {
  const own = spellings(a);
  if (asterisms.filter((o) => [...spellings(o)].some((x) => own.has(x))).length > 1) continue;
  const exact = items.filter((item) => labelsOf(item).some((x) => own.has(x)));
  const hits = exact.length > 0 ? exact : items.filter((item) => labelsOf(item).some((x) => own.has(x.replace(NOTE, ""))));
  if (hits.length === 1) matched.set(a.id, hits[0]!);
}

test("the file names its dump: the address, when it was last modified, its ETag, the licence and the day it was read", () => {
  assert.equal(header["dump"], "https://dumps.wikimedia.org/wikidatawiki/entities/latest-all.json.bz2");
  assert.equal(header["lastModified"], "Tue, 17 Nov 2026 18:42:29 GMT");
  assert.equal(header["etag"], "6afca015-1832128e37");
  assert.equal(header["licence"], "CC0");
  assert.equal(header["read"], "2026-11-17");
  assert.equal(all.length, 357);
  assert.equal(items.length, 342, "the items that are an instance of Chinese constellation");
});

test("the rows that match an item of the file: 217 of 238, by labels only; the 21 that do not are these", () => {
  assert.equal(asterisms.length, 238);
  assert.equal(matched.size, 217);
  const none = asterisms.filter((a) => !matched.has(a.id)).map((a) => a.id).sort();
  assert.deepEqual(none, [
    "bei3-dou3", "chu3", "chu3-2", "dai4", "dou3", "jin4-fu4-bai2", "qin2", "san1-tai2", "tai4-wei1-you4-yuan2", "tian1-ce4", "tian1-shi4-you4-yuan2", "tian1-tian2", "tian1-tian2-2", "tian1-you4", "wu3-zhu1-hou2",
    "wu3-zhu1-hou2-2", "you4-yuan2", "yu4-nu3", "zhou1", "zhu4", "zhu4-2",
  ]);
  // the ones that share a name are not matched, and neither are two items for one name (御女, 斗 and 杵 each have a second item that is part of a mansion)
  for (const id of ["wu3-zhu1-hou2", "wu3-zhu1-hou2-2", "zhu4", "zhu4-2", "yu4-nu3", "dou3"]) assert.ok(!matched.has(id), id);
  // the 28 mansions all match, each to its own item
  const mansions = asterisms.filter((a) => a.kind === "mansion");
  assert.equal(mansions.filter((a) => matched.has(a.id)).length, 28);
  assert.equal(new Set(mansions.map((a) => matched.get(a.id)!.id)).size, 28);
  // no item is the match of two rows
  assert.equal(new Set([...matched.values()].map((item) => item.id)).size, matched.size);
});

test("partOf is what the file says for the asterisms it matches: an enclosure, or a mansion, and nothing for a Western constellation", () => {
  const mansionOfItem = new Map(asterisms.filter((a) => a.kind === "mansion" && matched.has(a.id)).map((a) => [matched.get(a.id)!.id, a.id] as const));
  for (const [id, item] of matched) {
    const a = chinese.find(id)!;
    if (a.kind === "mansion") {
      assert.equal(a.partOf, undefined, `${id}: a mansion's own part is its Symbol`);
      continue;
    }
    const parts = (item.p361 ?? []).map((q) => ENCLOSURES[q] ?? mansionOfItem.get(q)).filter((x): x is string => x !== undefined);
    assert.equal(a.partOf, parts.length === 1 ? parts[0] : undefined, id);
  }
  // some by name: 華蓋 is in the Purple Forbidden Enclosure, 七公 in the Heavenly Market, 常陳 in the Supreme Palace, 九斿 is part of the mansion 畢宿 (Net)
  assert.equal(chinese.find("華蓋")?.partOf, "purple-forbidden");
  assert.equal(chinese.find("七公")?.partOf, "heavenly-market");
  assert.equal(chinese.find("常陳")?.partOf, "supreme-palace");
  assert.equal(chinese.find("九斿")?.partOf, "bi4-xiu4-2");
  // 華蓋's item names the enclosure and Draco (a Western constellation): only the enclosure is used
  const gai = matched.get("hua2-gai4")!;
  assert.ok(gai.p361!.includes("Q1145852"));
  // the file names the three enclosures with labels: nothing is missing, so none had to be left out
  for (const [q, name] of Object.entries({ Q1145852: "紫微垣", Q1145944: "太微垣", Q1145862: "天市垣" })) assert.equal(all.find((item) => item.id === q)?.labels["zh-hant"], name);
  // the counts of the rows: the enclosures as the file gives them are the 22, 3 and 15 the data had
  const count = (part: string): number => asterisms.filter((a) => a.partOf === part).length;
  assert.deepEqual([count("purple-forbidden"), count("supreme-palace"), count("heavenly-market")], [22, 3, 15]);
});

test("the Japanese labels: Wikidata's, where it has one, as it gives it", () => {
  const withJa = asterisms.filter((a) => a.names.ja !== undefined);
  assert.equal(withJa.length, 38);
  // the same characters as the Traditional name (軫宿) and different ones (the Japanese forms 虚, 参, 摂, 塁)
  assert.equal(chinese.find("軫宿")?.names.ja, "軫宿");
  assert.equal(chinese.find("虛宿")?.names.ja, "虚宿");
  assert.equal(chinese.find("參宿")?.names.ja, "参宿");
  assert.equal(chinese.find("右攝提")?.names.ja, "右摂提");
  assert.equal(chinese.find("壘壁陣")?.names.ja, "塁壁陣");
  assert.equal(withJa.filter((a) => a.names.ja !== a.name).length, 6, "虚宿 参宿 右摂提 塁壁陣 天大将軍 文昌星");
  assert.equal(withJa.filter((a) => a.names.ja === a.name).length, 32, "the same characters as the Traditional name");
  // every one is the label of the item it matched, and no one without an item or a label has one
  for (const a of asterisms) assert.equal(a.names.ja, matched.get(a.id)?.labels["ja"] === undefined || NOTE.test(matched.get(a.id)!.labels["ja"]!) ? undefined : matched.get(a.id)!.labels["ja"], a.id);
  // 北極's Japanese label is a page title with a bracketed note (北極 (星座)), not a name: it is left out
  assert.equal(matched.get("bei3-ji2")?.labels["ja"], "北極 (星座)");
  assert.equal(chinese.find("北極")?.names.ja, undefined);
  assert.ok(withJa.every((a) => !/[()（）]/.test(a.names.ja!)));
});
