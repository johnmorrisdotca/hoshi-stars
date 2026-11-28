#!/usr/bin/env python3
"""Write src/data/deep-sky-shapes-messier.ts and src/data/deep-sky-shapes-ngc-ic.ts: how big each galaxy is on the sky, and which way it lies.

The objects are those of src/data/messier.ts and src/data/ngc-ic.ts (Wikidata, CC0). A shape (a major diameter, a minor diameter, a position angle) comes from two places only; NOTICE.md
records each and the day it was read:

- NASA/IPAC NED's diameters table (the "Diameters" data of one object, as NED's web pages gave it on 2026-11-09, and for the galaxies that then had no shape, again on the date NOTICE.md records): for a galaxy, the measurement at the B-band 25 mag/arcsec^2 isophote that
  NED lists (ESO-LV, UGC, ESO-Uppsala), and where there is none, the 2MASS K_s "total" diameter, and where there is none of those, the SDSS r-band 25 mag/arcsec^2 isophotal diameter. Never a row that NED took from RC3 (so the NED-only build below holds no RC3 number), never an
  X-ray extent, never an eye estimate, never a Petrosian or model radius. Those answers were fetched one page per galaxy from NED's /cgi-bin/, which NED's robots.txt asks scripts not to use, and NED's terms for passing the numbers on
  are being confirmed (NOTICE.md). Rebuilding from saved answers (`--from`) never asks NED, and running with neither `--from` nor `--fetch-missing` refuses. `--fetch-missing` is the one path that asks NED, and only for a galaxy that has no shape shipped yet (a shipped NED or RC3 row is kept and is not asked again). It reads NED's diameters page one galaxy at a time, waits 10 seconds between requests, and will not start while another such read holds the lock. It is ONE FLAG too:
  `--no-ned` builds the shapes without NED (RC3's, and the dotted symbol where RC3 has none): the same switch as make-deep-sky-data.py (positions) and make-black-hole-data.py (places),
  so that every NED value can be left out of a build.
- RC3, the Third Reference Catalogue of Bright Galaxies (de Vaucouleurs et al. 1991; HEASARC table `rc3`): for a galaxy, the major diameter at the B-band 25 mag/arcsec^2 isophote (D25),
  the axis ratio (R25) and the position angle. RC3 states no licence and its use is under confirmation (NOTICE.md), so it is ONE FLAG: `--no-rc3` builds the shapes from NED alone.

The sources whose terms are not clear are left out: NGC 2000.0 and the Sky Catalog's Messier table are not read here. A Messier or NGC object that these give no shape has none here;
what `deepSkyShape` then offers is the size that the object's own row carries (`sizeArcmin`, from Wikidata and, for the Messier objects, what `src/data/messier.ts` holds today), round.

What an object gets, first that has it: RC3 (unless `--no-rc3`), then NED. A row is `id | major | minor | angle | source`: the major and minor diameters in tenths of an arc-minute (minor
left empty where unknown), the angle in whole degrees east of north (0 to 179, empty where unknown) and one letter for where it is from (r RC3, d NED).

    python3 -I scripts/make-deep-sky-shapes.py --from DIR        # reads DIR/heasarc_rc3.tdat.gz and DIR/ned/<object>.txt saved earlier, asking nobody
    python3 -I scripts/make-deep-sky-shapes.py --from DIR --no-rc3   # the same, without RC3: the NED-only build
    python3 -I scripts/make-deep-sky-shapes.py --no-ned          # without NED: RC3 only (from DIR with --from, else downloaded from HEASARC)
    python3 -I scripts/make-deep-sky-shapes.py                   # refuses: NED's web pages are not asked
    python3 -I scripts/make-deep-sky-shapes.py --fetch-missing  # asks NED for galaxies with no shipped shape, one request every 10 seconds
    python3 -I scripts/make-deep-sky-shapes.py --out DIR         # writes the two data files into DIR instead of src/data (the test does)
    python3 -I scripts/make-deep-sky-shapes.py --only "M31,NGC 253"   # just those objects
    python3 -I scripts/make-deep-sky-shapes.py --reverse --out DIR    # asks from the other end of the list, so that a second run shares the asking with the first

None of this runs in the test except through `--from` and the saved answers in test/data/shapes, and the refusal.
"""
import fcntl
import gzip
import importlib.util
import math
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("heasarc", Path(__file__).resolve().parent / "heasarc.py")
H = importlib.util.module_from_spec(spec)
spec.loader.exec_module(H)

