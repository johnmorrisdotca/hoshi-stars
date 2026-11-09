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

Ghosts (MODULES-769). UCAC4 holds detections that are not stars, in the halo of a bright one: a kept star within `ghost_radius(V)` of one of the 5,080 bright stars (30 arc-seconds round a star of V 5.5, growing a factor of 10^0.2 for each magnitude brighter, at most 120)
is dropped unless 2MASS (NASA/IPAC's Point Source Catalog, public domain) confirms it: a point source within 2 arc-seconds whose flags do not name a persistence, diffraction spike, stripe or halo artifact (p, d, s, h) and whose J is not
absurd against the star's V (V - J from -1 to 4.5); and a star within 5 arc-seconds of a bright star whose 2MASS source is no fainter in J than that star's V plus 1 is the bright star itself, seen again with a wrong magnitude, which confirms nothing. The 2MASS rows are fetched once (`download-ghost`) into `<backups>/2026-11-10-ghost-2mass/` and the build reads them. UCAC4's object type 1 ("near an overexposed star") is not used: 96.6 in 100 of a sample are
confirmed, as 96 in 100 of the ordinary stars are, so it marks real stars that lie near any overexposed star. The counts are in the report and in NOTICE.md.

Magnitudes (MODULES-786). UCAC4's V of its bright stars runs 0.4 to 1.2 too faint (see docs/guides/faint-stars.md). Where an APASS DR10 star of V from 7.0 to 10.2 (to declination +20.0; APASS has no bright stars north of about +20.5) lies within 5 arc-seconds of a kept star
and UCAC4's magnitude is no more than 0.5 brighter and no more than 2.5 fainter than APASS's, the star's V is APASS DR10's (and its colour APASS DR10's B-V, where both errors are under 0.1). The tile format has no room for a mark on each star, so the index says per tile how many stars took APASS's
V (`apassV.tiles`). SAO is not read unless `--correct apass,sao` is given (MODULES-787: its terms are not yet confirmed, and NOTICE.md says so).

    python3 -I scripts/make-faint-data.py download [RAW_DIR]   # IRSA TAP, 18 asynchronous jobs a pause apart, into RAW_DIR (default ~/Projects/backups/hoshi-stars/2026-11-09-ucac4-raw, or $HOSHI_STARS_BACKUP_DIR)
    python3 -I scripts/make-faint-data.py download-apass [DIR]   # the APASS DR10 stars of V 9.2 to 10.2 (to declination +25), GAVO's TAP service, into DIR (default ~/Projects/backups/hoshi-stars/2026-11-10-apass-faint-raw); V 6.0 to 9.2 is in 2026-11-09-apass-2mass-raw
    python3 -I scripts/make-faint-data.py download-ghost [RAW_DIR] [DIR]   # the 2MASS sources round every star that the ghost rule looks at, IRSA's TAP service, into DIR (default ~/Projects/backups/hoshi-stars/2026-11-10-ghost-2mass)
    python3 -I scripts/make-faint-data.py build [RAW_DIR] [--gap NAME[,NAME...]] [--correct apass|apass,sao|none] [--ghosts on|off] [--out DIR]   # reads the CSVs, writes faint-tiles/ and faint-tiles/index.json
        --gap adds the fill of the gap between the bright stars and UCAC4's own stars (see below); without it the build uses DEFAULT_GAP. `--gap none` adds nothing.
        --correct names the sources of corrected magnitudes (default apass); `--correct none --ghosts off --out DIR` reproduces the tiles of 0.18.1, byte for byte.

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
import importlib.util
import io
import json
import math
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path

def load_common():
    sys.dont_write_bytecode = True
    spec = importlib.util.spec_from_file_location("gap_common", Path(__file__).resolve().parent / "gap_common.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


G = load_common()
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "faint-tiles"
BACKUPS = Path(os.environ.get("HOSHI_STARS_BACKUP_DIR", Path.home() / "Projects" / "backups" / "hoshi-stars"))
GAP_ROOT = BACKUPS / "2026-11-09-gap-tiles"
DEFAULT_GAP = []  # nothing is merged until NOTICE.md says a source ships: `--gap sao` once HEASARC confirms its terms, or `--gap apass-2mass,sao` to prefer APASS+2MASS where it has the star
GAP_MATCH_ARCSEC = 5.0
GAP_MATCH_MAG = 2.0
DEFAULT_RAW = BACKUPS / "2026-11-09-ucac4-raw"
DEFAULT_GHOST = BACKUPS / "2026-11-10-ghost-2mass"
APASS_RAW = [BACKUPS / "2026-11-09-apass-2mass-raw", BACKUPS / "2026-11-10-apass-faint-raw"]  # V 6.0 to 9.2, and V 9.2 to 10.2

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

# ----- the ghosts (MODULES-769) -----
GHOST_BASE_ARCSEC = 30.0  # the radius round a bright star of V 5.5 ...
GHOST_BASE_MAG = 5.5
GHOST_SLOPE = 0.2  # ... grows by 10^0.2 for each magnitude brighter (the halo's reach goes with the square root of the light) ...
GHOST_MAX_ARCSEC = 120.0  # ... and stops here (only about 50 of the bright stars are brighter than 2)
GHOST_CONFIRM_ARCSEC = 2.0  # a 2MASS point source this close confirms a star
GHOST_FETCH_ARCSEC = 3.0  # what the download asks for, so that the rule can be a little different from it
GHOST_VJ = (-1.0, 4.5)  # a confirming source must not be absurd against the star: V - J from here to here
GHOST_OWN_ARCSEC = 5.0  # a star this close to a bright star, whose confirming 2MASS source is no fainter in J than the bright star's V plus GHOST_OWN_MAG, is the bright star itself seen again (UCAC4 gives it a wrong magnitude): it is not confirmed
GHOST_OWN_MAG = 1.0
GHOST_ARTIFACT_FLAGS = "pdsh"  # 2MASS cc_flg letters for persistence, diffraction spike, stripe and halo: such a source confirms nothing (confusion, c, is a real star among others)
GHOST_UPLOAD = 1000
TWOMASS_TAP = "https://irsa.ipac.caltech.edu/TAP"

# ----- the magnitudes (MODULES-786) -----
APASS_TAP = "https://dc.g-vo.org/tap"
APASS_TABLE = "apass.dr10"
APASS_COLUMNS = "id, ra, dec, ra_error, dec_error, nobs_v, mag_v, err_mag_v, nobs_b, mag_b, err_mag_b"
APASS_MORE_WHERE = "mag_v >= 9.2 AND mag_v < 10.2"
APASS_MORE_DEC_TO = 25
APASS_FROM = 7.0  # APASS saturates near V 7 ("anything brighter than V=7 is not usable", AAVSO)
APASS_TO = 10.2
APASS_DEC_MAX = 20.0  # APASS DR10 has its bright stars to declination +20.5 and a tenth of them beyond
APASS_MATCH_ARCSEC = 5.0
APASS_MATCH_MAG = (-0.5, 2.5)  # UCAC4's magnitude minus APASS's V may be from here to here for the two to be the same star
APASS_ERROR_MAX = 0.3  # APASS's own error in V: the scatter between nights, 0 where there is one night
APASS_COLOUR_ERROR_MAX = 0.1
SAO_MATCH_ARCSEC = 5.0
SAO_UNTIL = 9.5  # a star UCAC4 gives fainter than this is not corrected from SAO: UCAC4's bright-star error is gone by about 9.5

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


# ----- the bright stars: duplicates, and the halos that ghosts lie in -----
def ghost_radius(v):
    """The reach, in arc-seconds, of the halo of a bright star of visual magnitude `v`: where a faint star is a ghost unless 2MASS confirms it."""
    return min(GHOST_MAX_ARCSEC, GHOST_BASE_ARCSEC * 10 ** (GHOST_SLOPE * (GHOST_BASE_MAG - v)))


class BrightIndex:
    """The bright stars in one-degree cells of declination and right ascension, for a nearest search."""

    def __init__(self, stars):
        self.cells = {}
        for ra, dec, v in stars:
            self.cells.setdefault((int(math.floor(dec)), int(ra)), []).append((ra, dec, v))

    def _near(self, ra, dec, reach_of):
        """The bright stars (separation in arc-seconds, V) that lie within `reach_of(V)` arc-seconds of the point, nearest first."""
        found = []
        cosd = math.cos(math.radians(dec))
        cd = int(math.floor(dec))
        for d in (cd - 1, cd, cd + 1):
            spread = 1 + int(GHOST_MAX_ARCSEC / 3600 / max(0.01, math.cos(math.radians(min(89.9, abs(d) + 1)))))
            for r in range(int(ra) - spread, int(ra) + spread + 1):
                for bra, bdec, bv in self.cells.get((d, r % 360), ()):
                    dra = (bra - ra + 180) % 360 - 180
                    sep = math.hypot(dra * cosd, bdec - dec) * 3600
                    if sep <= reach_of(bv):
                        found.append((sep, bv, bra, bdec))
        found.sort()
        return found

    def match(self, ra, dec, mag):
        """Is the point one of the bright stars, by position (20 arc-seconds) and magnitude (1.5)?"""
        return any(abs(f[1] - mag) <= BRIGHT_MATCH_MAG for f in self._near(ra, dec, lambda _v: BRIGHT_MATCH_ARCSEC))

    def halo(self, ra, dec):
        """(separation, V, ra, dec) of the nearest bright star whose halo the point lies in, else None."""
        found = self._near(ra, dec, ghost_radius)
        return found[0] if found else None


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


# ----- UCAC4's stars, as the faint layer keeps them -----
# A star is a list: [ra, dec, magnitude, colour or None, UCAC4 id, took APASS's V (0 or 1), took APASS's colour (0 or 1), took SAO's V (0 or 1), UCAC4 object type]
RA, DEC, MAG, COLOUR, UID, FROM_APASS, COLOUR_FROM_APASS, FROM_SAO, OJT = range(9)


def read_stars(raw: Path, report, by_type, bright_examples=None):
    """UCAC4's stars after every drop that does not need a second catalogue: no Hipparcos, Tycho or FK6 copy, none fainter than 12.0, none of the 5,080 bright stars again."""
    bright = BrightIndex(G.bright_stars())
    stars = []
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
            if bright_examples is not None and len(bright_examples) < 5:
                bright_examples.append((uid, ra, dec, mag))
            continue
        b_apass = bmag is not None and not (ber == 0 and tf > 0)
        colour = None
        if v_apass and b_apass:
            colour = bmag - vmag
            if not -0.6 <= colour < 2.58:
                colour = None
        stars.append([ra, dec, mag, colour, uid, 0, 0, 0, ojt])
    return stars


# ----- ghosts -----
def ghost_candidates(stars):
    """The stars that lie in the halo of a bright star: [(star, separation, V of the bright star)]."""
    bright = BrightIndex(G.bright_stars())
    found = []
    for star in stars:
        halo = bright.halo(star[RA], star[DEC])
        if halo is not None:
            found.append((star, halo[0], halo[1], (halo[2], halo[3])))
    return found


def download_ghost(raw: Path, out: Path):
    """The 2MASS point sources within GHOST_FETCH_ARCSEC of every star the ghost rule looks at, into `out`: ghost-candidates.csv (the stars) and ghost-2mass.csv (the sources). IRSA's TAP service takes the positions as an uploaded table."""
    out.mkdir(parents=True, exist_ok=True)
    candidates = ghost_candidates(read_stars(raw, Counter(), Counter()))
    print(f"{len(candidates)} stars in the halo of a bright star")
    (out / "ghost-candidates.csv").write_text("ucac4_id,ra,dec,magnitude,bright_v,separation_arcsec\n" + "".join(f"{s[UID]},{s[RA]},{s[DEC]},{s[MAG]},{v},{sep:.2f}\n" for s, sep, v, _ in candidates))
    lines = []
    for i in range(0, len(candidates), GHOST_UPLOAD):
        chunk = [(int(s[UID]), s[RA], s[DEC]) for s, _, _, _ in candidates[i : i + GHOST_UPLOAD]]
        for attempt in range(1, 4):
            try:
                text = G.tap_cone_upload(TWOMASS_TAP, "fp_psc", "p.designation, p.ra, p.dec, p.j_m, p.ph_qual, p.cc_flg", chunk, GHOST_FETCH_ARCSEC)
                break
            except (urllib.error.URLError, TimeoutError) as e:
                if attempt == 3:
                    raise
                print(f"attempt {attempt} failed ({e}); trying again in a minute", flush=True)
                time.sleep(60)
        rows = list(csv.reader(io.StringIO(text)))
        lines.extend(rows[1:])
        print(f"sent {i + len(chunk)} of {len(candidates)}; {len(lines)} 2MASS sources so far", flush=True)
        time.sleep(PAUSE_SECONDS)
    with (out / "ghost-2mass.csv").open("w", newline="") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(["ucac4_id", "designation", "ra", "dec", "j_m", "ph_qual", "cc_flg"])
        w.writerows(lines)
    print(f"saved {out / 'ghost-2mass.csv'}: {len(lines)} rows")


def load_confirmations(ghost_dir: Path, candidates):
    """The candidates that 2MASS confirms, as {UCAC4 id: the designation of the 2MASS source}. The candidate list on file must be the one the build has (else `download-ghost` is run again)."""
    on_file = {}
    with (ghost_dir / "ghost-candidates.csv").open() as f:
        for row in csv.DictReader(f):
            on_file[row["ucac4_id"]] = (float(row["ra"]), float(row["dec"]), float(row["magnitude"]))
    ours = {s[UID]: (s[RA], s[DEC], s[MAG]) for s, _, _, _ in candidates}
    parent = {s[UID]: (sep, v) for s, sep, v, _ in candidates}
    if on_file != ours:
        raise RuntimeError(f"the 2MASS rows in {ghost_dir} are for another list of stars ({len(on_file)} there, {len(ours)} here); run download-ghost again")
    confirmed = {}
    with (ghost_dir / "ghost-2mass.csv").open() as f:
        for row in csv.DictReader(f):
            if row["j_m"] == "" or any(c in row["cc_flg"] for c in GHOST_ARTIFACT_FLAGS):
                continue
            ra, dec, mag = ours[row["ucac4_id"]]
            if G.separation_arcsec(ra, dec, float(row["ra"]), float(row["dec"])) > GHOST_CONFIRM_ARCSEC:
                continue
            sep, parent_v = parent[row["ucac4_id"]]
            if sep <= GHOST_OWN_ARCSEC and float(row["j_m"]) <= parent_v + GHOST_OWN_MAG:
                continue
            if GHOST_VJ[0] <= mag - float(row["j_m"]) <= GHOST_VJ[1]:
                confirmed.setdefault(row["ucac4_id"], row["designation"])
    return confirmed


def drop_ghosts(stars, ghost_dir: Path, report, info):
    """Drop the stars in the halo of a bright star that 2MASS does not confirm."""
    candidates = ghost_candidates(stars)
    confirmed = load_confirmations(ghost_dir, candidates)
    gone = [(s, bright) for s, _, _, bright in candidates if s[UID] not in confirmed]
    report["ghost rule: kept stars in the halo of a bright star"] = len(candidates)
    report["ghost rule: confirmed by a 2MASS source, kept"] = len(candidates) - len(gone)
    report["dropped: ghost, in the halo of a bright star with no 2MASS source"] = len(gone)
    info["ghosts"] = {
        "rule": f"a star within {GHOST_BASE_ARCSEC:g} arc-seconds x 10^({GHOST_SLOPE:g} x ({GHOST_BASE_MAG:g} - V)) of a bright star of visual magnitude V (at most {GHOST_MAX_ARCSEC:g}) is dropped unless a 2MASS point source within {GHOST_CONFIRM_ARCSEC:g} arc-seconds confirms it (no p, d, s or h flag; V - J from {GHOST_VJ[0]:g} to {GHOST_VJ[1]:g})",
        "source": "2MASS Point Source Catalog (Cutri et al. 2003) through NASA/IPAC IRSA's TAP service (fp_psc)",
        "inHalo": len(candidates),
        "confirmed": len(candidates) - len(gone),
        "dropped": len(gone),
        "brightStarsWithAGhost": len({bright for _, bright in gone}),
        "droppedExamples": [[s[RA], s[DEC], s[MAG], v] for s, _, v, _ in candidates if s[UID] not in confirmed][:5],
        "droppedByObjectType": {str(k): v for k, v in sorted(Counter(s[OJT] for s, _ in gone).items())},
        "droppedByHalfMagnitude": {f"{k:.1f}": v for k, v in sorted(Counter(math.floor(s[MAG] * 2) / 2 for s, _ in gone).items())},
    }
    drop = {s[UID] for s, _ in gone}
    bright = BrightIndex(G.bright_stars())
    near20_before, near20_after = set(), set()
    for s, _, _, _ in candidates:
        for _, _, bra, bdec in bright._near(s[RA], s[DEC], lambda _v: 20.0):
            near20_before.add((bra, bdec))
            if s[UID] not in drop:
                near20_after.add((bra, bdec))
    info["ghosts"]["brightStarsWithAFaintStarWithin20ArcSeconds"] = {"before": len(near20_before), "after": len(near20_after)}
    # who stays in a halo, with the V of the bright star and the 2MASS source that confirms it (the list is made once the magnitudes are final)
    kept_in_halo = {s[UID]: (v, confirmed[s[UID]]) for s, _, v, _ in candidates if s[UID] in confirmed}
    return [s for s in stars if s[UID] not in drop], kept_in_halo


# ----- APASS V -----
def apass_rows():
    """The APASS DR10 stars of V APASS_FROM to APASS_TO, south of APASS_DEC_MAX, with a V error no larger than APASS_ERROR_MAX."""
    for raw in APASS_RAW:
        for r in G.read_bands(raw, "apass"):
            if not r["mag_v"]:
                continue
            v, dec = float(r["mag_v"]), float(r["dec"])
            if not APASS_FROM <= v < APASS_TO or dec > APASS_DEC_MAX:
                continue
            yield {
                "id": r["id"],
                "ra": float(r["ra"]),
                "dec": dec,
                "nobs_v": int(r["nobs_v"] or 0),
                "v": v,
                "ev": number(r["err_mag_v"]),
                "b": number(r["mag_b"]),
                "eb": number(r["err_mag_b"]),
            }


def apass_colour(a):
    if a["b"] is None or a["ev"] is None or a["eb"] is None or a["ev"] > APASS_COLOUR_ERROR_MAX or a["eb"] > APASS_COLOUR_ERROR_MAX:
        return None
    c = a["b"] - a["v"]
    return c if -0.6 <= c < 2.58 else None


def correct_from_apass(stars, report, info):
    """Take APASS DR10's V (and B-V) for the stars it has: each APASS star to the nearest UCAC4 star within APASS_MATCH_ARCSEC whose magnitude is plausible (it may be 0.5 brighter and 2.5 fainter than APASS's), one APASS star to a UCAC4 star (the nearer, then the one with more nights)."""
    index = G.SkyIndex(s for s in stars if s[MAG] <= APASS_TO + APASS_MATCH_MAG[1])
    claims = {}
    for a in apass_rows():
        report["APASS DR10 stars of V 7.0 to 10.2 south of +20.0 read"] += 1
        if a["ev"] is not None and a["ev"] > APASS_ERROR_MAX:
            report["APASS stars not used: V error over 0.3"] += 1
            continue
        found = [(sep, s) for sep, s in index.near(a["ra"], a["dec"], APASS_MATCH_ARCSEC) if APASS_MATCH_MAG[0] <= s[MAG] - a["v"] <= APASS_MATCH_MAG[1]]
        if not found:
            report["APASS stars with no UCAC4 star in the layer"] += 1
            continue
        sep, star = found[0]
        old = claims.get(star[UID])
        if old is not None:
            report["APASS stars that share a UCAC4 star with another (the nearer taken)"] += 1
            if (old[0], -old[1]["nobs_v"]) <= (sep, -a["nobs_v"]):
                continue
        claims[star[UID]] = (sep, a, star)
    bands = {}
    for sep, a, star in claims.values():
        bands.setdefault(math.floor(a["v"] * 2) / 2, []).append(star[MAG] - round(a["v"] * MAG_STEP) / MAG_STEP)
        star[MAG] = round(a["v"] * MAG_STEP) / MAG_STEP
        star[FROM_APASS] = 1
        c = apass_colour(a)
        if c is not None:
            star[COLOUR] = c
            star[COLOUR_FROM_APASS] = 1
    changes = [d for v in bands.values() for d in v]  # UCAC4's magnitude minus the one now: positive where the star is brighter than UCAC4 said
    for by in (0.25, 0.5, 1.0):
        report[f"magnitude taken from APASS DR10, the star {by:g} magnitude or more brighter than UCAC4 gave it"] = sum(1 for d in changes if d >= by - 1e-9)
    report["magnitude taken from APASS DR10, the star 0.25 magnitude or more fainter than UCAC4 gave it"] = sum(1 for d in changes if d <= -0.25 + 1e-9)
    report["magnitude taken from APASS DR10"] = len(claims)
    report["colour taken from APASS DR10 (B-V, both errors under 0.1)"] = sum(s[COLOUR_FROM_APASS] for _, _, s in claims.values())
    info["apassV"] = {
        "source": "APASS DR10 (Henden et al.) through the GAVO Data Center's TAP service (apass.dr10)",
        "from": APASS_FROM,
        "to": APASS_TO,
        "declinationMax": APASS_DEC_MAX,
        "stars": len(claims),
        "colours": report["colour taken from APASS DR10 (B-V, both errors under 0.1)"],
        "medianUcac4MinusApassByApassV": {f"{k:.1f}": round(sorted(v)[len(v) // 2], 2) for k, v in sorted(bands.items())},
        "starsByApassV": {f"{k:.1f}": len(v) for k, v in sorted(bands.items())},
    }


# ----- SAO V (the hook: not on until NASA HEASARC confirms SAO's terms, MODULES-787) -----
def correct_from_sao(stars, report, info):
    """Take SAO's visual magnitude for a star that APASS did not correct and that UCAC4 gives brighter than SAO_UNTIL: the nearest SAO star within SAO_MATCH_ARCSEC (UCAC4 may be 0.5 brighter and 2.5 fainter than SAO's V)."""
    spec = importlib.util.spec_from_file_location("make_gap_sao", Path(__file__).resolve().parent / "make-gap-sao.py")
    sao_module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(sao_module)
    index = G.SkyIndex(s for s in stars if s[MAG] <= SAO_UNTIL and not s[FROM_APASS])
    taken = 0
    for r in sao_module.read_sao(sao_module.DEFAULT_RAW):
        if r["vmag"] == "":
            continue
        v = round(float(r["vmag"]) * MAG_STEP) / MAG_STEP
        found = [(sep, s) for sep, s in index.near(float(r["ra"]), float(r["dec"]), SAO_MATCH_ARCSEC) if -0.5 <= s[MAG] - v <= 2.5 and not s[FROM_SAO]]
        if found:
            star = found[0][1]
            star[MAG] = v
            star[FROM_SAO] = 1
            taken += 1
    report["magnitude taken from SAO"] = taken
    info["saoV"] = {"stars": taken, "until": SAO_UNTIL}


# ----- the gap fill -----
def load_gap(names, stars):
    """The gap fill: (stars as (ra, dec, mag, colour), the per-source list for the index). The sources are merged in the order named; a star within 5 arc-seconds and 2 magnitudes of one already taken is the same star and is dropped,
    and so is one within the same distance and magnitude of a star of UCAC4's that is kept to magnitude 11 (the magnitude of that star may have been corrected since the gap source was built)."""
    ucac = G.SkyIndex((s[RA], s[DEC], s[MAG]) for s in stars if s[MAG] <= 11.0)
    taken = G.SkyIndex()
    out = []
    sources = []
    for name in names:
        info = json.loads((GAP_ROOT / name / "index.json").read_text())
        mine = G.read_gap_tiles(GAP_ROOT / name)
        if len(mine) != info["stars"]:
            raise RuntimeError(f"gap source {name}: {len(mine)} stars in its tiles, its index says {info['stars']}")
        added = 0
        known = 0
        for ra, dec, mag, colour in mine:
            if any(abs(p[2] - mag) <= GAP_MATCH_MAG for _, p in taken.near(ra, dec, GAP_MATCH_ARCSEC)):
                continue
            if any(abs(p[2] - mag) <= GAP_MATCH_MAG for _, p in ucac.near(ra, dec, GAP_MATCH_ARCSEC)):
                known += 1
                continue
            taken.add((ra, dec, mag))
            out.append((ra, dec, mag, colour))
            added += 1
        sources.append({"name": name, "source": info["source"], "from": info["from"], "to": info["to"], "built": info["built"], "starsBuilt": info["stars"], "starsKept": added, "starsDroppedAsUcac4": known, "report": info["report"]})
    return out, sources


# ----- the build -----
def encode_tile(stars, level, band, column):
    """The bytes of a tile: six planes of one byte a star, the stars (ra, dec, mag, colour or None) sorted by declination."""
    height = LEVELS[level][1]
    dec0 = -90 + band * height
    columns = columns_of(height, band)
    width = 360 / columns
    ra0 = column * width
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
    return b"".join(bytes(p) for p in planes)


def build(raw: Path, gap_names=(), out: Path = OUT, corrections=("apass",), ghosts=True, ghost_dir: Path = DEFAULT_GHOST):
    report = Counter()
    by_type = Counter()
    info = {}
    dropped_bright_examples = []
    stars = read_stars(raw, report, by_type, dropped_bright_examples)
    kept_in_halo = {}
    if ghosts:
        stars, kept_in_halo = drop_ghosts(stars, ghost_dir, report, info)
    if "apass" in corrections:
        correct_from_apass(stars, report, info)
    if "sao" in corrections:
        correct_from_sao(stars, report, info)

    if ghosts:
        info["ghosts"]["confirmedStars"] = [[s[RA], s[DEC], s[MAG], *kept_in_halo[s[UID]]] for s in stars if s[UID] in kept_in_halo]
    kept = {}
    for star in stars:
        ra, dec, mag, colour = star[RA], star[DEC], star[MAG], star[COLOUR]
        key = level_of(mag)
        kept.setdefault((key,) + tile_of(key, ra, dec), []).append((ra, dec, mag, colour, star[FROM_APASS], star[COLOUR_FROM_APASS]))
        report[f"kept at level {key}"] += 1
        report["kept"] += 1
        if colour is None:
            report["kept without a colour"] += 1

    # the gap fill: level 0 stars (to magnitude 10) from the sources named by --gap
    gap_stars, gap_sources = load_gap(gap_names, stars) if gap_names else ([], [])
    for ra, dec, mag, colour in gap_stars:
        key = level_of(mag)
        if key != 0:
            raise RuntimeError(f"a gap star of magnitude {mag} is not in level 0")
        kept.setdefault((0,) + tile_of(0, ra, dec), []).append((ra, dec, mag, colour, 0, 0))
        report["kept at level 0"] += 1
        report["kept"] += 1
        report["kept without a colour"] += colour is None
    for src in gap_sources:
        report[f"gap fill, {src['name']}: stars kept"] = src["starsKept"]
    # the tiles
    if out.exists():
        for old in out.rglob("*.bin"):
            old.unlink()
    magnitude_counts = Counter()
    quarter_counts = Counter()
    apass_tiles = {}
    level_info = []
    for level, (top, height) in enumerate(LEVELS):
        (out / f"L{level}").mkdir(parents=True, exist_ok=True)
        bands = 180 // height
        files = 0
        stars_in_level = 0
        biggest = 0
        total_bytes = 0
        for band in range(bands):
            columns = columns_of(height, band)
            for column in range(columns):
                tile_stars = sorted(kept.get((level, band, column), []), key=lambda s: s[1])
                data = encode_tile([s[:4] for s in tile_stars], level, band, column)
                for ra, dec, mag, colour, from_apass, colour_from_apass in tile_stars:
                    magnitude_counts[math.floor(mag * 2) / 2] += 1
                    quarter_counts[math.floor(mag * 4 + 1e-9) / 4] += 1
                took = sum(s[4] for s in tile_stars)
                if took:
                    apass_tiles[f"L{level}/{band}-{column}"] = [took, sum(s[5] for s in tile_stars)]
                (out / f"L{level}" / f"{band}-{column}.bin").write_bytes(data)
                files += 1
                stars_in_level += len(tile_stars)
                biggest = max(biggest, len(tile_stars))
                total_bytes += len(data)
        level_info.append({"level": level, "faintest": top, "bandDegrees": height, "bands": bands, "tiles": files, "stars": stars_in_level, "bytes": total_bytes, "mostStarsInATile": biggest})
        print(f"level {level} (to {top}): {files} tiles, {stars_in_level} stars, {total_bytes} bytes, the biggest tile {biggest} stars")
    if "apass" in corrections:
        info["apassV"]["tiles"] = apass_tiles
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
        "keptByQuarterMagnitude": {f"{k:.2f}": v for k, v in sorted(quarter_counts.items()) if k < 10.5},
        "droppedAsBrightExamples": dropped_bright_examples,
        "gapFill": {"level": 0, "stars": sum(g["starsKept"] for g in gap_sources), "sources": gap_sources},
    }
    manifest.update(info)
    (out / "index.json").write_text(dump_json(manifest))
    print(json.dumps({"report": counts, "keptByHalfMagnitude": manifest["keptByHalfMagnitude"]}, indent=1))


def dump_json(value):
    """JSON with an indent of one, and every list of plain numbers or strings on one line (the index holds long lists of positions)."""
    text = json.dumps(value, indent=1)
    return re.sub(r"\[\s*([^\[\]{}]*?)\s*\]", lambda m: "[" + re.sub(r"\s*\n\s*", " ", m.group(1)) + "]", text) + "\n"


def main(argv):
    action = argv[0] if argv else ""
    options = {"--gap": None, "--correct": "apass", "--ghosts": "on", "--out": None}
    positional = []
    i = 1
    while i < len(argv):
        if argv[i] in options:
            if i + 1 >= len(argv):
                sys.exit(f"{argv[i]} needs a value")
            options[argv[i]] = argv[i + 1]
            i += 2
        else:
            positional.append(argv[i])
            i += 1
    if action == "download":
        download(Path(positional[0]) if positional else DEFAULT_RAW)
    elif action == "download-apass":
        out = Path(positional[0]) if positional else APASS_RAW[1]
        G.download_bands(APASS_TAP, out, "apass", APASS_COLUMNS, APASS_TABLE, APASS_MORE_WHERE, 5, 15, dec_to=APASS_MORE_DEC_TO)
    elif action == "download-ghost":
        download_ghost(Path(positional[0]) if positional else DEFAULT_RAW, Path(positional[1]) if len(positional) > 1 else DEFAULT_GHOST)
    elif action == "build":
        gap = DEFAULT_GAP if options["--gap"] is None else [] if options["--gap"] == "none" else options["--gap"].split(",")
        corrections = () if options["--correct"] == "none" else tuple(options["--correct"].split(","))
        if not set(corrections) <= {"apass", "sao"}:
            sys.exit("--correct takes apass, apass,sao or none")
        if options["--ghosts"] not in ("on", "off"):
            sys.exit("--ghosts takes on or off")
        build(Path(positional[0]) if positional else DEFAULT_RAW, gap, Path(options["--out"]) if options["--out"] else OUT, corrections, options["--ghosts"] == "on")
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main(sys.argv[1:])
