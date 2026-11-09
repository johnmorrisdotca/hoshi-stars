#!/usr/bin/env python3
"""Write src/data/messier.ts and src/data/ngc-ic.ts: the Messier, NGC and IC objects from Wikidata.

Source: Wikidata (https://www.wikidata.org), whose data is CC0 1.0 (public domain dedication), read through its SPARQL endpoint
https://query.wikidata.org/sparql. The queries are the QUERIES below, word for word; NOTICE.md records them with the date read. Wikidata is crowd-edited, so this
script is careful and scripts/check-deep-sky-ned.py compares the result with NASA/IPAC NED.

What it keeps
- An item is a deep-sky object when it has a "catalog code" (P528) in the Messier (Q14530), New General (Q14534) or Index (Q741672) catalogue with a plain number
  (`M31`, `NGC 224`, `NGC 2807A`, `IC 434`) and both a right ascension (P6257) and a declination (P6258), in degrees, J2000 (no epoch, or the epoch J2000.0).
- Statements ranked "deprecated" are ignored. Where an item has several positions that agree to 1 arc-minute their mean is used; where they disagree the item is left out
  (a Messier object is kept, with NED's position).
- A position more than 1 arc-minute from NED's is replaced by NED's (scripts/check-deep-sky-ned.py, applied from NED_POSITIONS).
- The Messier objects' magnitudes and sizes are NASA HEASARC's Messier table (heasarc_messier) where it has them; Wikidata's V band mixes in the central star's magnitude for
  planetary nebulae and values that differ by more than a magnitude for others. A planetary nebula outside the Messier list gets no magnitude, for the same reason.
- The constellation is the one the position is in by the IAU boundaries (scripts/deep-sky-constellations.ts, run last), not Wikidata's statement.
- Type (P31) is mapped to a small fixed vocabulary; magnitude is the V band (P1215 with band V, Q4892529); size is the angular diameter (P5348) in arc-minutes.
- Two items that carry the same catalogue number and sit within 1 arc-minute are one object (the Messier item, else the one labelled with the number, else the one with more
  data, is kept); where they sit further apart the number stays with the item labelled with it.

    python3 -I scripts/make-deep-sky-data.py                      # runs the queries (needs the network)
    python3 -I scripts/make-deep-sky-data.py --save DIR           # ... and keeps each answer in DIR
    python3 -I scripts/make-deep-sky-data.py --from DIR           # reads answers saved earlier
    python3 -I scripts/make-deep-sky-data.py --no-ned             # leaves out scripts/deep-sky-ned-positions.tsv, to compare Wikidata's own positions with NED's
    python3 -I scripts/make-deep-sky-data.py --no-sky-catalogue   # the fallback (MODULES-781), below; writes data-no-sky-catalogue/messier.ts and touches nothing in src/

The fallback, for the day Sky Catalog 2000.0 (by way of HEASARC's Messier table) has to come out. It does not read HEASARC at all. The Messier magnitudes are Wikidata's V band as above,
except where scripts/data/messier-fixes.tsv gives a value from a cited source (or, with the value left empty, says there is no clean one and the object has no magnitude), and the sizes are
the ones in scripts/data/messier-sizes.tsv (made by scripts/make-messier-fallback-sources.py); Wikidata's own Messier sizes have no reference and are not used. Positions, names, types and
constellations are the same as the default build's. The default build is unchanged, and its src/data/messier.ts stays byte for byte what it was. TO SWAP THE FALLBACK IN, copy
data-no-sky-catalogue/messier.ts over src/data/messier.ts (the one change; docs/research/messier-no-sky-catalogue.md lists what else it moves).

None of this runs in the test.
"""
import gzip
import json
import math
import re
import subprocess
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

ENDPOINT = "https://query.wikidata.org/sparql"
HEASARC = "https://heasarc.gsfc.nasa.gov/FTP/heasarc/dbase/tdat_files/heasarc_messier.tdat.gz"
USER_AGENT = "hoshi-stars-data-script/0.1 (https://github.com/johnmorrisdotca/hoshi-stars)"
ROOT = Path(__file__).resolve().parent.parent
OUT_MESSIER = ROOT / "src" / "data" / "messier.ts"
OUT_NGC_IC = ROOT / "src" / "data" / "ngc-ic.ts"
OUT_FALLBACK = ROOT / "data-no-sky-catalogue" / "messier.ts"
FIXES = ROOT / "scripts" / "data" / "messier-fixes.tsv"
SIZES = ROOT / "scripts" / "data" / "messier-sizes.tsv"

