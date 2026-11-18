#!/usr/bin/env python3
"""Write src/data/discovery-messier.ts and src/data/discovery-ngc-ic.ts: who found each Messier, NGC and IC object and when, from Wikidata's "discoverer or inventor" (P61) and "date of discovery or invention" (P575) statements.

Source: Wikidata (https://www.wikidata.org), CC0 1.0, read through its SPARQL endpoint https://query.wikidata.org/sparql. The two queries are QUERY_DISCOVERERS and QUERY_DATES below, word for word; NOTICE.md records them with the date read. The endpoint
is used as its usage policy asks, like make-galaxy-distances.py: one query at a time, a User-Agent that names this project, a wait before each try again. The answers are kept in a folder with --save and read again with --from.

What it keeps
- An item belongs to an object of the deep-sky table when its catalogue codes (P528: M, NGC, IC) name that object's designations. An item whose codes name two objects is left out and listed.
- The discoverers of an object are the people its items name, in the order of the first statement, each once. They are kept as a table of names, with the Wikidata item of each; a statement whose value is not a person
  (a country, an institution) is counted and left out.
- The date is the earliest of the dates of its statements, with the precision Wikidata gives it (a year, a month or a day); when its statements give more than one date the row says so (flag `m`), and a precision coarser
  than a year is flagged `c`, and a date later than the object's own catalogue (a Messier object after 1800, an NGC or IC object after 1908) is flagged `x`. A date before the common era keeps its minus sign (`-0259` for the year 259 BC).
- Nothing is estimated and nothing is taken from anywhere else: an object whose items have no such statement has no row.

    python3 -I scripts/make-discovery-data.py --save DIR     # runs the queries (needs the network) and keeps the answers in DIR
    python3 -I scripts/make-discovery-data.py --from DIR     # reads the answers saved earlier

None of this runs in the test.
"""
from __future__ import annotations
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

ENDPOINT = "https://query.wikidata.org/sparql"
USER_AGENT = "hoshi-stars-data-script/0.1 (https://github.com/johnmorrisdotca/hoshi-stars)"
ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "src" / "data"

QUERY_DISCOVERERS = """SELECT ?item ?id ?disc ?discLabel ?human WHERE {
  VALUES ?cat { wd:Q14530 wd:Q14534 wd:Q741672 }
  ?item p:P528 ?cs . ?cs ps:P528 ?id ; pq:P972 ?cat .
  FILTER(REGEX(?id, "^(M|NGC|IC) ?[0-9]+[A-Za-z]?$"))
  ?item wdt:P61 ?disc .
  OPTIONAL { ?disc wdt:P31 ?human . FILTER(?human = wd:Q5) }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}"""

QUERY_DATES = """SELECT ?item ?id ?date ?prec WHERE {
  VALUES ?cat { wd:Q14530 wd:Q14534 wd:Q741672 }
  ?item p:P528 ?cs . ?cs ps:P528 ?id ; pq:P972 ?cat .
  FILTER(REGEX(?id, "^(M|NGC|IC) ?[0-9]+[A-Za-z]?$"))
  ?item p:P575 ?st . ?st psv:P575 ?v . ?v wikibase:timeValue ?date ; wikibase:timePrecision ?prec .
}"""


def run(query: str, name: str, saved: Path | None, keep: Path | None):
    if saved is not None:
        return json.loads((saved / f"{name}.json").read_text(encoding="utf-8"))["results"]["bindings"]
    url = ENDPOINT + "?" + urllib.parse.urlencode({"query": query, "format": "json"})
    wait = 30
    for attempt in range(4):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/sparql-results+json"})
            with urllib.request.urlopen(request, timeout=170) as response:
                raw = response.read()
            break
        except urllib.error.HTTPError as error:
            if attempt == 3:
                raise
            asked = error.headers.get("Retry-After")
            print(f"{name}: HTTP {error.code}; waiting before trying again", file=sys.stderr)
            time.sleep(int(asked) if asked and asked.isdigit() else wait)
            wait *= 2
        except Exception as error:
            if attempt == 3:
                raise
            print(f"{name}: {error}; waiting before trying again", file=sys.stderr)
            time.sleep(wait)
            wait *= 2
    if keep is not None:
        keep.mkdir(parents=True, exist_ok=True)
        (keep / f"{name}.json").write_bytes(raw)
        (keep / f"{name}.rq").write_text(query + "\n", encoding="utf-8")
    return json.loads(raw)["results"]["bindings"]


