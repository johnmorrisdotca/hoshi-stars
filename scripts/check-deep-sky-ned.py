#!/usr/bin/env python3
"""Compare the deep-sky positions with NASA/IPAC NED's, object by object, and list the ones more than 1 arc-minute apart.

NED (https://ned.ipac.caltech.edu, funded by NASA and operated by Caltech) answered an object-name lookup (its /srs/ObjectLookup) with the object's preferred position, on 2026-11-08.
Each object was looked up by its NGC or IC name (its Messier name if it has neither); an answer counts only when NED understood the name as that very object (`Interpreted.Name`).
Those lookups, one request an object, went to a part of NED's site that its robots.txt asks scripts not to use (/srs/ and /cgi-bin/, with a 10 s crawl delay), so this script never asks
NED again: it reads the answers saved earlier in a cache file, and refuses to run when the file is missing or lacks an answer it needs.

    python3 -I scripts/check-deep-sky-ned.py --cache FILE             # the 110 Messier objects and 500 random others (seed 1), from the answers in FILE
    python3 -I scripts/check-deep-sky-ned.py --cache FILE --sample 200 --seed 7
    python3 -I scripts/check-deep-sky-ned.py --cache FILE --all --write scripts/deep-sky-ned-positions.tsv
                                                                      # every object; writes NED's position for each one that is over 1 arc-minute away

Run it on the rows `scripts/make-deep-sky-data.py --no-ned` writes, so the Wikidata positions are what is compared; then run the generator again and it applies the file.
Does not run in the test, except the refusal.
"""
import json
import math
import random
import re
import sys
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "src" / "data"
REFUSE_NED = ("check-deep-sky-ned.py does not ask NASA/IPAC NED's web pages (MODULES-839): its lookups went to /srs/, which NED's robots.txt keeps scripts out of (with /cgi-bin/ "
              "and a 10 s crawl delay). Pass --cache FILE holding every answer, saved earlier.")


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


def separation_arcmin(a, b) -> float:
    ra1, dec1, ra2, dec2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((dec2 - dec1) / 2) ** 2 + math.cos(dec1) * math.cos(dec2) * math.sin((ra2 - ra1) / 2) ** 2
    return math.degrees(2 * math.asin(min(1.0, math.sqrt(h)))) * 60


def saved(names, cache_path):
    """The answers saved in the cache file for these names (an answer is NED's [ra, dec, type], or null where NED did not know the name). Refuses if any is missing."""
    if cache_path is None or not cache_path.exists():
        raise SystemExit(REFUSE_NED)
    cache = json.loads(cache_path.read_text())
    missing = [n for n in names if n not in cache]
    if missing:
        raise SystemExit(f"{REFUSE_NED} {len(missing)} names have no saved answer, the first {missing[0]}.")
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
    if cache_path is None or not cache_path.exists():
        raise SystemExit(REFUSE_NED)
    messier = list(rows("messier.ts", "MESSIER_ROWS"))
    others = list(rows("ngc-ic.ts", "NGC_IC_ROWS"))
    if "--all" in sys.argv:
        chosen, label = messier + others, "every object"
    else:
        sample = int(sys.argv[sys.argv.index("--sample") + 1]) if "--sample" in sys.argv else 500
        seed = int(sys.argv[sys.argv.index("--seed") + 1]) if "--seed" in sys.argv else 1
        random.seed(seed)
        chosen, label = messier + random.sample(others, min(sample, len(others))), f"the Messier objects and {sample} random others (seed {seed})"
    cache = saved(sorted({n for o in chosen for n in designations(o)}), cache_path)
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
