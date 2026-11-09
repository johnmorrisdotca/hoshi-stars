"""Shared helpers of scripts/make-gap-sao.py, scripts/make-gap-apass.py and scripts/compare-gap.py: the sky index, the matches against the bright stars and
against UCAC4's own stars, the TAP download, and the tile writer of the faint layer. Not run by itself.

The three scripts run as `python3 -I`, which keeps a script's own folder off the import path, so they load this file by its path (`load_common()` in each).
"""
import csv
import io
import json
import math
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STARS_TS = ROOT / "src" / "data" / "stars.ts"
BACKUPS = Path.home() / "Projects" / "backups" / "hoshi-stars"

# The matches. The bright stars: as scripts/make-faint-data.py (20 arc-seconds, 1.5 magnitudes). UCAC4's own stars: a star of the gap sources that lies within this many arc-seconds of one is the same star.
BRIGHT_MATCH_ARCSEC = 20.0
BRIGHT_MATCH_MAG = 1.5
UCAC4_MATCH_ARCSEC = 5.0
UCAC4_MATCH_MAG = 2.0

# The tile format of the faint layer (the same in src/faint.ts and scripts/make-faint-data.py). The gap stars all go in level 0 (to magnitude 10).
LEVEL0_FAINTEST = 10.0
LEVEL0_BAND_DEGREES = 10
MAG_STEP = 20
COLOUR_OFFSET = 0.6
COLOUR_STEP = 80
NO_COLOUR = 255
FULL = 65535


# ----- the sky index -----
class SkyIndex:
    """Points in one-degree cells of declination and right ascension, for a nearest search within a few arc-seconds."""

    def __init__(self, points=()):
        self.cells = {}
        for p in points:
            self.add(p)

    def add(self, p):
        """`p` is a tuple whose first two items are right ascension and declination in degrees."""
        self.cells.setdefault((int(math.floor(p[1])), int(p[0]) % 360), []).append(p)

    def near(self, ra, dec, arcsec):
        """Every point within `arcsec`, as (distance in arc-seconds, point), nearest first."""
        reach = arcsec / 3600
        cosd = math.cos(math.radians(dec))
        cd = int(math.floor(dec))
        found = []
        for d in (cd - 1, cd, cd + 1):
            spread = 1 + int(reach / max(0.01, math.cos(math.radians(min(89.9, abs(d) + 1)))))
            for r in range(int(ra) - spread, int(ra) + spread + 1):
                for p in self.cells.get((d, r % 360), ()):
                    dra = (p[0] - ra + 180) % 360 - 180
                    dd = p[1] - dec
                    if abs(dd) > reach:
                        continue
                    sep = math.hypot(dra * cosd, dd) * 3600
                    if sep <= arcsec:
                        found.append((sep, p))
        found.sort(key=lambda t: t[0])
        return found


def separation_arcsec(ra1, dec1, ra2, dec2):
    """Angular distance in arc-seconds (haversine)."""
    p1, p2 = math.radians(dec1), math.radians(dec2)
    dl = math.radians(ra2 - ra1)
    a = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return math.degrees(2 * math.asin(min(1.0, math.sqrt(a)))) * 3600


# ----- the bright stars, and UCAC4's own stars -----
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


def bright_index():
    return SkyIndex(bright_stars())


def is_bright_duplicate(index, ra, dec, mag):
    return any(abs(p[2] - mag) <= BRIGHT_MATCH_MAG for _, p in index.near(ra, dec, BRIGHT_MATCH_ARCSEC))


def ucac4_kept_index(raw_dir, faintest=11.0):
    """UCAC4's own stars to magnitude `faintest` as scripts/make-faint-data.py keeps them (same drops, same magnitude rule), from the raw band files in `raw_dir`. Items: (ra, dec, magnitude)."""
    drop_types = {4, 6, 7}
    index = SkyIndex()
    count = 0
    for path in sorted(Path(raw_dir).glob("ucac4-dec*.csv")):
        with path.open() as f:
            reader = csv.reader(f)
            next(reader)
            for row in reader:
                _, ra, dec, momag, vmag, ver, _bmag, _ber, ojt, tf, _dsf = row
                if int(ojt) in drop_types:
                    continue
                tf = int(tf)
                v_apass = vmag != "" and not (ver != "" and float(ver) == 0 and tf > 0)
                if v_apass:
                    mag = float(vmag)
                elif momag != "":
                    mag = float(momag)
                else:
                    continue
                mag = round(mag * MAG_STEP) / MAG_STEP
                if mag > faintest:
                    continue
                index.add((float(ra), float(dec), mag))
                count += 1
    return index, count


def is_ucac4_duplicate(index, ra, dec, mag):
    return any(abs(p[2] - mag) <= UCAC4_MATCH_MAG for _, p in index.near(ra, dec, UCAC4_MATCH_ARCSEC))


# ----- TAP -----
USER_AGENT = "hoshi-stars gap scripts (john@johnmorris.ca)"


