#!/usr/bin/env python3
"""Write src/data/stars.ts: the stars to visual magnitude 6.0 from the Yale Bright Star Catalogue.

Source: Hoffleit, D. and Warren, W. H. Jr., 1991, "The Bright Star Catalogue, 5th Revised Edition (Preliminary Version)", Astronomical Data Center
(NASA Goddard), catalogue V/50, as NASA's HEASARC serves it (table bsc5p, https://heasarc.gsfc.nasa.gov/W3Browse/star-catalog/bsc5p.html), a US
government source. The catalogue's own documentation calls it public domain, and the Astronomical Data Center asks only that it and the authors are
acknowledged; NOTICE.md does. Positions are J2000 (FK5) in the catalogue's own sexagesimal resolution; proper motions are the catalogue's, and so is the full spectral type string.
Parallaxes: where the Yale General Catalogue of Trigonometric Stellar Parallaxes (van Altena, Lee and Hoffleit 1995, VizieR I/238A, the file make-nearby-data.py reads) holds the star (matched by
HD number, and the V magnitudes must agree to 1.0) and gives a positive parallax, that parallax and its standard error, to a tenth of a milliarcsecond; else the Bright Star Catalogue's, to a whole
milliarcsecond and with no error (a dynamical parallax, code D in the catalogue, is kept in preference to a trigonometric one and marked).
NOT the Hipparcos or Tycho catalogues (including the new reduction, van Leeuwen 2007): ESA distributes those under CC BY-NC 3.0 IGO (non-commercial), which an MIT package cannot pass on.

The common names are our own list, keyed by the catalogue's Bayer designation; each is checked here against the catalogue (the star must exist and
be as bright as the name implies). Names follow the IAU Working Group on Star Names (its Catalog of Star Names, IAU-CSN, last updated 2022-04-04).

    python3 -I scripts/make-star-data.py                 # fetches HEASARC's heasarc_bsc5p.tdat.gz and the Yale parallax catalogue (needs the network)
    python3 -I scripts/make-star-data.py --from FILE --gctp FILE  # reads those files saved earlier (the first gzipped or not; picat.dat as is)
    node scripts/set-star-constellations.ts              # then fills the constellation of the stars the catalogue names none for, from the boundaries

Neither runs in the test.
"""
import gzip
import hashlib
import re
import sys
import urllib.request
from pathlib import Path

LIMIT = 6.0
SOURCE = "https://heasarc.gsfc.nasa.gov/FTP/heasarc/dbase/tdat_files/heasarc_bsc5p.tdat.gz"
GCTP_SOURCE = "https://vizier.cfa.harvard.edu/ftp/cats/I/238A/picat.dat"
GCTP_SHA256 = "3b483e9ddf76e2fa9860adf2d25aae79ee257de428284c3351e5e81e402727a6"
OUT = Path(__file__).resolve().parent.parent / "src" / "data" / "stars.ts"

GREEK = {
    "Alp": "α", "Bet": "β", "Gam": "γ", "Del": "δ", "Eps": "ε", "Zet": "ζ", "Eta": "η", "The": "θ", "Iot": "ι", "Kap": "κ", "Lam": "λ", "Mu": "μ",
    "Nu": "ν", "Xi": "ξ", "Omi": "ο", "Pi": "π", "Rho": "ρ", "Sig": "σ", "Tau": "τ", "Ups": "υ", "Phi": "φ", "Chi": "χ", "Psi": "ψ", "Ome": "ω",
}

