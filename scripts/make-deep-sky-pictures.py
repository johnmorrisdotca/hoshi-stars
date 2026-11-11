#!/usr/bin/env python3
"""Make the deep-sky pictures: pictures/<id>.webp, src/data/deep-sky-pictures.ts and the picture table in NOTICE.md.

Each picture is made from survey images that NASA's SkyView (https://skyview.gsfc.nasa.gov) cuts for us in the standard tangent projection about the object, north up and east left, so where a
picture lies on the sky is known by construction (centre, field and pixel scale) and nothing is fitted by eye. Three surveys, each of which states its terms on SkyView's page for it, read the
day the pictures were made (NOTICE.md records the words):

- SDSS g, r and i (Sloan Digital Sky Survey, images under a Creative Commons Attribution licence): the first choice for a galaxy or a cluster where the survey covers it.
- 2MASS J, H and K (Two Micron All Sky Survey, a US government work): the infrared sky everywhere; the first choice where SDSS has no data.
- WISE 3.4, 4.6 and 12 micron (Wide-field Infrared Survey Explorer, public domain): for nebulae and supernova remnants, which glow in the infrared.
NOT used: the Digitized Sky Survey plates (their terms are not free), Stellarium's textures (GPL), and any picture whose licence is not stated.

A picture is the bands as red, green and blue (the longest wavelength red), stretched with the inverse hyperbolic sine so faint and bright show together, with the black sky left clear: the file is
WebP with an alpha channel equal to the brightness, so laid over the dark chart it adds light and nothing else, with no rectangle and no seam. These are survey data made visible, not
photographs a person took; the infrared pictures are in false colour, and the pick card says which.

    python3 -I scripts/make-deep-sky-pictures.py                    # every target (needs the network, and numpy, pillow and astropy)
    python3 -I scripts/make-deep-sky-pictures.py --only M31,M42     # just those
    python3 -I scripts/make-deep-sky-pictures.py --only M13 --data  # just that one, and write the data for it alone (to try the demo before all are made)
    python3 -I scripts/make-deep-sky-pictures.py --releases-only    # only the finer pictures from ESA/Hubble
    python3 -I scripts/make-deep-sky-pictures.py --cache-only      # asks SkyView for nothing: what the earlier runs kept (what SkyView could not give is then a survey that does not cover the field)
    python3 -I scripts/make-deep-sky-pictures.py --shard 0/3        # every third target, so three runs at once share the asking; a last run with no option writes the data
    python3 -I scripts/make-deep-sky-pictures.py --sheet OUT.png    # also a contact sheet of the pictures made, for looking at

The answers are kept in .cache/deep-sky-pictures (git-ignored), so a second run does not ask again. SkyView allows a few requests at once: this asks one at a time. None of this runs in the test.
"""
import hashlib
import html
import io
import json
import math
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

import numpy as np
from astropy.io import fits
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / ".cache" / "deep-sky-pictures"
OUT = ROOT / "pictures"
DATA_OUT = ROOT / "src" / "data" / "deep-sky-pictures.ts"
NOTICE = ROOT / "NOTICE.md"
ENDPOINT = "https://skyview.gsfc.nasa.gov/current/cgi/runquery.pl"
USER_AGENT = "hoshi-stars-data-script/0.1 (https://github.com/johnmorrisdotca/hoshi-stars)"
MAX_PIXELS = 720
WEBP_QUALITY = 60
BUDGET_BYTES = 90_000  # a picture file is never larger than this; the page budget (five at once, 450 kB) follows from it