# The items to read: those with a catalog code in one of the three catalogues and a plain number. Every query below starts with this.
SELECTION = """VALUES ?cat { wd:Q14530 wd:Q14534 wd:Q741672 }
  ?item p:P528 ?cs . ?cs ps:P528 ?id ; pq:P972 ?cat .
  FILTER(REGEX(?id, "^(M|NGC|IC) ?[0-9]+[A-Za-z]?$"))"""

QUERIES = {
    "ids": """SELECT DISTINCT ?item ?id ?cat WHERE {
  %s
}""" % SELECTION,
    "coordinates": """SELECT DISTINCT ?item ?ra ?raUnit ?raEpoch ?raRank ?dec ?decUnit ?decEpoch ?decRank WHERE {
  %s
  ?item p:P6257 ?rs . ?rs psv:P6257 ?rv ; wikibase:rank ?raRank . ?rv wikibase:quantityAmount ?ra ; wikibase:quantityUnit ?raUnit .
  ?item p:P6258 ?ds . ?ds psv:P6258 ?dv ; wikibase:rank ?decRank . ?dv wikibase:quantityAmount ?dec ; wikibase:quantityUnit ?decUnit .
  OPTIONAL { ?rs pq:P6259 ?raEpoch }
  OPTIONAL { ?ds pq:P6259 ?decEpoch }
}""" % SELECTION,
    "types": """SELECT DISTINCT ?item ?class ?rank WHERE {
  %s
  ?item p:P31 ?ts . ?ts ps:P31 ?class ; wikibase:rank ?rank .
}""" % SELECTION,
    "classes": """SELECT DISTINCT ?class ?kind WHERE {
  VALUES ?kind { wd:Q318 wd:Q42372 wd:Q13632 wd:Q207436 wd:Q11276 wd:Q11387 }
  ?class wdt:P279* ?kind .
}""",
    "magnitudes": """SELECT DISTINCT ?item ?mag ?rank WHERE {
  %s
  ?item p:P1215 ?ms . ?ms psv:P1215 ?mv ; wikibase:rank ?rank ; pq:P1227 wd:Q4892529 . ?mv wikibase:quantityAmount ?mag .
}""" % SELECTION,
    "labels": """SELECT DISTINCT ?item ?label ?constellationLabel WHERE {
  %s
  OPTIONAL { ?item rdfs:label ?label . FILTER(LANG(?label) = "en") }
  OPTIONAL { ?item wdt:P59 ?constellation }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}""" % SELECTION,
    "aliases": """SELECT DISTINCT ?item ?alias WHERE {
  %s
  ?item skos:altLabel ?alias . FILTER(LANG(?alias) = "en")
}""" % SELECTION,
    "sizes": """SELECT DISTINCT ?item ?size ?unit ?rank WHERE {
  %s
  ?item p:P5348 ?ss . ?ss psv:P5348 ?sv ; wikibase:rank ?rank . ?sv wikibase:quantityAmount ?size ; wikibase:quantityUnit ?unit .
}""" % SELECTION,
}

CATALOGUES = {"Q14530": "M", "Q14534": "NGC", "Q741672": "IC"}
DEGREE = "Q28390"
J2000 = "Q1264450"
V_BAND = "Q4892529"
ARCMINUTE_UNITS = {"Q209426": 1.0, "Q829073": 1 / 60, "Q28390": 60.0}  # arc-minute, arc-second, degree

