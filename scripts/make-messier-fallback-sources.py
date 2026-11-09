#!/usr/bin/env python3
"""Write scripts/data/messier-sizes.tsv: a size for each Messier object from a source that is not Sky Catalog 2000.0 (MODULES-781).

Sky Catalog 2000.0 reaches this package through NASA HEASARC's Messier table. This file is the fallback for the day that has to come out: every size here is read from one of
the sources below and the tsv names the source, the measure and the date for each line. scripts/make-deep-sky-data.py --no-sky-catalogue reads the tsv.

Where a size comes from, by kind of object (the measure is different for each, and the tsv says which):
- Galaxies: NASA/IPAC NED's major-axis diameter of RC3's D_25, the blue 25 mag/arcsec^2 isophote (de Vaucouleurs et al. 1991, RC3), from NED's Diameters table.
- Globular clusters: twice the half-light radius r_h in Harris 1996 (2010 edition), https://physwww.mcmaster.ca/~harris/mwgc.dat. (Twice the tidal radius is far larger and is in the research note.)
- Open clusters: twice the radius of the central part (r_center) in Kharchenko et al. 2013, A&A 558, A53 (MWSC), read through the GAVO Data Center's TAP service.
- The Crab Nebula (M1): the larger side of 7 x 5 arc-minutes in D. A. Green's catalogue of Galactic supernova remnants (Cambridge; Green 2025, J. Astrophys. Astron. 46, 14).
- M27, M57, M76: NED's major-axis diameter of the K_s 20 mag/arcsec^2 isophote (2MASS; Jarrett et al. 2003 for M27 and M57, the 2MASS Extended Source Catalog for M76).
Objects with no size from any of these (the H II regions, M97, M24, M40, M73) get no line; docs/research/messier-no-sky-catalogue.md lists them.

    python3 -I scripts/make-messier-fallback-sources.py --from DIR     # reads the answers saved in DIR (see --fetch)
    python3 -I scripts/make-messier-fallback-sources.py --fetch DIR    # downloads them into DIR first (NED, Harris, GAVO, Green: a few requests, 3 seconds apart)

None of this runs in the test.
"""
import csv
import io
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "scripts" / "data" / "messier-sizes.tsv"
USER_AGENT = "hoshi-stars-data-script/0.1 (https://github.com/johnmorrisdotca/hoshi-stars)"
DATE = "2026-11-09"
PAUSE = 3

NED_SIZED = [31, 32, 33, 49, 51, 58, 59, 60, 61, 63, 64, 65, 66, 74, 77, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 94, 95, 96, 98, 99, 100, 101, 102, 104, 105, 106, 108, 109, 110]
NED_INFRARED = [27, 57, 76]
NED_OTHER = [1, 8, 16, 17, 20, 24, 42, 43, 78, 97]  # looked up too, for the research note; none gives a usable size
NED_NAME = {51: "NGC 5194", 102: "NGC 5866"}  # NED's "M51" page errors; M102 is NGC 5866 here
GREEN = "https://www.mrao.cam.ac.uk/surveys/snrs/snrs.G184.6-5.8.html"
HARRIS = "https://physwww.mcmaster.ca/~harris/mwgc.dat"
GAVO = "https://dc.zah.uni-heidelberg.de/tap/sync"


def fetch(url, data=None):
    request = urllib.request.Request(url, data=data, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=120) as response:
        return response.read()


def messier_rows():
    text = (ROOT / "src" / "data" / "messier.ts").read_text(encoding="utf-8")
    for row in re.search(r"MESSIER_ROWS = `(.*?)`", text, re.S).group(1).split("\n"):
        p = row.split("|")
        yield {"m": int(p[0]), "ngc": p[1].split(",")[0], "ic": p[2].split(",")[0], "type": int(p[3])}


def mwsc_names():
    """The MWSC name of each Messier open cluster that has an NGC or IC number (M45 is Melotte 22)."""
    names = {}
    for o in messier_rows():
        if o["type"] == 3:
            names[o["m"]] = "Melotte_22" if o["m"] == 45 else (f"NGC_{o['ngc']}" if o["ngc"] else f"IC_{o['ic']}")
    return names


def fetch_all(directory: Path):
    for sub in ("ned-diameters", "harris", "mwsc", "green"):
        (directory / sub).mkdir(parents=True, exist_ok=True)
    for m in NED_SIZED + NED_INFRARED + NED_OTHER:
        query = urllib.parse.urlencode({"search_type": "Diameters", "objname": NED_NAME.get(m, f"M{m}"), "of": "ascii_bar"})
        (directory / "ned-diameters" / f"M{m}.txt").write_bytes(fetch("https://ned.ipac.caltech.edu/cgi-bin/datasearch?" + query))
        time.sleep(PAUSE)
    (directory / "harris" / "mwgc.dat").write_bytes(fetch(HARRIS))
    names = ",".join(f"'{n}'" for n in mwsc_names().values())
    adql = f"select recno,name,confirmation_flag,object_type,raj2000,dej2000,rcore,rcenter,rcluster,dist,logt from mwsc.main where name in ({names})"
    (directory / "mwsc" / "query.adql").write_text(adql)
    (directory / "mwsc" / "mwsc.csv").write_bytes(fetch(GAVO, urllib.parse.urlencode({"QUERY": adql, "LANG": "ADQL", "REQUEST": "doQuery", "FORMAT": "csv"}).encode()))
    (directory / "green" / "G184.6-5.8.html").write_bytes(fetch(GREEN))