def last(x: dict, key: str) -> str:
    return x.get(key, {}).get("value", "").split("/")[-1].split("#")[-1]


def designation(text: str) -> str:
    found = re.match(r"^(M|NGC|IC) ?(\d+)([A-Za-z]?)$", text)
    return f"{found.group(1)} {int(found.group(2))}{found.group(3).upper()}"


def objects():
    """Every object of the deep-sky table: {designation: short id}, and the short ids in table order. The short id is `M31`, `N224` for NGC 224 and `I1613` for IC 1613, as in the distance tables."""
    by_name, ids = {}, []
    for source in ("messier.ts", "ngc-ic.ts"):
        text = (DATA / source).read_text(encoding="utf-8")
        for line in re.search(r"= `(.*?)`;", text, re.S).group(1).split("\n"):
            p = line.split("|")
            names = ([f"M {p[0]}"] if p[0] else []) + [f"NGC {n}" for n in p[1].split(",") if n] + [f"IC {n}" for n in p[2].split(",") if n]
            short = f"M{p[0]}" if p[0] else (f"N{p[1].split(',')[0]}" if p[1] else f"I{p[2].split(',')[0]}")
            ids.append(short)
            for name in names:
                by_name[name] = short
    return by_name, ids


def iso(value: str, precision: int) -> str | None:
    """A date as Wikidata gives it (`+1731-01-01T00:00:00Z`) at its precision: year (9), month (10) or day (11); anything coarser is given as the year and flagged by the caller."""
    found = re.match(r"^([+-]?)(\d{4,})-(\d\d)-(\d\d)T", value)
    if not found:
        return None
    year = f"{found.group(1) if found.group(1) == '-' else ''}{int(found.group(2)):04d}"
    if precision >= 11:
        return f"{year}-{found.group(3)}-{found.group(4)}"
    if precision == 10:
        return f"{year}-{found.group(3)}"
    return year