SURVEYS = {
    "sdss": {
        "name": "SDSS g, r, i",
        "bands": ["SDSSg", "SDSSr", "SDSSi"],
        "native": 0.396,
        "reach": 62,  # arc-minutes: SkyView gives up after a minute, and a wider SDSS mosaic takes longer
        "credit": "Sloan Digital Sky Survey, images from NASA's SkyView",
        "licence": "CC BY (Creative Commons Attribution), per the SDSS Image Use Policy; SkyView's survey page states the licence",
        "colour": "visible light (g, r, i filters as blue, green, red), colours as the survey measured them, stretched",
        "page": "https://skyview.gsfc.nasa.gov/current/cgi/moreinfo.pl?survey=SDSSg",
    },
    "2mass": {
        "name": "2MASS J, H, K",
        "bands": ["2MASS-J", "2MASS-H", "2MASS-K"],
        "native": 1.0,
        "reach": 150,
        "credit": "Two Micron All Sky Survey (University of Massachusetts and IPAC/Caltech, NASA and NSF), images from NASA's SkyView",
        "licence": "a US government work; the survey asks for its acknowledgement, which NOTICE.md gives",
        "colour": "near-infrared, false colour (J, H, K as blue, green, red), stretched",
        "page": "https://skyview.gsfc.nasa.gov/current/cgi/moreinfo.pl?survey=2MASS-J",
    },
    "wise": {
        "name": "WISE 3.4, 4.6, 12 micron",
        "bands": ["WISE 3.4", "WISE 4.6", "WISE 12"],
        "native": 1.375,
        "reach": 150,
        "credit": "Wide-field Infrared Survey Explorer (UCLA and JPL/Caltech, NASA), images from NASA's SkyView",
        "licence": "public domain (SkyView's survey page: WISE data is in the public domain); the survey asks for its acknowledgement, which NOTICE.md gives",
        "colour": "mid-infrared, false colour (3.4, 4.6 and 12 micron as blue, green, red), stretched",
        "page": "https://skyview.gsfc.nasa.gov/current/cgi/moreinfo.pl?survey=WISE+3.4",
    },
}

SURVEYS_EXTRA = {
    "esahubble": {
        "name": "ESA/Hubble",
        "colour": "visible and near-infrared light in colour, as ESA/Hubble released it, resized, with the black of the sky and of the edges made clear",
        "credit": "ESA/Hubble (the credit line of each release is given with its picture)",
        "licence": "CC BY 4.0 (Creative Commons Attribution 4.0 International), the licence ESA/Hubble gives its images on https://esahubble.org/copyright/",
        "page": "https://esahubble.org/copyright/",
    }
}

# What to try first for each kind of object (index of DEEP_SKY_TYPES in src/deep-sky-core.ts): the first survey that covers the field is used.
# A galaxy in 2MASS is only its core and the tiles of that survey do not join, so a galaxy is SDSS or WISE; an open cluster in a rich field of the Milky Way is a sheet of equal faint stars in 2MASS and
# says nothing, so it is SDSS or WISE too (and with neither it has no picture: its member stars are drawn instead). A globular cluster is its stars, which 2MASS shows well.
BY_TYPE = {0: [], 1: ["sdss", "wise"], 2: ["sdss", "2mass"], 3: ["sdss"], 4: ["wise", "2mass"], 5: ["wise", "2mass"], 6: ["wise", "2mass"]}
# Objects that look better from another survey, by eye: id -> survey keys in order.
# (an asterism or a star cloud, which "other" is, has no picture: it is stars that are already drawn; the Pleiades are a cluster whose dust is the picture; M32 is a satellite of M31 that SDSS covers by halves.)
PREFER = {"M45": ["wise"]}
# Looked at and left without a picture: the infrared glow of the Milky Way fills the whole field and the picture is a red wall that shows no object (or, for M32, a galaxy that SDSS covers by halves
# and that already lies inside the picture of M31).
SKIP = {"M32", "NGC 2237", "NGC 6960", "NGC 3115", "NGC 6888", "NGC 1499", "NGC 7000", "IC 5070"}

# Finer pictures of part of an object, from ESA/Hubble (https://esahubble.org/images/<release>/): the image's own AVM tags (Astronomy Visualization Metadata) say where it lies on the sky.
# Each is laid over the survey picture of its object. The release page's credit line and the copyright page's licence are read when the picture is made.
HUBBLE = {
    "M51": ["heic0506a"],
    "M42": ["heic0601a"],
    "M1": ["heic0515a"],
    "M16": ["heic1501a"],
    "M82": ["heic0604a"],
    "M104": ["opo0328a"],
    "M57": ["heic1310a"],
    "M77": ["heic1305a"],
    "M94": ["potw1542a"],
    "M81": ["opo1438b"],
    "M83": ["heic1403a"],
    "M33": ["heic1901a"],
    "M31": ["heic1502a"],
    "M102": ["opo0624a"],
    "NGC 104": ["heic1510a"],
    "NGC 7293": ["opo0432d"],
    "NGC 2070": ["heic1105a"],
    "NGC 3372": ["opo0006a"],
}

