#!/usr/bin/env python3
"""The gap between the bright stars and UCAC4's own stars, filled from the SAO Star Catalog. One of the two candidate fills of MODULES-660; the other is scripts/make-gap-apass.py,
and scripts/compare-gap.py compares them. NOTICE.md says which of them ships.

Source (read 2026-11-09; NOTICE.md quotes the sentences relied on)
- The Smithsonian Astrophysical Observatory Star Catalog (SAO Staff 1966), the Astronomical Data Center's J2000 version (VizieR I/131A), as NASA's HEASARC serves it: table `sao`,
  https://heasarc.gsfc.nasa.gov/W3Browse/star-catalog/sao.html, file https://heasarc.gsfc.nasa.gov/FTP/heasarc/dbase/tdat_files/heasarc_sao.tdat.gz (258,944 stars). The same footing as the Yale Bright Star Catalogue (a NASA-served catalogue, used with credit).
- It measured its own stars: its positions and proper motions come from the AGK2, the Yale, Cape and Melbourne zone catalogues and the Boss General Catalogue, all of them ground-based, from before ESA's satellite flew. It holds no Hipparcos, Tycho or Gaia value.
- The J2000 positions are Clayton A. Smith's (U.S. Naval Observatory) on the FK5 at equinox and epoch J2000.0, with proper motions on the FK5 (`proper_motion_ra_fk5` in seconds of time a year, `proper_motion_dec_fk5` in arc-seconds a year);
  no further proper motion is applied (scripts/compare-gap.py checks this against 2MASS). The magnitude is the catalogue's visual magnitude, from Durchmusterung, Harvard and other sources, good to about 0.3.
- The colour is worked out from the catalogue's spectral type by Mamajek's dwarf sequence (src/data/profile-tables.ts, the table NOTICE.md credits for the profiles): a star with no usable type has none. The SAO has no luminosity class, so a giant's colour is a little too blue.

How a star is made: an SAO star with a visual magnitude in [LOW, HIGH) is dropped if it is among the 5,080 bright stars (20 arc-seconds, 1.5 magnitudes) or among UCAC4's own stars that the faint layer keeps (5 arc-seconds, 2 magnitudes).
The magnitude is stored to 0.05.

    python3 -I scripts/make-gap-sao.py download [RAW_DIR]   # the HEASARC file into RAW_DIR (default ~/Projects/backups/hoshi-stars/2026-11-09-sao-raw)
    python3 -I scripts/make-gap-sao.py build [RAW_DIR] [UCAC4_RAW_DIR] [OUT_DIR]   # writes OUT_DIR/L0/*.bin (default ~/Projects/backups/hoshi-stars/2026-11-09-gap-tiles/sao), OUT_DIR/index.json, OUT_DIR/stars.tsv and OUT_DIR/report.json

Neither runs in the test. The tiles of this source are kept on file; they are not in the repository's faint-tiles/ unless NOTICE.md says so.
"""
import csv
import gzip
import hashlib
import importlib.util
import json
import math
import re
import sys
import time
import urllib.request
from collections import Counter
from pathlib import Path