def main() -> None:
    saved = Path(sys.argv[sys.argv.index("--from") + 1]) if "--from" in sys.argv else None
    keep = Path(sys.argv[sys.argv.index("--save") + 1]) if "--save" in sys.argv else None
    discoverer_rows = run(QUERY_DISCOVERERS, "discoverers", saved, keep)
    if saved is None:
        time.sleep(10)
    date_rows = run(QUERY_DATES, "dates", saved, keep)
    by_name, ids = objects()

    item_names = defaultdict(set)
    for x in discoverer_rows + date_rows:
        item_names[last(x, "item")].add(designation(x["id"]["value"]))
    object_of, mixed = {}, []
    for item, names in item_names.items():
        found = {by_name[n] for n in names if n in by_name}
        if len(found) == 1:
            object_of[item] = next(iter(found))
        elif len(found) > 1:
            mixed.append((item, sorted(found)))

    people, others = {}, defaultdict(int)  # Wikidata item -> name; not a person -> count
    found_by = defaultdict(list)  # object -> [person item]
    for x in discoverer_rows:
        item = last(x, "item")
        if item not in object_of:
            continue
        who = last(x, "disc")
        if "human" not in x:
            others[x.get("discLabel", {}).get("value", who)] += 1
            continue
        people.setdefault(who, x["discLabel"]["value"])
        if who not in found_by[object_of[item]]:
            found_by[object_of[item]].append(who)

    dates = defaultdict(set)  # object -> {(iso, precision)}
    dropped = []
    for x in date_rows:
        item = last(x, "item")
        if item not in object_of:
            continue
        precision = int(x["prec"]["value"])
        value = iso(x["date"]["value"], precision)
        if value is None:
            dropped.append((object_of[item], x["date"]["value"], precision))
            continue
        dates[object_of[item]].add((value, precision))

    order = sorted(people, key=lambda q: (people[q].lower(), q))
    index = {q: n for n, q in enumerate(order)}
    out = []
    for n, short in enumerate(ids):
        who = found_by.get(short, [])
        when = sorted(dates.get(short, set()))
        if not who and not when:
            continue
        flags = ""
        if len({v for v, _ in when}) > 1:
            flags += "m"
        if any(p < 9 for _, p in when):
            flags += "c"
        # a date later than the object's own catalogue (a Messier object after 1800, an NGC or IC object after 1908, the end of the Index Catalogue) is flagged `x`, and kept as Wikidata gives it
        if when and int(when[0][0][:5] if when[0][0].startswith("-") else when[0][0][:4]) > (1800 if short.startswith("M") else 1908):
            flags += "x"
        out.append("|".join([short, ",".join(str(index[q]) for q in who), when[0][0] if when else "", flags]))

    names_lines = ",\n".join(f'  [{json.dumps(people[q], ensure_ascii=False)}, {int(q[1:])}]' for q in order)
    header = """// GENERATED by scripts/make-discovery-data.py. Do not edit by hand.
// Who found each Messier, NGC and IC object and when, from Wikidata (CC0 1.0), its "discoverer or inventor" (P61) and "date of discovery or invention" (P575) statements, read through its SPARQL endpoint; the queries and the date are in NOTICE.md.
// One row an object: id (`M31`, `N224` for NGC 224, `I1613` for IC 1613) | the discoverers (indexes into DISCOVERERS, comma-separated, in the order Wikidata gives them) | the date (a year, `1731`, or a month or a day) |
// flags (`m`: the statements give more than one date and this is the earliest; `c`: a date coarser than a year was given; `x`: a date later than the object's own catalogue, kept as Wikidata gives it).
"""
    messier = [r for r in out if r.startswith("M")]
    rest = [r for r in out if not r.startswith("M")]
    people_block = f"\n/** The people Wikidata names as discoverers, in the order the rows count them: their names, and the digits after Q of their Wikidata items. */\nexport const DISCOVERERS: readonly (readonly [name: string, wikidata: number])[] = [\n{names_lines},\n];\n"
    (DATA / "discovery-messier.ts").write_text(header + people_block + f"\n/** The Messier objects that have a discoverer or a date, one per line. */\nexport const MESSIER_DISCOVERY = `{chr(10).join(messier)}`;\n", encoding="utf-8")
    (DATA / "discovery-ngc-ic.ts").write_text(header + f"\n/** The NGC and IC objects that are not Messier objects and have a discoverer or a date, one per line; the discoverers are those of `discovery-messier.ts`. */\nexport const NGC_IC_DISCOVERY = `{chr(10).join(rest)}`;\n", encoding="utf-8")
    with_who = sum(1 for r in out if r.split("|")[1])
    with_date = sum(1 for r in out if r.split("|")[2])
    print(f"read {len(discoverer_rows)} discoverer rows and {len(date_rows)} date rows; items matched to an object {len(object_of)}, naming two objects {len(mixed)} {mixed[:6]}")
    print(f"statements whose value is not a person (left out): {dict(sorted(others.items(), key=lambda kv: -kv[1])[:8])}; dates left out {len(dropped)} {dropped[:4]}")
    print(f"wrote {len(out)} rows of {len(ids)} objects: {with_who} with a discoverer, {with_date} with a date, {sum(1 for r in out if 'm' in r.split('|')[3])} with more than one date; {len(people)} people")


if __name__ == "__main__":
    main()
