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
  const wikidataJa = (a: (typeof asterisms)[number]): string | undefined => { const label = matched.get(a.id)?.labels["ja"]; return label === undefined || NOTE.test(label) ? undefined : label; };
  const withJa = asterisms.filter((a) => wikidataJa(a) !== undefined);
  assert.equal(withJa.length, 38);
  // the same characters as the Traditional name (軫宿) and different ones (the Japanese forms 虚, 参, 摂, 塁)
  assert.equal(chinese.find("軫宿")?.names.ja, "軫宿");
  assert.equal(chinese.find("虛宿")?.names.ja, "虚宿");
  assert.equal(chinese.find("參宿")?.names.ja, "参宿");
  assert.equal(chinese.find("右攝提")?.names.ja, "右摂提");
  assert.equal(chinese.find("壘壁陣")?.names.ja, "塁壁陣");
  assert.equal(withJa.filter((a) => a.names.ja !== a.name).length, 6, "虚宿 参宿 右摂提 塁壁陣 天大将軍 庫楼 (文昌 is the same characters again)");
  assert.equal(withJa.filter((a) => a.names.ja === a.name).length, 32, "the same characters as the Traditional name");
  // every one is the label of the item it matched, and no one without an item or a label has one
  const fixed: Record<string, string> = { "ku4-lou2": "庫楼", "wen2-chang1": "文昌", "teng2-she2": "騰蛇" };
  // a name with no Wikidata label gets the Traditional name in Japanese forms, or nothing where there is nothing to change (below)
  const inJapanese = (name: string): string => [...name].map((c) => TABLE[c] ?? c).join("");
  for (const a of asterisms) assert.equal(a.names.ja, fixed[a.id] ?? wikidataJa(a) ?? (inJapanese(a.name) === a.name ? undefined : inJapanese(a.name)), a.id);
  // 北極's Japanese label is a page title with a bracketed note (北極 (星座)), not a name: it is left out
  assert.equal(matched.get("bei3-ji2")?.labels["ja"], "北極 (星座)");
  assert.equal(chinese.find("北極")?.names.ja, undefined);
  assert.ok(withJa.every((a) => !/[()（）]/.test(a.names.ja!)));
  assert.equal(asterisms.filter((a) => a.names.ja !== undefined).length, 60, "38 of Wikidata and 22 in Japanese forms");
});

