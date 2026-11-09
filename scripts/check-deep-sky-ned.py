#!/usr/bin/env python3
"""Compare the deep-sky positions with NASA/IPAC NED's, object by object, and list the ones more than 1 arc-minute apart.

NED (https://ned.ipac.caltech.edu, funded by NASA and operated by Caltech) answers an object-name lookup with the object's preferred position:
https://ned.ipac.caltech.edu/srs/ObjectLookup. Each object is looked up by its NGC or IC name (its Messier name if it has neither); an answer counts only when NED
understood the name as that very object (`Interpreted.Name`).

    python3 -I scripts/check-deep-sky-ned.py                          # the 110 Messier objects and 500 random others (seed 1)
    python3 -I scripts/check-deep-sky-ned.py --sample 200 --seed 7
    python3 -I scripts/check-deep-sky-ned.py --all --write scripts/deep-sky-ned-positions.tsv
                                                                      # every object (an hour); writes NED's position for each one that is over 1 arc-minute away
    python3 -I scripts/check-deep-sky-ned.py --cache FILE             # keeps the answers in FILE and reads them from it on the next run

Run it on the rows `scripts/make-deep-sky-data.py --no-ned` writes, so the Wikidata positions are what is compared; then run the generator again and it applies the file.
Needs the network and does not run in the test.
"""
import json
import math
import random
import re
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

LOOKUP = "https://ned.ipac.caltech.edu/srs/ObjectLookup"
USER_AGENT = "hoshi-stars-data-script/0.1 (https://github.com/johnmorrisdotca/hoshi-stars)"
DATA = Path(__file__).resolve().parent.parent / "src" / "data"
WORKERS = 4


def rows(name: str, constant: str):
    text = (DATA / name).read_text(encoding="utf-8")
    for row in re.search(constant + r" = `(.*?)`", text, re.S).group(1).split("\n"):
        p = row.split("|")
        yield {"messier": p[0], "ngc": p[1], "ic": p[2], "ra": int(p[4]) / 10000, "dec": int(p[5]) / 10000}


def designation(o) -> str:
    """The name NED is asked for first: NGC, else IC, else Messier."""
    return designations(o)[0]


def designations(o) -> list:
    """Every NGC and IC name of the object (NGC first), else its Messier name. A Wikidata item can carry two numbers that are two NED entries: NGC 2652 is an old
    catalogue place with no object type, and the galaxy is NGC 2974."""
    names = [f"NGC {n}" for n in o["ngc"].split(",") if n] + [f"IC {n}" for n in o["ic"].split(",") if n]
    return names or [f"M{o['messier']}"]


def best(o, cache):
    """NED's place for the object: the first name's, unless the names are more than 1 arc-minute apart in NED, when the first one NED gives an object type wins."""
    found = [(n, cache.get(n)) for n in designations(o) if cache.get(n) is not None]
    if not found:
        return None
    first = found[0][1]
    if all(separation_arcmin(first, f) <= 1.0 for _, f in found):
        return first
    typed = [f for _, f in found if len(f) > 2 and f[2]]
    return typed[0] if typed else first


def key(o) -> str:
    """The object's own id, the one the data file uses."""
    return f"M{o['messier']}" if o["messier"] else designation(o)


def understood(asked: str, interpreted: str) -> bool:
    """Did NED read `NGC 296` as NGC 296 (it says `NGC 0296`) and `M45` as Messier 45?"""
    a, b = re.match(r"^(M|NGC|IC) ?(\d+)([A-Za-z]?)$", asked), re.match(r"^(MESSIER|NGC|IC) ?0*(\d+)([A-Za-z]?)$", interpreted.strip().upper())
    return a is not None and b is not None and a.group(1)[0] == b.group(1)[0] and a.group(2) == b.group(2) and a.group(3).upper() == b.group(3).upper()