# Common names by Bayer designation (with its number where the catalogue has components) and the faintest magnitude we expect, a check against a wrong key.
NAMES = {
    "α CMa": "Sirius", "α Car": "Canopus", "α Boo": "Arcturus", "α1 Cen": "Rigil Kentaurus", "α Lyr": "Vega", "α Aur": "Capella", "β Ori": "Rigel",
    "α CMi": "Procyon", "α Eri": "Achernar", "α Ori": "Betelgeuse", "β Cen": "Hadar", "α Aql": "Altair", "α Tau": "Aldebaran", "α Sco": "Antares",
    "α Vir": "Spica", "β Gem": "Pollux", "α PsA": "Fomalhaut", "α Cyg": "Deneb", "β Cru": "Mimosa", "α Leo": "Regulus", "ε CMa": "Adhara",
    "γ Cru": "Gacrux", "λ Sco": "Shaula", "γ Ori": "Bellatrix", "β Tau": "Elnath", "β Car": "Miaplacidus", "ε Ori": "Alnilam", "α Gru": "Alnair",
    "ζ Ori": "Alnitak", "α UMa": "Dubhe", "ε UMa": "Alioth", "α Per": "Mirfak", "η UMa": "Alkaid", "ε Sgr": "Kaus Australis", "δ CMa": "Wezen",
    "θ Sco": "Sargas", "ε Car": "Avior", "β CMa": "Mirzam", "α Pav": "Peacock", "α Hya": "Alphard", "α Cas": "Schedar", "β UMa": "Merak",
    "ε Boo": "Izar", "α Cet": "Menkar", "α Oph": "Rasalhague", "β Cet": "Diphda", "γ Dra": "Eltanin", "β And": "Mirach", "α And": "Alpheratz",
    "γ1 And": "Almach", "β UMi": "Kochab", "α UMi": "Polaris", "α CrB": "Alphecca", "α Ari": "Hamal", "β Per": "Algol", "ζ UMa": "Mizar",
    "δ Ori": "Mintaka", "κ Ori": "Saiph", "β Aur": "Menkalinan", "γ1 Leo": "Algieba", "β Leo": "Denebola", "γ Gem": "Alhena", "α Lup": "Men",
    "δ Sco": "Dschubba", "ε Sco": "Larawag", "ζ Pup": "Naos", "γ Vir": "Porrima", "β Cap": "Dabih", "α Aqr": "Sadalmelik", "β Aqr": "Sadalsuud",
    "ε Peg": "Enif", "α Peg": "Markab", "β Peg": "Scheat", "γ Peg": "Algenib", "β1 Sco": "Acrab", "δ Cas": "Ruchbah", "γ Cas": "Navi",
    "ε Cas": "Segin", "β Cas": "Caph", "α Tri": "Mothallah", "γ Cyg": "Sadr", "β1 Cyg": "Albireo", "γ Aql": "Tarazed",
    "β Aql": "Alshain", "α Del": "Sualocin", "β Del": "Rotanev", "ζ Her": "Rutilicus", "β Her": "Kornephoros", "α1 Her": "Rasalgethi",
    "η Boo": "Muphrid", "β Boo": "Nekkar", "γ Boo": "Seginus", "β Lib": "Zubeneschamali", "α2 Lib": "Zubenelgenubi", "β Leo": "Denebola",
    "α Crv": "Alchiba", "β Crv": "Kraz", "δ Crv": "Algorab", "α Crt": "Alkes", "α Lep": "Arneb", "β Lep": "Nihal",
    "α Col": "Phact", "β Col": "Wazn", "α Phe": "Ankaa", "θ1 Eri": "Acamar",
    "ι UMa": "Talitha", "λ UMa": "Tania Borealis", "μ UMa": "Tania Australis", "ν UMa": "Alula Borealis",
    "ξ UMa": "Alula Australis", "δ UMa": "Megrez", "γ UMa": "Phecda",
    "α Gem": "Castor", "α TrA": "Atria", "σ Sgr": "Nunki", "ζ Sgr": "Ascella", "η Oph": "Sabik", "α Cep": "Alderamin", "α Dra": "Thuban",
    "ο Cet": "Mira", "θ Cen": "Menkent", "λ Vel": "Suhail", "α Ser": "Unukalhai", "β Ari": "Sheratan", "γ Crv": "Gienah", "β Oph": "Cebalrai",
    "δ Sgr": "Kaus Media", "λ Sgr": "Kaus Borealis", "γ Cep": "Errai", "ε Vir": "Vindemiatrix", "ι Car": "Aspidiske", "β Lyr": "Sheliak",
    "γ Lyr": "Sulafat", "ζ Aql": "Okab", "δ Cyg": "Fawaris", "ε Cyg": "Aljanah", "η Dra": "Athebyne",
}
FAINTEST = {}

