#!/usr/bin/env python3
"""Write src/data/black-holes.ts: every known black hole with a place on the sky and a published mass or a published case for one.

Sources (the sentence relied on and the date read are in NOTICE.md)
- Stellar-mass black holes in X-ray binaries: BlackCAT (Corral-Santana et al. 2016, A&A 587, A61), the online version at https://www.astro.puc.cl/BlackCAT, 73 systems. Its
  page asks only "Please acknowledge the use of this catalogue in any published work you derive from it" and carries no licence, so the package takes facts (a place, a
  distance, a mass, a spectral type, a year, and the paper each comes from), never its text, pictures or layout, and cites it.
- Supermassive black holes: the table of black hole masses in van den Bosch (2016, ApJ 831, 134), read from the paper's LaTeX source on arXiv (arXiv:1606.01246), with the
  galaxy's place from NASA/IPAC NED (the nucleus's position, a fact; NED asks for an acknowledgement, which NOTICE.md gives). Rows that are only upper limits are left out.
- The few systems typed here (HAND_STELLAR, HAND_QUIET, HAND_SUPERMASSIVE) are facts from the discovery papers named in each row; their places are Wikidata's (CC0),
  checked against the papers or against BlackCAT.

    python3 -I scripts/make-black-hole-data.py                    # reads what is in the cache (the caches below) and fetches what is missing
    python3 -I scripts/make-black-hole-data.py --save DIR         # ... and keeps every answer in DIR
    python3 -I scripts/make-black-hole-data.py --from DIR         # reads answers saved earlier, never the network

None of this runs in the test.
"""
import html
import json
import math
import re
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "src" / "data" / "black-holes.ts"
USER_AGENT = "hoshi-stars-data-script/0.1 (https://github.com/johnmorrisdotca/hoshi-stars)"
BLACKCAT = "https://www.astro.puc.cl/BlackCAT"
VDB16_SOURCE = "https://arxiv.org/e-print/1606.01246"
NED_LOOKUP = "https://ned.ipac.caltech.edu/srs/ObjectLookup"
WIKIDATA = "https://query.wikidata.org/sparql"

KINDS = ["stellar", "quiet", "supermassive"]
FOUND = ["x-rays", "orbit", "microlensing", "stars", "gas", "masers", "echoes", "image"]


def get(url: str, data: bytes | None = None, headers: dict | None = None, tries: int = 3) -> bytes:
    request = urllib.request.Request(url, data=data, headers={"User-Agent": USER_AGENT, **(headers or {})})
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(request, timeout=90) as response:
                return response.read()
        except Exception:
            if attempt == tries - 1:
                raise
            time.sleep(3)
    raise RuntimeError("unreachable")


# ---------------------------------------------------------------------------------------------------------------------------------------------------------------
# Numbers

def sig(x: float, digits: int = 3) -> str:
    """Three significant figures (more where the paper gives more), as JavaScript reads them: 4.3e6, 21.2, 0.0136."""
    text = format(float(f"{x:.{digits}g}"), "g")
    if "e" in text:
        base, exp = text.split("e")
        return f"{base}e{int(exp)}"
    return text


def parse_number(text: str) -> float:
    return float(text.replace(",", ""))


def parse_quantity(raw: str):
    """BlackCAT's value formats -> (value, low, high, limit). `raw` is one value, as text with its tags removed.

    6.6±0.3 -> (6.6, 6.3, 6.9); 8.4 – 10.4 -> (None, 8.4, 10.4); 5.8 +3.0 -2.4 -> (5.8, 3.4, 8.8); ≥7.6±0.7 and >4.4 -> a lower limit; ≤7.3 an upper limit; ∼25 -> 25."""
    s = html.unescape(raw).replace("\xa0", " ").strip()
    s = re.sub(r"\(.*?\)", "", s).strip()
    s = s.lstrip("?").strip()
    limit = ""
    if s[:1] in "≥>":
        limit, s = ">", s[1:].strip()
    elif s[:1] in "≤<":
        limit, s = "<", s[1:].strip()
    s = s.lstrip("∼~").strip()
    number = r"(\d+(?:\.\d+)?)"
    m = re.fullmatch(number + r"\s*±\s*" + number, s)
    if m:
        v, e = float(m.group(1)), float(m.group(2))
        return v, (None if limit else v - e), (None if limit else v + e), limit
    m = re.fullmatch(number + r"\s*\+\s*" + number + r"\s*-\s*" + number, s)
    if m:
        v, up, down = float(m.group(1)), float(m.group(2)), float(m.group(3))
        return v, v - down, v + up, limit
    m = re.fullmatch(number + r"\s*[–-]\s*" + number, s)
    if m:
        return None, float(m.group(1)), float(m.group(2)), ""
    m = re.fullmatch(number, s)
    if m:
        return float(m.group(1)), None, None, limit
    return None


# ---------------------------------------------------------------------------------------------------------------------------------------------------------------
# References: key -> (bibcode or arXiv id, text)

JOURNALS = {"ApJ": "ApJ", "ApJL": "ApJ", "A&A": "A&A", "MNRAS": "MNRAS", "Natur": "Nature", "Sci": "Science", "AJ": "AJ", "ApJS": "ApJS", "PASP": "PASP", "NatAs": "Nature Astronomy", "IAUC": "IAU Circ.", "ATel": "ATel", "Natur.": "Nature", "ARA&A": "ARA&A", "PASJ": "PASJ", "SSRv": "Space Sci. Rev.", "AcA": "Acta Astron.", "ApJ.": "ApJ"}