# The targets: all the Messier objects, then these brighter NGC and IC objects that are the sky's famous sights.
EXTRA = [
    "NGC 104", "NGC 5139", "NGC 253", "NGC 5128", "NGC 869", "NGC 884", "NGC 7000", "IC 5070", "NGC 2237", "NGC 2244", "NGC 2264", "IC 434", "NGC 7293", "NGC 6992", "NGC 6960",
    "NGC 3372", "NGC 2070", "NGC 281", "IC 1396", "NGC 1499", "NGC 4565", "NGC 891", "NGC 2403", "NGC 6946", "NGC 7331", "NGC 6888", "NGC 4631", "NGC 3115", "NGC 1316", "NGC 4038",
    "NGC 5907", "NGC 4244", "NGC 3628", "NGC 4725", "NGC 7479", "NGC 2392", "NGC 6543", "NGC 7662", "NGC 3242", "NGC 6826", "NGC 7009", "NGC 6205", "NGC 2419", "NGC 6397", "NGC 6752",
]


def fold(text):
    return re.sub(r"\s+", "", text).upper()


def objects():
    """The package's objects: id, type index, position and size in arc-minutes (from the shapes data, else the object's own)."""
    sizes = {}
    for name in ("messier", "ngc-ic"):
        text = (ROOT / "src" / "data" / f"deep-sky-shapes-{name}.ts").read_text(encoding="utf-8")
        body = re.search(r"= `(.*?)`;", text, re.S).group(1)
        for row in body.split("\n"):
            p = row.split("|")
            sizes[p[0]] = int(p[1]) / 10
    found = {}
    for name, constant in (("messier", "MESSIER_ROWS"), ("ngc-ic", "NGC_IC_ROWS")):
        text = (ROOT / "src" / "data" / f"{name}.ts").read_text(encoding="utf-8")
        for row in re.search(constant + r" = `(.*?)`;", text, re.S).group(1).split("\n"):
            p = row.split("|")
            ngc = [n for n in p[1].split(",") if n != ""]
            ic = [n for n in p[2].split(",") if n != ""]
            ident = f"M{p[0]}" if p[0] != "" else (f"NGC {ngc[0]}" if ngc else f"IC {ic[0]}")
            short = ident.replace("NGC ", "N").replace("IC ", "I")
            size = sizes.get(short, int(p[7]) / 10 if p[7] != "" else None)
            found[ident] = {"id": ident, "type": int(p[3]), "ra": int(p[4]) / 10000, "dec": int(p[5]) / 10000, "size": size, "name": p[9]}
    return found


def fetch(survey, ra, dec, field_deg, pixels):
    """One FITS image from SkyView, kept in the cache. Returns its path and the query address. Asks politely: one at a time, again after a pause when SkyView says it is busy."""
    query = {"Survey": survey, "Position": f"{ra:.5f},{dec:.5f}", "Size": f"{field_deg:.5f}", "Pixels": str(pixels), "Projection": "Tan", "Coordinates": "J2000", "Sampler": "Clip", "Return": "FITS"}
    address = ENDPOINT + "?" + urllib.parse.urlencode(query)
    path = CACHE / (hashlib.sha1(address.encode()).hexdigest()[:20] + ".fits")
    if path.exists():
        return path, address
    if "--cache-only" in sys.argv:
        return None, address
    CACHE.mkdir(parents=True, exist_ok=True)
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(address, headers={"User-Agent": USER_AGENT}), timeout=90) as answer:
                body = answer.read()
            if body[:6] == b"SIMPLE" and len(body) > 20_000:  # a shorter answer is SkyView's empty one, given when it is struggling: it is asked again
                path.write_bytes(body)
                time.sleep(1.5)
                return path, address
        except Exception as error:  # a busy server, a dropped connection, a field too big for SkyView's minute
            print(f"    {survey}: {error}", file=sys.stderr)
        time.sleep(10 * (attempt + 1))
    return None, address


