#!/usr/bin/env python3
"""Write faint-tiles/: the faint stars of UCAC4 to magnitude 12, in sky tiles, for `@johnmorrisdotca/hoshi-stars/faint`.

Source
- UCAC4, the fourth U.S. Naval Observatory CCD Astrograph Catalog: Zacharias, N., Finch, C. T., Girard, T. M., Henden, A., Bartlett, J. L., Monet, D. G. and Zacharias, M. I. (2013), Astronomical Journal 145, 44;
  VizieR catalogue I/322A, read through NASA/IPAC Infrared Science Archive (IRSA)'s TAP service (https://irsa.ipac.caltech.edu/TAP, table ucac4_sources, DOI 10.26131/IRSA17).
  NOTICE.md quotes the sentences relied on and the date they were read.
- The positions are UCAC4's J2000.0 ICRS positions (`ra`, `dec`); no proper motion is read. The magnitude is APASS V (UCAC4 carries APASS DR6 photometry; `vmag`) where the record has one that is APASS's own,
  else UCAC4's own fit model magnitude (`momag`, 579 to 642 nm, between V and R). The colour is APASS B-V (`bmag - vmag`) where both are APASS's own, else none.

NOT from Hipparcos, Tycho-2 or Gaia (ESA's, CC BY-NC 3.0 IGO). UCAC4 copies some of their values in; this script drops, and counts, every row that has any:
- object type (`ojt`) 6 (position and proper motion substituted from FK6, Hipparcos or Tycho-2), 7 (a supplement star added from them with no CCD data) and 4 (external high-proper-motion data used instead of UCAC's own;
  the catalogue does not say whose, so they are all dropped);
- where the record's FK6-Hipparcos-Tycho source flag (`tf`) is not 0 and the APASS error (`ver`, `ber`) is 0, the V (or B) in the record is Tycho's Vt (or Bt), not APASS's (the catalogue's own words:
  "apasm(2) < 20000 and apase(2) = 0"), so it is not used: the star is then measured by UCAC's own model magnitude and has no colour.
A record whose `tf` is not 0 but whose position and magnitude are UCAC's own (a Tycho-2 cross-reference only) stays, and the count of these is in the report.

Also dropped: the stars the 5,080 bright stars (src/data/stars.ts) already hold, matched by position (within 20 arc-seconds) and magnitude (within 1.5).

    python3 -I scripts/make-faint-data.py download [RAW_DIR]   # IRSA TAP, 18 asynchronous jobs a pause apart, into RAW_DIR (default ~/Projects/backups/hoshi-stars/2026-11-09-ucac4-raw, or $HOSHI_STARS_BACKUP_DIR)
    python3 -I scripts/make-faint-data.py build [RAW_DIR] [--gap NAME[,NAME...]]   # reads the CSVs, writes faint-tiles/ and faint-tiles/index.json
        --gap adds the fill of the gap between the bright stars and UCAC4's own stars (see below); without it the build uses DEFAULT_GAP. `--gap none` adds nothing.

The gap between the bright stars and UCAC4's own stars (magnitude 6.0 to 9.0, where UCAC4 holds few stars, because its rows there are copies of Hipparcos and Tycho-2 and are dropped) is filled by a source of its own,
built by scripts/make-gap-apass.py (APASS V with 2MASS positions) or scripts/make-gap-sao.py (the SAO Star Catalog) into level 0 tiles of their own in `<backups>/2026-11-09-gap-tiles/<name>/`. `--gap` merges the ones it names into level 0 here, the first named winning where two of
them hold the same star (5 arc-seconds, 2 magnitudes), and the index says how many stars each source gave (`gapFill`). The tile format has no room for a mark on each star, so the source of a star is not in the tile: the index records it per source.

Neither runs in the test. The raw downloads stay out of the repository; only the built tiles are committed.

Tile format (the same in src/faint.ts): a tile is a rectangle of the sky, a band of declination by a range of right ascension. A tile file holds `n` stars as six planes of `n` bytes each, the stars sorted by declination:
  1. declination step, low byte      2. declination step, high byte (the step from the star before, in 1/65535 of the tile's height; the first from the tile's south edge)
  3. right ascension, low byte        4. right ascension, high byte (in 1/65535 of the tile's width)
  5. magnitude: round(V * 20), so 0.05 steps, to 12.75
  6. colour: round((B-V + 0.6) * 80) from 0 to 254, 255 for no colour
No header: `n` is the file's length over six. The planes compress well (the high step byte is nearly all zero).
"""
import csv
import io
import json
import math
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "faint-tiles"
STARS_TS = ROOT / "src" / "data" / "stars.ts"
GAP_ROOT = Path(os.environ.get("HOSHI_STARS_BACKUP_DIR", Path.home() / "Projects" / "backups" / "hoshi-stars")) / "2026-11-09-gap-tiles"
DEFAULT_GAP = []  # nothing is merged until NOTICE.md says a source ships: `--gap sao` once HEASARC confirms its terms, or `--gap apass-2mass,sao` to prefer APASS+2MASS where it has the star
GAP_MATCH_ARCSEC = 5.0
GAP_MATCH_MAG = 2.0
DEFAULT_RAW = Path(os.environ.get("HOSHI_STARS_BACKUP_DIR", Path.home() / "Projects" / "backups" / "hoshi-stars")) / "2026-11-09-ucac4-raw"