def lookup(name: str):
    request = urllib.request.Request(LOOKUP, data=json.dumps({"name": {"v": name}}).encode(), headers={"Content-Type": "application/json", "User-Agent": USER_AGENT})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                answer = json.load(response)
            found = answer.get("Preferred")
            if found is None or not understood(name, answer["Interpreted"]["Name"]):
                return None
            return [found["Position"]["RA"], found["Position"]["Dec"], (found.get("ObjType") or {}).get("Value") or ""]
        except Exception:
            time.sleep(3)
    return None


def separation_arcmin(a, b) -> float:
    ra1, dec1, ra2, dec2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((dec2 - dec1) / 2) ** 2 + math.cos(dec1) * math.cos(dec2) * math.sin((ra2 - ra1) / 2) ** 2
    return math.degrees(2 * math.asin(min(1.0, math.sqrt(h)))) * 60


def ask(names, cache_path):
    cache = json.loads(cache_path.read_text()) if cache_path is not None and cache_path.exists() else {}
    todo = [n for n in names if n not in cache]
    with ThreadPoolExecutor(WORKERS) as pool:
        for i, (name, found) in enumerate(zip(todo, pool.map(lookup, todo))):
            cache[name] = found
            if cache_path is not None and i % 200 == 199:
                cache_path.write_text(json.dumps(cache))
    if cache_path is not None:
        cache_path.write_text(json.dumps(cache))
    return cache


def report(label: str, results: list) -> None:
    found = sorted(s for _, s in results if s is not None)
    missing = sum(1 for _, s in results if s is None)
    if not found:
        print(f"{label}: nothing found")
        return
    over = [(n, s) for n, s in results if s is not None and s > 1.0]
    print(f"{label}: {len(found)} found in NED of {len(results)}; median {found[len(found) // 2]:.3f}', 95th percentile {found[int(len(found) * 0.95)]:.2f}', max {found[-1]:.2f}';"
          f" within 6 arc-seconds {sum(1 for s in found if s <= 0.1)}, within 1 arc-minute {sum(1 for s in found if s <= 1.0)}, over 1 arc-minute {len(over)}; not found {missing}")
    for n, s in sorted(over, key=lambda t: -t[1]):
        print(f"  over 1 arc-minute: {n} {s:.2f}'")


def main() -> None:
    cache_path = Path(sys.argv[sys.argv.index("--cache") + 1]) if "--cache" in sys.argv else None
    messier = list(rows("messier.ts", "MESSIER_ROWS"))
    others = list(rows("ngc-ic.ts", "NGC_IC_ROWS"))
    if "--all" in sys.argv:
        chosen, label = messier + others, "every object"
    else:
        sample = int(sys.argv[sys.argv.index("--sample") + 1]) if "--sample" in sys.argv else 500
        seed = int(sys.argv[sys.argv.index("--seed") + 1]) if "--seed" in sys.argv else 1
        random.seed(seed)
        chosen, label = messier + random.sample(others, min(sample, len(others))), f"the Messier objects and {sample} random others (seed {seed})"
    cache = ask(sorted({n for o in chosen for n in designations(o)}), cache_path)
    results, fixes = [], []
    for o in chosen:
        found = best(o, cache)
        s = None if found is None else separation_arcmin((o["ra"], o["dec"]), found)
        results.append((key(o), s))
        if s is not None and s > 1.0:
            fixes.append((key(o), o["ra"], o["dec"], found[0], found[1], s))
    report("Messier objects", results[: len(messier)])
    report(f"NGC and IC objects of {label}", results[len(messier):])
    if "--write" in sys.argv:
        path = Path(sys.argv[sys.argv.index("--write") + 1])
        path.write_text("".join(f"{k}\t{ra:.4f}\t{dec:.4f}\t{wra:.4f}\t{wdec:.4f}\t{s:.2f}\n" for k, wra, wdec, ra, dec, s in fixes), encoding="utf-8")
        print(f"wrote {path} ({len(fixes)} positions)")


if __name__ == "__main__":
    main()