def bibcode_text(key: str, bibcode: str) -> str:
    """`Cantrell2010` and `2010ApJ...710.1127C` -> `Cantrell 2010, ApJ 710, 1127`."""
    m = re.fullmatch(r"(\d{4})(.{5})(.{4})(.)(.{4})(.)", bibcode)
    author = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", re.sub(r"(\d{4})[a-z]?$", "", key))
    year = re.search(r"(\d{4}[a-z]?)$", key)
    head = f"{author} {year.group(1)}" if year else author
    if not m:
        return head
    journal = m.group(2).strip(".")
    volume = m.group(3).strip(".")
    qualifier = m.group(4).strip(".")
    page = (qualifier if qualifier in "LAB" else "") + m.group(5).strip(".")
    journal = {"ApJ": "ApJ", "A&A": "A&A", "MNRAS": "MNRAS", "Natur": "Nature", "Sci": "Science", "NatAs": "Nature Astronomy", "AJ": "AJ", "ApJS": "ApJS", "PASP": "PASP", "ATel": "ATel", "IAUC": "IAU Circ.", "arXiv": "arXiv"}.get(journal, journal)
    if journal == "ApJ" and qualifier == "L":
        page = "L" + m.group(5).strip(".")
    if journal in ("arXiv", "ATel", "IAUC"):
        return head
    return f"{head}, {journal} {volume}, {page}" if volume and page else head


REFERENCES: dict[str, tuple[str, str]] = {}


def reference(key: str, link: str, text: str | None = None) -> str:
    key = key.strip()
    if key not in REFERENCES or (REFERENCES[key][0] == "" and link != ""):
        REFERENCES[key] = (link, text if text is not None else bibcode_text(key, link))
    return key


# ---------------------------------------------------------------------------------------------------------------------------------------------------------------
# BlackCAT

def text_of(fragment: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]*>", " ", fragment).replace("<br>", " "))).strip()


def anchors(fragment: str) -> list[tuple[str, str]]:
    """(ADS bibcode or empty, key) for each reference link in a piece of a BlackCAT page; a link that does not lead to ADS (BlackCAT has a few broken ones) gives an empty bibcode."""
    out = []
    for href, key in re.findall(r"href='([^']*)'[^>]*>([^<]+)</a>", fragment):
        key = key.strip()
        if key == "":
            continue
        m = re.search(r"/abs/(.+)$", href)
        out.append((urllib.parse.unquote(m.group(1)) if m else "", key))
    return out


def parse_blackcat_page(source: str, page_id: int) -> dict:
    t = re.sub(r"<script.*?</script>", "", source, flags=re.S)
    r: dict = {"id": page_id}
    m = re.search(r"<h2><strong>(.*?)</h2></strong>\s*<h4>(.*?)</h4>", t, re.S)
    r["name"], r["alt"] = text_of(m.group(1)), text_of(m.group(2))
    m = re.search(r'<caption align="bottom">\((.*?)\)</caption>', t, re.S)
    r["posRefs"] = anchors(m.group(1)) if m else []
    m = re.search(r"<h4>([\d:.]+)&nbsp;&nbsp;([-+\d:.]+)</h4>", t)
    r["ra"], r["dec"] = m.group(1), m.group(2)
    m = re.search(r"Year of discovery:\s*</strong>\s*(\d{4})?(.*?)</h4>", t, re.S)
    r["year"] = int(m.group(1)) if m and m.group(1) else None
    r["yearRefs"] = anchors(m.group(2)) if m else []
    rows: dict[str, dict] = {}
    for tr in re.findall(r"<tr>(.*?)</tr>", t, re.S):
        th = re.search(r"<th[^>]*>(.*?)</th>", tr, re.S)
        if not th:
            continue
        tds = re.findall(r"<td[^>]*>(.*?)(?=<td|$)", tr, re.S)
        if not tds:
            continue
        label = text_of(th.group(1))
        raw = re.sub(r"<sup>(.*?)</sup>\s*<sub>(.*?)</sub>", r" \1 \2 ", tds[0])
        values = [text_of(v) for v in re.split(r"<br\s*/?>", raw)]
        values = [v for v in values if v != "" and v != "/"]
        refs = anchors(tr)
        rows.setdefault(label, {"values": values, "refs": refs})
    r["rows"] = rows
    page = t
    r["confirmed"] = "Dynamically confirmed BH" in page
    r["probable"] = "Strictly speaking it is not a dynamical BH but there is either a robust mass function" in page
    return r


def sexagesimal(text: str, hours: bool) -> float:
    sign = -1 if text.strip().startswith("-") else 1
    d, m, s = (float(x) for x in text.strip().lstrip("+-").split(":"))
    value = d + m / 60 + s / 3600
    return sign * value * (15 if hours else 1)


# The first value BlackCAT lists is used, except where a row lists several that disagree and one is plainly the better published measurement: the page id -> (field -> index
# into that row's values). The reasons are in NOTICE.md.
CHOOSE = {
    31: {"mass": 1},   # XTE J1859+226: a lower limit (Corral-Santana 2011), then 8 +/- 2 (Yanes-Rizo 2022)
    39: {"mass": 1, "distance": 1},   # Swift J1753.5-0127: Shaw 2016 and Gandhi 2019 are refereed; the first values are preprints
    20: {"distance": 1},   # GRS 1716-249: 7 +/- 1 kpc (Saikia 2022) replaces 2.4 +/- 0.4 (della Valle 1994)
    63: {"distance": 1},   # MAXI J1820+070: the radio parallax (Atri 2020) replaces the Gaia DR2 estimate
    67: {"distance": 1},   # MAXI J1348-630: 2.2 +0.5 -0.6 kpc (Chauhan 2020) replaces a lower limit
}
# Values BlackCAT marks with a question mark and no source are left out.
DROP_MASS = {48}