# ----- download -----
TAP = "https://irsa.ipac.caltech.edu/TAP"
TABLE = "ucac4_sources"
COLUMNS = "ucac4_id, ra, dec, momag, vmag, ver, bmag, ber, ojt, tf, dsf"
# Everything the build might use. A UCAC model magnitude of 12.6 or brighter (an APASS V of 12.0 can sit 0.5 away from it), or an APASS V of 12.0 or brighter (the supplement stars have no model magnitude).
# The dropped rows are downloaded too, so that the report can count them.
WHERE = "(momag <= 12.6 OR vmag <= 12)"
BAND_DEGREES = 10
PAUSE_SECONDS = 10
POLL_SECONDS = 10
USER_AGENT = "hoshi-stars make-faint-data.py (john@johnmorris.ca)"

# ----- the build -----
LIMIT = 12.0
BRIGHT_MATCH_ARCSEC = 20.0
BRIGHT_MATCH_MAG = 1.5
DROP_TYPES = {4: "external high-proper-motion data", 6: "substituted from FK6, Hipparcos or Tycho-2", 7: "supplement star from FK6, Hipparcos or Tycho-2"}
# The tile levels: (faintest magnitude in the level, height of a band in degrees). A star goes in the first level whose faintest magnitude it does not pass and past the faintest of the one before.
LEVELS = [(10.0, 10), (11.0, 6), (12.0, 5)]
MAG_STEP = 20
COLOUR_OFFSET = 0.6
COLOUR_STEP = 80
NO_COLOUR = 255
FULL = 65535


def tap_request(url, data=None, method=None):
    body = urllib.parse.urlencode(data).encode() if data is not None else None
    return urllib.request.Request(url, data=body, method=method, headers={"User-Agent": USER_AGENT, "Accept-Encoding": "identity"})


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def tap_count(where):
    req = tap_request(TAP + "/sync", {"QUERY": f"SELECT COUNT(*) AS n FROM {TABLE} WHERE {where}", "FORMAT": "csv", "LANG": "ADQL"})
    with urllib.request.urlopen(req, timeout=280) as r:
        return int(list(csv.reader(io.StringIO(r.read().decode())))[1][0])


def tap_job(query):
    """One asynchronous job; its CSV text. The job is deleted once read."""
    opener = urllib.request.build_opener(NoRedirect)
    req = tap_request(TAP + "/async", {"REQUEST": "doQuery", "LANG": "ADQL", "FORMAT": "csv", "PHASE": "RUN", "QUERY": query})
    try:
        opener.open(req, timeout=120)
        raise RuntimeError("IRSA did not answer with a job location")
    except urllib.error.HTTPError as e:
        if e.code not in (301, 302, 303):
            raise
        job = e.headers["Location"]
    for _ in range(360):
        time.sleep(POLL_SECONDS)
        with urllib.request.urlopen(tap_request(job), timeout=60) as r:
            root = ET.fromstring(r.read())
        phase = root.findtext("{http://www.ivoa.net/xml/UWS/v1.0}phase")
        if phase == "COMPLETED":
            break
        if phase in ("ERROR", "ABORTED"):
            raise RuntimeError(f"job {job} ended {phase}")
    else:
        raise RuntimeError(f"job {job} did not finish")
    with urllib.request.urlopen(tap_request(job + "/results/result"), timeout=600) as r:
        text = r.read().decode()
    try:
        urllib.request.urlopen(tap_request(job, method="DELETE"), timeout=60).read()
    except Exception:
        pass
    return text