ROOT = Path(__file__).resolve().parent.parent
REFUSE_NED = ("make-deep-sky-shapes.py does not ask NASA/IPAC NED's web pages (MODULES-839): they were fetched one page per galaxy against NED's robots.txt, which keeps scripts out of "
              "/cgi-bin/ and /srs/ with a 10 s crawl delay, and NED's terms are being confirmed. Use --from DIR with answers saved earlier, --no-ned to build without NED, or --fetch-missing "
              "to ask NED only for galaxies that have no shipped shape, one request every 10 seconds.")
GAP_SECONDS = 10
NED_DIAMETERS = "https://ned.ipac.caltech.edu/cgi-bin/nph-datasearch"
USER_AGENT = "hoshi-stars-data-script/0.1 (https://github.com/johnmorrisdotca/hoshi-stars)"
GALAXY = 1  # the index of "galaxy" in DEEP_SKY_TYPES

HEADER = """// GENERATED by scripts/make-deep-sky-shapes.py. Do not edit by hand.
// How big each galaxy is on the sky and which way it lies, from RC3 (HEASARC) and NASA/IPAC NED's diameters table (the sources are in NOTICE.md).
// One row an object: id (`M31`, `N7000` for NGC 7000, `I434` for IC 434) | major diameter in tenths of an arc-minute | minor diameter (tenths; empty where unknown) |
// position angle of the major axis, whole degrees east of north (empty where unknown) | source (r RC3, d NED).
"""


def args_value(name):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else None


def table(text):
    """The rows of a .tdat table as dicts keyed by the names of its `line[1]` header."""
    names = re.search(r"^line\[1\] = (.*)$", text, re.M).group(1).split()
    body = text.split("<DATA>\n", 1)[1].split("<END>")[0]
    return [dict(zip(names, line.split("|"))) for line in body.split("\n") if line != ""]


def designation(text):
    """`NGC 224`, `NGC224`, `IC 4725` and `NGC 2573A` as ("NGC", "224", "A") or None."""
    found = re.fullmatch(r"(NGC|IC) ?0*(\d+) ?([A-Za-z]?)", text.strip())
    return None if found is None else (found.group(1), found.group(2), found.group(3).upper())


def objects():
    """The Wikidata objects of the two data files: dicts with id, messier, names (the designations), type, ra, dec."""
    found = []
    for name, constant in (("messier", "MESSIER_ROWS"), ("ngc-ic", "NGC_IC_ROWS")):
        text = (ROOT / "src" / "data" / f"{name}.ts").read_text(encoding="utf-8")
        rows = re.search(constant + r" = `(.*?)`;", text, re.S).group(1).split("\n")
        for row in rows:
            p = row.split("|")
            messier = f"M{p[0]}" if p[0] != "" else None
            ngc = [("NGC", n[:-1] if n[-1:].isalpha() else n, n[-1:] if n[-1:].isalpha() else "") for n in p[1].split(",") if n != ""]
            ic = [("IC", n[:-1] if n[-1:].isalpha() else n, n[-1:] if n[-1:].isalpha() else "") for n in p[2].split(",") if n != ""]
            names = ngc + ic
            first = messier or (f"NGC {ngc[0][1]}{ngc[0][2]}" if ngc else f"IC {ic[0][1]}{ic[0][2]}")
            found.append({"id": first, "messier": messier, "names": names, "type": int(p[3]), "ra": int(p[4]) / 10000, "dec": int(p[5]) / 10000})
    return found


def separation(ra1, dec1, ra2, dec2):
    """Degrees between two positions."""
    a, b, c, d = map(math.radians, (ra1, dec1, ra2, dec2))
    x = math.sin(b) * math.sin(d) + math.cos(b) * math.cos(d) * math.cos(a - c)
    return math.degrees(math.acos(max(-1.0, min(1.0, x))))


def number(text):
    try:
        return float(text)
    except ValueError:
        return None


def ned_name(o):
    """The name NED is asked for: the NGC or IC designation (a Messier object by its NGC number, which NED knows best)."""
    d = o["names"][0]
    return f"{d[0]} {d[1]}{d[2]}"


def ned_path(name, folder):
    """Where NED's saved diameters answer for one object is, in `folder`."""
    return folder / "ned" / (re.sub(r"[^A-Za-z0-9]+", "-", name) + ".txt")


def ned_text(name, folder):
    """NED's diameters answer for one object as text, from the answers saved in `folder` (empty text where none is saved). NED itself is never asked."""
    if folder is None:
        raise SystemExit(REFUSE_NED)
    path = ned_path(name, folder)
    return path.read_text(encoding="utf-8") if path.exists() else ""