# The other names of the IAU Catalog of Star Names (IAU-CSN, WGSN) whose star is in the 5,080, by HR number: the Pleiades and the stars with no Bayer letter need it, and
# so does everything else the list above leaves out. Spelled as the catalogue's ASCII name column spells them.
NAMES_BY_HR = {
    153: "Fulu", 219: "Achird", 265: "Castula", 338: "Wurren", 361: "Revati",
    390: "Adhil", 437: "Alpherg", 458: "Titawin", 464: "Nembus", 510: "Torcular",
    539: "Baten Kaitos", 546: "Mesarthim", 596: "Alrescha", 804: "Kaffaljidhma", 824: "Lilii Borea",
    834: "Miram", 838: "Bharani", 850: "Angetenar", 874: "Azha", 941: "Misam",
    951: "Botein", 963: "Dalim", 984: "Zibal", 1084: "Ran", 1131: "Atik",
    1136: "Rana", 1140: "Celaeno", 1142: "Electra", 1145: "Taygeta", 1149: "Maia",
    1151: "Asterope", 1156: "Merope", 1165: "Alcyone", 1178: "Atlas", 1180: "Pleione",
    1228: "Menkib", 1231: "Zaurak", 1298: "Beid", 1325: "Keid", 1346: "Prima Hyadum",
    1373: "Secunda Hyadum", 1393: "Beemim", 1409: "Ain", 1412: "Chamukuy", 1464: "Theemin",
    1481: "Sceptrum", 1543: "Tabit", 1577: "Hassaleh", 1605: "Almaaz", 1612: "Saclateni",
    1641: "Haedus", 1666: "Cursa", 1879: "Meissa", 1899: "Hatysa", 1910: "Tianguan",
    2095: "Mahasim", 2177: "Elkurud", 2216: "Propus", 2282: "Furud", 2286: "Tejat",
    2473: "Mebsuta", 2484: "Alzirr", 2646: "Nganurganity", 2650: "Mekbuda", 2657: "Muliphein",
    2777: "Wasat", 2827: "Aludra", 2845: "Gomeisa", 2930: "Jishui", 3045: "Azmidi",
    3185: "Tureis", 3208: "Tegmine", 3249: "Tarf", 3268: "Piautos", 3275: "Alsciaukat",
    3323: "Muscida", 3418: "Minchir", 3449: "Asellus Borealis", 3461: "Asellus Australis", 3482: "Ashlesha",
    3485: "Alsephina", 3522: "Copernicus", 3572: "Acubens", 3594: "Alkaphrah", 3627: "Nahn",
    3734: "Markeb", 3743: "Intercrus", 3773: "Alterf", 3845: "Ukdah", 3852: "Subra",
    3903: "Zhang", 3905: "Rasalas", 3923: "Felis", 4031: "Adhafera", 4247: "Praecipua",
    4277: "Chalawan", 4357: "Zosma", 4359: "Chertan", 4434: "Giausar", 4518: "Taiyangshou",
    4540: "Zavijava", 4609: "Tonatiuh", 4656: "Imai", 4689: "Zaniah", 4700: "Ginan",
    4730: "Acrux", 4785: "Chara", 4846: "La Superba", 4863: "Tianyi", 4910: "Minelauva",
    4915: "Cor Caroli", 4916: "Taiyi", 4968: "Diadem", 5062: "Alcor", 5107: "Heze",
    5315: "Kang", 5338: "Syrma", 5351: "Xuange", 5359: "Khambalia", 5409: "Elgafar",
    5460: "Toliman", 5533: "Merga", 5603: "Brachium", 5733: "Alkalurops", 5735: "Pherkad",
    5744: "Edasich", 5747: "Nusakan", 5787: "Zubenelhakrabi", 5879: "Gudja", 5928: "Iklil",
    5944: "Fang", 6008: "Marsic", 6027: "Jabbah", 6056: "Yed Prior", 6075: "Yed Posterior",
    6084: "Alniyat", 6117: "Cujam", 6149: "Marfik", 6165: "Paikauhale", 6247: "Xamidimura",
    6252: "Pipirima", 6370: "Alrakis", 6396: "Aldhibah", 6402: "Guniibuu", 6410: "Sarin",
    6508: "Lesath", 6526: "Maasym", 6536: "Rastaban", 6585: "Cervantes", 6618: "Alruba",
    6630: "Fuyue", 6636: "Dziban", 6688: "Grumium", 6746: "Alnasl", 6789: "Yildun",
    6812: "Polis", 6945: "Fafnir", 7116: "Ainalrami", 7141: "Alya", 7228: "Polaris Australis",
    7254: "Meridiana", 7264: "Albaldah", 7298: "Aladfar", 7310: "Altais", 7337: "Arkab Prior",
    7343: "Arkab Posterior", 7348: "Rukbat", 7405: "Anser", 7462: "Alsafi", 7479: "Sham",
    7595: "Libertas", 7597: "Terebellum", 7754: "Algedi", 7773: "Alshat", 7852: "Aldulfin",
    7950: "Albali", 8030: "Musica", 8131: "Kitalpha", 8238: "Alfirk", 8264: "Bunda",
    8278: "Nashira", 8301: "Azelfafage", 8322: "Deneb Algedi", 8353: "Aldhanab", 8417: "Kurhah",
    8450: "Biham", 8499: "Ancha", 8518: "Sadachbia", 8610: "Situla", 8634: "Homam",
    8636: "Tiaki", 8650: "Matar", 8684: "Sadalbari", 8709: "Skat", 8729: "Helvetios",
    8773: "Fumalsamakah", 8880: "Salm", 8905: "Alkarab", 8930: "Veritate",
}