def band_name(low, high):
    return f"ucac4-dec{low:+03d}-{high:+03d}.csv"


def download(raw: Path):
    raw.mkdir(parents=True, exist_ok=True)
    for low in range(-90, 90, BAND_DEGREES):
        high = low + BAND_DEGREES
        path = raw / band_name(low, high)
        if path.exists():
            print(f"have {path.name}")
            continue
        where = f"dec >= {low} AND dec {'<=' if high == 90 else '<'} {high} AND {WHERE}"
        for attempt in range(1, 4):
            try:
                expected = tap_count(where)
                time.sleep(PAUSE_SECONDS)
                text = tap_job(f"SELECT {COLUMNS} FROM {TABLE} WHERE {where}")
                break
            except (urllib.error.URLError, TimeoutError, RuntimeError) as e:
                if attempt == 3:
                    raise
                print(f"{path.name}: attempt {attempt} failed ({e}); trying again in a minute", flush=True)
                time.sleep(60)
        got = text.count("\n") - 1
        if got != expected:
            raise RuntimeError(f"{path.name}: {got} rows, the COUNT query said {expected}; not saved")
        tmp = path.with_suffix(".part")
        tmp.write_text(text)
        tmp.rename(path)
        print(f"saved {path.name}: {got} rows", flush=True)
        time.sleep(PAUSE_SECONDS)


# ----- the bright stars, to drop duplicates of -----
def bright_stars():
    """(ra, dec, V) of the 5,080 bright stars, from src/data/stars.ts."""
    found = []
    for line in STARS_TS.read_text().split("\n"):
        parts = line.removeprefix("export const STAR_ROWS = `").split("|")
        if len(parts) < 10 or not parts[0].isdigit():
            continue
        found.append((int(parts[4]) / 10 / 3600 * 15, int(parts[5]) / 3600, int(parts[8]) / 100))
    if len(found) != 5080:
        raise RuntimeError(f"read {len(found)} bright stars, expected 5080")
    return found


class BrightIndex:
    """The bright stars in one-degree cells of declination and right ascension, for a nearest search."""

    def __init__(self, stars):
        self.cells = {}
        for ra, dec, v in stars:
            self.cells.setdefault((int(math.floor(dec)), int(ra)), []).append((ra, dec, v))

    def match(self, ra, dec, mag):
        reach = BRIGHT_MATCH_ARCSEC / 3600
        cd = int(math.floor(dec))
        for d in (cd - 1, cd, cd + 1):
            spread = 1 + int(reach / max(0.01, math.cos(math.radians(min(89.9, abs(d) + 1)))))
            for r in range(int(ra) - spread, int(ra) + spread + 1):
                for bra, bdec, bv in self.cells.get((d, r % 360), ()):
                    dra = (bra - ra + 180) % 360 - 180
                    if abs(bdec - dec) <= reach and abs(dra) * math.cos(math.radians(dec)) <= reach and math.hypot(dra * math.cos(math.radians(dec)), bdec - dec) <= reach and abs(bv - mag) <= BRIGHT_MATCH_MAG:
                        return True
        return False


# ----- the tile grid (the same in src/faint.ts) -----
def columns_of(band_degrees, band):
    """Tiles along a band: as many as keep a tile about as wide as it is tall at the band's edge nearer the equator."""
    low = -90 + band * band_degrees
    high = low + band_degrees
    nearer = 0.0 if low < 0 < high else min(abs(low), abs(high))
    return max(1, int(math.floor(360 * math.cos(math.radians(nearer)) / band_degrees)))


