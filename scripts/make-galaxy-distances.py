#!/usr/bin/env python3
"""Write src/data/galaxy-distances-messier.ts and src/data/galaxy-distances-ngc-ic.ts: the distances of the Messier, NGC and IC galaxies, from Wikidata's "distance from Earth" statements (P2583).

Source: Wikidata (https://www.wikidata.org), whose data is CC0 1.0 (public domain dedication), read through its SPARQL endpoint https://query.wikidata.org/sparql. The query is QUERY
below, word for word; NOTICE.md records it with the date read. The endpoint is used as its usage policy asks (https://www.wikidata.org/wiki/Wikidata:SPARQL_query_service/query_limits
and https://foundation.wikimedia.org/wiki/Policy:User-Agent_policy): one query at a time, a User-Agent that names this project, a wait before each try again and the wait the
server asks for when it answers 429 or 503. One query is run in all, kept in a folder with --save and read again with --from, so the script need not touch the network twice.

What it keeps
- A statement is a distance when its rank is not "deprecated" and its unit is one of the lengths in UNITS (parsec, kiloparsec, megaparsec, light-year, kilometre and metre,
  all converted to parsecs, the unit items checked against Wikidata's English labels on 2026-11-10; a statement in any other unit is counted and left out).
- An item belongs to a galaxy of the deep-sky table (type `galaxy`) when its catalogue codes (P528: M, NGC, IC) name that galaxy's designations. An item whose codes name two
  galaxies is left out and listed.
- A galaxy with several statements keeps the median of the distances, the lowest and highest, the count, and, where one or more statements give bounds, the median of their errors.
  Values far from the others are not dropped: they are what the `disagree` flag (the highest more than 1.2 times the lowest) is for.
- The error is half the width of the statement's bounds (Wikidata's "upper bound" minus "lower bound"); none where no statement has bounds.
- A statement under 20 kpc is left out (NEAREST_PARSECS above). The method of every Wikidata value is "compiled, method not stated": Wikidata's "determination method" (P459) is
  on 2 statements of 19,309 and is counted in the answer, not used.
- Statements of every rank but deprecated count (a "preferred" one does not hide the others: the spread is the point).

    python3 -I scripts/make-galaxy-distances.py --save DIR     # runs the query (needs the network) and keeps the answer in DIR
    python3 -I scripts/make-galaxy-distances.py --from DIR     # reads the answer saved earlier
    python3 -I scripts/make-galaxy-distances.py --from DIR --out DIR2   # writes the two data files to DIR2 instead of src/data (the test does)

None of this runs in the test.
"""
import json
import re
import statistics
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

ENDPOINT = "https://query.wikidata.org/sparql"
USER_AGENT = "hoshi-stars-data-script/0.1 (https://github.com/johnmorrisdotca/hoshi-stars; john@johnmorris.ca)"
ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "src" / "data"

QUERY = """SELECT ?item ?id ?st ?rank ?d ?unit ?lo ?hi ?meth ?statedin WHERE {
  VALUES ?cat { wd:Q14530 wd:Q14534 wd:Q741672 }
  ?item p:P528 ?cs . ?cs ps:P528 ?id ; pq:P972 ?cat .
  FILTER(REGEX(?id, "^(M|NGC|IC) ?[0-9]+[A-Za-z]?$"))
  ?item p:P2583 ?st . ?st wikibase:rank ?rank ; psv:P2583 ?v . ?v wikibase:quantityAmount ?d ; wikibase:quantityUnit ?unit .
  OPTIONAL { ?v wikibase:quantityLowerBound ?lo ; wikibase:quantityUpperBound ?hi }
  OPTIONAL { ?st pq:P459 ?meth }
  OPTIONAL { ?st prov:wasDerivedFrom/pr:P248 ?statedin }
}"""