def read(path):
    """The image, with what the survey lacks (not a number) as 0, and the share of the pixels that had data."""
    data = fits.getdata(path).astype(np.float64)
    data = data if data.ndim == 2 else data.reshape(data.shape[-2:])
    have = np.isfinite(data) & (data != 0)
    return np.nan_to_num(data, nan=0.0), float(have.mean()) if data.size > 100 else 0.0


def stretch(bands, kind, galaxy=False):
    """Three bands (blue, green, red order) into float RGB 0 to 1: sky to black, asinh stretch, colour kept."""
    channels = []
    low, high, soft = {"sdss": (35, 99.85, 0.06), "2mass": (30, 99.9, 0.07), "wise": (10 if galaxy else 35, 99.6, 0.10)}[kind]
    for band in reversed(bands):  # red first
        nonzero = band[band != 0]
        black = np.percentile(nonzero, low) if nonzero.size else 0.0
        white = np.percentile(nonzero, high) if nonzero.size else 1.0
        # a little noise below the black point is clipped; the white point keeps the faint light in view
        channels.append(np.clip((band - black) / max(white - black, 1e-12), 0, None))
    rgb = np.stack(channels, -1)
    brightness = rgb.mean(-1, keepdims=True) + 1e-9
    scaled = np.arcsinh(brightness / soft) / np.arcsinh(1 / soft)
    out = rgb / brightness * scaled
    out = out / np.maximum(out.max(-1, keepdims=True), 1.0)
    return np.clip(out, 0, 1)


def to_image(rgb, feather=0.06, floor=0.06):
    """RGB (0 to 1, FITS order: south first) into an RGBA picture, north up: alpha is the brightness, the colour is divided by it, and the edges fade."""
    rgb = np.flipud(rgb)
    height, width = rgb.shape[:2]
    alpha = rgb.max(-1)
    alpha = np.clip((alpha ** 0.9 * 1.15 - floor) / (1 - floor), 0, 1)  # the faintest noise of the sky goes clear, which is also what keeps a file small
    colour = rgb / np.maximum(alpha[..., None], 1e-6)
    colour = np.clip(colour, 0, 1)
    edge = max(2, int(min(width, height) * feather))
    ramp_x = np.minimum(1.0, np.minimum(np.arange(width) + 0.5, width - np.arange(width) - 0.5) / edge)
    ramp_y = np.minimum(1.0, np.minimum(np.arange(height) + 0.5, height - np.arange(height) - 0.5) / edge)
    window = np.outer(ramp_y, ramp_x)
    window = window * window * (3 - 2 * window)
    alpha = alpha * window
    rgba = np.dstack([colour, alpha])
    return Image.fromarray((np.clip(rgba, 0, 1) * 255 + 0.5).astype(np.uint8), "RGBA")


def make(o, order):
    major = o["size"] or 6.0
    field_arcmin = min(150.0, max(8.0, major * 1.7 + 3))
    for kind in order:
        spec = SURVEYS[kind]
        if field_arcmin > spec["reach"]:
            continue
        pixels = int(max(160, min(MAX_PIXELS, math.ceil(field_arcmin * 60 / spec["native"]))))
        if field_arcmin > 100:
            pixels = min(pixels, 500)  # a wide field is slow for SkyView, and the picture is soft at that scale anyway
        bands = []
        addresses = []
        share = 1.0
        for band in spec["bands"]:
            path, address = fetch(band, o["ra"], o["dec"], field_arcmin / 60, pixels)
            addresses.append(address)
            if path is None:
                share = 0.0
                break
            data, have = read(path)
            bands.append(data)
            share = min(share, have)
        if share < 0.98:
            print(f"  {o['id']}: {spec['name']} does not cover the field ({share:.2f})")
            continue
        wide_glow = kind == "wise" and o["type"] == 1  # the haze of a galaxy's infrared surroundings is cut harder, and its edge faded longer, so that no box shows
        image = to_image(stretch(bands, kind, galaxy=o["type"] == 1), feather=0.10 if wide_glow else 0.06, floor=0.12 if wide_glow else 0.06)
        return {"id": o["id"], "kind": kind, "image": image, "pixels": pixels, "field": field_arcmin, "scale": field_arcmin * 60 / pixels, "address": addresses[0]}
    return None


