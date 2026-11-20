#!/usr/bin/env python3
"""Rewrite the "part of" and Japanese-name columns of src/data/culture-chinese.ts from the committed file data-sources/chinese-constellations-wikidata.jsonl, offline.

The star lists, the lines and the names of the 238 asterisms come from scripts/make-culture-data.py (Wikidata's SPARQL, which needs the network and is not run here). This script
adds, from a file already in the repository, what that script read from the same Wikidata items: which enclosure or mansion an asterism is part of (P361) and its Japanese label.

Source: Wikidata (https://www.wikidata.org), CC0 1.0, through the dump https://dumps.wikimedia.org/wikidatawiki/entities/latest-all.json.bz2 (Last-Modified Tue, 17 Nov 2026 18:42:29 GMT,
ETag 6afca015-1832128e37, read 2026-11-17), reduced to the items of "Chinese constellation" (Q1074076) and the targets of their "part of" statements. The first line of the file says so.

The match of a row to a file item uses nothing but the labels, never a guess:
- an item's labels are its `zh`, `zh-hant` and `zh-hans`; a row's spellings are its Traditional and its Simplified name;
- first an item with a label equal to one of the row's spellings; only if there is none, an item with such a label once a bracketed note such as `(星官)` is taken off the end (the same
  rule scripts/make-culture-data.py has);
- more than one item, or a name that another row has too (the old lists have two 五諸侯, two 柱, two 天田), matches nothing: the row is left as it is.
The part of statement is kept when it names exactly one of the Three Enclosures (Purple Forbidden Q1145852, Supreme Palace Q1145944, Heavenly Market Q1145862) or one mansion (an item matched
to one of the 28 mansion rows); a statement that names a Western constellation is a different fact and is not used. A mansion's own part (its Symbol) is in the `group` column and stays.
Then every asterism that has no Japanese label gets its Traditional name with the characters of JA_CHARACTERS (thirteen, each with a standard Japanese form) written in that form, so that a Japanese page
shows one form (MODULES-1739); the characters that are the same (婁 畢 觜 軫 張 氐) and the doubtful ones (JA_CHARACTER_QUESTIONS) are left. Two Japanese labels are corrected in JA_LABEL_FIXES (庫樓 to 庫楼, 文昌星 to 文昌, with the reasons); --check and a run stop if the dump no longer holds the label a fix replaces.
A row with no matching item keeps the part of it had. The Japanese label (`ja`) is kept where the item has one, as Wikidata gives it; a label ending in a bracketed note (`北極 (星座)`) is a
page title and not a name and is left out.

    python3 -I scripts/make-culture-parts.py              # rewrites src/data/culture-chinese.ts; prints what it did
    python3 -I scripts/make-culture-parts.py --check      # exits 1 if the file is not what it would write

None of this runs in the test, and nothing here reads the network.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "src" / "data" / "culture-chinese.ts"
ITEMS = ROOT / "data-sources" / "chinese-constellations-wikidata.jsonl"
ENCLOSURES = {"Q1145852": "purple-forbidden", "Q1145944": "supreme-palace", "Q1145862": "heavenly-market"}
CHINESE_CONSTELLATION = "Q1074076"
# Corrections to a Japanese label of Wikidata's, from a review by a reader of Japanese (2026-11-19), applied after the dump's label so that a rerun keeps them. Each names the row, the label
# the dump gives (`was`: the script stops if the dump no longer says that, so a fix never outlives its reason) and the label kept (`ja`). Every other label is Wikidata's as it is.
JA_LABEL_FIXES = {
    "ku4-lou2": {"was": "庫樓", "ja": "庫楼", "why": "楼 is the Japanese form of 樓, as 虚, 参, 摂 and 塁 are of the labels Wikidata already gives in Japanese forms"},
    "wen2-chang1": {"was": "文昌星", "ja": "文昌", "why": "every other name is bare; the 星 is Wikidata's label for the god and stands out among the choices"},
}
# Traditional characters that have a standard Japanese form, written in that form in the name of an asterism that Wikidata has no Japanese label for (MODULES-1739): on the Japanese page one
# screen otherwise mixes forms (右摂提 from Wikidata beside 左攝提), and a child can pick the answer by its script. This is a hoshi correction for the Japanese page, not Wikidata's, and it is
# reviewed: the list is the maintainer's, checked by a reader of Japanese; the dump's own Japanese labels (虚 参 摂 塁 将, in 虚宿 参宿 右摂提 塁壁陣 天大将軍) agree with the pairs they show. A character is
# added here only when the reviewer says its Japanese form is standard; the doubtful ones are not in it (see JA_CHARACTER_QUESTIONS). A name with a Wikidata label (or a JA_LABEL_FIXES one) keeps
# that label and is not converted. Names are not given a 星 or a 座 and the mansions keep 宿; no reading is added.
JA_CHARACTERS = {
    "虛": "虚", "參": "参", "攝": "摂", "壘": "塁", "將": "将", "樓": "楼", "臺": "台", "廚": "厨", "內": "内", "傳": "伝", "從": "従", "祿": "禄", "龜": "亀",
}
# Characters of the names that are the same in Japanese on purpose, and must never be in the table: 婁 畢 觜 軫 張 氐 (the Japanese forms are the same as the Traditional) and 漸.
JA_CHARACTERS_KEPT = "婁畢觜軫張氐漸"
# Characters of the names that may have a different Japanese form and are not decided here: for the reviewer, never converted.
JA_CHARACTER_QUESTIONS = "礪廄"
NOTE = re.compile(r"\s*[(（][^)）]*[)）]\s*$")

HEADER = (
    "// GENERATED by scripts/make-culture-data.py (the stars, lines and names) and scripts/make-culture-parts.py (the part of and ja columns). Do not edit by hand.\n"
    "// The traditional Chinese sky (the Three Enclosures and the Twenty-Eight Mansions): which Bright Star Catalogue stars carry the name of each asterism, from Wikidata (CC0), read 2026-11-09; read again with the star numbers 2026-11-12.\n"
    "// English names from Wikidata's asterism items, read 2026-11-11. The part of statements and the Japanese labels from data-sources/chinese-constellations-wikidata.jsonl: Wikidata (CC0) through its dump of 2026-11-17 (see NOTICE.md).\n"
    "// One row an asterism: id | name in Traditional characters | name in Simplified characters | pinyin | English name (blank where Wikidata has none) | the Symbol a mansion belongs to (blank for any other asterism) |\n"
    "// the enclosure (purple-forbidden, supreme-palace, heavenly-market) or the id of the mansion Wikidata says it is part of (blank where it says neither) |\n"
    "// stars of the asterism that are not held (at least: fainter than magnitude 6.0, which the catalogue does not hold, or not named with an HR number in Wikidata) |\n"
    "// chains of HR numbers, each chain a run of stars joined one to the next, chains separated by ; | each held star's number in the asterism (角宿一 is 1), in the order the stars first come in the chains, 0 for none, space-separated |\n"
    "// the Japanese label Wikidata gives the asterism, as it gives it (a column only on a row that has one; it waits for a native reader).\n\n"
)


def read_items():
    lines = [json.loads(line) for line in ITEMS.read_text(encoding="utf-8").splitlines() if line.strip()]
    return [item for item in lines[1:] if CHINESE_CONSTELLATION in item.get("p31", [])]


def labels_of(item):
    return [item["labels"][k] for k in ("zh-hant", "zh", "zh-hans") if k in item["labels"]]


def match(rows, items):
    """Row id -> the one item it matches, by labels only; and the rows that share a name with another."""
    found = {}
    for row in rows:
        spellings = {row[1], row[2]}
        sharing = [o for o in rows if {o[1], o[2]} & spellings]
        if len(sharing) > 1:
            continue
        exact = [i for i in items if spellings & set(labels_of(i))]
        hits = exact or [i for i in items if spellings & {NOTE.sub("", x) for x in labels_of(i)}]
        if len(hits) == 1:
            found[row[0]] = hits[0]
    return found


def japanese_form(name):
    """The name with each character of JA_CHARACTERS written in its Japanese form."""
    return "".join(JA_CHARACTERS.get(c, c) for c in name)


def build():
    text = DATA.read_text(encoding="utf-8")
    body = re.search(r"CHINESE_ROWS = `(.*?)`;", text, re.S).group(1)
    rows = [line.split("|")[:10] for line in body.split("\n")]
    items = read_items()
    found = match(rows, items)
    for fixed, fix in JA_LABEL_FIXES.items():
        item = found.get(fixed)
        if item is None or item["labels"].get("ja") != fix["was"]:
            raise SystemExit(f"JA_LABEL_FIXES: {fixed} no longer has the dump label {fix['was']!r}")
    names = [r[1] for r in rows]
    for kept in JA_CHARACTERS_KEPT + JA_CHARACTER_QUESTIONS:
        if kept in JA_CHARACTERS:
            raise SystemExit(f"JA_CHARACTERS: {kept} is a kept or doubtful character and must not be converted")
    for old, new in JA_CHARACTERS.items():
        if not any(old in n for n in names):
            raise SystemExit(f"JA_CHARACTERS: {old} is in no asterism's name")
        if new in JA_CHARACTERS:
            raise SystemExit(f"JA_CHARACTERS: {new} is both a Japanese form and a form to convert")
    mansion_of = {found[r[0]]["id"]: r[0] for r in rows if r[5] != "" and r[0] in found}
    out, stats = [], {"matched": len(found), "part_set": 0, "part_changed": 0, "ja": 0}
    for row in rows:
        item = found.get(row[0])
        part = row[6]
        if item is not None and row[5] == "":
            parts = [ENCLOSURES.get(q) or mansion_of.get(q) for q in item.get("p361", []) if q in ENCLOSURES or q in mansion_of]
            new = parts[0] if len(parts) == 1 else ""
            if new != part:
                stats["part_set" if part == "" else "part_changed"] += 1
                part = new
        ja = ""
        if item is not None and "ja" in item["labels"] and not NOTE.search(item["labels"]["ja"]):
            ja = JA_LABEL_FIXES.get(row[0], {}).get("ja", item["labels"]["ja"])
            stats["ja"] += 1
        if ja == "" and japanese_form(row[1]) != row[1]:
            ja = japanese_form(row[1])
            stats["ja_table"] = stats.get("ja_table", 0) + 1
        row = row[:6] + [part] + row[7:]
        out.append("|".join(row + ([ja] if ja else [])))
    return HEADER + "/** The asterism rows, one per line. */\n" + "export const CHINESE_ROWS = `" + "\n".join(out) + "`;\n", stats


def main():
    text, stats = build()
    if "--check" in sys.argv:
        sys.exit(0 if DATA.read_text(encoding="utf-8") == text else 1)
    DATA.write_text(text, encoding="utf-8")
    print(stats)


main()