# Wikidata unit items, each as parsecs: the metre is 1 / 3.0856775814913673e16 parsec, the light-year 9.4607304725808e15 metres.
METRE_PER_PARSEC = 3.0856775814913673e16
LIGHT_YEAR_METRES = 9.4607304725808e15
UNITS = {
    "Q12129": 1.0,  # parsec
    "Q11929860": 1e3,  # kiloparsec
    "Q3773454": 1e6,  # megaparsec
    "Q531": LIGHT_YEAR_METRES / METRE_PER_PARSEC,  # light-year
    "Q828224": 1e3 / METRE_PER_PARSEC,  # kilometre
    "Q11573": 1 / METRE_PER_PARSEC,  # metre
}
# No galaxy of the NGC and IC lists is nearer than the Small Magellanic Cloud (60 kpc). A statement under 20 kpc is for a star cluster or nebula that the deep-sky table types as a
# galaxy (NGC 6469 at 550 pc, NGC 6535 at 6.9 kpc), and it is left out, counted and listed.
NEAREST_PARSECS = 20000.0


def fetch(saved: Path | None, keep: Path | None):
    if saved is not None:
        return json.loads((saved / "distances.json").read_text(encoding="utf-8"))["results"]["bindings"]
    url = ENDPOINT + "?" + urllib.parse.urlencode({"query": QUERY, "format": "json"})
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
            print(f"distances: HTTP {error.code}; waiting before trying again", file=sys.stderr)
            time.sleep(int(asked) if asked and asked.isdigit() else wait)
            wait *= 2
        except Exception as error:  # a timeout
            if attempt == 3:
                raise
            print(f"distances: {error}; waiting before trying again", file=sys.stderr)
            time.sleep(wait)
            wait *= 2
    if keep is not None:
        keep.mkdir(parents=True, exist_ok=True)
        (keep / "distances.json").write_bytes(raw)
        (keep / "query.rq").write_text(QUERY + "\n", encoding="utf-8")
    return json.loads(raw)["results"]["bindings"]


def last(x: dict, key: str) -> str:
    return x.get(key, {}).get("value", "").split("/")[-1].split("#")[-1]


def designation(text: str) -> str:
    found = re.match(r"^(M|NGC|IC) ?(\d+)([A-Za-z]?)$", text)
    return f"{found.group(1)} {int(found.group(2))}{found.group(3).upper()}"


def galaxies():
    """The galaxies of the deep-sky table: {designation: short id} for every name of a galaxy (its Messier, NGC and IC numbers and the others), and the list of short ids."""
    types = ["other", "galaxy", "globular cluster", "open cluster", "nebula", "planetary nebula", "supernova remnant"]
    by_name, ids = {}, []
    for source in ("messier.ts", "ngc-ic.ts"):
        text = (ROOT / "src" / "data" / source).read_text(encoding="utf-8")
        for line in re.search(r"= `(.*?)`;", text, re.S).group(1).split("\n"):
            p = line.split("|")
            if types[int(p[3])] != "galaxy":
                continue
            names = ([f"M {p[0]}"] if p[0] else []) + [f"NGC {n}" for n in p[1].split(",") if n] + [f"IC {n}" for n in p[2].split(",") if n]
            short = f"M{p[0]}" if p[0] else (f"N{p[1].split(',')[0]}" if p[1] else f"I{p[2].split(',')[0]}")
            ids.append(short)
            for name in names:
                by_name[name] = short
    return by_name, ids