def sexagesimal(text: str, hours: bool) -> float:
    """HEASARC's packed form: `064508.9` (hours, minutes, seconds) or `-164258` (sign, degrees, minutes, seconds)."""
    text = text.strip()
    sign = -1.0 if text.startswith("-") else 1.0
    digits = text.lstrip("+-")
    value = float(digits[0:2]) + float(digits[2:4]) / 60 + float(digits[4:]) / 3600
    return sign * value * (15.0 if hours else 1.0)


def gctp_parallaxes(raw: bytes) -> dict:
    """HD number to (parallax in tenths of a milliarcsecond, its standard error in the same unit, the V magnitudes of the star's records) over picat.dat, by the byte columns of its ReadMe. A catalogue
    number is one star or one system: its parallax is on one record (the primary's) and belongs to every component with an HD number, so Alpha Centauri B has Alpha Centauri A's."""
    if hashlib.sha256(raw).hexdigest() != GCTP_SHA256:
        raise SystemExit("picat.dat is not the file this script was written for (SHA-256 differs): read the new ReadMe and errata, then update GCTP_SHA256")
    lines = [line.ljust(132) for line in raw.decode("latin-1").splitlines()]
    own = {}
    for line in lines:
        if line[117:124].strip() and line[1:8].strip() not in own:
            own[line[1:8].strip()] = (round(float(line[117:124]) * 10000), int(line[125:128]) if line[125:128].strip() else None)
    found = {}
    for line in lines:
        hd = re.match(r"\s*(\d+)", line[78:85])
        if not hd or line[1:8].strip() not in own:
            continue
        entry = found.setdefault(int(hd.group(1)), {"plx": own[line[1:8].strip()][0], "error": own[line[1:8].strip()][1], "v": []})
        if line[31:36].strip():
            entry["v"].append(float(line[31:36]))
    return found


def parallax(r: dict, gctp: dict) -> tuple:
    """(parallax in tenths of a milliarcsecond, its error in the same unit or None, source) for a star: g Yale GCTP, b the Bright Star Catalogue, d the catalogue's dynamical parallax; (0, None, "") for none."""
    own = round(float(r["parallax"]) * 10000) if r["parallax"].strip() else 0
    if own > 0 and r["par_code"].strip() == "D":
        return own, None, "d"
    entry = gctp.get(int(r["hd"])) if r["hd"].strip() else None
    if entry and entry["plx"] > 0 and not (entry["v"] and min(abs(v - float(r["vmag"])) for v in entry["v"]) > 1.0):
        return entry["plx"], entry["error"], "g"
    return (own, None, "b") if own > 0 else (0, None, "")


def unpack(raw: bytes) -> str:
    return (gzip.decompress(raw) if raw[:2] == b"\x1f\x8b" else raw).decode("latin-1")


def fetch() -> str:
    with urllib.request.urlopen(SOURCE, timeout=120) as response:
        return unpack(response.read())


def records(text: str):
    """The rows of a HEASARC tdat file as dictionaries keyed by its column names (`line[1]`)."""
    lines = text.splitlines()
    columns = next(line for line in lines if line.startswith("line[1]")).split("=", 1)[1].split()
    for line in lines[lines.index("<DATA>") + 1 : lines.index("<END>")]:
        yield dict(zip(columns, line.split("|")))


def designation(name: str):
    """The catalogue's ten-character name (HEASARC's `alt_name`, leading spaces dropped): a three-character Flamsteed number, a four-character Bayer
    letter and a three-character constellation."""
    name = name.strip().rjust(10) if name.strip() else " " * 10
    flamsteed = name[0:3].strip()
    bayer = name[3:7].strip()
    constellation = name[7:10].strip()
    letter = ""
    if bayer:
        parts = re.fullmatch(r"([A-Za-z]+)\s*([0-9]*)", bayer)
        if parts is None or parts.group(1) not in GREEK:
            raise SystemExit(f"a Bayer letter this script does not know: {bayer!r} in {name!r}")
        letter = GREEK[parts.group(1)] + parts.group(2)
    return (int(flamsteed) if flamsteed.isdigit() else 0), letter, constellation