COMMON = {
    7: ("A0620-00", ["3A 0620-003", "V616 Mon", "Nova Monocerotis 1975"]),
    15: ("V404 Cygni", ["GS 2023+338", "V404 Cyg"]),
    5: ("GX 339-4", ["1H 1659-487", "V821 Ara"]),
    16: ("GRS 1124-684", ["GU Mus", "Nova Muscae 1991"]),
    17: ("GRO J0422+32", ["V518 Per", "Nova Persei 1992"]),
    21: ("GRO J1655-40", ["V1033 Sco", "Nova Scorpii 1994"]),
    9: ("H 1705-250", ["V2107 Oph", "Nova Ophiuchi 1977"]),
    19: ("GRS 1009-45", ["MM Vel", "Nova Velorum 1993"]),
    13: ("GS 2000+251", ["QZ Vul"]),
    30: ("V4641 Sgr", ["SAX J1819.3-2525"]),
    3: ("4U 1543-475", ["IL Lup"]),
    12: ("GS 1354-64", ["BW Cir"]),
    63: ("MAXI J1820+070", ["ASASSN-18ey", "V3721 Oph"]),
}


def blackcat_system(r: dict) -> dict:
    rows = r["rows"]

    def pick(label: str, field: str):
        row = rows.get(label)
        if not row or not row["values"]:
            return None
        index = CHOOSE.get(r["id"], {}).get(field, 0)
        if index >= len(row["values"]):
            index = 0
        refs = [k for _, k in row["refs"]]
        ref = refs[index] if index < len(refs) else (refs[0] if refs else "")
        link = next((b for b, k in row["refs"] if k == ref), "")
        q = parse_quantity(row["values"][index])
        if q is None:
            return None
        return q, ref, link

    name = r["name"]
    others: list[str] = []
    for token in [t.strip() for t in re.split(r"=", r["alt"]) if t.strip()]:
        others.append(token)
    if r["id"] in COMMON:
        name, extra = COMMON[r["id"]]
        others = [r["name"]] + [e for e in extra if e != r["name"]] + [o for o in others if o not in extra]
    others = [o for o in dict.fromkeys(others) if o != name]
    companion = None
    for token in others:
        if re.fullmatch(r"(V\d+ [A-Z][a-z]{2}|[A-Z]{2} [A-Z][a-z]{2}|[A-Z] [A-Z][a-z]{2})", token) and not re.search(r"\d{4}", token):
            companion = token
            break
    spectral = None
    for label in ("Star's spectral type", "Spectral type"):
        if label in rows and rows[label]["values"]:
            spectral = rows[label]["values"][0]
            spectral = re.sub(r"(\d)([IV]+)", r"\1 \2", re.sub(r"\s+", " ", spectral).replace(" – ", "–").replace(" - ", "–").strip())
            spectral_ref_row = rows[label]
            break
    mass = pick("BH mass (M 1 ) [M ☉ ]", "mass") if r["id"] not in DROP_MASS else None
    distance = pick("Distance [kpc]", "distance")
    spectral_ref = ""
    if spectral:
        refs = spectral_ref_row["refs"]
        spectral_ref = refs[0][1] if refs else ""
    ra = sexagesimal(r["ra"], True)
    dec = sexagesimal(r["dec"], False)
    system = {
        "name": name, "others": others, "kind": "stellar", "status": "confirmed" if r["confirmed"] else "candidate", "ra": ra, "dec": dec,
        "companion": companion, "companionType": spectral, "found": "x-rays", "year": r["year"], "note": "Not dynamically confirmed, but a mass function or a mass points to a black hole." if r["probable"] else "",
        "refs": {}, "mass": None, "distance": None,
    }
    for fact, got, scale in (("mass", mass, 1.0), ("distance", distance, 1000.0)):
        if got is None:
            continue
        (v, lo, hi, limit), ref, link = got
        system[fact] = (None if v is None else v * scale, None if lo is None else lo * scale, None if hi is None else hi * scale, limit)
        if ref:
            system["refs"][fact] = reference(ref, link)
    if r["posRefs"]:
        link, ref = r["posRefs"][0]
        system["refs"]["position"] = reference(ref, link)
    if r["yearRefs"]:
        link, ref = r["yearRefs"][0]
        system["refs"]["found"] = reference(ref, link)
    if spectral_ref:
        row = spectral_ref_row
        link = next((b for b, k in row["refs"] if k == spectral_ref), "")
        system["refs"]["companion"] = reference(spectral_ref, link)
    return system


# ---------------------------------------------------------------------------------------------------------------------------------------------------------------
# The systems typed from papers. Each number is in the paper named; `place` is a Wikidata item (CC0) or the paper's own position.

R = reference


def WD(item: str) -> str:
    return reference(f"Wikidata-{item}", f"https://www.wikidata.org/wiki/{item}", f"Wikidata {item} (CC0)")