def ned_rows(text):
    """The rows of a NED diameters answer, as dicts keyed by its header."""
    lines = text.split("\n")
    start = [k for k, line in enumerate(lines) if line.startswith("No.|Frequency")]
    if not start:
        return []
    head = lines[start[0]].split("|")
    rows = []
    for line in lines[start[0] + 1 :]:
        p = line.split("|")
        if len(p) >= len(head) and p[0].strip().isdigit():
            rows.append(dict(zip(head, [x.strip() for x in p])))
    return rows


def ned_shape(text):
    """(major, minor, angle) in arc-minutes and degrees from a NED answer, or None. The B-band 25 mag/arcsec^2 isophote of ESO-LV, UGC or ESO-Uppsala first, else the 2MASS K_s total diameter, else the SDSS
    r-band 25 mag/arcsec^2 isophote. Rows from RC3 are never used (the RC3 flag is what carries RC3), nor X-ray extents, nor an eye estimate, nor a Petrosian or model radius."""
    best = None
    for r in ned_rows(text):
        refcode, level, frequency = r.get("Refcode", ""), r.get("Reference Level", ""), r.get("Frequency targeted", "")
        if "RC3" in refcode or "keV" in frequency:
            continue
        major = number(r.get("NED Major Axis", ""))
        if major is None or major <= 0:
            continue
        rank = None
        if "ESOLV" in refcode and level.startswith("25.0 B-mag"):
            rank = 0
        elif "UGC" in refcode and "25.0 B-mag" in level:
            rank = 1
        elif "ESOU" in refcode and "25.5 B-mag" in level:
            rank = 2
        elif ("2003AJ" in refcode or "2MASX" in refcode) and level.startswith("Diameter for"):
            rank = 3
        elif "SDSS" in refcode and "Isophotal" in frequency and level.startswith("25.0 mag"):
            rank = 4
        if rank is None or (best is not None and rank >= best[0]):
            continue
        minor = number(r.get("NED Minor Axis", ""))
        angle = number(r.get("NED Position Angle", ""))
        best = (rank, major / 60, minor / 60 if minor is not None and 0 < minor <= major else None, int(angle) % 180 if angle is not None else None)
    return None if best is None else best[1:]


def short_id(o):
    """The id a shape row uses: `M31`, `N7000`, `I434`."""
    return o["id"].replace("NGC ", "N").replace("IC ", "I")


def shipped_ids():
    """Ids that already have a shape row. Those rows stay, and NED is not asked for them."""
    found = set()
    for name, constant in (("deep-sky-shapes-messier.ts", "MESSIER_SHAPES"), ("deep-sky-shapes-ngc-ic.ts", "NGC_IC_SHAPES")):
        text = (ROOT / "src" / "data" / name).read_text(encoding="utf-8")
        body = re.search(constant + r" = `(.*?)`;", text, re.S).group(1)
        for row in body.split("\n"):
            if row != "":
                found.add(row.split("|", 1)[0])
    return found