def main() -> None:
    saved = Path(sys.argv[sys.argv.index("--from") + 1]) if "--from" in sys.argv else None
    keep = Path(sys.argv[sys.argv.index("--save") + 1]) if "--save" in sys.argv else None
    out_dir = Path(sys.argv[sys.argv.index("--out") + 1]) if "--out" in sys.argv else DATA
    out_messier, out_ngc_ic = out_dir / "galaxy-distances-messier.ts", out_dir / "galaxy-distances-ngc-ic.ts"
    rows = fetch(saved, keep)
    by_name, galaxy_ids = galaxies()

    designations = defaultdict(set)  # item -> designations
    statements = {}  # statement id -> {item, value (pc), lo, hi}
    skipped_units, deprecated, with_method, too_near = defaultdict(int), 0, set(), []
    for x in rows:
        item, st = last(x, "item"), x["st"]["value"]
        designations[item].add(designation(x["id"]["value"]))
        if st in statements or st in with_method:
            if "meth" in x:
                with_method.add(st)
            continue
        if last(x, "rank") == "DeprecatedRank":
            deprecated += 1
            statements[st] = None
            continue
        unit = last(x, "unit")
        if unit not in UNITS:
            skipped_units[unit] += 1
            statements[st] = None
            continue
        scale = UNITS[unit]
        value = float(x["d"]["value"]) * scale
        if value < NEAREST_PARSECS:
            too_near.append((item, value))
            statements[st] = None
            continue
        lo, hi = (float(x["lo"]["value"]) * scale, float(x["hi"]["value"]) * scale) if "lo" in x and "hi" in x else (None, None)
        statements[st] = {"item": item, "pc": value, "error": (hi - lo) / 2 if lo is not None and hi > lo else None}
        if "meth" in x:
            with_method.add(st)

    # The galaxy of each item: all its designations must name one galaxy.
    galaxy_of, mixed, unmatched = {}, [], 0
    for item, names in designations.items():
        found = {by_name[n] for n in names if n in by_name}
        if len(found) == 1:
            galaxy_of[item] = next(iter(found))
        elif len(found) > 1:
            mixed.append((item, sorted(found)))
        else:
            unmatched += 1

    per_galaxy = defaultdict(lambda: {"items": set(), "pc": [], "errors": []})
    for st in statements.values():
        if st is None or st["item"] not in galaxy_of:
            continue
        g = per_galaxy[galaxy_of[st["item"]]]
        g["items"].add(st["item"])
        g["pc"].append(st["pc"])
        if st["error"] is not None:
            g["errors"].append(st["error"])

    def pretty(v: float) -> str:
        return f"{v:.6g}"

    # One row a galaxy: id | Wikidata item(s) (digits after Q, comma-separated) | median parsecs | lowest | highest | count | median error or empty.
    out = []
    order = {short: n for n, short in enumerate(galaxy_ids)}
    for short in sorted(per_galaxy, key=lambda s: order[s]):
        g = per_galaxy[short]
        pcs = g["pc"]
        out.append("|".join([
            short, ",".join(sorted((i[1:] for i in g["items"]), key=int)), pretty(statistics.median(pcs)), pretty(min(pcs)), pretty(max(pcs)), str(len(pcs)),
            pretty(statistics.median(g["errors"])) if g["errors"] else "",
        ]))
    header = """// GENERATED by scripts/make-galaxy-distances.py. Do not edit by hand.
// Galaxy distances from Wikidata (CC0 1.0), its "distance from Earth" statements (P2583), read through its SPARQL endpoint; the query and the date are in NOTICE.md.
// One row a galaxy: id (`M31`, `N224` for NGC 224, `I1613` for IC 1613) | Wikidata item numbers (the digits after Q, comma-separated) | median distance in parsecs |
// lowest | highest | number of statements | median error in parsecs (empty where no statement gives one). Every value is "compiled, method not stated".
"""
    messier = [r for r in out if r.startswith("M")]
    rest = [r for r in out if not r.startswith("M")]
    out_messier.write_text(header + f"\n/** The Messier galaxies that have a distance, one per line. */\nexport const MESSIER_DISTANCES = `{chr(10).join(messier)}`;\n", encoding="utf-8")
    out_ngc_ic.write_text(header + f"\n/** The NGC and IC galaxies that are not Messier objects and have a distance, one per line. */\nexport const NGC_IC_DISTANCES = `{chr(10).join(rest)}`;\n", encoding="utf-8")
    disagree = sum(1 for g in per_galaxy.values() if len(g["pc"]) > 1 and max(g["pc"]) > 1.2 * min(g["pc"]))
    with_error = sum(1 for g in per_galaxy.values() if g["errors"])
    print(f"read {len(rows)} answer rows: {len(statements)} statements ({deprecated} deprecated, {sum(skipped_units.values())} in another unit {dict(skipped_units)}), {len(with_method)} with a method")
    print(f"items matched to a galaxy {len(galaxy_of)}, naming two galaxies {len(mixed)} {mixed[:10]}, matching no galaxy {unmatched}")
    print(f"{len(too_near)} statements under 20 kpc left out: {sorted(set(i for i, _ in too_near))[:6]} ...")
    print(f"wrote {out_messier} ({len(messier)}) and {out_ngc_ic} ({len(rest)}): {len(out)} of {len(galaxy_ids)} galaxies have a distance; {disagree} disagree (highest over 1.2 times lowest); {with_error} have an error")


if __name__ == "__main__":
    main()