HAND = [
    {
        "name": "Cygnus X-1", "others": ["Cyg X-1", "HDE 226868", "4U 1956+350"], "kind": "stellar", "status": "confirmed", "wd": "Q332674", "companion": "HDE 226868", "companionType": "O supergiant",
        "mass": (21.2, 19.0, 23.4, ""), "distance": (2220, 2050, 2400, ""), "found": "x-rays", "year": 1964, "note": "",
        "refs": {"position": WD("Q332674"), "mass": R("Miller-Jones2021", "2021Sci...371.1046M"), "distance": R("Miller-Jones2021", "2021Sci...371.1046M"), "companion": R("Miller-Jones2021", "2021Sci...371.1046M"), "found": R("Bowyer1965", "1965Sci...147..394B", "Bowyer et al. 1965, Science 147, 394")},
    },
    {
        "name": "LMC X-1", "others": [], "kind": "stellar", "status": "confirmed", "wd": "Q2777677", "companion": None, "companionType": "O star",
        "mass": (10.91, 9.50, 12.32, ""), "distance": (49590, 49050, 50130, ""), "found": "x-rays", "year": None, "note": "In the Large Magellanic Cloud; the distance is the Cloud's.",
        "refs": {"position": WD("Q2777677"), "mass": R("Orosz2009", "2009ApJ...697..573O"), "distance": R("Pietrzynski2019", "2019Natur.567..200P")},
    },
    {
        "name": "LMC X-3", "others": [], "kind": "stellar", "status": "confirmed", "wd": "Q3206084", "companion": None, "companionType": "B star",
        "mass": (6.98, 6.42, 7.54, ""), "distance": (49590, 49050, 50130, ""), "found": "x-rays", "year": None, "note": "In the Large Magellanic Cloud; the distance is the Cloud's.",
        "refs": {"position": WD("Q3206084"), "mass": R("Orosz2014", "2014ApJ...794..154O"), "distance": R("Pietrzynski2019", "2019Natur.567..200P")},
    },
    {
        "name": "M33 X-7", "others": [], "kind": "stellar", "status": "confirmed", "wd": "Q2697812", "companion": None, "companionType": "O star",
        "mass": (15.65, 14.20, 17.10, ""), "distance": None, "found": "x-rays", "year": None, "note": "In the Triangulum Galaxy (M33); the only known black hole in an eclipsing binary.",
        "refs": {"position": WD("Q2697812"), "mass": R("Orosz2007", "2007Natur.449..872O")},
    },
    {
        "name": "1E 1740.7-2942", "others": ["Great Annihilator"], "kind": "stellar", "status": "candidate", "wd": "Q16839981", "companion": None, "companionType": None,
        "mass": None, "distance": None, "found": "x-rays", "year": 1984, "note": "Near the Galactic centre; a microquasar whose compact object is thought to be a black hole.",
        "refs": {"position": WD("Q16839981")},
    },
    {
        "name": "Gaia BH1", "others": ["Gaia DR3 4373465352415301632"], "kind": "quiet", "status": "confirmed", "wd": "Q114345349", "companion": "Gaia DR3 4373465352415301632", "companionType": "G dwarf (Sun-like)",
        "mass": (9.62, 9.44, 9.80, ""), "distance": (480, None, None, ""), "found": "orbit", "year": 2023, "note": "The nearest known black hole to the Sun; found by the wobble of its companion in Gaia's astrometry, then checked by radial velocities.",
        "refs": {"position": WD("Q114345349"), "mass": R("El-Badry2023a", "2023MNRAS.518.1057E"), "distance": R("El-Badry2023a", "2023MNRAS.518.1057E"), "companion": R("El-Badry2023a", "2023MNRAS.518.1057E"), "found": R("El-Badry2023a", "2023MNRAS.518.1057E")},
    },
    {
        "name": "Gaia BH2", "others": ["Gaia DR3 5870569352746779008"], "kind": "quiet", "status": "confirmed", "ra": 207.56971624, "dec": -59.2390050, "companion": "Gaia DR3 5870569352746779008", "companionType": "red giant",
        "mass": (8.9, 8.6, 9.2, ""), "distance": (1160, None, None, ""), "found": "orbit", "year": 2023, "note": "",
        "refs": {"position": R("El-Badry2023b", "2023MNRAS.521.4323E"), "mass": R("El-Badry2023b", "2023MNRAS.521.4323E"), "distance": R("El-Badry2023b", "2023MNRAS.521.4323E"), "companion": R("El-Badry2023b", "2023MNRAS.521.4323E"), "found": R("El-Badry2023b", "2023MNRAS.521.4323E")},
    },
    {
        "name": "Gaia BH3", "others": ["Gaia DR3 4318465066420528000", "LS II +14 13"], "kind": "quiet", "status": "confirmed", "ra": 294.82800, "dec": 14.93172, "companion": "LS II +14 13", "companionType": "metal-poor giant",
        "mass": (32.7, 31.88, 33.52, ""), "distance": (590, 584, 596, ""), "found": "orbit", "year": 2024, "note": "The most massive stellar-origin black hole known in the Milky Way; its companion belongs to the Galactic halo.",
        "refs": {"position": R("Panuzzo2024", "2024A&A...686L...2G", "Gaia Collaboration, Panuzzo et al. 2024, A&A 686, L2"), "mass": R("Panuzzo2024", "2024A&A...686L...2G"), "distance": R("Panuzzo2024", "2024A&A...686L...2G"), "companion": R("Panuzzo2024", "2024A&A...686L...2G"), "found": R("Panuzzo2024", "2024A&A...686L...2G")},
    },
    {
        "name": "VFTS 243", "others": [], "kind": "quiet", "status": "confirmed", "wd": "Q88926991", "companion": None, "companionType": "O7 V",
        "mass": (10.1, 8.0, 12.1, ""), "distance": (49590, 49050, 50130, ""), "found": "orbit", "year": 2022, "note": "In the Large Magellanic Cloud (the Tarantula Nebula); X-ray quiet, found from the orbit of its companion. The distance is the Cloud's.",
        "refs": {"position": WD("Q88926991"), "mass": R("Shenar2022", "2022NatAs...6.1085S"), "distance": R("Pietrzynski2019", "2019Natur.567..200P"), "companion": R("Shenar2022", "2022NatAs...6.1085S"), "found": R("Shenar2022", "2022NatAs...6.1085S")},
    },
    {
        "name": "OGLE-2011-BLG-0462", "others": ["MOA-2011-BLG-191"], "kind": "quiet", "status": "confirmed", "ra": sexagesimal("17:51:40.208", True), "dec": sexagesimal("-29:53:26.50", False), "companion": None, "companionType": None,
        "mass": (7.1, 5.8, 8.4, ""), "distance": (1580, 1400, 1760, ""), "found": "microlensing", "year": 2022,
        "note": "An isolated black hole, found by how it bent the light of a star behind it. Its mass is disputed: 1.6 to 4.4 Suns (Lam et al. 2022) against 5.8 to 8.7 (Sahu et al. 2022, Mroz et al. 2022); a 2025 reanalysis gives 7.15 +/- 0.83.",
        "refs": {"position": R("Sahu2025", "arXiv:2503.07820", "Sahu et al. 2025, arXiv:2503.07820"), "mass": R("Sahu2022", "2022ApJ...933...83S", "Sahu et al. 2022, ApJ 933, 83"), "distance": R("Sahu2022", "2022ApJ...933...83S"), "found": R("Sahu2022", "2022ApJ...933...83S")},
    },
]