def load_common():
    sys.dont_write_bytecode = True
    spec = importlib.util.spec_from_file_location("gap_common", Path(__file__).resolve().parent / "gap_common.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


G = load_common()

DEFAULT_RAW = G.BACKUPS / "2026-11-09-sao-raw"
DEFAULT_UCAC4 = G.BACKUPS / "2026-11-09-ucac4-raw"
DEFAULT_OUT = G.BACKUPS / "2026-11-09-gap-tiles" / "sao"
URL = "https://heasarc.gsfc.nasa.gov/FTP/heasarc/dbase/tdat_files/heasarc_sao.tdat.gz"
FILE = "heasarc_sao.tdat.gz"
PROFILE_TABLES = G.ROOT / "src" / "data" / "profile-tables.ts"

LOW = 6.0
HIGH = 9.0
FIELDS = (
    "name ra pm_ra pm_ra_err ra_epoch dec pm_dec pm_dec_err dec_epoch position_error lii bii pg_mag vmag spect_type ref_vmag ref_star_number ref_pg_mag ref_pm ref_spect remarks ref_source_cat num_source_cat dm hd hd_component gc pm_ra_fk5 pm_dec_fk5 class"
).split()
LETTER_INDEX = {"O": 0, "B": 10, "A": 20, "F": 30, "G": 40, "K": 50, "M": 60}


def download(raw: Path):
    raw.mkdir(parents=True, exist_ok=True)
    path = raw / FILE
    if not path.exists():
        req = urllib.request.Request(URL, headers={"User-Agent": G.USER_AGENT})
        with urllib.request.urlopen(req, timeout=600) as r:
            path.write_bytes(r.read())
    print(f"{path}: {path.stat().st_size} bytes, SHA-256 {hashlib.sha256(path.read_bytes()).hexdigest()}")


def read_sao(raw: Path):
    """The SAO rows as dicts of text."""
    data = False
    with gzip.open(raw / FILE, "rt") as f:
        for line in f:
            if line.startswith("<DATA>"):
                data = True
                continue
            if not data or line.startswith("<END>"):
                continue
            parts = line.rstrip("\n").split("|")
            if len(parts) >= len(FIELDS):
                yield dict(zip(FIELDS, parts))


def dwarf_colours():
    """(type index, B-V) from Mamajek's dwarf sequence."""
    text = PROFILE_TABLES.read_text()
    block = text.split("export const DWARF_ROWS = `", 1)[1].split("`", 1)[0]
    rows = []
    for line in block.split("\n"):
        index, _teff, _bc, _radius, colour = line.split("|")
        if colour != "":
            rows.append((float(index), float(colour)))
    return rows


def colour_from_type(spectral, table):
    """B-V of a one-dimensional spectral type such as `K2` or `A0p`, from the dwarf sequence; None for a composite (`+++`), an empty or an unusual type."""
    m = re.match(r"^([OBAFGKM])(\d(?:\.\d)?)?", spectral.strip())
    if not m:
        return None
    index = LETTER_INDEX[m.group(1)] + (float(m.group(2)) if m.group(2) else 5.0)
    if index <= table[0][0]:
        return table[0][1]
    for (i0, c0), (i1, c1) in zip(table, table[1:]):
        if i0 <= index <= i1:
            return c0 + (c1 - c0) * (index - i0) / (i1 - i0)
    return table[-1][1]


def build(raw: Path, ucac4_raw: Path, out: Path):
    report = Counter()
    table = dwarf_colours()
    bright = G.bright_index()
    ucac4, n_ucac4 = G.ucac4_kept_index(ucac4_raw)
    report["UCAC4 stars to 11 kept by the faint layer"] = n_ucac4
    kept = []
    rows = []
    for r in read_sao(raw):
        report["SAO stars read"] += 1
        if r["vmag"] == "":
            report["no visual magnitude (not used)"] += 1
            continue
        v = round(float(r["vmag"]) * G.MAG_STEP) / G.MAG_STEP
        if not LOW <= v < HIGH:
            continue
        report[f"visual magnitude from {LOW} to {HIGH}"] += 1
        ra, dec = float(r["ra"]), float(r["dec"])
        if G.is_bright_duplicate(bright, ra, dec, v):
            report["dropped: already one of the 5,080 bright stars"] += 1
            continue
        if G.is_ucac4_duplicate(ucac4, ra, dec, v):
            report["dropped: already a star UCAC4 keeps"] += 1
            continue
        c = colour_from_type(r["spect_type"], table)
        report["kept"] += 1
        report["kept with a colour from the spectral type" if c is not None else "kept without a colour"] += 1
        kept.append((ra, dec, v, c))
        rows.append((ra, dec, v, "" if c is None else f"{c:.3f}", r["name"].replace("SAO ", ""), r["hd"].strip(), r["spect_type"].strip()))
    manifest = {
        "source": "Smithsonian Astrophysical Observatory Star Catalog (SAO Staff 1966), the J2000 version of the Astronomical Data Center (I/131A), as NASA HEASARC serves it (table sao)",
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
        w.writerow(["ra", "dec", "v", "b_v", "sao", "hd", "type"])
        w.writerows(rows)
    (out / "report.json").write_text(json.dumps(manifest["report"], indent=1) + "\n")
    print(json.dumps(manifest["report"], indent=1))


if __name__ == "__main__":
    action = sys.argv[1] if len(sys.argv) > 1 else ""
    raw_dir = Path(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_RAW
    if action == "download":
        download(raw_dir)
    elif action == "build":
        build(raw_dir, Path(sys.argv[3]) if len(sys.argv) > 3 else DEFAULT_UCAC4, Path(sys.argv[4]) if len(sys.argv) > 4 else DEFAULT_OUT)
    else:
        sys.exit(__doc__)
