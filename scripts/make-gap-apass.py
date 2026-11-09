#!/usr/bin/env python3
"""The gap between the bright stars and UCAC4's own stars, filled from APASS (V magnitudes) and 2MASS (positions). One of the two candidate fills of MODULES-660; the other is scripts/make-gap-sao.py,
and scripts/compare-gap.py compares them. NOTICE.md says which of them ships.

Sources (read 2026-11-09; NOTICE.md quotes the sentences relied on)
- APASS DR10, the AAVSO Photometric All-Sky Survey (Henden et al.), through the GAVO Data Center's TAP service (https://dc.g-vo.org/tap, table apass.dr10). V and B-V are APASS's own. AAVSO's own page says: "APASS is a public service to the astronomical community"
  and asks for the credit line that NOTICE.md gives. APASS DR10's V is trusted from about 7.5 (it saturates near 7; where it is trusted is the comparison report's subject).
- 2MASS Point Source Catalog (Cutri et al. 2003), through NASA/IPAC's Infrared Science Archive TAP service (https://irsa.ipac.caltech.edu/TAP, table fp_psc). The position of the star is 2MASS's (epoch about 1999 to 2001; no proper motion is applied).

NOT used: any Hipparcos, Tycho or Gaia value or catalogue number. APASS and 2MASS are measured on their own, and the GAVO and IRSA tables that join them to Gaia (`gaia_dr2_apassdr9_*`, `*_best_neighbour`) are never read.

How a star is made: an APASS DR10 star with V in [LOW, HIGH) is matched to the nearest 2MASS point source within MATCH_ARCSEC with a plausible V-J (a 2MASS star that is a J magnitude of 9.5 or fainter is not read, so a star with no match stays out).
Where several APASS entries land on the same 2MASS source, the one with the most nights is kept. The star is then dropped if it is among the 5,080 bright stars (20 arc-seconds, 1.5 magnitudes) or among UCAC4's own stars that the faint layer keeps (5 arc-seconds, 2 magnitudes).
The magnitude is stored to 0.05 and the colour is APASS B-V where APASS has both B and V with errors under 0.1, else none.

    python3 -I scripts/make-gap-apass.py download [RAW_DIR]   # GAVO TAP (APASS) and IRSA TAP (2MASS), a band of declination at a time with pauses, into RAW_DIR (default ~/Projects/backups/hoshi-stars/2026-11-09-apass-2mass-raw)
    python3 -I scripts/make-gap-apass.py download-2mass [RAW_DIR]   # the 2MASS half alone (the two services are different servers, so the halves can run at the same time)
    python3 -I scripts/make-gap-apass.py build [RAW_DIR] [UCAC4_RAW_DIR] [OUT_DIR]   # writes OUT_DIR/L0/*.bin (default ~/Projects/backups/hoshi-stars/2026-11-09-gap-tiles/apass-2mass), OUT_DIR/index.json, OUT_DIR/stars.tsv and OUT_DIR/report.json

Neither runs in the test. The tiles of this source are kept on file; they are not in the repository's faint-tiles/ unless NOTICE.md says so.
"""
import csv
import importlib.util
import json
import math
import sys
import time
from collections import Counter
from pathlib import Path