HAND_SUPERMASSIVE = [
    {
        "digits": 4, "name": "Sagittarius A*", "others": ["Sgr A*", "Milky Way"], "kind": "supermassive", "status": "confirmed", "wd": "Q237284", "companion": None, "companionType": None,
        "mass": (4.297e6, 4.255e6, 4.339e6, ""), "distance": (8277, 8243, 8311, ""), "found": "stars", "year": 2022, "note": "At the centre of the Milky Way; its mass comes from the orbit of the star S2.",
        "refs": {"position": WD("Q237284"), "mass": R("GRAVITY2022", "2022A&A...657L..12G", "GRAVITY Collaboration 2022, A&A 657, L12"), "distance": R("GRAVITY2022", "2022A&A...657L..12G"), "found": R("GRAVITY2022", "2022A&A...657L..12G")},
    },
    {
        "name": "M87*", "others": ["M87", "NGC 4486", "Virgo A"], "kind": "supermassive", "status": "confirmed", "ned": "M87", "companion": None, "companionType": None,
        "mass": (6.5e9, 5.8e9, 7.2e9, ""), "distance": (16.8e6, 16.1e6, 17.6e6, ""), "found": "image", "year": 2019, "note": "The first black hole imaged, by the Event Horizon Telescope.",
        "refs": {"position": R("NED", "https://ned.ipac.caltech.edu", "NASA/IPAC Extragalactic Database"), "mass": R("EHT2019", "2019ApJ...875L...6E", "Event Horizon Telescope Collaboration 2019, ApJ 875, L6"), "distance": R("EHT2019", "2019ApJ...875L...6E"), "found": R("EHT2019", "2019ApJ...875L...6E")},
    },
]


# ---------------------------------------------------------------------------------------------------------------------------------------------------------------
# van den Bosch (2016)

METHODS = {"star": "stars", "stars": "stars", "gas": "gas", "maser": "masers", "reverb": "echoes", "CO": "gas"}
BIB_FIELDS = {}


def read_bibliography(bbl: str) -> dict[str, tuple[str, str]]:
    """key -> (bibcode, 'Author et al. 2014, ApJ 797, 12') from the .bbl of the paper."""
    out = {}
    for block in bbl.split("\\bibitem")[1:]:
        m = re.match(r"\[\{(.*?)\}\]\{([^}]*)\}", block, re.S)
        if not m:
            continue
        label, key = m.group(1), m.group(2)
        names = re.sub(r"\s+", " ", label)
        first = re.match(r"\{\{?([^}]*)\}\}?", names)
        year = re.search(r"\((\d{4}[a-z]?)\)", names)
        author = first.group(1) if first else key
        author = author.replace("{", "").replace("}", "")
        author = author.replace("\\'", "").replace('\\"', "").replace("\\~", "").replace("\\`", "")
        author = re.sub(r"\\[a-zA-Z]+\s*", "", author).strip()
        et_al = "et~al" in names
        bib = re.search(r"abs/([^}]+)\}", block)
        bibcode = urllib.parse.unquote(bib.group(1)) if bib else ""
        journal = re.sub(r"\s+", " ", block[block.find("\\JournalTitle") :]) if "\\JournalTitle" in block else ""
        j = re.search(r"\\JournalTitle\{\\?([A-Za-z]+)\},\s*([\w]+),\s*([\w.]+)", journal)
        journal_name = {"apj": "ApJ", "apjl": "ApJ", "apjs": "ApJS", "aj": "AJ", "mnras": "MNRAS", "aap": "A&A", "nat": "Nature", "natur": "Nature", "pasp": "PASP", "araa": "ARA&A", "apss": "Ap&SS", "science": "Science"}.get(j.group(1).lower(), j.group(1)) if j else ""
        text = f"{author}{' et al.' if et_al else ''} {year.group(1) if year else ''}"
        if j:
            text += f", {journal_name} {j.group(2)}, {j.group(3)}"
        out[key] = (bibcode, text.strip())
    return out