def _request(url, data=None, method=None):
    body = urllib.parse.urlencode(data).encode() if data is not None else None
    return urllib.request.Request(url, data=body, method=method, headers={"User-Agent": USER_AGENT, "Accept-Encoding": "identity"})


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def tap_job(base, query, poll_seconds=10, attempts=720):
    """One asynchronous TAP job at `base` (IRSA's https://irsa.ipac.caltech.edu/TAP, GAVO's https://dc.g-vo.org/tap); its CSV text. The job is deleted once read."""
    opener = urllib.request.build_opener(_NoRedirect)
    req = _request(base + "/async", {"REQUEST": "doQuery", "LANG": "ADQL", "FORMAT": "csv", "PHASE": "RUN", "QUERY": query})
    try:
        opener.open(req, timeout=120)
        raise RuntimeError(f"{base} did not answer with a job location")
    except urllib.error.HTTPError as e:
        if e.code not in (301, 302, 303):
            raise
        job = e.headers["Location"]
    try:  # GAVO's service leaves the job pending until it is told to run; IRSA's has started it already
        urllib.request.urlopen(_request(job + "/phase", {"PHASE": "RUN"}), timeout=60).read()
    except urllib.error.HTTPError:
        pass
    for _ in range(attempts):
        time.sleep(poll_seconds)
        with urllib.request.urlopen(_request(job), timeout=60) as r:
            root = ET.fromstring(r.read())
        phase = root.findtext("{http://www.ivoa.net/xml/UWS/v1.0}phase")
        if phase == "COMPLETED":
            break
        if phase in ("ERROR", "ABORTED"):
            raise RuntimeError(f"job {job} ended {phase}")
    else:
        raise RuntimeError(f"job {job} did not finish")
    with urllib.request.urlopen(_request(job + "/results/result"), timeout=900) as r:
        text = r.read().decode()
    try:
        urllib.request.urlopen(_request(job, method="DELETE"), timeout=60).read()
    except Exception:
        pass
    return text


def tap_cone_upload(base, table, columns, points, radius_arcsec):
    """The rows of `table` (columns of the alias `p`) within `radius_arcsec` of each of `points` ((id, ra, dec) in degrees), as CSV text: the positions go up as a VOTable, and the query joins them on the server (IRSA's TAP service; one synchronous call).
    The first column of the answer is `cid`, the id of the point the row is near."""
    import uuid

    rows = "".join(f"<TR><TD>{cid}</TD><TD>{ra!r}</TD><TD>{dec!r}</TD></TR>" for cid, ra, dec in points)
    votable = (
        '<?xml version="1.0"?><VOTABLE version="1.3" xmlns="http://www.ivoa.net/xml/VOTable/v1.3"><RESOURCE type="results"><TABLE name="cand">'
        '<FIELD name="cid" datatype="long"/><FIELD name="cra" datatype="double" unit="deg"/><FIELD name="cdec" datatype="double" unit="deg"/>'
        f"<DATA><TABLEDATA>{rows}</TABLEDATA></DATA></TABLE></RESOURCE></VOTABLE>"
    ).encode()
    query = f"SELECT c.cid, {columns} FROM {table} AS p, TAP_UPLOAD.cand AS c WHERE CONTAINS(POINT('ICRS',p.ra,p.dec),CIRCLE('ICRS',c.cra,c.cdec,{radius_arcsec / 3600}))=1"
    boundary = uuid.uuid4().hex
    fields = {"REQUEST": "doQuery", "LANG": "ADQL", "FORMAT": "csv", "QUERY": query, "UPLOAD": "cand,param:cand"}
    body = b"".join(f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode() for k, v in fields.items())
    body += f'--{boundary}\r\nContent-Disposition: form-data; name="cand"; filename="cand.xml"\r\nContent-Type: text/xml\r\n\r\n'.encode() + votable + f"\r\n--{boundary}--\r\n".encode()
    req = urllib.request.Request(base + "/sync", data=body, headers={"Content-Type": f"multipart/form-data; boundary={boundary}", "User-Agent": USER_AGENT, "Accept-Encoding": "identity"})
    with urllib.request.urlopen(req, timeout=900) as r:
        return r.read().decode()


def tap_count(base, query_from_where):
    """`SELECT COUNT(*)` of `FROM ... WHERE ...` as an async job (the sync route times out on the big tables)."""
    text = tap_job(base, f"SELECT COUNT(*) AS n {query_from_where}")
    return int(list(csv.reader(io.StringIO(text)))[1][0])