test("two Japanese labels are corrected after a review, and the map of corrections in the script names rows that exist with the dump's label", () => {
  // the dump says 庫樓 and 文昌星; the data says 庫楼 (楼 is the Japanese form of 樓) and 文昌 (every other name is bare)
  assert.equal(matched.get("ku4-lou2")?.labels["ja"], "庫樓");
  assert.equal(matched.get("wen2-chang1")?.labels["ja"], "文昌星");
  assert.equal(chinese.find("庫樓")?.names.ja, "庫楼");
  assert.equal(chinese.find("文昌")?.names.ja, "文昌");
  // the map is in the script: every id is a row, and its `was` is what the dump holds (the script also stops when it is not)
  const script = readFileSync(new URL("../scripts/make-culture-parts.py", import.meta.url), "utf8");
  const fixes = [.../JA_LABEL_FIXES = \{\n([\s\S]*?)\n\}/.exec(script)![1]!.matchAll(/"([a-z0-9-]+)": \{"was": "([^"]+)", "ja": "([^"]+)"/g)];
  assert.equal(fixes.length, 2);
  for (const [, id, was, ja] of fixes) {
    assert.ok(asterisms.some((a) => a.id === id), `${id} is a row`);
    assert.equal(matched.get(id!)?.labels["ja"], was, `${id}: the dump's label is the one the fix replaces`);
    assert.equal(chinese.find(id!)?.names.ja, ja);
  }
});

// The Japanese page shows one form of each character (MODULES-1739): the Traditional name where the data has no Japanese label would put 左攝提 beside Wikidata's 右摂提 and a child could pick the answer by its script.
const TABLE: Record<string, string> = { 虛: "虚", 參: "参", 攝: "摂", 壘: "塁", 將: "将", 樓: "楼", 臺: "台", 廚: "厨", 內: "内", 傳: "伝", 從: "従", 祿: "禄", 龜: "亀", 舍: "舎", 德: "徳", 國: "国", 廄: "厩", 鱉: "鼈", 廁: "厠" };
const KEPT = "婁畢觜軫張氐漸淵鉤穀勢陣軍龠爟溷潢礪瀆";
const japanesePage = (a: (typeof asterisms)[number]): string => a.names.ja ?? a.name;

test("the table of Japanese forms is the reviewed one: the script holds exactly these 19 pairs, and the characters that are the same in Japanese or still a question are not in it", () => {
  const script = readFileSync(new URL("../scripts/make-culture-parts.py", import.meta.url), "utf8");
  const block = /JA_CHARACTERS = \{([^}]*)\}/.exec(script)![1]!;
  const pairs = Object.fromEntries([...block.matchAll(/"(.)": "(.)"/gu)].map((m) => [m[1]!, m[2]!]));
  assert.deepEqual(pairs, TABLE);
  for (const c of KEPT) assert.ok(!(c in TABLE) && !Object.values(TABLE).includes(c) || c === "", `${c} is not converted`);
  assert.match(script, /JA_CHARACTER_QUESTIONS = ""/, "no character is still a question after the review of 2026-11-20");
  // 螣蛇 is written 騰蛇 by name, not by the table: 螣 and 騰 are two characters, not two forms of one
  assert.ok(!("螣" in TABLE));
  assert.match(script, /"teng2-she2": \{"was": "螣蛇", "ja": "騰蛇"/);
  assert.ok(Object.keys(TABLE).every((c) => !Object.values(TABLE).includes(c)), "no form is both converted and a result");
  // every converted character is in the name of some asterism, so the table has no dead entry
  for (const c of Object.keys(TABLE)) assert.ok(asterisms.some((a) => a.name.includes(c)), c);
});

test("every asterism's name on the Japanese page has no character the table would change, and no name mixes forms of a character", () => {
  const names = asterisms.map(japanesePage);
  for (const [i, name] of names.entries()) for (const c of Object.keys(TABLE)) assert.ok(!name.includes(c), `${asterisms[i]!.id}: ${name} has ${c}`);
  // a character is in one form on the whole page: where the Japanese form is used, the Traditional one is not, and the other way round for the characters that stay
  for (const [from, to] of Object.entries(TABLE)) assert.ok(!(names.some((n) => n.includes(from)) && names.some((n) => n.includes(to))), `${from} and ${to} are both used`);
  for (const c of KEPT) assert.ok(asterisms.every((a) => !a.name.includes(c) || japanesePage(a).includes(c)), `${c} stays as it is`);
  // Wikidata's label (and the two corrections) win over the table, and a name with nothing to change has no Japanese name of its own
  assert.equal(chinese.find("右攝提")?.names.ja, "右摂提", "Wikidata's own label");
  assert.equal(chinese.find("北極")?.names.ja, undefined, "nothing to change and no Wikidata label");
  assert.equal(japanesePage(chinese.find("婁宿")!), "婁宿", "婁 stays");
  assert.equal(chinese.find("畢宿")?.names.ja, "畢宿", "畢 stays (Wikidata's label has it)");
  // the bare names: no 星 or 座 is added, and the mansions keep 宿
  for (const a of asterisms) {
    const ja = japanesePage(a);
    assert.equal(ja.replace(/[^\p{Script=Han}]/gu, ""), ja, `${a.id}: characters only`);
    if (a.names.ja === undefined) assert.equal(ja.length, a.name.length, `${a.id}: nothing added`);
  }
  assert.ok(asterisms.filter((a) => a.kind === "mansion").every((a) => japanesePage(a).endsWith("宿")));
});

test("the 22 names the table and the one name form convert, Traditional then Japanese", () => {
  const wikidata = (a: (typeof asterisms)[number]): boolean => matched.get(a.id)?.labels["ja"] !== undefined;
  assert.deepEqual(
    asterisms.filter((a) => a.names.ja !== undefined && !wikidata(a)).map((a) => `${a.name}>${a.names.ja}`).sort(),
    ["三臺>三台", "司祿>司禄", "外廚>外厨", "天壘城>天塁城", "天廚>天厨", "傳舍>伝舎", "內平>内平", "內廚>内厨", "內階>内階", "參旗>参旗", "市樓>市楼", "從官>従官", "漸臺>漸台", "左攝提>左摂提", "龜>亀", "天廄>天厩", "狗國>狗国", "陰德>陰徳", "廁>厠", "天廁>天厠", "鱉>鼈", "螣蛇>騰蛇"].sort(),
  );
});