def parse_logm(text: str):
    """`8.15$\\pm$0.16` and `6.41$^{+0.29}_{-6.41}$` -> (log M, down, up)."""
    s = text.replace(" ", "")
    m = re.fullmatch(r"(\d+\.\d+)\$\\pm\$(\d+\.\d+)", s)
    if m:
        return float(m.group(1)), float(m.group(2)), float(m.group(2))
    m = re.fullmatch(r"(\d+\.\d+)\$\^\{\+(\d+\.\d+)\}_\{-(\d+\.\d+)\}\$", s)
    if m:
        return float(m.group(1)), float(m.group(3)), float(m.group(2))
    return None


def parse_vdb16(tex: str) -> list[dict]:
    lines = tex.split("\n")
    rows = []
    start = None
    for i, line in enumerate(lines):
        if "\\begin{longtable*}" in line:
            start = i
        if "\\end{longtable*}" in line and start is not None:
            for ln in lines[start:i]:
                if "&" not in ln or ln.strip().startswith("%") or "Name &" in ln or "multicolumn" in ln:
                    continue
                cells = [c.strip() for c in ln.rstrip().rstrip("\\").rstrip().split("&")]
                if len(cells) < 11:
                    continue
                cites = re.findall(r"\\cite\w*\{([^}]*)\}", cells[10])
                if not cites:
                    continue
                rows.append({"name": cells[0], "dist": cells[1], "logm": cells[2], "method": cells[9], "refs": [k.strip() for c in cites for k in c.split(",")]})
            start = None
    return rows


NED_SPECIAL = {
    "Circinus": ["Circinus Galaxy"], "CygnusA": ["Cygnus A"], "A3565BCG": ["IC 4296"], "NGC6240(S)": ["NGC 6240S", "NGC 6240"], "M60UCD1": ["M60-UCD1"], "Henize2-10": ["He 2-10"],
    "ESO558-009": ["ESO 558- G 009"], "J0437+2456": ["SDSS J043703.67+245606.8"], "SBS1116+583A": ["SBS 1116+583A"], "Arp151": ["Mrk 40", "Arp 151"], "Fairall9": ["Fairall 9"],
    "H0507+164": ["H 0507+164"], "Zw229-015": ["ZW 229-015"],
}
# Left out because NED could not name the object or the name in the table is not enough to find it.
NED_DROP = {"A1836BCG", "1RXSJ1858+4850", "MW", "NGC4486"}


def ned_names(name: str) -> list[str]:
    if name in NED_SPECIAL:
        return NED_SPECIAL[name]
    m = re.fullmatch(r"(NGC|IC|UGC|Mrk|PG|Ark|ESO|SBS|3C|H)(\d.*)", name)
    if m:
        pre, rest = m.groups()
        if pre in ("NGC", "IC", "UGC", "Mrk"):
            rest = rest.lstrip("0")
        return [f"{pre} {rest}", name]
    return [name]


def ned_lookup(name: str):
    body = json.dumps({"name": {"v": name}}).encode()
    for attempt in range(3):
        try:
            answer = json.loads(get(NED_LOOKUP, body, {"Content-Type": "application/json"}, tries=1))
            found = answer.get("Preferred")
            if found is None:
                return None
            return {"ned": found["Name"], "ra": found["Position"]["RA"], "dec": found["Position"]["Dec"], "asked": name, "type": (found.get("ObjType") or {}).get("Value")}
        except Exception:
            time.sleep(2)
    return None


def host_name(name: str) -> str:
    """`NGC0224` -> `NGC 224`; `Mrk0050` -> `Mrk 50`; `3C120` -> `3C 120`; `CygnusA` -> `Cygnus A`."""
    n = re.sub(r"\{\\tiny (.*)\}", r"\1", name)
    special = {"CygnusA": "Cygnus A", "A3565BCG": "IC 4296", "NGC6240(S)": "NGC 6240 S", "M60UCD1": "M60-UCD1", "Henize2-10": "Henize 2-10", "ESO558-009": "ESO 558-009", "Circinus": "Circinus Galaxy"}
    if n in special:
        return special[n]
    m = re.fullmatch(r"(NGC|IC|UGC|Mrk|PG|Ark|Arp|ESO|SBS|3C|Zw|Fairall|H)(\d.*)", n)
    if m:
        pre, rest = m.groups()
        if pre in ("NGC", "IC", "UGC", "Mrk"):
            rest = rest.lstrip("0")
        return f"{pre} {rest}"
    return n


# ---------------------------------------------------------------------------------------------------------------------------------------------------------------
# Messier names for the host galaxies, from the package's own deep-sky table.

def messier_table() -> dict[str, tuple[str, str]]:
    text = (ROOT / "src" / "data" / "messier.ts").read_text(encoding="utf-8")
    rows = re.search(r"= `(.*?)`", text, re.S).group(1).split("\n")
    out = {}
    for row in rows:
        p = row.split("|")
        for n in p[1].split(","):
            if n:
                out[f"NGC {n}"] = (f"M{p[0]}", p[9])
    return out


# ---------------------------------------------------------------------------------------------------------------------------------------------------------------