def load_common():
    sys.dont_write_bytecode = True
    spec = importlib.util.spec_from_file_location("gap_common", Path(__file__).resolve().parent / "gap_common.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


G = load_common()

DEFAULT_RAW = G.BACKUPS / "2026-11-09-apass-2mass-raw"
DEFAULT_UCAC4 = G.BACKUPS / "2026-11-09-ucac4-raw"
DEFAULT_OUT = G.BACKUPS / "2026-11-09-gap-tiles" / "apass-2mass"

APASS_TAP = "https://dc.g-vo.org/tap"
APASS_TABLE = "apass.dr10"
APASS_COLUMNS = "id, ra, dec, ra_error, dec_error, nobs_v, mag_v, err_mag_v, nobs_b, mag_b, err_mag_b"
# The download takes a margin past HIGH so that the report can count what lies near the edges.
APASS_DOWNLOAD_WHERE = "mag_v >= 6.0 AND mag_v < 9.2"
APASS_BAND_DEGREES = 5
TWOMASS_TAP = "https://irsa.ipac.caltech.edu/TAP"
TWOMASS_TABLE = "fp_psc"
TWOMASS_COLUMNS = "designation, ra, dec, err_maj, err_min, j_m, h_m, k_m, ph_qual, cc_flg, jdate"
TWOMASS_WHERE = "j_m <= 9.5"
TWOMASS_BAND_DEGREES = 10
PAUSE_SECONDS = 15

# the build
LOW = 6.0
HIGH = 9.0
MATCH_ARCSEC = 5.0
VJ_RANGE = (-1.0, 6.0)
COLOUR_ERROR_LIMIT = 0.1
COLOUR_RANGE = (-0.6, 2.58)


def download(raw: Path):
    G.download_bands(APASS_TAP, raw, "apass", APASS_COLUMNS, APASS_TABLE, APASS_DOWNLOAD_WHERE, APASS_BAND_DEGREES, PAUSE_SECONDS)
    G.download_bands(TWOMASS_TAP, raw, "2mass", TWOMASS_COLUMNS, TWOMASS_TABLE, TWOMASS_WHERE, TWOMASS_BAND_DEGREES, PAUSE_SECONDS)


def number(text):
    return None if text in ("", None) else float(text)


def load_twomass(raw: Path):
    """The 2MASS sources, in a sky index. Items: (ra, dec, designation, J, K, err_maj, ph_qual, cc_flg)."""
    index = G.SkyIndex()
    count = 0
    for r in G.read_bands(raw, "2mass"):
        j = number(r["j_m"])
        if j is None:
            continue
        index.add((float(r["ra"]), float(r["dec"]), r["designation"], j, number(r["k_m"]), number(r["err_maj"]), r["ph_qual"], r["cc_flg"]))
        count += 1
    return index, count


def apass_candidates(raw: Path):
    """The APASS rows that have a V in [LOW - 0.5, HIGH + 0.2): dicts with floats."""
    for r in G.read_bands(raw, "apass"):
        v = number(r["mag_v"])
        if v is None:
            continue
        yield {
            "id": r["id"],
            "ra": float(r["ra"]),
            "dec": float(r["dec"]),
            "nobs_v": int(r["nobs_v"] or 0),
            "v": v,
            "ev": number(r["err_mag_v"]),
            "nobs_b": int(r["nobs_b"] or 0),
            "b": number(r["mag_b"]),
            "eb": number(r["err_mag_b"]),
        }


def match_to_twomass(apass_rows, twomass, report):
    """Each APASS row with a 2MASS source: the nearest within MATCH_ARCSEC whose J is not unreasonably far from V. One APASS entry per 2MASS source (the one with most nights, then the smaller error)."""
    best = {}
    for a in apass_rows:
        report["apass rows read, V from 6.0 to 9.2"] += 1
        candidates = [(sep, p) for sep, p in twomass.near(a["ra"], a["dec"], MATCH_ARCSEC) if VJ_RANGE[0] <= a["v"] - p[3] <= VJ_RANGE[1]]
        if not candidates:
            report["APASS rows with no 2MASS source within 5 arc-seconds"] += 1
            continue
        if len(candidates) > 1:
            report["APASS rows with more than one 2MASS candidate (the nearest taken)"] += 1
        sep, p = candidates[0]
        key = p[2]
        a = dict(a, sep=sep, twomass=p)
        old = best.get(key)
        if old is None:
            best[key] = a
        else:
            report["APASS rows that share a 2MASS source with another (one kept)"] += 1
            if (a["nobs_v"], -(a["ev"] or 9)) > (old["nobs_v"], -(old["ev"] or 9)):
                best[key] = a
    return list(best.values())


def colour_of(a):
    if a["b"] is None or a["ev"] is None or a["eb"] is None or a["ev"] > COLOUR_ERROR_LIMIT or a["eb"] > COLOUR_ERROR_LIMIT:
        return None
    c = a["b"] - a["v"]
    return c if COLOUR_RANGE[0] <= c < COLOUR_RANGE[1] else None


def build(raw: Path, ucac4_raw: Path, out: Path):
    report = Counter()
    twomass, n = load_twomass(raw)
    report["2MASS sources read (J 9.5 or brighter)"] = n
    matched = match_to_twomass(apass_candidates(raw), twomass, report)
    report["2MASS sources matched to an APASS star"] = len(matched)
    bright = G.bright_index()
    ucac4, n_ucac4 = G.ucac4_kept_index(ucac4_raw)
    report["UCAC4 stars to 11 kept by the faint layer"] = n_ucac4
    kept = []
    rows = []
    for a in matched:
        v = round(a["v"] * G.MAG_STEP) / G.MAG_STEP
        if not LOW <= v < HIGH:
            continue
        report[f"matched, V from {LOW} to {HIGH}"] += 1
        ra, dec = a["twomass"][0], a["twomass"][1]
        if G.is_bright_duplicate(bright, ra, dec, v):
            report["dropped: already one of the 5,080 bright stars"] += 1
            continue
        if G.is_ucac4_duplicate(ucac4, ra, dec, v):
            report["dropped: already a star UCAC4 keeps"] += 1
            continue
        c = colour_of(a)
        report["kept"] += 1
        report["kept with an APASS colour" if c is not None else "kept without a colour"] += 1
        kept.append((ra, dec, v, c))
        rows.append((ra, dec, v, "" if c is None else f"{c:.3f}", a["id"], a["twomass"][2], a["nobs_v"], a["ev"], round(a["sep"], 2)))
    manifest = {
        "source": "APASS DR10 (Henden et al.) V and B-V through the GAVO Data Center's TAP service (apass.dr10); positions from the 2MASS Point Source Catalog (Cutri et al. 2003) through NASA/IPAC IRSA's TAP service (fp_psc)",
        "built": time.strftime("%Y-%m-%d"),
        "from": LOW,
        "to": HIGH,
        "magnitudeStep": 1 / G.MAG_STEP,
        "colour": {"offset": G.COLOUR_OFFSET, "step": G.COLOUR_STEP, "none": G.NO_COLOUR},
        "report": dict(sorted(report.items())),
    }
    G.write_gap_tiles(kept, out, manifest)
    with (out / "stars.tsv").open("w") as f:
        w = csv.writer(f, delimiter="\t", lineterminator="\n")
        w.writerow(["ra", "dec", "v", "b_v", "apass_id", "twomass", "nobs_v", "err_v", "match_arcsec"])
        w.writerows(rows)
    (out / "report.json").write_text(json.dumps(manifest["report"], indent=1) + "\n")
    print(json.dumps(manifest["report"], indent=1))


if __name__ == "__main__":
    action = sys.argv[1] if len(sys.argv) > 1 else ""
    raw_dir = Path(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_RAW
    if action == "download":
        download(raw_dir)
    elif action == "download-2mass":
        G.download_bands(TWOMASS_TAP, raw_dir, "2mass", TWOMASS_COLUMNS, TWOMASS_TABLE, TWOMASS_WHERE, TWOMASS_BAND_DEGREES, PAUSE_SECONDS)
    elif action == "build":
        build(raw_dir, Path(sys.argv[3]) if len(sys.argv) > 3 else DEFAULT_UCAC4, Path(sys.argv[4]) if len(sys.argv) > 4 else DEFAULT_OUT)
    else:
        sys.exit(__doc__)