def ned_rows(path: Path):
    lines = path.read_text(encoding="latin-1").splitlines()
    header = next((i for i, line in enumerate(lines) if line.startswith("No.|")), None)
    if header is None:
        return []
    columns = [c.strip() for c in lines[header].split("|")]
    return [dict(zip(columns, (x.strip() for x in line.split("|")))) for line in lines[header + 1 :] if line.split("|")[0].strip().isdigit()]


def ned_size(directory: Path, m: int, label_start: str):
    """NED's major axis, in arc-minutes, of the first diameter line whose label starts with `label_start`."""
    for r in ned_rows(directory / "ned-diameters" / f"M{m}.txt"):
        if r["Frequency targeted"].startswith(label_start) and r["NED Major Axis"]:
            return float(r["NED Major Axis"]) / 60
    return None


def harris_table(directory: Path):
    """{NGC name: (V_t, c, r_c, r_h)} for every cluster in Harris's table. The columns are fixed-width: V_t in Part II, then c, r_c and r_h in Part III (r_h is in arc-minutes)."""
    lines = (directory / "harris" / "mwgc.dat").read_text(encoding="latin-1").splitlines()
    part3 = next(i for i, l in enumerate(lines) if l.strip().startswith("ID") and "r_h" in l)
    number = lambda text: float(text) if text.strip() else None
    vt, structure = {}, {}
    for i, line in enumerate(lines):
        found = re.match(r"^ (NGC \d+)\s", line)
        if found and i < part3 - 10 and i > 240:
            vt[found.group(1)] = number(line[40:46])
        elif found and i > part3:
            structure[found.group(1)] = (number(line[48:54]), number(line[58:64]), number(line[64:70]))
    return {k: (vt.get(k),) + v for k, v in structure.items()}


def main():
    if "--fetch" in sys.argv:
        fetch_all(Path(sys.argv[sys.argv.index("--fetch") + 1]))
    directory = Path(sys.argv[sys.argv.index("--from" if "--from" in sys.argv else "--fetch") + 1])
    rows = []
    ned_note = "https://ned.ipac.caltech.edu/cgi-bin/datasearch?search_type=Diameters&objname="
    for m in NED_SIZED:
        size = ned_size(directory, m, "RC3 D_25")
        if size is None:
            continue
        name = NED_NAME.get(m, f"M{m}").replace(" ", "+")
        rows.append((f"M{m}", size, "major axis of RC3 D_25 (blue 25 mag/arcsec^2 isophote), de Vaucouleurs et al. 1991, as NED lists it", "NASA/IPAC NED, Diameters table", ned_note + name))
    for m, name in ((27, "M27"), (57, "M57"), (76, "M76")):
        for label, text in (("K_s (LGA/2MASS isophotal)", "K_s 20 mag/arcsec^2 isophotal major axis, Jarrett et al. 2003 (2003AJ....125..525J), as NED lists it"), ("K_s (2MASS isophotal)", "K_s 20 mag/arcsec^2 isophotal major axis, 2MASS Extended Source Catalog (2003 release), as NED lists it")):
            size = ned_size(directory, m, label)
            if size is not None:
                rows.append((name, size, text, "NASA/IPAC NED, Diameters table", ned_note + name))
                break
    harris = harris_table(directory)
    for o in messier_rows():
        if o["type"] == 2:
            _, _, _, r_h = harris[f"NGC {o['ngc']}"]
            rows.append((f"M{o['m']}", 2 * r_h, "twice the half-light radius r_h, Harris 1996 (2010 edition)", "Harris, Catalog of Parameters for Milky Way Globular Clusters", HARRIS))
    wanted = mwsc_names()
    found = {r["name"]: r for r in csv.DictReader(io.StringIO((directory / "mwsc" / "mwsc.csv").read_text()))}
    for m, name in wanted.items():
        r = found.get(name)
        if r is not None and r["rcenter"]:
            rows.append((f"M{m}", 2 * 60 * float(r["rcenter"]), "twice the radius of the central part r_center, Kharchenko et al. 2013 (A&A 558, A53), MWSC", "GAVO Data Center, table mwsc.main", "https://dc.zah.uni-heidelberg.de/tap"))
    green = re.search(r"Size \(/arcmin\):\s*(\d+)&#215;(\d+)", (directory / "green" / "G184.6-5.8.html").read_text())
    rows.append(("M1", float(max(green.group(1), green.group(2), key=int)), "larger side of the 7 x 5 arc-minute size, D. A. Green's catalogue of Galactic supernova remnants (G184.6-5.8), Green 2025, J. Astrophys. Astron. 46, 14", "Cavendish Laboratory, Cambridge", GREEN))
    rows.sort(key=lambda r: int(r[0][1:]))
    OUT.parent.mkdir(exist_ok=True)
    with OUT.open("w", encoding="utf-8") as f:
        f.write("object\tsize_arcmin\tmeasure\tsource\turl\tdate_read\n")
        for obj, size, measure, source, url in rows:
            f.write(f"{obj}\t{size:.1f}\t{measure}\t{source}\t{url}\t{DATE}\n")
    print(f"wrote {OUT} ({len(rows)} sizes)")


if __name__ == "__main__":
    main()