def encode(image, path):
    """Saves the picture as WebP, at the best quality that keeps the file within BUDGET_BYTES, then with fewer pixels if it must. Returns the image as saved."""
    for shrink in (1.0, 0.85, 0.72, 0.6, 0.5, 0.42):
        size = max(160, round(image.width * shrink))
        smaller = image if size == image.width else image.resize((size, size), Image.LANCZOS)
        for quality in (WEBP_QUALITY, 50, 40):
            smaller.save(path, "WEBP", quality=quality, method=6, alpha_quality=quality)
            if path.stat().st_size <= BUDGET_BYTES:
                return smaller
    raise RuntimeError(f"{path.name} is {path.stat().st_size} bytes at the lowest setting")


def get(address, binary=True):
    """A file from the web, kept in the cache."""
    path = CACHE / (hashlib.sha1(address.encode()).hexdigest()[:20] + ".bin")
    if not path.exists():
        CACHE.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(urllib.request.Request(address, headers={"User-Agent": USER_AGENT}), timeout=120) as answer:
            path.write_bytes(answer.read())
        time.sleep(1.0)
    return path.read_bytes() if binary else path.read_text(encoding="utf-8", errors="replace")


def avm(jpeg):
    """The Astronomy Visualization Metadata of a JPEG: centre, original size, degrees a pixel, rotation and the credit."""
    start = jpeg.find(b"<?xpacket begin")
    packet = jpeg[start : jpeg.find(b"<?xpacket end", start)].decode("utf-8", "replace")
    def seq(name):
        found = re.search(r"<avm:" + name + r">\s*<rdf:Seq>(.*?)</rdf:Seq>", packet, re.S)
        return [float(x) for x in re.findall(r"<rdf:li>([^<]+)</rdf:li>", found.group(1))]
    credit = re.search(r'photoshop:Credit="([^"]+)"', packet)
    rotation = re.search(r'avm:Spatial.Rotation="([^"]+)"', packet)
    projection = re.search(r'avm:Spatial.CoordsystemProjection="([^"]+)"', packet)
    return {"value": seq("Spatial.ReferenceValue"), "dimension": seq("Spatial.ReferenceDimension"), "pixel": seq("Spatial.ReferencePixel"), "scale": seq("Spatial.Scale"),
            "rotation": float(rotation.group(1)), "credit": credit.group(1) if credit else None, "projection": projection.group(1) if projection else None}