def tile_of(level, ra, dec):
    height = LEVELS[level][1]
    bands = 180 // height
    band = min(bands - 1, int((dec + 90) // height))
    columns = columns_of(height, band)
    return band, min(columns - 1, int(ra // (360 / columns)))


def level_of(mag):
    for i, (top, _) in enumerate(LEVELS):
        if mag <= top:
            return i
    raise ValueError(mag)


def read_rows(raw: Path):
    for path in sorted(raw.glob("ucac4-dec*.csv")):
        with path.open() as f:
            reader = csv.reader(f)
            next(reader)
            yield from reader


def number(text):
    return None if text == "" else float(text)


def load_gap(names):
    """The gap fill: (stars as (ra, dec, mag, colour), the per-source list for the index). The sources are merged in the order named; a star within 5 arc-seconds and 2 magnitudes of one already taken is the same star and is dropped."""
    import importlib.util

    sys.dont_write_bytecode = True
    spec = importlib.util.spec_from_file_location("gap_common", Path(__file__).resolve().parent / "gap_common.py")
    common = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(common)
    taken = common.SkyIndex()
    stars = []
    sources = []
    for name in names:
        info = json.loads((GAP_ROOT / name / "index.json").read_text())
        mine = common.read_gap_tiles(GAP_ROOT / name)
        if len(mine) != info["stars"]:
            raise RuntimeError(f"gap source {name}: {len(mine)} stars in its tiles, its index says {info['stars']}")
        added = 0
        for ra, dec, mag, colour in mine:
            if any(abs(p[2] - mag) <= GAP_MATCH_MAG for _, p in taken.near(ra, dec, GAP_MATCH_ARCSEC)):
                continue
            taken.add((ra, dec, mag))
            stars.append((ra, dec, mag, colour))
            added += 1
        sources.append({"name": name, "source": info["source"], "from": info["from"], "to": info["to"], "built": info["built"], "starsBuilt": info["stars"], "starsKept": added, "report": info["report"]})
    return stars, sources


def build(raw: Path, gap_names=()):
    bright = BrightIndex(bright_stars())
    report = Counter()
    by_type = Counter()
    kept = {}
    dropped_bright_examples = []
    for row in read_rows(raw):
        report["rows read"] += 1
        uid, ra, dec, momag, vmag, ver, bmag, ber, ojt, tf, dsf = row
        ra, dec = float(ra), float(dec)
        momag, vmag, ver, bmag, ber = number(momag), number(vmag), number(ver), number(bmag), number(ber)
        ojt, tf = int(ojt), int(tf)
        by_type[ojt] += 1
        if tf > 0:
            report["rows with a Hipparcos or Tycho cross-reference (tf not 0)"] += 1
        if ojt in DROP_TYPES:
            report[f"dropped: object type {ojt}, {DROP_TYPES[ojt]}"] += 1
            continue
        v_apass = vmag is not None and not (ver == 0 and tf > 0)
        if vmag is not None and not v_apass:
            report["V is Tycho's Vt, not used (tf not 0 and APASS error 0); model magnitude used"] += 1
        if v_apass:
            mag = vmag
            report["magnitude: APASS V"] += 1
        elif momag is not None:
            mag = momag
            report["magnitude: UCAC model magnitude"] += 1
        else:
            report["dropped: no magnitude of its own"] += 1
            continue
        mag = round(mag * MAG_STEP) / MAG_STEP  # the magnitude as the tile stores it: the level and the limit go by that
        if mag > LIMIT:
            report["dropped: fainter than 12.0 by the chosen magnitude"] += 1
            continue
        if tf > 0:
            report["kept with a Tycho cross-reference only (position and magnitude UCAC's own)"] += 1
        if mag <= 8.5 and bright.match(ra, dec, mag):
            report["dropped: already one of the 5,080 bright stars"] += 1
            if len(dropped_bright_examples) < 5:
                dropped_bright_examples.append((uid, ra, dec, mag))
            continue
        b_apass = bmag is not None and not (ber == 0 and tf > 0)
        colour = None
        if v_apass and b_apass:
            colour = bmag - vmag
            if not -0.6 <= colour < 2.58:
                colour = None
        key = level_of(mag)
        kept.setdefault((key,) + tile_of(key, ra, dec), []).append((ra, dec, mag, colour))
        report[f"kept at level {key}"] += 1
        report["kept"] += 1
        if colour is None:
            report["kept without a colour"] += 1

    # the gap fill: level 0 stars (to magnitude 10) from the sources named by --gap
    gap_stars, gap_sources = load_gap(gap_names) if gap_names else ([], [])
    for ra, dec, mag, colour in gap_stars:
        key = level_of(mag)
        if key != 0:
            raise RuntimeError(f"a gap star of magnitude {mag} is not in level 0")
        kept.setdefault((0,) + tile_of(0, ra, dec), []).append((ra, dec, mag, colour))
        report["kept at level 0"] += 1
        report["kept"] += 1
        report["kept without a colour"] += colour is None
    for src in gap_sources:
        report[f"gap fill, {src['name']}: stars kept"] = src["starsKept"]
    # the tiles
    if OUT.exists():
        for old in OUT.rglob("*.bin"):
            old.unlink()
    sizes = {}
    magnitude_counts = Counter()
    level_info = []
    for level, (top, height) in enumerate(LEVELS):
        (OUT / f"L{level}").mkdir(parents=True, exist_ok=True)
        bands = 180 // height
        files = 0
        stars_in_level = 0
        biggest = 0
        total_bytes = 0
        for band in range(bands):
            columns = columns_of(height, band)
            for column in range(columns):
                stars = sorted(kept.get((level, band, column), []), key=lambda s: s[1])
                dec0 = -90 + band * height
                ra0 = column * 360 / columns
                width = 360 / columns
                n = len(stars)
                planes = [bytearray(n) for _ in range(6)]
                last = 0
                for i, (ra, dec, mag, colour) in enumerate(stars):
                    y = min(FULL, max(0, round((dec - dec0) / height * FULL)))
                    x = min(FULL, max(0, round((ra - ra0) / width * FULL)))
                    step = y - last
                    last = y
                    planes[0][i] = step & 255
                    planes[1][i] = step >> 8
                    planes[2][i] = x & 255
                    planes[3][i] = x >> 8
                    planes[4][i] = min(255, round(mag * MAG_STEP))
                    planes[5][i] = NO_COLOUR if colour is None else min(254, max(0, round((colour + COLOUR_OFFSET) * COLOUR_STEP)))
                    magnitude_counts[math.floor(mag * 2) / 2] += 1
                data = b"".join(bytes(p) for p in planes)
                (OUT / f"L{level}" / f"{band}-{column}.bin").write_bytes(data)
                files += 1
                stars_in_level += n
                biggest = max(biggest, n)
                total_bytes += len(data)
        level_info.append({"level": level, "faintest": top, "bandDegrees": height, "bands": bands, "tiles": files, "stars": stars_in_level, "bytes": total_bytes, "mostStarsInATile": biggest})
        print(f"level {level} (to {top}): {files} tiles, {stars_in_level} stars, {total_bytes} bytes, the biggest tile {biggest} stars")

    counts = dict(sorted(report.items()))
    manifest = {
        "source": "UCAC4 (Zacharias et al. 2013, AJ 145, 44), VizieR I/322A, through NASA/IPAC IRSA's TAP service, table ucac4_sources",
        "built": time.strftime("%Y-%m-%d"),
        "limit": LIMIT,
        "levels": level_info,
        "magnitudeStep": 1 / MAG_STEP,
        "colour": {"offset": COLOUR_OFFSET, "step": COLOUR_STEP, "none": NO_COLOUR},
        "stars": report["kept"],
        "report": counts,
        "objectTypes": {str(k): v for k, v in sorted(by_type.items())},
        "keptByHalfMagnitude": {f"{k:.1f}": v for k, v in sorted(magnitude_counts.items())},
        "droppedAsBrightExamples": dropped_bright_examples,
        "gapFill": {"level": 0, "stars": sum(g["starsKept"] for g in gap_sources), "sources": gap_sources},
    }
    (OUT / "index.json").write_text(json.dumps(manifest, indent=1) + "\n")
    print(json.dumps({"report": counts, "keptByHalfMagnitude": manifest["keptByHalfMagnitude"]}, indent=1))


if __name__ == "__main__":
    action = sys.argv[1] if len(sys.argv) > 1 else ""
    args = [a for a in sys.argv[2:] if not a.startswith("--gap")]
    gap_arg = next((sys.argv[i + 1] for i, a in enumerate(sys.argv) if a == "--gap" and i + 1 < len(sys.argv)), None)
    args = [a for a in args if a != gap_arg]
    raw_dir = Path(args[0]) if args else DEFAULT_RAW
    gap = DEFAULT_GAP if gap_arg is None else [] if gap_arg == "none" else gap_arg.split(",")
    if action == "download":
        download(raw_dir)
    elif action == "build":
        build(raw_dir, gap)
    else:
        sys.exit(__doc__)