def constellations(points: list[tuple[float, float]]) -> list[str]:
    program = (
        "import { constellationAt } from './src/boundaries.ts';"
        "const pts = JSON.parse(await new Promise(r => { let s=''; process.stdin.on('data', d => s += d).on('end', () => r(s)); }));"
        "console.log(JSON.stringify(pts.map(([ra, dec]) => constellationAt({ rightAscension: ra, declination: dec })?.abbreviation ?? '')));"
    )
    done = subprocess.run(["node", "--input-type=module", "-e", program], input=json.dumps(points), capture_output=True, text=True, cwd=ROOT, check=True)
    return json.loads(done.stdout)


def ten_thousandths(x: float) -> int:
    return round(x * 10000)


def cell(value) -> str:
    return "" if value is None else str(value)


def main() -> None:
    args = sys.argv[1:]
    cache = Path(args[args.index("--from") + 1]) if "--from" in args else (Path(args[args.index("--save") + 1]) if "--save" in args else Path("/tmp/hoshi-black-hole-cache"))
    offline = "--from" in args
    cache.mkdir(parents=True, exist_ok=True)
    (cache / "blackcat").mkdir(exist_ok=True)
    (cache / "vdb16").mkdir(exist_ok=True)

    # BlackCAT
    systems = []
    for page_id in range(1, 74):
        path = cache / "blackcat" / f"{page_id}.html"
        if not path.exists():
            if offline:
                raise SystemExit(f"missing {path}")
            path.write_bytes(get(f"{BLACKCAT}/info.php?id={page_id}"))
            time.sleep(0.5)
        systems.append(blackcat_system(parse_blackcat_page(path.read_text(encoding="utf-8"), page_id)))

    # Wikidata places for the typed systems
    wd_path = cache / "wikidata.json"
    wanted = sorted({h["wd"] for h in HAND + HAND_SUPERMASSIVE if "wd" in h})
    if not wd_path.exists():
        if offline:
            raise SystemExit(f"missing {wd_path}")
        query = "SELECT ?item ?ra ?dec WHERE { VALUES ?item { %s } ?item wdt:P6257 ?ra . ?item wdt:P6258 ?dec . }" % " ".join(f"wd:{q}" for q in wanted)
        answer = json.loads(get(WIKIDATA + "?" + urllib.parse.urlencode({"query": query}), headers={"Accept": "application/sparql-results+json"}))
        wd_path.write_text(json.dumps({b["item"]["value"].split("/")[-1]: [float(b["ra"]["value"]), float(b["dec"]["value"])] for b in answer["results"]["bindings"]}))
    wikidata = json.loads(wd_path.read_text())

    # van den Bosch (2016)
    tex_path, bbl_path = cache / "vdb16" / "msigma.tex", cache / "vdb16" / "msigma.bbl"
    if not tex_path.exists():
        if offline:
            raise SystemExit(f"missing {tex_path}")
        import io
        import tarfile
        data = get(VDB16_SOURCE)
        with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as tar:
            for member in tar.getmembers():
                if member.name in ("msigma.tex", "msigma.bbl"):
                    (cache / "vdb16" / member.name).write_bytes(tar.extractfile(member).read())
    vdb_rows = parse_vdb16(tex_path.read_text(encoding="utf-8", errors="replace"))
    bibliography = read_bibliography(bbl_path.read_text(encoding="utf-8", errors="replace"))

    # NED places for the host galaxies
    ned_path = cache / "ned.json"
    ned = json.loads(ned_path.read_text()) if ned_path.exists() else {}
    if offline:
        pass
    wanted_hosts = sorted({re.sub(r"\{\\tiny (.*)\}", r"\1", r["name"]) for r in vdb_rows} | {"M87"})
    for host in wanted_hosts:
        if host in ned or host in NED_DROP:
            continue
        if offline:
            raise SystemExit(f"missing NED answer for {host}")
        found = None
        for candidate in ned_names(host):
            found = ned_lookup(candidate)
            if found:
                break
        ned[host] = found
        ned_path.write_text(json.dumps(ned, indent=1))

    # The supermassive black holes of the table
    messier = messier_table()
    by_host: dict[str, dict] = {}
    left_out = {"upper limit": 0, "no place": 0}
    for row in vdb_rows:
        raw_name = re.sub(r"\{\\tiny (.*)\}", r"\1", row["name"])
        if raw_name in NED_DROP:
            left_out["no place"] += 1
            continue
        parsed = parse_logm(row["logm"])
        if parsed is None:
            continue
        logm, down, up = parsed
        if down >= logm - 1e-9 or logm < 4.0:
            left_out["upper limit"] += 1
            continue
        where = ned.get(raw_name)
        if where is None:
            left_out["no place"] += 1
            continue
        d = re.match(r"(\d+(?:\.\d+)?)(?:\$\\pm\$(\d+(?:\.\d+)?))?$", row["dist"].replace(" ", ""))
        distance = None
        if d:
            mpc, err = float(d.group(1)), float(d.group(2)) if d.group(2) else None
            distance = (mpc * 1e6, (mpc - err) * 1e6 if err else None, (mpc + err) * 1e6 if err else None, "")
        refs = [k for k in row["refs"] if k in bibliography]
        if not refs:
            continue
        keep = {
            "name": host_name(row["name"]) + "*", "host": host_name(row["name"]), "kind": "supermassive", "status": "confirmed", "ra": where["ra"], "dec": where["dec"], "companion": None, "companionType": None,
            "mass": (10 ** logm, 10 ** (logm - down), 10 ** (logm + up), ""), "distance": distance, "found": METHODS[row["method"]], "note": "", "error": (down + up) / 2,
            "refs": {}, "paper": refs,
        }
        year = re.search(r"(\d{4})", bibliography[refs[0]][1])
        keep["year"] = int(year.group(1)) if year else None
        existing = by_host.get(keep["host"])
        if existing is None or keep["error"] < existing["error"]:
            by_host[keep["host"]] = keep
    supermassive = []
    for host, s in by_host.items():
        keys = [R(k, bibliography[k][0] or k, bibliography[k][1]) for k in s["paper"]]
        paper = R("vandenBosch2016", "2016ApJ...831..134V", "van den Bosch 2016, ApJ 831, 134")
        s["refs"] = {"position": R("NED", "https://ned.ipac.caltech.edu", "NASA/IPAC Extragalactic Database"), "mass": "+".join(keys), "distance": paper, "found": keys[0]}
        names = [s["host"]]
        m = messier.get(s["host"])
        s["others"] = ([m[1]] if m and m[1] else []) + ([s["host"]] if m else [])
        if m:
            s["name"] = f"{m[0]}*"
        supermassive.append(s)
    for h in HAND_SUPERMASSIVE:
        if "ned" in h:
            where = ned.get(h["ned"])
            h["ra"], h["dec"] = where["ra"], where["dec"]
    # Sgr A* and M87* are typed above from the papers that measured them; the table's row for M87 (NGC 4486) is dropped (NED_DROP) and the Milky Way's row too.

    everything = systems + HAND + HAND_SUPERMASSIVE + supermassive
    for h in HAND + HAND_SUPERMASSIVE:
        if "wd" in h:
            h["ra"], h["dec"] = wikidata[h["wd"]]
        if "year" not in h:
            h["year"] = None
    places = [(round(s["ra"] % 360, 4), round(s["dec"], 4)) for s in everything]
    abbreviations = constellations(places)

    # A black hole's id is its name with the marks taken out.
    def slug(name: str) -> str:
        return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", name.lower().replace("*", "").replace("+", "p"))).strip("-")

    rows = []
    seen_ids: dict[str, str] = {}
    order = {"stellar": 0, "quiet": 1, "supermassive": 2}
    indexed = sorted(range(len(everything)), key=lambda i: (order[everything[i]["kind"]], everything[i]["ra"]))
    counts = {k: 0 for k in KINDS}
    for i in indexed:
        s = everything[i]
        identifier = slug(s["name"])
        if identifier in seen_ids:
            raise SystemExit(f"duplicate id {identifier}: {s['name']} and {seen_ids[identifier]}")
        seen_ids[identifier] = s["name"]
        counts[s["kind"]] += 1
        mass = s["mass"] or (None, None, None, "")
        distance = s["distance"] or (None, None, None, "")

        def number(x, digits=s.get("digits", 3 if "paper" in s else 4)):
            return "" if x is None else sig(x, digits)

        refs = s.get("refs", {})
        row = [
            identifier, s["name"], ";".join(s.get("others", [])), str(KINDS.index(s["kind"])), "0" if s["status"] == "confirmed" else "1",
            str(ten_thousandths(s["ra"] % 360)), str(ten_thousandths(s["dec"])), abbreviations[i],
            number(mass[0]), number(mass[1]), number(mass[2]), mass[3], number(distance[0]), number(distance[1]), number(distance[2]), distance[3],
            s["companion"] or "", s["companionType"] or "", str(FOUND.index(s["found"])), cell(s["year"]),
            ",".join(refs.get(k, "") for k in ("position", "mass", "distance", "companion", "found")), s["note"],
        ]
        if any("|" in c or "\n" in c or "`" in c or "\\" in c or "${" in c for c in row):
            raise SystemExit(f"bad character in {row}")
        rows.append("|".join(row))

    used = set()
    for r in rows:
        for chunk in r.split("|")[20].split(","):
            for key in chunk.split("+"):
                if key:
                    used.add(key)
    reference_rows = []
    for key in sorted(used):
        link, text = REFERENCES[key]
        if "|" in text or "`" in text or "\\" in text:
            raise SystemExit(f"bad character in reference {key}")
        reference_rows.append(f"{key}|{link}|{text}")

    header = """// GENERATED by scripts/make-black-hole-data.py. Do not edit by hand.
// Black holes with a place on the sky, one row each. Sources and the sentence relied on for each are in NOTICE.md. Columns:
// id | name | other names (semicolon-separated) | kind (index into BLACK_HOLE_KINDS) | status (0 confirmed, 1 candidate) | RA J2000 and Dec J2000 in ten-thousandths of a degree |
// IAU constellation abbreviation | mass, low and high in Suns (limit mark: > or <) | distance, low and high in parsecs (limit mark) | companion star | companion type |
// how it was found (index into BLACK_HOLE_FOUND) | year | sources of position, mass, distance, companion and discovery (reference keys, joined by +) | note.
"""
    OUT.write_text(
        header
        + "\n/** The black holes, one per line. */\nexport const BLACK_HOLE_ROWS = `"
        + "\n".join(rows)
        + "`;\n\n// key | ADS bibcode (or arXiv id, or a web address) | the citation as shown\n/** The papers the rows cite, one per line. */\nexport const BLACK_HOLE_REFERENCE_ROWS = `"
        + "\n".join(reference_rows)
        + "`;\n",
        encoding="utf-8",
    )
    print(f"wrote {OUT.relative_to(ROOT)}: {len(rows)} black holes ({', '.join(f'{k} {v}' for k, v in counts.items())}), {len(reference_rows)} papers; left out of the table: {left_out}")


if __name__ == "__main__":
    main()