def make_release(object_id, release):
    """One ESA/Hubble image as a finer picture of an object, placed by its AVM tags."""
    page = f"https://esahubble.org/images/{release}/"
    text = get(page, binary=False)
    if "/copyright/" not in text:
        raise RuntimeError(f"{release}: the page does not link its usage terms")
    jpeg = get(f"https://cdn.esahubble.org/archives/images/screen/{release}.jpg")
    tags = avm(jpeg)
    if tags["projection"] != "TAN" or abs(abs(tags["scale"][0]) / abs(tags["scale"][1]) - 1) > 0.01:
        raise RuntimeError(f"{release}: not a plain tangent-plane image")
    image = Image.open(io.BytesIO(jpeg)).convert("RGB")
    image.thumbnail((768, 768), Image.LANCZOS)
    width, height = image.size
    if abs(tags["pixel"][0] - (tags["dimension"][0] + 1) / 2) > 1.5 or abs(tags["pixel"][1] - (tags["dimension"][1] + 1) / 2) > 1.5:
        return None  # the reference pixel is not the middle: the picture's centre would need the convention for which way its y runs, which is not used here
    scale = abs(tags["scale"][0]) * 3600 * tags["dimension"][0] / width
    rgb = np.asarray(image, dtype=np.float64) / 255
    # the picture's own edge and the black outside it go clear: where every channel is near zero, widened a little and softened
    inside = rgb.max(-1) > 0.035
    mask = Image.fromarray((inside * 255).astype(np.uint8), "L").filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(9)).filter(ImageFilter.GaussianBlur(3))
    footprint = np.asarray(mask, dtype=np.float64) / 255
    edge = max(2, int(min(width, height) * 0.05))
    ramp_x = np.minimum(1.0, np.minimum(np.arange(width) + 0.5, width - np.arange(width) - 0.5) / edge)
    ramp_y = np.minimum(1.0, np.minimum(np.arange(height) + 0.5, height - np.arange(height) - 0.5) / edge)
    window = np.outer(ramp_y, ramp_x)
    # as for the survey pictures, the picture adds light and its dark sky is clear (what is faint is partly clear, and its colour is scaled up by the same share, so the light is unchanged);
    # where it is bright it replaces what lies under it, so the sky of the survey picture is not seen through a galaxy
    brightness = rgb.max(-1)
    alpha = np.clip(brightness * 3, 0, 1) * footprint * window * window * (3 - 2 * window)
    colour = np.clip(rgb * (np.maximum(footprint * window, 1e-6) / np.maximum(alpha, 1e-6))[..., None], 0, 1)
    colour = np.where(alpha[..., None] > 1e-4, colour, rgb)
    rgba = np.dstack([colour, alpha])
    credit = " ".join(html.unescape(tags["credit"] or "").split())
    return {"id": f"{object_id}-{release}", "kind": "esahubble", "image": Image.fromarray((np.clip(rgba, 0, 1) * 255 + 0.5).astype(np.uint8), "RGBA"), "pixels": width, "height": height, "field": scale * width / 60, "scale": scale,
            "ra": tags["value"][0], "dec": tags["value"][1], "rotation": (-tags["rotation"]) % 360, "address": page, "credit": f"{credit} ({'ESA/Hubble'})", "object": {"id": object_id}}


def file_of(ident):
    return ident.replace(" ", "-") + ".webp"


def main():
    args = sys.argv[1:]
    only = args[args.index("--only") + 1].split(",") if "--only" in args else None
    sheet = args[args.index("--sheet") + 1] if "--sheet" in args else None
    found = objects()
    targets = [f"M{n}" for n in range(1, 111)] + EXTRA
    if only is not None:
        targets = [t for t in targets if fold(t) in {fold(x) for x in only}]
    shard = args[args.index("--shard") + 1] if "--shard" in args else None
    if shard is not None:
        index, count = (int(x) for x in shard.split("/"))
        targets = targets[index::count]
    OUT.mkdir(exist_ok=True)
    made = []
    for ident in [] if "--releases-only" in args else targets:
        o = found.get(ident)
        if o is None:
            print(f"{ident}: not in the package's table, skipped")
            continue
        print(f"{ident} ({o['name'] or o['id']}, type {o['type']}, size {o['size']})")
        result = make(o, [] if ident in SKIP else PREFER.get(ident, BY_TYPE[o["type"]]))
        if result is None:
            print(f"  {ident}: no survey covers it; no picture")
            (OUT / file_of(ident)).unlink(missing_ok=True)
            continue
        before = result["image"].width
        result["image"] = encode(result["image"], OUT / file_of(ident))
        result["scale"] *= before / result["image"].width
        result["pixels"] = result["image"].width
        result["object"] = o
        made.append(result)
        print(f"  {ident}: {result['kind']}, {result['pixels']} px, field {result['field']:.1f}', {(OUT / file_of(ident)).stat().st_size // 1024} kB")
    if shard is None:
        for object_id, releases in HUBBLE.items():
            if only is not None and fold(object_id) not in {fold(x) for x in only}:
                continue
            for release in releases:
                print(f"{object_id}: {release} (ESA/Hubble)")
                result = make_release(object_id, release)
                if result is None:
                    print(f"  {release}: its reference pixel is not the middle of the picture; not used")
                    continue
                before = result["image"].width
                result["image"] = encode(result["image"], OUT / file_of(result["id"]))
                result["scale"] *= before / result["image"].width
                result["pixels"] = result["image"].width
                result["height"] = result["image"].height
                made.append(result)
                print(f"  {result['id']}: {result['pixels']} x {result['height']} px, field {result['field']:.1f}', {(OUT / file_of(result['id'])).stat().st_size // 1024} kB")
    if (only is None and shard is None) or "--data" in args:
        write_data(made)
    if sheet is not None and made:
        contact_sheet(made, sheet)