# The vocabulary, in the order the data stores it: the digit in a row is the index.
TYPES = ["other", "galaxy", "globular cluster", "open cluster", "nebula", "planetary nebula", "supernova remnant"]
# When an item has classes of several types the first listed here wins (a nebula before a cluster: the Eagle Nebula is both).
TYPE_PRIORITY = ["planetary nebula", "supernova remnant", "globular cluster", "nebula", "open cluster", "galaxy"]
# The classes that mean each type are the class and its subclasses in Wikidata (the "classes" query: galaxy, nebula, planetary nebula, supernova remnant, globular cluster,
# open cluster), and these few that are not subclasses but are what a galaxy is called when its centre is what was catalogued.
KINDS = {"Q318": "galaxy", "Q42372": "nebula", "Q13632": "planetary nebula", "Q207436": "supernova remnant", "Q11276": "globular cluster", "Q11387": "open cluster"}
EXTRA_GALAXY_CLASSES = ["Q46587", "Q83373", "Q221221", "Q217012"]  # active galactic nucleus, quasar, blazar, radio galaxy
# Items that are not an object: a disambiguation page or a duplicate.
NOT_OBJECTS = {"Q4167410", "Q17362920"}

# NED's position (degrees J2000, rounded to ten-thousandths) for each object whose Wikidata position is more than 1 arc-minute from it, as scripts/check-deep-sky-ned.py writes
# them: one line `id<TAB>ra<TAB>dec<TAB>wikidata ra<TAB>wikidata dec<TAB>arc-minutes apart`. The id is `M45`, or the NGC or IC name for an object with no Messier number.
NED_POSITIONS = ROOT / "scripts" / "deep-sky-ned-positions.tsv"

# A name must be a name: no digits, except a leading star number (`47 Tucanae`), so catalogue labels (`Messier 2`, `Arp 87`) are not names.
NAME_OK = re.compile(r"^(?:\d+ )?[^\d]+$")
HAS_LETTERS = re.compile(r"[A-Za-zÀ-ɏ]{4}")


def fetch(name: str, saved: Path | None, keep: Path | None):
    if saved is not None:
        return json.loads((saved / f"{name}.json").read_text(encoding="utf-8"))["results"]["bindings"]
    url = ENDPOINT + "?" + urllib.parse.urlencode({"query": QUERIES[name], "format": "json"})
    for attempt in range(4):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/sparql-results+json"})
            with urllib.request.urlopen(request, timeout=170) as response:
                raw = response.read()
            break
        except Exception as error:  # the endpoint times out or throttles now and then
            if attempt == 3:
                raise
            print(f"{name}: {error}; trying again", file=sys.stderr)
            time.sleep(10 * (attempt + 1))
    if keep is not None:
        keep.mkdir(parents=True, exist_ok=True)
        (keep / f"{name}.json").write_bytes(raw)
    return json.loads(raw)["results"]["bindings"]