class NedGate:
    """One NED read at a time, with 10 seconds between requests. A second process finds the lock taken and stops."""

    def __init__(self, path):
        self.path = path
        self.handle = None
        self.last = None

    def acquire(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.handle = self.path.open("a", encoding="utf-8")
        try:
            fcntl.flock(self.handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise SystemExit("another NED read already holds the lock, so this one stops: never two at once")

    def wait(self):
        if self.last is None:
            return
        left = GAP_SECONDS - (time.monotonic() - self.last)
        if left > 0:
            time.sleep(left)

    def mark(self):
        self.last = time.monotonic()


def ned_request(name, gate):
    """One diameters page. Returns (status, body) or (None, reason) after the tries are spent. Each try is one request, and the gate spaces them."""
    url = NED_DIAMETERS + "?" + urllib.parse.urlencode({"search_type": "Diameters", "objname": name, "of": "ascii_bar"})
    status, body = None, ""
    for attempt in range(3):
        gate.wait()
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/plain"})
            with urllib.request.urlopen(req, timeout=60) as resp:
                status, body = resp.status, resp.read().decode("utf-8", errors="replace")
        except urllib.error.HTTPError as err:
            status, body = err.code, err.read().decode("utf-8", errors="replace")
        except (urllib.error.URLError, TimeoutError, ConnectionError) as err:
            gate.mark()
            if attempt == 2:
                return None, str(err)
            continue
        gate.mark()
        if status == 429 and attempt < 2:
            continue
        return status, body
    return status, body


def append_rows(path, rows):
    """Add rows at the end of a generated shapes file. The rows already there are not rewritten."""
    if not rows:
        return
    text = path.read_text(encoding="utf-8")
    if not text.endswith("`;\n"):
        raise SystemExit(f"{path} does not end the way the generator writes it, so nothing was added")
    path.write_text(text[:-3] + "\n" + "\n".join(rows) + "`;\n", encoding="utf-8")


def shape_row(o, found):
    """A `d` row from a NED answer, or None. The same minor-axis rule as the rebuild. A major axis that rounds to nothing is not a size."""
    major, minor, angle = found
    if round(major * 10) < 1:
        return None
    if minor is not None and minor > 0.97 * major:
        angle = None
    return f"{short_id(o)}|{round(major * 10)}|{'' if minor is None else round(min(minor, major) * 10)}|{'' if angle is None else angle}|d"


def fill_missing():
    """Ask NED for galaxies that have no shipped shape, and append only the new rows. Shipped NED and RC3 rows stay byte for byte."""
    if "--no-ned" in sys.argv:
        raise SystemExit("--fetch-missing asks NED, so it cannot be combined with --no-ned")
    cache = ROOT / ".cache" / "deep-sky-shapes"
    gate = NedGate(cache / "ned.lock")
    gate.acquire()
    answers = cache / "ned"
    answers.mkdir(parents=True, exist_ok=True)
    log_path = cache / "fetches.log"
    have = shipped_ids()
    missing = [o for o in objects() if o["type"] == GALAXY and short_id(o) not in have]
    added = {"messier": [], "ngc-ic": []}
    asked = 0
    failed = []
    again = []

    def note(name, status):
        stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        with log_path.open("a", encoding="utf-8") as log:
            log.write(f"{stamp}\t{name}\t{status if status is not None else 'FAILED'}\n")

    def take(o, name, path, status, body):
        """Keep a diameters table. A 500 is NED having no table and is recorded. A 503 or a dropped connection is asked once more."""
        if status == 429:
            raise SystemExit(f"NED answered 429 for {name}; stopping so the requests stay one every {GAP_SECONDS} seconds")
        if status == 200 and "No.|Frequency" in body:
            path.write_text(body, encoding="utf-8")
            found = ned_shape(body)
            row = shape_row(o, found) if found is not None else None
            if row is not None:
                added["messier" if o["messier"] else "ngc-ic"].append(row)
            return
        if status in (503, None):
            again.append((o, name, path))
            return
        path.write_text(f"HTTP {status}\n", encoding="utf-8")
        failed.append(name)

    for index, o in enumerate(missing, start=1):
        name = ned_name(o)
        path = answers / (re.sub(r"[^A-Za-z0-9]+", "-", name) + ".txt")
        if path.exists() and path.stat().st_size > 0:
            found = ned_shape(path.read_text(encoding="utf-8", errors="replace"))
            row = shape_row(o, found) if found is not None else None
            if row is not None:
                added["messier" if o["messier"] else "ngc-ic"].append(row)
            continue
        status, body = ned_request(name, gate)
        note(name, status)
        asked += 1
        print(f"{index}/{len(missing)} {name} {status if status is not None else 'FAILED'}", flush=True)
        take(o, name, path, status, body)
    for o, name, path in again:
        status, body = ned_request(name, gate)
        note(name, status)
        asked += 1
        print(f"retry {name} {status if status is not None else 'FAILED'}", flush=True)
        if status == 200 and "No.|Frequency" in body:
            path.write_text(body, encoding="utf-8")
            found = ned_shape(body)
            row = shape_row(o, found) if found is not None else None
            if row is not None:
                added["messier" if o["messier"] else "ngc-ic"].append(row)
        else:
            path.write_text(f"HTTP {status}\n", encoding="utf-8")
            failed.append(name)
    for name, rows in (("messier", added["messier"]), ("ngc-ic", added["ngc-ic"])):
        append_rows(ROOT / "src" / "data" / f"deep-sky-shapes-{name}.ts", rows)
    dates = []
    if log_path.exists():
        dates = [line.split("\t", 1)[0][:10] for line in log_path.read_text(encoding="utf-8").split("\n") if line != ""]
    span = dates[0] if dates and dates[0] == dates[-1] else (f"{dates[0]} to {dates[-1]}" if dates else "none")
    print(f"missing {len(missing)}; asked {asked}; added messier {len(added['messier'])}, ngc-ic {len(added['ngc-ic'])}; failed {len(failed)}; fetch dates {span}")


def main():
    if "--fetch-missing" in sys.argv:
        fill_missing()
        return
    folder = Path(args_value("--from")) if args_value("--from") else None
    out_dir = Path(args_value("--out")) if args_value("--out") else ROOT / "src" / "data"
    use_rc3 = "--no-rc3" not in sys.argv
    use_ned = "--no-ned" not in sys.argv
    if use_ned and folder is None:
        raise SystemExit(REFUSE_NED)
    if use_ned and not (folder / "ned").is_dir():
        raise SystemExit(f"{folder / 'ned'} is not a folder of NED's saved answers, so every NED shape would be missing. Give --from the folder that holds ned/, or use --no-ned.")
    only = {x.strip().upper() for x in args_value("--only").split(",")} if args_value("--only") else None

    rc3 = {}
    if use_rc3:
        if folder is not None:
            text = gzip.open(folder / "heasarc_rc3.tdat.gz", "rt", encoding="utf-8", errors="replace").read()
        else:
            text = gzip.decompress(H.fetch_table("rc3")).decode("utf-8", errors="replace")
        for row in table(text):
            if number(row["log_d25"]) is None:
                continue
            for key in (row["name"], row["alt_name_1"], row["alt_name_2"]):
                d = designation(key)
                if d is not None and d not in rc3:
                    rc3[d] = row

    galaxies = [o for o in objects() if o["type"] == GALAXY and (only is None or o["id"].upper() in only)]
    if "--reverse" in sys.argv:  # a second run from the other end, to share the asking
        galaxies.reverse()
    texts = {o["id"]: ned_text(ned_name(o), folder) for o in galaxies} if use_ned else {}
    unsaved = sum(1 for o in galaxies if not ned_path(ned_name(o), folder).exists()) if use_ned else 0

    out = {"messier": [], "ngc-ic": []}
    counts = {}
    rejected = 0
    for o in galaxies:
        entry = None  # (major, minor, angle, source)
        for d in o["names"]:
            row = rc3.get(d)
            if row is None:
                continue
            if separation(o["ra"], o["dec"], float(row["ra"]), float(row["dec"])) * 60 >= max(6.0, 0.6 * 10 ** number(row["log_d25"]) / 10):
                rejected += 1
                continue
            major = 10 ** number(row["log_d25"]) / 10
            ratio = 10 ** number(row["log_r25"]) if number(row["log_r25"]) is not None else None
            angle = number(row["position_angle"])
            minor = major / ratio if ratio is not None and ratio >= 1 else None
            entry = (major, minor, None if angle is None or minor is None or minor > 0.97 * major else int(angle) % 180, "r")
            break
        if entry is None:
            found = ned_shape(texts[o["id"]]) if use_ned else None
            if found is not None:
                major, minor, angle = found
                if minor is not None and minor > 0.97 * major:
                    angle = None
                entry = (major, minor, angle, "d")
        if entry is None:
            continue
        counts[entry[3]] = counts.get(entry[3], 0) + 1
        short = o["id"].replace("NGC ", "N").replace("IC ", "I")
        major, minor, angle, source = entry
        out["messier" if o["messier"] else "ngc-ic"].append(f"{short}|{round(major * 10)}|{'' if minor is None else round(min(minor, major) * 10)}|{'' if angle is None else angle}|{source}")

    out_dir.mkdir(parents=True, exist_ok=True)
    for name, constant, note in (("messier", "MESSIER_SHAPES", "The Messier galaxies that have a shape, one per line."), ("ngc-ic", "NGC_IC_SHAPES", "The NGC and IC galaxies that are not Messier objects and have a shape, one per line.")):
        (out_dir / f"deep-sky-shapes-{name}.ts").write_text(HEADER + f"\n/** {note} */\nexport const {constant} = `" + "\n".join(out[name]) + "`;\n", encoding="utf-8")
    angled = sum(1 for rows in out.values() for row in rows if row.split("|")[3] != "")
    ratioed = sum(1 for rows in out.values() for row in rows if row.split("|")[2] != "")
    print(f"rows: messier {len(out['messier'])}, ngc-ic {len(out['ngc-ic'])}; by source {counts}; with a minor axis {ratioed}; with an angle {angled}; rc3 rows refused for position {rejected}; rc3 {'on' if use_rc3 else 'off'}; ned {'on' if use_ned else 'off'}{f', no saved NED answer for {unsaved} of {len(galaxies)} galaxies' if use_ned else ''}")


if __name__ == "__main__":
    main()