def write_data(made):
    specs = {**SURVEYS, **SURVEYS_EXTRA}
    keys = list(specs)
    rows = []
    for m in made:
        o = m.get("object", {})
        ra = m["ra"] if "ra" in m else o["ra"]
        dec = m["dec"] if "dec" in m else o["dec"]
        object_id = o["id"] if "id" in o else m["id"]
        credit = m.get("credit", "")
        height = m.get("height", m["pixels"])
        rows.append("|".join([m["id"], object_id, str(round(ra * 100000)), str(round(dec * 100000)), str(m["pixels"]), str(height), str(round(m["scale"] * 100)), str(round(m.get("rotation", 0.0) * 10)), str(keys.index(m["kind"])), m["address"].replace("|", "%7C"), credit]))
    sources = ",\n".join("  { " + ", ".join(f"{k}: {json.dumps(sp[k], ensure_ascii=False)}" for k in ("name", "colour", "credit", "licence", "page")) + " }" for sp in specs.values())
    head = """// GENERATED by scripts/make-deep-sky-pictures.py. Do not edit by hand.
// The pictures of deep-sky objects in `pictures/`: where each lies on the sky and where it comes from. One row a picture: picture id | the object's id | right ascension and declination of the picture's
// middle in hundred-thousandths of a degree | width and height in pixels | arc-seconds a pixel times 100 | angle of the picture's top, east of north, in tenths of a degree | index into
// `PICTURE_SOURCES` | the SkyView address of the first band, or the release's page | the credit line where it is the picture's own (empty: the source's). The sources' words are in NOTICE.md.

/** Where the pictures come from: what each is called, how its colours are made, who is credited, its licence and its page. */
export const PICTURE_SOURCES = [
"""
    DATA_OUT.write_text(head + sources + "\n] as const;\n\n/** One picture a line: the survey pictures first, then the finer pictures. */\nexport const PICTURE_ROWS = `" + "\n".join(rows) + "`;\n", encoding="utf-8")
    table = ["| file | object | survey and bands | address | credit | licence | read |", "| --- | --- | --- | --- | --- | --- | --- |"]
    today = date.today().isoformat()
    for m in made:
        spec = specs[m["kind"]]
        table.append(f"| pictures/{file_of(m['id'])} | {m.get('object', {}).get('id', m['id'])} | {spec['name']} | {m['address']} | {m.get('credit') or spec['credit']} | {spec['licence']} | {today} |")
    text = NOTICE.read_text(encoding="utf-8")
    begin, end = "<!-- pictures:begin -->", "<!-- pictures:end -->"
    block = begin + "\n" + "\n".join(table) + "\n" + end
    if begin in text:
        text = re.sub(re.escape(begin) + r".*?" + re.escape(end), lambda _: block, text, flags=re.S)
    else:
        text = text.rstrip("\n") + "\n\n" + block + "\n"
    NOTICE.write_text(text, encoding="utf-8")
    total = sum((OUT / file_of(m["id"])).stat().st_size for m in made)
    print(f"{len(made)} pictures, {total / 1e6:.2f} MB in all")


def contact_sheet(made, path):
    cell = 240
    columns = 8
    rows = math.ceil(len(made) / columns)
    sheet = Image.new("RGB", (columns * cell, rows * cell), (11, 16, 32))
    for i, m in enumerate(made):
        tile = m["image"].resize((cell - 4, cell - 4))
        sheet.paste(tile, ((i % columns) * cell + 2, (i // columns) * cell + 2), tile)
    sheet.save(path)


if __name__ == "__main__":
    main()