def heasarc_messier(saved: Path | None, keep: Path | None):
    """NASA HEASARC's table of the Messier objects (heasarc_messier): {number: (visual magnitude or None, major axis in arc-minutes or None, constellation)}."""
    if saved is not None:
        raw = (saved / "messier.tdat.gz").read_bytes()
    else:
        request = urllib.request.Request(HEASARC, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(request, timeout=120) as response:
            raw = response.read()
        if keep is not None:
            keep.mkdir(parents=True, exist_ok=True)
            (keep / "messier.tdat.gz").write_bytes(raw)
    lines = (gzip.decompress(raw) if raw[:2] == b"\x1f\x8b" else raw).decode("latin-1").splitlines()
    columns = next(line for line in lines if line.startswith("line[1]")).split("=", 1)[1].split()
    table = {}
    for line in lines[lines.index("<DATA>") + 1 : lines.index("<END>")]:
        r = dict(zip(columns, line.split("|")))
        number = int(r["name"].replace("M", "").strip())
        size = re.match(r"\s*(\d+(?:\.\d+)?)", r["dimension"])
        table[number] = (float(r["vmag"]) if r["vmag"].strip() else None, float(size.group(1)) if size else None, r["constell"].strip().title())
    return table


def tsv(path: Path):
    """The rows of one of the fallback's tables as dicts, by the names in its header line."""
    lines = path.read_text(encoding="utf-8").splitlines()
    names = lines[0].split("\t")
    return [dict(zip(names, line.split("\t"))) for line in lines[1:] if line.strip()]


def last(x: dict, key: str) -> str:
    return x.get(key, {}).get("value", "").split("/")[-1].split("#")[-1]


def fold(text: str) -> str:
    return re.sub(r"\s+", " ", unicodedata.normalize("NFD", text).encode("ascii", "ignore").decode().lower()).strip()


def separation_arcmin(a, b) -> float:
    """Angle between two (ra, dec) positions in degrees, in arc-minutes (haversine)."""
    ra1, dec1, ra2, dec2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((dec2 - dec1) / 2) ** 2 + math.cos(dec1) * math.cos(dec2) * math.sin((ra2 - ra1) / 2) ** 2
    return math.degrees(2 * math.asin(min(1.0, math.sqrt(h)))) * 60


def constellation_table():
    """Latin and English names to the IAU abbreviation, read from src/data/constellations.ts (used as labels only)."""
    table = {}
    text = (ROOT / "src" / "data" / "constellations.ts").read_text(encoding="utf-8")
    for row in re.search(r"CONSTELLATION_ROWS = `(.*?)`", text, re.S).group(1).split("\n"):
        abbreviation, name, genitive, english, _ = row.split("|")
        for label in (name, english):
            table[fold(label)] = abbreviation
    table[fold("Serpens Caput")] = "Ser"
    table[fold("Serpens Cauda")] = "Ser"
    return table


def number_of(designation: str):
    """(catalogue, number, suffix) of `NGC 2807A` -> ("NGC", 2807, "A")."""
    match = re.match(r"^(M|NGC|IC) ?(\d+)([A-Za-z]?)$", designation)
    return match.group(1), int(match.group(2)), match.group(3).upper()


def label_designation(label: str):
    match = re.match(r"^(?:Messier|M|NGC|IC) ?(\d+)([A-Za-z]?)$", label or "")
    return (label.split()[0].replace("Messier", "M"), int(match.group(1)), match.group(2).upper()) if match else None


def candidates(values):
    """The distinct values of a statement list, leaving out deprecated statements and, where there is one, keeping only the preferred."""
    values = [v for v in values if v[1] != "deprecated"]
    preferred = [v for v in values if v[1] == "preferred"]
    return sorted({v[0] for v in (preferred or values)})


def main() -> None:
    saved = Path(sys.argv[sys.argv.index("--from") + 1]) if "--from" in sys.argv else None
    keep = Path(sys.argv[sys.argv.index("--save") + 1]) if "--save" in sys.argv else None
    fallback = "--no-sky-catalogue" in sys.argv
    data = {name: fetch(name, saved, keep) for name in QUERIES}
    abbreviations = constellation_table()

    # Designations by item.
    designations = defaultdict(set)
    for x in data["ids"]:
        found = re.match(r"^(M|NGC|IC) ?(\d+)([A-Za-z]?)$", x["id"]["value"])
        designations[last(x, "item")].add(f"{CATALOGUES[last(x, 'cat')]} {int(found.group(2))}{found.group(3).upper()}")

    # Positions.
    ras, decs = defaultdict(list), defaultdict(list)
    bad_epoch = set()
    for x in data["coordinates"]:
        item = last(x, "item")
        if last(x, "raUnit") != DEGREE or last(x, "decUnit") != DEGREE or last(x, "raEpoch") not in ("", J2000) or last(x, "decEpoch") not in ("", J2000):
            bad_epoch.add(item)
            continue
        ras[item].append((float(x["ra"]["value"]), last(x, "raRank").replace("Rank", "").lower()))
        decs[item].append((float(x["dec"]["value"]), last(x, "decRank").replace("Rank", "").lower()))
    positions, ambiguous = {}, set()
    for item in ras:
        if item in bad_epoch:
            continue
        ra_values, dec_values = candidates(ras[item]), candidates(decs[item])
        if not ra_values or not dec_values:
            continue
        if not all(0 <= r < 360.000001 for r in ra_values) or not all(-90 <= d <= 90 for d in dec_values):
            continue
        ra, dec = sum(ra_values) / len(ra_values), sum(dec_values) / len(dec_values)
        spread = max(separation_arcmin((r, dec), (ra, dec)) for r in ra_values), max(separation_arcmin((ra, d), (ra, dec)) for d in dec_values)
        if max(spread) > 1.0:
            ambiguous.add(item)
        positions[item] = (ra % 360, dec)

    # Types.
    classes = defaultdict(list)
    for x in data["types"]:
        if last(x, "rank") != "DeprecatedRank":
            classes[last(x, "item")].append((last(x, "class"), last(x, "rank") == "PreferredRank"))
    class_types = defaultdict(set)
    for x in data["classes"]:
        class_types[last(x, "class")].add(KINDS[last(x, "kind")])
    for extra in EXTRA_GALAXY_CLASSES:
        class_types[extra].add("galaxy")
    kinds, not_objects = {}, set()
    for item, found in classes.items():
        if any(c in NOT_OBJECTS for c, _ in found):
            not_objects.add(item)
        preferred = [c for c, p in found if p and c in class_types]
        chosen = set().union(*(class_types[c] for c in (preferred or [c for c, _ in found if c in class_types])))
        kinds[item] = next((t for t in TYPE_PRIORITY if t in chosen), "other")

    # Magnitudes: the V band; the brightest of the statements that are not deprecated.
    visual = {}
    for x in data["magnitudes"]:
        if last(x, "rank") == "DeprecatedRank":
            continue
        item, value = last(x, "item"), float(x["mag"]["value"])
        if item not in visual or value < visual[item]:
            visual[item] = value

    sizes = {}
    for x in data["sizes"]:
        if last(x, "rank") != "DeprecatedRank" and last(x, "unit") in ARCMINUTE_UNITS:
            sizes[last(x, "item")] = max(sizes.get(last(x, "item"), 0), float(x["size"]["value"]) * ARCMINUTE_UNITS[last(x, "unit")])

    names, constellations = {}, {}
    for x in data["labels"]:
        item = last(x, "item")
        if "label" in x:
            names[item] = x["label"]["value"]
        if "constellationLabel" in x:
            abbreviation = abbreviations.get(fold(x["constellationLabel"]["value"]))
            if abbreviation is not None:
                constellations[item] = abbreviation
    aliases = defaultdict(set)
    for x in data["aliases"]:
        aliases[last(x, "item")].add(x["alias"]["value"])

    # Objects: one per item with a position; then merge duplicates that share a catalogue number.
    items = {q: d for q, d in designations.items() if q in positions and q not in not_objects}

    def richness(q):
        return (q in visual) + (q in sizes) + (kinds.get(q, "other") != "other") + (q in constellations)

    def label_matches(q, designation):
        found = label_designation(names.get(q, ""))
        return found is not None and f"{found[0]} {found[1]}{found[2]}" == designation

    def has_messier(q):
        return any(d.startswith("M ") for d in items[q])

    # A number held by two items: items within 1 arc-minute are one object (the head takes the other's numbers); items further apart keep the number on the head only.
    head_of = {q: q for q in items}
    owner = {}
    for designation in sorted({d for ds in items.values() for d in ds}, key=lambda d: (number_of(d)[0] != "M", number_of(d)[1], number_of(d)[2])):
        holders = sorted({head_of[q] for q, ds in items.items() if designation in ds})
        head = max(holders, key=lambda q: (has_messier(q), label_matches(q, designation), richness(q), -int(q[1:])))
        owner[designation] = head
        for q in holders:
            if q != head and separation_arcmin(positions[q], positions[head]) <= 1.0:
                for other in head_of:
                    if head_of[other] == q:
                        head_of[other] = head
    group_of = defaultdict(list)
    for q in items:
        group_of[head_of[q]].append(q)
    objects = []
    for q, group in group_of.items():
        group = [q] + sorted(g for g in group if g != q)
        mine = {d for g in group for d in items[g] if head_of[owner[d]] == q}
        if not mine:
            continue
        pick = lambda table: next((table[g] for g in group if g in table), None)
        kind = kinds.get(q, "other")
        if kind == "other":
            kind = next((kinds[g] for g in group if kinds.get(g, "other") != "other"), "other")
        sort = lambda catalogue: sorted((number_of(d) for d in mine if d.startswith(catalogue + " ")), key=lambda t: (t[2] != "", t[1], t[2]))
        messier, ngc, ic = sort("M"), sort("NGC"), sort("IC")
        if len(messier) > 1:
            print(f"{q} has two Messier numbers: {messier}", file=sys.stderr)
            continue
        objects.append({
            "item": q, "messier": messier[0][1] if messier else None,
            "ngc": [f"{n}{s}" for _, n, s in ngc], "ic": [f"{n}{s}" for _, n, s in ic],
            "type": kind, "ra": positions[q][0], "dec": positions[q][1], "ambiguous": q in ambiguous,
            "mag": pick(visual), "size": pick(sizes),
            "constellation": pick(constellations), "name": names.get(q), "aliases": set().union(*(aliases[g] for g in group)),
        })

    heasarc = {} if fallback else heasarc_messier(saved, keep)
    fixes = {int(r["object"][1:]): (float(r["v_magnitude"]) if r["v_magnitude"] else None) for r in tsv(FIXES)} if fallback else {}
    fallback_sizes = {int(r["object"][1:]): float(r["size_arcmin"]) for r in tsv(SIZES)} if fallback else {}
    ned = {}
    if "--no-ned" not in sys.argv and NED_POSITIONS.exists():
        for line in NED_POSITIONS.read_text(encoding="utf-8").splitlines():
            fields = line.split("\t")
            ned[fields[0]] = (float(fields[1]), float(fields[2]))
    corrections = 0
    abbreviations_by_upper = {a.upper(): a for a in set(abbreviations.values())}
    differences = []
    result = []
    for o in objects:
        if o["ambiguous"] and o["messier"] is None:
            continue
        corrected = ned.get(f"M{o['messier']}" if o["messier"] is not None else (f"NGC {o['ngc'][0]}" if o["ngc"] else f"IC {o['ic'][0]}"))
        if corrected is not None:
            o["ra"], o["dec"] = corrected
            corrections += 1
        if o["messier"] is None and o["type"] == "planetary nebula":
            o["mag"] = None  # Wikidata's V band for a planetary nebula is mostly its central star's (the Helix is 13.5)
        if o["messier"] is not None and fallback:
            if o["messier"] in fixes:
                o["mag"] = fixes[o["messier"]]
            o["size"] = fallback_sizes.get(o["messier"])
        elif o["messier"] is not None:
            published_mag, published_size, published_constellation = heasarc.get(o["messier"], (None, None, None))
            if published_mag is not None:
                if o["mag"] is not None and abs(o["mag"] - published_mag) > 1.0:
                    differences.append(f"M{o['messier']}: Wikidata V {o['mag']}, published {published_mag}")
                o["mag"] = published_mag
            if published_size is not None:
                o["size"] = published_size
            if published_constellation is not None and abbreviations_by_upper.get(published_constellation.upper()) != o["constellation"]:
                differences.append(f"M{o['messier']}: Wikidata constellation {o['constellation']}, HEASARC {published_constellation}")
        label = o["name"]
        o["name"] = label if label and NAME_OK.match(label) and HAS_LETTERS.search(label) else ""
        seen = {fold(o["name"])}
        kept = []
        for alias in sorted(o["aliases"]):
            if NAME_OK.match(alias) and HAS_LETTERS.search(alias) and fold(alias) not in seen:
                seen.add(fold(alias))
                kept.append(alias)
        o["aliases"] = kept
        result.append(o)
    ambiguous_dropped = sum(1 for o in objects if o["ambiguous"] and o["messier"] is None)

    def key(o):
        return (o["messier"] is None, o["messier"] or 0, int(re.sub(r"\D", "", o["ngc"][0])) if o["ngc"] else 10**6, int(re.sub(r"\D", "", o["ic"][0])) if o["ic"] else 10**6, o["item"])

    result.sort(key=key)
    problems = []
    messier = [o for o in result if o["messier"] is not None]
    if [o["messier"] for o in messier] != list(range(1, 111)):
        problems.append(f"the Messier objects are not M1 to M110: {sorted(set(range(1, 111)) - {o['messier'] for o in messier})}")
    for o in messier:
        if o["mag"] is None and not (fallback and o["messier"] in fixes):
            problems.append(f"M{o['messier']} has no magnitude")
        if o["constellation"] is None:
            problems.append(f"M{o['messier']} has no constellation")
    if problems:
        print("\n".join(problems))
        sys.exit(1)

    def row(o):
        return "|".join([
            str(o["messier"] or ""), ",".join(o["ngc"]), ",".join(o["ic"]), str(TYPES.index(o["type"])),
            str(round(o["ra"] * 10000)), str(round(o["dec"] * 10000)),
            str(round(o["mag"] * 100)) if o["mag"] is not None else "", str(round(o["size"] * 10)) if o["size"] else "",
            o["constellation"] or "", o["name"], ";".join(o["aliases"]),
        ])

    header = f"""// GENERATED by scripts/make-deep-sky-data.py. Do not edit by hand.
// Deep-sky objects from Wikidata (CC0 1.0), read through its SPARQL endpoint; the queries and the date are in NOTICE.md. One row an object:
// Messier number | NGC numbers | IC numbers (comma-separated, a letter after a number is part of it) | type (index into the list in `../deep-sky.ts`) |
// RA J2000 and Dec J2000 in ten-thousandths of a degree | V magnitude times 100 | angular size in tenths of an arc-minute | IAU constellation abbreviation |
// English name | other English names (semicolon-separated).
"""
    in_messier = [o for o in result if o["messier"] is not None]
    rest = [o for o in result if o["messier"] is None]
    if fallback:
        fallback_header = f"""// GENERATED by scripts/make-deep-sky-data.py --no-sky-catalogue (MODULES-781). Do not edit by hand. NOT SHIPPED: the fallback for the Messier magnitudes and sizes, the day NASA HEASARC's
// Messier table (Sky Catalog 2000.0) has to come out. Copy it over src/data/messier.ts to swap it in. Same rows and columns as that file; magnitudes are Wikidata's V band (CC0) with the
// values in scripts/data/messier-fixes.tsv, sizes are scripts/data/messier-sizes.tsv; where either is empty the column is empty.
// Messier number | NGC numbers | IC numbers (comma-separated, a letter after a number is part of it) | type (index into the list in `../deep-sky.ts`) |
// RA J2000 and Dec J2000 in ten-thousandths of a degree | V magnitude times 100 | angular size in tenths of an arc-minute | IAU constellation abbreviation |
// English name | other English names (semicolon-separated).
"""
        OUT_FALLBACK.parent.mkdir(exist_ok=True)
        OUT_FALLBACK.write_text(fallback_header + f"\n/** The 110 Messier objects, one per line. */\nexport const MESSIER_ROWS = `{chr(10).join(row(o) for o in in_messier)}`;\n", encoding="utf-8")
        print(f"wrote {OUT_FALLBACK} ({len(in_messier)} objects); src/data is untouched")
        print(f"no magnitude: {', '.join('M' + str(o['messier']) for o in in_messier if o['mag'] is None)}; no size: {', '.join('M' + str(o['messier']) for o in in_messier if not o['size'])}")
        subprocess.run(["node", str(ROOT / "scripts" / "deep-sky-constellations.ts"), "--fallback"], check=True, cwd=ROOT)
        return
    OUT_MESSIER.write_text(header + f"\n/** The 110 Messier objects, one per line. */\nexport const MESSIER_ROWS = `{chr(10).join(row(o) for o in in_messier)}`;\n", encoding="utf-8")
    OUT_NGC_IC.write_text(header + f"\n/** The NGC and IC objects that are not Messier objects, one per line. */\nexport const NGC_IC_ROWS = `{chr(10).join(row(o) for o in rest)}`;\n", encoding="utf-8")
    counts = defaultdict(int)
    for o in result:
        counts[o["type"]] += 1
    print(f"wrote {OUT_MESSIER} ({len(in_messier)} objects) and {OUT_NGC_IC} ({len(rest)} objects)")
    print("\n".join(differences))
    print(f"positions taken from NED: {corrections} of {len(ned)} in the file")
    print(f"left out for positions that disagree: {ambiguous_dropped}; types: {dict(counts)}")
    subprocess.run(["node", str(ROOT / "scripts" / "deep-sky-constellations.ts")], check=True, cwd=ROOT)


if __name__ == "__main__":
    main()