def download_bands(base, raw_dir, name, select, table, extra_where, band_degrees, pause_seconds, count_base=None, dec_to=90):
    """One CSV per band of declination in `raw_dir` (from -90 up to `dec_to`), named `<name>-dec<low>-<high>.csv`. A band already saved is skipped; each is checked against a COUNT of the same query before it is saved."""
    raw_dir = Path(raw_dir)
    raw_dir.mkdir(parents=True, exist_ok=True)
    for low in range(-90, dec_to, band_degrees):
        high = min(low + band_degrees, dec_to)
        path = raw_dir / f"{name}-dec{low:+03d}-{high:+03d}.csv"
        if path.exists():
            print(f"have {path.name}", flush=True)
            continue
        where = f"dec >= {low} AND dec {'<=' if high == 90 else '<'} {high} AND {extra_where}"
        for attempt in range(1, 4):
            try:
                expected = tap_count(base, f"FROM {table} WHERE {where}")
                time.sleep(pause_seconds)
                text = tap_job(base, f"SELECT {select} FROM {table} WHERE {where}")
                break
            except (urllib.error.URLError, TimeoutError, RuntimeError) as e:
                if attempt == 3:
                    raise
                print(f"{path.name}: attempt {attempt} failed ({e}); trying again in a minute", flush=True)
                time.sleep(60)
        got = sum(1 for _ in csv.reader(io.StringIO(text))) - 1
        if got != expected:
            raise RuntimeError(f"{path.name}: {got} rows, the COUNT query said {expected}; not saved")
        tmp = path.with_suffix(".part")
        tmp.write_text(text)
        tmp.rename(path)
        print(f"saved {path.name}: {got} rows", flush=True)
        time.sleep(pause_seconds)


def read_bands(raw_dir, name):
    """Rows (as dicts) of every `<name>-dec*.csv` in `raw_dir`."""
    for path in sorted(Path(raw_dir).glob(f"{name}-dec*.csv")):
        with path.open() as f:
            yield from csv.DictReader(f)


# ----- the tiles (level 0 of the faint layer) -----
def columns_of(band_degrees, band):
    low = -90 + band * band_degrees
    high = low + band_degrees
    nearer = 0.0 if low < 0 < high else min(abs(low), abs(high))
    return max(1, int(math.floor(360 * math.cos(math.radians(nearer)) / band_degrees)))


def tile_of_level0(ra, dec):
    bands = 180 // LEVEL0_BAND_DEGREES
    band = min(bands - 1, int((dec + 90) // LEVEL0_BAND_DEGREES))
    columns = columns_of(LEVEL0_BAND_DEGREES, band)
    return band, min(columns - 1, int(ra // (360 / columns)))


def encode_tile(stars, band, column):
    """The bytes of a level 0 tile: six planes of one byte a star (see scripts/make-faint-data.py). `stars` are (ra, dec, mag, colour or None), any order."""
    stars = sorted(stars, key=lambda s: s[1])
    height = LEVEL0_BAND_DEGREES
    columns = columns_of(height, band)
    dec0 = -90 + band * height
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


def decode_tile(data, band, column):
    """The stars of a level 0 tile file: (ra, dec, mag, colour or None)."""
    n = len(data) // 6
    height = LEVEL0_BAND_DEGREES
    columns = columns_of(height, band)
    dec0 = -90 + band * height
    width = 360 / columns
    ra0 = column * width
    out = []
    y = 0
    for i in range(n):
        y += data[i] | (data[n + i] << 8)
        x = data[2 * n + i] | (data[3 * n + i] << 8)
        mag = data[4 * n + i] / MAG_STEP
        c = data[5 * n + i]
        out.append((ra0 + x / FULL * width, dec0 + y / FULL * height, mag, None if c == NO_COLOUR else c / COLOUR_STEP - COLOUR_OFFSET))
    return out


def write_gap_tiles(stars, out_dir, manifest):
    """Write `stars` (ra, dec, mag, colour or None) as level 0 tiles in `out_dir`/L0 and `out_dir`/index.json (`manifest` plus the counts). Returns the star count per tile."""
    out_dir = Path(out_dir)
    (out_dir / "L0").mkdir(parents=True, exist_ok=True)
    for old in (out_dir / "L0").glob("*.bin"):
        old.unlink()
    by_tile = {}
    for s in stars:
        by_tile.setdefault(tile_of_level0(s[0], s[1]), []).append(s)
    total_bytes = 0
    for (band, column), group in sorted(by_tile.items()):
        data = encode_tile(group, band, column)
        (out_dir / "L0" / f"{band}-{column}.bin").write_bytes(data)
        total_bytes += len(data)
    info = dict(manifest)
    info.update({"stars": len(stars), "tiles": len(by_tile), "bytes": total_bytes})
    (out_dir / "index.json").write_text(json.dumps(info, indent=1) + "\n")
    return {k: len(v) for k, v in by_tile.items()}


def read_gap_tiles(gap_dir):
    """Every star of the level 0 tiles in `gap_dir`, as (ra, dec, mag, colour or None)."""
    stars = []
    for path in sorted((Path(gap_dir) / "L0").glob("*.bin")):
        band, column = (int(x) for x in path.stem.split("-"))
        stars.extend(decode_tile(path.read_bytes(), band, column))
    return stars


def quarter(mag):
    """The quarter magnitude a star is counted in: 7.0 holds 7.0 up to but not including 7.25."""
    return math.floor(mag * 4 + 1e-9) / 4