def main() -> None:
    text = unpack(Path(sys.argv[sys.argv.index("--from") + 1]).read_bytes()) if "--from" in sys.argv else fetch()
    if "--gctp" in sys.argv:
        gctp = gctp_parallaxes(Path(sys.argv[sys.argv.index("--gctp") + 1]).read_bytes())
    else:
        with urllib.request.urlopen(GCTP_SOURCE, timeout=120) as response:
            gctp = gctp_parallaxes(response.read())
    stars = []
    for r in records(text):
        if not r["hr"].strip() or not r["cra"].strip() or not r["cdec"].strip() or not r["vmag"].strip():
            continue
        magnitude = float(r["vmag"])
        if magnitude > LIMIT:
            continue
        flamsteed, letter, constellation = designation(r["alt_name"])
        stars.append({
            "hr": int(r["hr"]), "letter": letter, "flamsteed": flamsteed, "constellation": constellation,
            "ra": sexagesimal(r["cra"], True), "dec": sexagesimal(r["cdec"], False),
            "pmRa": round(float(r["pmra"]) * 1000) if r["pmra"].strip() else 0, "pmDec": round(float(r["pmdec"]) * 1000) if r["pmdec"].strip() else 0,
            "v": magnitude, "bv": r["bv_color"].strip(), "spectral": r["spect_type"].strip(), "plx": parallax(r, gctp),
        })
    stars.sort(key=lambda s: (s["v"], s["hr"]))
    by_designation = {}
    for s in stars:
        if s["letter"]:
            by_designation.setdefault(f'{s["letter"]} {s["constellation"]}', s)

    names = {}
    problems = []
    for key, name in NAMES.items():
        star = by_designation.get(key)
        if star is None:
            problems.append(f"no such star: {key} {name}; similar: {[k for k in by_designation if k.split()[-1] == key.split()[-1] and k[0] == key[0]]}")
        elif star["v"] > FAINTEST.get(key, 4.5):
            problems.append(f"too faint for a common name: {key} {name} {star['v']}")
        else:
            names[star["hr"]] = name
    by_hr = {s["hr"]: s for s in stars}
    for hr, name in NAMES_BY_HR.items():
        if hr not in by_hr:
            problems.append(f"no such star: HR {hr} {name}")
        elif hr in names:
            problems.append(f"named twice: HR {hr} {names[hr]} and {name}")
        else:
            names[hr] = name
    if len(set(names.values())) != len(names):
        problems.append("a name is used twice")
    if problems:
        print("\n".join(problems))
        sys.exit(1)

    rows = []
    for s in stars:
        rows.append("|".join([
            str(s["hr"]), s["letter"], str(s["flamsteed"] or ""), s["constellation"], str(round(s["ra"] * 2400)), str(round(s["dec"] * 3600)), str(s["pmRa"]), str(s["pmDec"]),
            str(round(s["v"] * 100)), str(round(float(s["bv"]) * 100)) if s["bv"] else "", s["spectral"],
            str(s["plx"][0]), "" if s["plx"][1] is None else str(s["plx"][1]), s["plx"][2],
        ]))
    name_lines = ",".join(f"{hr}:{name!r}".replace("'", '"') for hr, name in sorted(names.items()))
    out = f"""// GENERATED by scripts/make-star-data.py. Do not edit by hand.
// The stars of visual magnitude {LIMIT} and brighter from the Yale Bright Star Catalogue (Hoffleit and Warren 1991, 5th revised edition, preliminary; ADC V/50, from NASA HEASARC):
// {len(stars)} stars, brightest first. One row a star: HR number | Bayer letter | Flamsteed number | constellation (the catalogue's for a star with a Bayer letter or a Flamsteed number, else the boundaries': scripts/set-star-constellations.ts fills it in) | RA J2000 in tenths of a second of time |
// Dec J2000 in arc-seconds (both the catalogue's own resolution) | proper motion in RA (times cos Dec) and in Dec, milliarcseconds a year | V magnitude times 100 |
// B-V times 100 | spectral type as the catalogue gives it (K1.5IIIFe-0.5) | parallax in tenths of a milliarcsecond (0 where there is none) | its standard error in the same unit (blank where there is none) |
// where the parallax is from (g: Yale General Catalogue of Trigonometric Stellar Parallaxes, I/238A; b: the Bright Star Catalogue's, to a whole milliarcsecond; d: the Bright Star Catalogue's dynamical parallax; blank: none).

/** The star rows, one per line. */
export const STAR_ROWS = `{chr(10).join(rows)}`;

/** Common names by HR number: our own list, after the IAU Working Group on Star Names. */
export const STAR_NAMES: Readonly<Record<number, string>> = {{ {name_lines} }};
"""
    OUT.write_text(out, encoding="utf-8")
    print(f"wrote {OUT} ({len(stars)} stars, {len(names)} named)")


if __name__ == "__main__":
    main()
