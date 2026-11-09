#!/usr/bin/env python3
"""Compare the two fills of the gap between the bright stars and UCAC4's own stars (MODULES-660): the SAO Star Catalog (scripts/make-gap-sao.py) and APASS V with 2MASS positions (scripts/make-gap-apass.py).
Writes the numbers that docs/research/gap-6.5-8.md reports, as JSON, and prints them. Needs the raw downloads and the two builds (their stars.tsv) first.

    python3 -I scripts/compare-gap.py [GAP_TILES_DIR]   # default ~/Projects/backups/hoshi-stars/2026-11-09-gap-tiles; writes GAP_TILES_DIR/compare.json
"""
import importlib.util
import json
import math
import statistics
import sys
from collections import Counter, defaultdict
from pathlib import Path


def load(name, file):
    sys.dont_write_bytecode = True
    spec = importlib.util.spec_from_file_location(name, Path(__file__).resolve().parent / file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


G = load("gap_common", "gap_common.py")
SAO = load("make_gap_sao", "make-gap-sao.py")
APASS = load("make_gap_apass", "make-gap-apass.py")

SKY_SQUARE_DEGREES = 41252.96
# The expected number of stars of the whole sky brighter than V: the BSC's 4,800 to 6.0 and a slope of 0.47 dex a magnitude, which is what the star counts of the Durchmusterungs and of Tycho-2 give between 6 and 10 (14,000 to 7, 41,000 to 8, 120,000 to 9, 350,000 to 10).
# A model good to about 15 per cent, here to say whether a count is near, a half or double what the sky holds.
EXPECT_ANCHOR = 4800
EXPECT_SLOPE = 0.47
RAW = SAO.G.BACKUPS


def expected_to(v):
    return EXPECT_ANCHOR * 10 ** (EXPECT_SLOPE * (v - 6.0))


def expected_between(lo, hi):
    return expected_to(hi) - expected_to(lo)


def quarters(lo, hi):
    q = lo
    while q < hi - 1e-9:
        yield q
        q += 0.25


def pct(values, p):
    values = sorted(values)
    if not values:
        return None
    k = (len(values) - 1) * p / 100
    f = math.floor(k)
    c = min(len(values) - 1, f + 1)
    return values[f] + (values[c] - values[f]) * (k - f)


def robust_sigma(values):
    med = statistics.median(values)
    return 1.4826 * statistics.median(abs(v - med) for v in values)


def main(out: Path):
    result = {}
    sao_raw = SAO.DEFAULT_RAW
    apass_raw = APASS.DEFAULT_RAW
    ucac4_raw = APASS.DEFAULT_UCAC4

    # ---- every star of each source in 6.0 to 9.0, before any dropping
    twomass, n2 = APASS.load_twomass(apass_raw)
    result["2MASS sources read (J 9.5 or brighter)"] = n2
    sao_all = []  # dicts
    for r in SAO.read_sao(sao_raw):
        if r["vmag"] == "":
            continue
        v = round(float(r["vmag"]) * G.MAG_STEP) / G.MAG_STEP
        if not 6.0 <= v < 9.0:
            continue
        sao_all.append({"ra": float(r["ra"]), "dec": float(r["dec"]), "v": v, "pmra": float(r["pm_ra_fk5"] or 0) * 15 * math.cos(math.radians(float(r["dec"]))), "pmdec": float(r["pm_dec_fk5"] or 0), "name": r["name"], "pg": r["pg_mag"], "err": r["position_error"]})
    counter = Counter()
    apass_matched = APASS.match_to_twomass(APASS.apass_candidates(apass_raw), twomass, counter)
    apass_all = [dict(a, ra=a["twomass"][0], dec=a["twomass"][1]) for a in apass_matched if 6.0 <= round(a["v"] * 20) / 20 < 9.0]
    for a in apass_all:
        a["v"] = round(a["v"] * 20) / 20
    result["APASS rows matched to a 2MASS source, V 6.0 to 9.0"] = len(apass_all)
    result["APASS match report"] = dict(counter)

    # ---- counts per quarter magnitude: each source whole, each source's new stars (kept), UCAC4's own, against the sky
    def stars_of(tsv_dir, name):
        rows = []
        with (tsv_dir / name / "stars.tsv").open() as f:
            next(f)
            for line in f:
                p = line.rstrip("\n").split("\t")
                rows.append((float(p[0]), float(p[1]), float(p[2])))
        return rows

    sao_kept = stars_of(out, "sao")
    apass_kept = stars_of(out, "apass-2mass")
    ucac4, _ = G.ucac4_kept_index(ucac4_raw)
    ucac4_counts = Counter(G.quarter(p[2]) for cell in ucac4.cells.values() for p in cell)
    bright = G.bright_stars()
    table = []
    for q in quarters(6.0, 9.0):
        row = {
            "from": q,
            "expected": round(expected_between(q, q + 0.25)),
            "bright5080": sum(1 for b in bright if G.quarter(b[2]) == q),
            "ucac4Own": ucac4_counts.get(q, 0),
            "saoAll": sum(1 for s in sao_all if G.quarter(s["v"]) == q),
            "apass2massAll": sum(1 for a in apass_all if G.quarter(a["v"]) == q),
            "saoNew": sum(1 for s in sao_kept if G.quarter(s[2]) == q),
            "apass2massNew": sum(1 for s in apass_kept if G.quarter(s[2]) == q),
        }
        table.append(row)
    result["perQuarter"] = table

    # ---- SAO against 2MASS: the position difference, and the epoch of SAO's J2000 positions
    sao_hits = []  # (sao dict, 2MASS point, separation)
    for s in sao_all:
        near = twomass.near(s["ra"], s["dec"], 15.0)
        if near:
            sao_hits.append((s, near[0][1], near[0][0]))
    result["SAO stars 6.0 to 9.0 with a 2MASS source within 15 arc-seconds"] = len(sao_hits)
    result["SAO stars 6.0 to 9.0"] = len(sao_all)
    seps = [h[2] for h in sao_hits]
    result["SAO against 2MASS, separation arc-seconds (all matched)"] = {"median": pct(seps, 50), "p95": pct(seps, 95), "n": len(seps)}
    # the epoch test: for stars that move fast, how well does the J2000 position, as given, match 2MASS, against the position moved 50 years on?
    fast = [h for h in sao_hits if math.hypot(h[0]["pmra"], h[0]["pmdec"]) >= 0.1]
    as_given, moved = [], []
    for s, p, sep in fast:
        as_given.append(sep)
        for years, store in ((49.6, moved),):
            ra = s["ra"] + s["pmra"] * years / 3600 / max(0.01, math.cos(math.radians(s["dec"])))
            dec = s["dec"] + s["pmdec"] * years / 3600
            store.append(G.separation_arcsec(ra, dec, p[0], p[1]))
    result["SAO epoch test, stars moving 0.1 arc-seconds a year or more"] = {"n": len(fast), "asGivenMedian": pct(as_given, 50), "asGivenP95": pct(as_given, 95), "movedFifty YearsMedian": pct(moved, 50)}
    # the position difference by magnitude, and for the stars that do not move
    slow = [h[2] for h in sao_hits if math.hypot(h[0]["pmra"], h[0]["pmdec"]) < 0.1]
    result["SAO against 2MASS, stars moving under 0.1 arc-seconds a year"] = {"median": pct(slow, 50), "p95": pct(slow, 95), "n": len(slow)}
    by_mag = {}
    for q in quarters(6.0, 9.0):
        v = [h[2] for h in sao_hits if G.quarter(h[0]["v"]) == q]
        by_mag[f"{q:.2f}"] = {"n": len(v), "median": pct(v, 50), "p95": pct(v, 95)}
    result["SAO against 2MASS by quarter magnitude"] = by_mag
    result["SAO stars with no 2MASS source within 15 arc-seconds, by quarter magnitude"] = {f"{q:.2f}": sum(1 for s in sao_all if G.quarter(s["v"]) == q) - sum(1 for h in sao_hits if G.quarter(h[0]["v"]) == q) for q in quarters(6.0, 9.0)}

    # ---- SAO against APASS: matched through 2MASS (same 2MASS source) and the magnitude difference
    by_twomass = {a["twomass"][2]: a for a in apass_all}
    pairs = []
    sao_with_apass = 0
    for s, p, sep in sao_hits:
        a = by_twomass.get(p[2])
        if a is not None and sep <= 10:
            pairs.append((s, a))
    result["SAO stars matched to an APASS star through the same 2MASS source"] = len(pairs)
    mag_table = {}
    for lo, hi in ((6.0, 6.5), (6.5, 7.0), (7.0, 7.5), (7.5, 8.0), (8.0, 8.5), (8.5, 9.0), (7.5, 8.5)):
        d = [s["v"] - a["v"] for s, a in pairs if lo <= a["v"] < hi]
        mag_table[f"{lo}-{hi} by APASS V"] = {"n": len(d), "median": statistics.median(d) if d else None, "robustSigma": robust_sigma(d) if len(d) > 5 else None, "p16": pct(d, 16), "p84": pct(d, 84)}
    for lo, hi in ((6.0, 6.5), (6.5, 7.0), (7.0, 7.5), (7.5, 8.0), (8.0, 8.5), (8.5, 9.0)):
        d = [s["v"] - a["v"] for s, a in pairs if lo <= s["v"] < hi]
        mag_table[f"{lo}-{hi} by SAO V"] = {"n": len(d), "median": statistics.median(d) if d else None, "robustSigma": robust_sigma(d) if len(d) > 5 else None}
    result["SAO V minus APASS V"] = mag_table

    # ---- the overlap of the two sources: stars of one that the other holds (matched through 2MASS, SAO within 10 arc-seconds of it)
    overlap = []
    sao_by_twomass = {}
    for s, p, sep in sao_hits:
        if sep <= 10:
            sao_by_twomass.setdefault(p[2], s)
    for q in quarters(6.0, 9.0):
        sa = [s for s in sao_all if G.quarter(s["v"]) == q]
        ap = [a for a in apass_all if G.quarter(a["v"]) == q]
        both_ap = sum(1 for a in ap if a["twomass"][2] in sao_by_twomass)
        overlap.append({"from": q, "saoStars": len(sa), "apassStars": len(ap), "apassStarsSaoHas": both_ap, "apassOnly": len(ap) - both_ap})
    result["overlapPerQuarter"] = overlap

    # ---- sky coverage: stars per square degree of the level 0 tiles, 7.5 to 8.5 (where the two both claim to work), by declination band and the tiles one lacks
    def tile_counts(items, key_v, lo, hi, key_ra="ra", key_dec="dec"):
        c = Counter()
        for it in items:
            if lo <= key_v(it) < hi:
                c[G.tile_of_level0(it[key_ra], it[key_dec])] += 1
        return c

    lo, hi = 7.5, 8.5
    sao_t = tile_counts(sao_all, lambda s: s["v"], lo, hi)
    apass_t = tile_counts(apass_all, lambda a: a["v"], lo, hi)
    ucac_t = Counter()
    for cell in ucac4.cells.values():
        for p in cell:
            if lo <= p[2] < hi:
                ucac_t[G.tile_of_level0(p[0], p[1])] += 1
    bands = defaultdict(lambda: {"tiles": 0, "sao": 0, "apass": 0, "ucac4": 0, "area": 0.0})
    holes_apass, holes_sao = [], []
    for band in range(18):
        for col in range(G.columns_of(10, band)):
            tid = (band, col)
            dec_lo = -90 + band * 10
            width = 360 / G.columns_of(10, band)
            area = width * (math.sin(math.radians(dec_lo + 10)) - math.sin(math.radians(dec_lo))) * 180 / math.pi
            b = bands[dec_lo]
            b["tiles"] += 1
            b["sao"] += sao_t[tid]
            b["apass"] += apass_t[tid]
            b["ucac4"] += ucac_t[tid]
            b["area"] += area
            s_n, a_n = sao_t[tid], apass_t[tid]
            if s_n >= 20 and a_n < 0.5 * s_n:
                holes_apass.append((dec_lo, col, s_n, a_n))
            if a_n >= 20 and s_n < 0.5 * a_n:
                holes_sao.append((dec_lo, col, s_n, a_n))
    result["coverage per declination band, stars 7.5 to 8.5 per square degree"] = {
        f"{k:+d}": {"saoPerSqDeg": round(v["sao"] / v["area"], 2), "apassPerSqDeg": round(v["apass"] / v["area"], 2), "ucac4PerSqDeg": round(v["ucac4"] / v["area"], 2), "tiles": v["tiles"]} for k, v in sorted(bands.items())
    }
    result["expected per square degree, 7.5 to 8.5"] = round(expected_between(7.5, 8.5) / SKY_SQUARE_DEGREES, 2)
    result["tiles where APASS+2MASS holds under half of SAO's stars (7.5 to 8.5, SAO 20 or more)"] = {"count": len(holes_apass), "of": sum(1 for s in sao_t.values() if s >= 20), "examples": holes_apass[:12]}
    result["tiles where SAO holds under half of APASS+2MASS's stars (7.5 to 8.5, APASS 20 or more)"] = {"count": len(holes_sao), "of": sum(1 for s in apass_t.values() if s >= 20), "examples": holes_sao[:12]}


    # ---- where APASS DR10's bright stars stop on the sky: stars 7.5 to 8.5 per square degree of each source, by degree of declination from +10 to +29
    edge = {}
    apass_dec, sao_dec = Counter(), Counter()
    for r in APASS.G.read_bands(apass_raw, "apass"):
        if r["mag_v"] and 7.5 <= float(r["mag_v"]) < 8.5:
            apass_dec[math.floor(float(r["dec"]))] += 1
    for s_ in sao_all:
        if 7.5 <= s_["v"] < 8.5:
            sao_dec[math.floor(s_["dec"])] += 1
    for d in range(10, 30):
        area = 360 * (math.sin(math.radians(d + 1)) - math.sin(math.radians(d))) * 180 / math.pi
        edge[f"{d:+d}"] = {"apassPerSqDeg": round(apass_dec[d] / area, 2), "saoPerSqDeg": round(sao_dec[d] / area, 2)}
    result["APASS DR10 and SAO stars 7.5 to 8.5 per square degree, by degree of declination"] = edge
    south_a = sum(v for d, v in apass_dec.items() if d <= 19)
    south_s = sum(v for d, v in sao_dec.items() if d <= 19)
    north_a = sum(v for d, v in apass_dec.items() if d >= 21)
    north_s = sum(v for d, v in sao_dec.items() if d >= 21)
    result["APASS DR10 stars as a fraction of SAO's, 7.5 to 8.5: south of +20 and north of +21"] = [round(south_a / south_s, 3), round(north_a / north_s, 3)]
    result["share of the sky south of +20 degrees"] = round((1 + math.sin(math.radians(20))) / 2, 3)

    # ---- the magnitudes of UCAC4's own stars against APASS DR10 and against SAO, for the same stars (UCAC4 to 11 here)
    ucac11, _ = G.ucac4_kept_index(ucac4_raw, faintest=11.0)
    against_apass = defaultdict(list)
    for r in APASS.G.read_bands(apass_raw, "apass"):
        if not r["mag_v"] or float(r["dec"]) > 15:
            continue
        v = float(r["mag_v"])
        if not 7.0 <= v < 9.0:
            continue
        near = ucac11.near(float(r["ra"]), float(r["dec"]), 6.0)
        if near:
            against_apass[math.floor(v * 2) / 2].append(near[0][1][2] - v)
    result["UCAC4 V minus APASS DR10 V for the same stars, south of +15, by APASS V (UCAC4 stars to 11 as the faint layer keeps them)"] = {f"{k:.1f}": {"n": len(v), "median": pct(v, 50), "p16": pct(v, 16), "p84": pct(v, 84)} for k, v in sorted(against_apass.items())}
    against_sao = defaultdict(list)
    for s_ in sao_all:
        near = ucac11.near(s_["ra"], s_["dec"], 5.0)
        if near:
            against_sao[math.floor(s_["v"] * 2) / 2].append(near[0][1][2] - s_["v"])
    result["UCAC4 V minus SAO V for the same stars, by SAO V"] = {f"{k:.1f}": {"n": len(v), "median": pct(v, 50), "p16": pct(v, 16), "p84": pct(v, 84)} for k, v in sorted(against_sao.items())}

    # ---- what SAO would add on top of APASS+2MASS (the build's own rule: 5 arc-seconds and 2 magnitudes)
    taken = G.SkyIndex((a[0], a[1], a[2]) for a in apass_kept)
    add = Counter()
    for s in sao_kept:
        if not any(abs(p[2] - s[2]) <= 2.0 for _, p in taken.near(s[0], s[1], 5.0)):
            add[G.quarter(s[2])] += 1
    result["SAO stars that APASS+2MASS does not hold (after both dropped what UCAC4 and the bright stars have), by quarter magnitude"] = {f"{k:.2f}": add[k] for k in sorted(add)}
    result["SAO new stars total / APASS+2MASS new stars total / SAO beyond APASS+2MASS"] = [len(sao_kept), len(apass_kept), sum(add.values())]

    (out / "compare.json").write_text(json.dumps(result, indent=1) + "\n")
    print(json.dumps(result, indent=1))


if __name__ == "__main__":
    main(Path(sys.argv[1]) if len(sys.argv) > 1 else G.BACKUPS / "2026-11-09-gap-tiles")
