#!/usr/bin/env python3
"""Make the natural-colour pictures of the showpiece deep-sky objects: pictures/<id>.webp, their rows in src/data/deep-sky-pictures.ts, their rows in the picture table of NOTICE.md and scripts/natural-pictures.json.

Where make-deep-sky-pictures.py cuts false-colour survey pictures out of NASA's SkyView, this takes true-colour photographs that their owners have released under a licence a package can pass on, and lays each exactly on the sky:

- NSF NOIRLab (https://noirlab.edu/public/copyright/): "Unless specifically noted ... licensed under a Creative Commons Attribution 4.0 International License".
- ESO (https://www.eso.org/public/outreach/copyright/): the same, with the credit line kept and any change said.
- ESA/Hubble (https://esahubble.org/copyright/): Creative Commons Attribution 4.0.
Never CC BY-SA, never non-commercial, never "all rights reserved". Each page of an image is read for its credit when the picture is made, and the licence page for the sentence; NOTICE.md records both with the day.

Where a picture lies is found twice. The release carries its own Astronomy Visualization Metadata (AVM): a tangent-plane position, scale and turn. That is the prior. The placement used is then our own fit: the stars in
the photograph are found, matched to this package's own stars (the Yale stars to magnitude 6 and the faint tiles' UCAC4 stars to magnitude 12; nothing from Hipparcos, Tycho or Gaia, and no astrometry service), and a
tangent-plane turn, scale and centre are fitted to them by least squares with outliers clipped (scripts/field-stars.ts lists the stars). Where the field holds too few stars to fit (a Hubble field of a few arc-minutes) the AVM
placement is used and the manifest says so. The manifest (scripts/natural-pictures.json) keeps, for each picture, which it was, how many stars matched, the residual in arc-seconds and the difference from the AVM, and for a
galaxy the centre and the position angle of the galaxy as measured in the picture itself, which test/deep-sky-pictures.test.ts holds to the catalogue's.

A picture is a WebP with an alpha channel a little over the brightness (1.15 times it, up to 1), the colour divided by it, the photograph's sky taken off and the edges of the picture and of its data faded, so laid over the dark chart it adds the light of the photograph and no rectangle.

    python3 -I scripts/make-natural-pictures.py                      # every entry of PICTURES (needs the network, numpy, pillow, scipy and node)
    python3 -I scripts/make-natural-pictures.py --only M31,M42       # just those
    python3 -I scripts/make-natural-pictures.py --cache-only         # asks the sites for nothing
    python3 -I scripts/make-natural-pictures.py --raw DIR            # where the downloads are kept (default ~/Projects/backups/hoshi-stars/2026-11-10-natural-colour-raw, or $HOSHI_STARS_BACKUP_DIR/...)
    python3 -I scripts/make-natural-pictures.py --sheet OUT.png      # also a contact sheet of the pictures made, for looking at
    python3 -I scripts/make-natural-pictures.py --feather-finer       # once, after make-deep-sky-pictures.py: fade the straight edges of the finer ESA/Hubble pictures
    python3 -I scripts/make-natural-pictures.py --dry                # fit and report; write no file

make-deep-sky-pictures.py rewrites the whole data file from the survey pictures, so run this after it: every row here replaces the survey picture of the same id, or is added. None of this runs in the test.
"""
import hashlib
import html
import io
import json
import math
import os
import re
import subprocess
import sys
import time
import urllib.request
from datetime import date
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "pictures"
DATA_OUT = ROOT / "src" / "data" / "deep-sky-pictures.ts"
NOTICE = ROOT / "NOTICE.md"
MANIFEST = ROOT / "scripts" / "natural-pictures.json"
FEATHERED = ROOT / "scripts" / "finer-feathered.json"
USER_AGENT = "hoshi-stars-data-script/0.1 (https://github.com/johnmorrisdotca/hoshi-stars)"
BUDGET_BYTES = 110_000  # a natural picture file is never larger than this; the page budget (six at once) follows from it
ARCSEC = 3600.0

SITES = {
    "noirlab": {
        "page": "https://noirlab.edu/public/images/{id}/",
        "file": "https://storage.noirlab.edu/media/archives/images/{variant}/{id}.jpg",
        "source": {
            "name": "NSF NOIRLab",
            "colour": "true colour from several filters, as NOIRLab released it, resized, with the black of the sky and of the edges made clear",
            "credit": "NOIRLab/NSF/AURA (the credit line of each image is given with its picture)",
            "licence": "CC BY 4.0 (Creative Commons Attribution 4.0 International), the licence NSF NOIRLab gives its images on https://noirlab.edu/public/copyright/",
            "page": "https://noirlab.edu/public/copyright/",
        },
    },
    "eso": {
        "page": "https://www.eso.org/public/images/{id}/",
        "file": "https://cdn.eso.org/images/{variant}/{id}.jpg",
        "source": {
            "name": "ESO",
            "colour": "true colour from several filters, as ESO released it, resized, with the black of the sky and of the edges made clear",
            "credit": "ESO (the credit line of each image is given with its picture)",
            "licence": "CC BY 4.0 (Creative Commons Attribution 4.0 International), the licence ESO gives its images on https://www.eso.org/public/outreach/copyright/",
            "page": "https://www.eso.org/public/outreach/copyright/",
        },
    },
    "hubble": {
        "page": "https://esahubble.org/images/{id}/",
        "file": "https://cdn.esahubble.org/archives/images/{variant}/{id}.jpg",
        "source": {
            "name": "ESA/Hubble",
            "colour": "visible and near-infrared light in colour, as ESA/Hubble released it, resized, with the black of the sky and of the edges made clear",
            "credit": "ESA/Hubble (the credit line of each release is given with its picture)",
            "licence": "CC BY 4.0 (Creative Commons Attribution 4.0 International), the licence ESA/Hubble gives its images on https://esahubble.org/copyright/",
            "page": "https://esahubble.org/copyright/",
        },
    },
}

# The pictures. `id` is the object's id and the picture's (it replaces the survey picture of that id: the widest view of the object). `image` is the image's id on its site; `long` the pixels of its longer side in the file;
# `centre` says to cut the picture symmetrically about the object's own position (the largest box of the photograph that fits), which a galaxy that fills its frame wants; `scale` the coarsest arc-seconds a pixel
# the picture may have, so that a finer picture of part of the object (the Hubble ones) is still the finer one and is drawn over it.
PICTURES = [
    {"id": "M31", "site": "noirlab", "image": "noao-m31lgs_ubvIha", "variant": "publicationjpg", "long": 1800, "galaxy": True, "sky": 35},
    {"id": "M33", "site": "eso", "image": "eso1424a", "long": 800, "galaxy": True},
    {"id": "M42", "site": "eso", "image": "eso1723a", "long": 900},
    {"id": "M45", "site": "noirlab", "image": "noao-m45", "long": 900},
    {"id": "M8", "site": "eso", "image": "eso0936a", "long": 900},
    {"id": "M16", "site": "eso", "image": "eso0926a", "long": 800},
    {"id": "M17", "site": "eso", "image": "eso1119a", "long": 800},
    {"id": "M20", "site": "eso", "image": "eso0930a", "long": 800},
    {"id": "M27", "site": "noirlab", "image": "noao-m27", "long": 640},
    {"id": "M81", "site": "noirlab", "image": "noao-m81", "long": 800, "centre": True, "galaxy": True},
    {"id": "M110", "site": "noirlab", "image": "noao-m110", "long": 700},
    {"id": "NGC 2403", "site": "noirlab", "image": "iotw2221a", "long": 800, "galaxy": True},
    {"id": "NGC 1316", "site": "eso", "image": "eso0024a", "long": 640},
    {"id": "NGC 5139", "site": "eso", "image": "eso1119b", "long": 800},
    {"id": "M101", "site": "hubble", "image": "heic0602a", "long": 900, "finer": True, "galaxy": True},
]


def fold(text):
    return re.sub(r"\s+", "", text).upper()


# ---------------------------------------------------------------------------------------------------------------- downloads

def raw_dir(args):
    if "--raw" in args:
        return Path(args[args.index("--raw") + 1])
    base = Path(os.environ.get("HOSHI_STARS_BACKUP_DIR", Path.home() / "Projects" / "backups" / "hoshi-stars"))
    return base / "2026-11-10-natural-colour-raw"


def get(address, cache, binary=True):
    """A file from the web, kept in the cache folder (one at a time, politely)."""
    path = cache / (hashlib.sha1(address.encode()).hexdigest()[:16] + (".bin" if binary else ".html"))
    if not path.exists():
        if "--cache-only" in sys.argv:
            raise RuntimeError(f"{address} is not in the cache")
        cache.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(urllib.request.Request(address, headers={"User-Agent": USER_AGENT}), timeout=180) as answer:
            path.write_bytes(answer.read())
        time.sleep(1.0)
    return path.read_bytes() if binary else path.read_text(encoding="utf-8", errors="replace")


def avm(jpeg):
    """The Astronomy Visualization Metadata of a JPEG: the reference position, the original size, the reference pixel, degrees a pixel and the turn, and the credit."""
    start = jpeg.find(b"<?xpacket begin")
    packet = jpeg[start : jpeg.find(b"<?xpacket end", start)].decode("utf-8", "replace")

    def seq(name):
        found = re.search(r"<avm:" + name + r">\s*<rdf:Seq>(.*?)</rdf:Seq>", packet, re.S)
        return [float(x) for x in re.findall(r"<rdf:li>([^<]+)</rdf:li>", found.group(1))]

    credit = re.search(r'photoshop:Credit="([^"]+)"', packet)
    rotation = re.search(r'avm:Spatial.Rotation="([^"]+)"', packet)
    projection = re.search(r'avm:Spatial.CoordsystemProjection="([^"]+)"', packet)
    return {"value": seq("Spatial.ReferenceValue"), "dimension": seq("Spatial.ReferenceDimension"), "pixel": seq("Spatial.ReferencePixel"), "scale": seq("Spatial.Scale"),
            "rotation": float(rotation.group(1)), "projection": projection.group(1) if projection else None, "credit": credit.group(1) if credit else None}


def credit_of(site, text):
    """The credit line of an image as its page prints it."""
    body = re.sub(r"<script.*?</script>|<style.*?</style>", "", text, flags=re.S)
    body = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", body)))
    found = re.search(r"Credit:\s*(.*?)\s*Usage of ", body)
    if found is None:
        raise RuntimeError("no credit line on the page")
    return re.sub(r"\s*/\s*$", "", found.group(1).strip().rstrip("/ ").strip()).replace("#L", "").strip()


# ---------------------------------------------------------------------------------------------------------------- the sky (tangent plane)

RAD = math.pi / 180


def to_std(ra, dec, ra0, dec0):
    """Standard coordinates (east, north) in arc-seconds of sky points about a tangent point."""
    ra, dec = np.asarray(ra) * RAD, np.asarray(dec) * RAD
    d = ra - ra0 * RAD
    denominator = math.sin(dec0 * RAD) * np.sin(dec) + math.cos(dec0 * RAD) * np.cos(dec) * np.cos(d)
    xi = np.cos(dec) * np.sin(d) / denominator
    eta = (math.cos(dec0 * RAD) * np.sin(dec) - math.sin(dec0 * RAD) * np.cos(dec) * np.cos(d)) / denominator
    return xi / RAD * ARCSEC, eta / RAD * ARCSEC


def from_std(xi, eta, ra0, dec0):
    """The sky point (degrees) at standard coordinates (east, north, arc-seconds) about a tangent point."""
    x, y = np.asarray(xi) / ARCSEC * RAD, np.asarray(eta) / ARCSEC * RAD
    rho = np.hypot(x, y)
    c = np.arctan(rho)
    rho = np.where(rho == 0, 1e-300, rho)
    dec = np.arcsin(np.cos(c) * math.sin(dec0 * RAD) + y * np.sin(c) * math.cos(dec0 * RAD) / rho)
    ra = ra0 * RAD + np.arctan2(x * np.sin(c), rho * math.cos(dec0 * RAD) * np.cos(c) - y * math.sin(dec0 * RAD) * np.sin(c))
    return (ra / RAD) % 360, dec / RAD


class Placement:
    """Where a picture lies: pixel (x right, y down, centres at whole numbers, in an image `width` by `height`) to the sky, by a tangent plane about (ra0, dec0).
    The pixel (cx, cy) is at the tangent point; `scale` is arc-seconds a pixel; `rotation` the degrees the picture's top is turned from north toward east (the package's convention)."""

    def __init__(self, ra0, dec0, cx, cy, scale, rotation, width, height):
        self.ra0, self.dec0, self.cx, self.cy, self.scale, self.rotation, self.width, self.height = ra0, dec0, cx, cy, scale, rotation, width, height

    def std_of(self, x, y):
        rho = self.rotation * RAD
        dx, dup = np.asarray(x) - self.cx, -(np.asarray(y) - self.cy)
        east = self.scale * (dx * -math.cos(rho) + dup * math.sin(rho))
        north = self.scale * (dx * math.sin(rho) + dup * math.cos(rho))
        return east, north

    def sky_of(self, x, y):
        return from_std(*self.std_of(x, y), self.ra0, self.dec0)

    def pixel_of(self, ra, dec):
        xi, eta = to_std(ra, dec, self.ra0, self.dec0)
        rho = self.rotation * RAD
        dx = (-xi * math.cos(rho) + eta * math.sin(rho)) / self.scale
        dup = (xi * math.sin(rho) + eta * math.cos(rho)) / self.scale
        return self.cx + dx, self.cy - dup

    def about_centre(self):
        """The same placement as the package's picture rows say it: tangent point at the middle of the image, the turn as the tangent plane there sees it."""
        mx, my = (self.width - 1) / 2, (self.height - 1) / 2
        ra, dec = (float(v) for v in self.sky_of(mx, my))
        # the direction of the picture's top and its scale, seen from the middle
        step = 0.25 * min(self.width, self.height)
        up_ra, up_dec = self.sky_of(mx, my - step)
        right_ra, right_dec = self.sky_of(mx + step, my)
        ue, un = to_std(up_ra, up_dec, ra, dec)
        re_, rn = to_std(right_ra, right_dec, ra, dec)
        rotation = math.degrees(math.atan2(float(ue), float(un))) % 360
        scale = (math.hypot(float(ue), float(un)) + math.hypot(float(re_), float(rn))) / 2 / step
        return Placement(ra, dec, mx, my, scale, rotation, self.width, self.height)


def from_avm(tags, width, height):
    """The release's own placement, for an image `width` by `height` that is a resized copy of the one the tags describe. The tags count pixels from 1 and from the bottom left."""
    factor = width / tags["dimension"][0]
    if abs(height / tags["dimension"][1] - factor) > 0.01 * factor:
        raise RuntimeError("the image's shape is not the shape the tags say")
    cx = (tags["pixel"][0] - 0.5) * factor - 0.5
    cy = (tags["dimension"][1] - tags["pixel"][1] + 0.5) * factor - 0.5
    scale = abs(tags["scale"][1]) * ARCSEC / factor
    return Placement(tags["value"][0], tags["value"][1], cx, cy, scale, (-tags["rotation"]) % 360, width, height)


# ---------------------------------------------------------------------------------------------------------------- the star fit

def field_stars(ra, dec, radius):
    """This package's stars in a patch of sky: right ascension, declination and magnitude, brightest first (scripts/field-stars.ts)."""
    out = subprocess.run(["node", str(ROOT / "scripts" / "field-stars.ts"), f"{ra:.5f}", f"{dec:.5f}", f"{radius:.4f}"], check=True, capture_output=True, text=True, cwd=ROOT).stdout
    return np.array(json.loads(out), dtype=float).reshape(-1, 3)


def detect(image, count=500):
    """The stars in a picture: (x, y, flux) of its brightest point sources, found as peaks over a smooth background and centred by their light."""
    grey = np.asarray(image.convert("L"), dtype=float)
    smooth = ndimage.gaussian_filter(grey, 1.2)
    local = smooth - ndimage.gaussian_filter(grey, 12)
    noise = 1.4826 * np.median(np.abs(local - np.median(local)))
    peaks = (local == ndimage.maximum_filter(local, size=7)) & (local > 6 * noise)
    ys, xs = np.nonzero(peaks)
    order = np.argsort(-local[ys, xs])[: count * 2]
    found = []
    for y, x in zip(ys[order], xs[order]):
        if x < 5 or y < 5 or x >= grey.shape[1] - 5 or y >= grey.shape[0] - 5:
            continue
        window = np.clip(local[y - 3 : y + 4, x - 3 : x + 4], 0, None)
        total = window.sum()
        if total <= 0:
            continue
        gx, gy = np.meshgrid(np.arange(x - 3, x + 4), np.arange(y - 3, y + 4))
        found.append(((window * gx).sum() / total, (window * gy).sum() / total, total))
    found.sort(key=lambda s: -s[2])
    return np.array(found[:count], dtype=float).reshape(-1, 3)


def solve(pairs_xy, pairs_uv):
    """A tangent-plane turn, scale and shift (no reflection) from matched pixel positions and standard coordinates: x = a u - b v + tx, y = b u + a v + ty, least squares."""
    n = len(pairs_xy)
    design = np.zeros((2 * n, 4))
    target = np.zeros(2 * n)
    u, v = pairs_uv[:, 0], pairs_uv[:, 1]
    design[0::2] = np.column_stack([u, -v, np.ones(n), np.zeros(n)])
    design[1::2] = np.column_stack([v, u, np.zeros(n), np.ones(n)])
    target[0::2], target[1::2] = pairs_xy[:, 0], pairs_xy[:, 1]
    solution, *_ = np.linalg.lstsq(design, target, rcond=None)
    return solution


def solve_shift(pairs_xy, pairs_uv, a, b):
    """Only the shift, with the turn and scale given: x = a u - b v + tx, y = b u + a v + ty, the median of what is left over."""
    u, v = pairs_uv[:, 0], pairs_uv[:, 1]
    return np.array([a, b, float(np.median(pairs_xy[:, 0] - (a * u - b * v))), float(np.median(pairs_xy[:, 1] - (b * u + a * v)))])


def fit(image, prior, reach, full=True):
    """Fit our stars to the picture's. `prior` is the AVM placement, which starts the search; `reach` the arc-minutes of sky to take stars from. Returns the fitted placement and its numbers, or None.
    With `full` the turn, scale and shift are all fitted; without it only the shift is, the turn and scale being the release's own (for a field of a few arc-minutes, which holds too few of our stars to fit them)."""
    least = 6 if full else 3
    width, height = image.size
    detected = detect(image)
    cat = field_stars(prior.ra0, prior.dec0, reach)
    if len(detected) < 12 or len(cat) < 8:
        return None, {"matched": 0, "detected": int(len(detected)), "catalogue": int(len(cat))}
    best = None
    for sign in (1, -1):  # the sign of the turn in the tags is the one thing the tags' convention leaves open: both are tried
        trial = Placement(prior.ra0, prior.dec0, prior.cx, prior.cy, prior.scale, (sign * prior.rotation) % 360, width, height)
        px, py = trial.pixel_of(cat[:, 0], cat[:, 1])
        inside = (px > -40) & (px < width + 40) & (py > -40) & (py < height + 40)
        cx_, cy_ = px[inside], py[inside]
        # vote for the shift that brings the most of the catalogue's stars onto detected ones
        dx = (detected[:, 0][:, None] - cx_[None, :]).ravel()
        dy = (detected[:, 1][:, None] - cy_[None, :]).ravel()
        span = 0.12 * max(width, height)
        keep = (np.abs(dx) < span) & (np.abs(dy) < span)
        if keep.sum() == 0:
            continue
        histogram, xe, ye = np.histogram2d(dx[keep], dy[keep], bins=int(2 * span / 3), range=[[-span, span], [-span, span]])
        histogram = ndimage.uniform_filter(histogram, 3)
        i, j = np.unravel_index(np.argmax(histogram), histogram.shape)
        shift = ((xe[i] + xe[i + 1]) / 2, (ye[j] + ye[j + 1]) / 2)
        score = histogram[i, j]
        if best is None or score > best[0]:
            best = (score, sign, shift)
    if best is None:
        return None, {"matched": 0, "detected": int(len(detected)), "catalogue": int(len(cat))}
    _, sign, shift = best
    ra0, dec0 = prior.ra0, prior.dec0
    xi, eta = to_std(cat[:, 0], cat[:, 1], ra0, dec0)
    uv = np.column_stack([xi, eta])
    rho = ((sign * prior.rotation) % 360) * RAD
    a0, b0 = -math.cos(rho) / prior.scale, -math.sin(rho) / prior.scale
    params = np.array([a0, b0, prior.cx + shift[0], prior.cy + shift[1]])
    matched = None
    for radius in (6.0, 4.0, 3.0, 2.0, 1.5, 1.2, 1.0, 1.0):
        x = params[0] * uv[:, 0] - params[1] * uv[:, 1] + params[2]
        y = params[1] * uv[:, 0] + params[0] * uv[:, 1] + params[3]
        inside = (x > 4) & (x < width - 4) & (y > 4) & (y < height - 4)
        index = np.nonzero(inside)[0]
        if len(index) < least:
            return None, {"matched": 0, "detected": int(len(detected)), "catalogue": int(len(cat))}
        distance = np.hypot(detected[:, 0][None, :] - x[index][:, None], detected[:, 1][None, :] - y[index][:, None])
        nearest = distance.argmin(1)
        close = distance[np.arange(len(index)), nearest] <= radius
        # each detected star is taken once, by its nearest catalogue star
        taken = {}
        for k in np.nonzero(close)[0]:
            s = nearest[k]
            if s not in taken or distance[k, s] < distance[taken[s], s]:
                taken[s] = k
        pairs = [(index[k], s) for s, k in taken.items()]
        if len(pairs) < least:
            return None, {"matched": len(pairs), "detected": int(len(detected)), "catalogue": int(len(cat))}
        ci = np.array([p[0] for p in pairs])
        di = np.array([p[1] for p in pairs])
        params = solve(detected[di][:, :2], uv[ci]) if full else solve_shift(detected[di][:, :2], uv[ci], a0, b0)
        matched = (ci, di)
    ci, di = matched
    x = params[0] * uv[ci, 0] - params[1] * uv[ci, 1] + params[2]
    y = params[1] * uv[ci, 0] + params[0] * uv[ci, 1] + params[3]
    residual = np.hypot(detected[di, 0] - x, detected[di, 1] - y)
    # a last pass without the worst fifth (with only a few stars, without the worst one)
    good = residual <= (np.percentile(residual, 85) if len(residual) >= 8 else residual.max()) + 1e-9
    if len(residual) < 8 and len(residual) > least:
        good = residual < residual.max()
    params = solve(detected[di][good][:, :2], uv[ci][good]) if full else solve_shift(detected[di][good][:, :2], uv[ci][good], a0, b0)
    x = params[0] * uv[ci, 0] - params[1] * uv[ci, 1] + params[2]
    y = params[1] * uv[ci, 0] + params[0] * uv[ci, 1] + params[3]
    residual = np.hypot(detected[di, 0] - x, detected[di, 1] - y)
    scale = 1 / math.hypot(params[0], params[1])
    rotation = (math.degrees(math.atan2(params[1], params[0])) + 180) % 360
    placement = Placement(ra0, dec0, params[2], params[3], scale, rotation, width, height)
    kept = residual[good]
    return placement, {"matched": int(good.sum()), "detected": int(len(detected)), "catalogue": int(len(cat)), "rmsPixels": float(math.sqrt((kept**2).mean())), "rmsArcsec": float(math.sqrt((kept**2).mean()) * scale), "turnSign": sign}


def agree(image, placement, reach, radius=3.0):
    """How well a placement puts our stars on the picture's: how many of our stars inside the picture have a detected star within `radius` pixels, and the median offset of those, in pixels."""
    width, height = image.size
    detected = detect(image)
    cat = field_stars(placement.ra0, placement.dec0, reach)
    if len(detected) == 0 or len(cat) == 0:
        return {"inside": 0, "near": 0, "medianPixels": None}
    x, y = placement.pixel_of(cat[:, 0], cat[:, 1])
    inside = np.nonzero((x > 4) & (x < width - 4) & (y > 4) & (y < height - 4))[0]
    if len(inside) == 0:
        return {"inside": 0, "near": 0, "medianPixels": None}
    distance = np.hypot(detected[:, 0][None, :] - x[inside][:, None], detected[:, 1][None, :] - y[inside][:, None]).min(1)
    near = distance <= radius
    return {"inside": int(len(inside)), "near": int(near.sum()), "medianPixels": float(np.median(distance[near])) if near.any() else None}


# ---------------------------------------------------------------------------------------------------------------- the picture

def to_rgba(rgb, feather=0.04, sky_percent=15, gain=1.15, wide_share=0.14):
    """RGB (0 to 1) into the picture: alpha is `gain` times the brightness (to 1; a little over 1, so that a galaxy's light is not seen through, and no more, so that the dark sky of the photograph darkens little of what lies under it), the colour is divided by it, and the edges fade, so over black it is the photograph's light and nothing else.
    The sky of the photograph is taken off first (the faintest `sky_percent` in 100 of what it holds, a channel at a time), so that where a mosaic's data ends the sky it held does not end in a step; and the fade follows the edge of the
    data as well as the edge of the picture, over `wide_share` (0.14) of the smaller side: a mosaic's tiles do not end in a straight line, and a photograph's own square edge must not show against what is under it."""
    height, width = rgb.shape[:2]
    footprint = ndimage.binary_opening(rgb.max(-1) > 0.02, iterations=2)
    footprint = ndimage.binary_fill_holes(footprint)
    edge = max(2, int(min(width, height) * feather))
    wide = max(edge, int(min(width, height) * wide_share))
    inside = ndimage.distance_transform_edt(np.pad(footprint, 1, constant_values=False))[1:-1, 1:-1]
    ramp = np.clip(inside / wide, 0, 1)
    window = ramp * ramp * (3 - 2 * ramp)
    window = window * window * (3 - 2 * window)
    sky = np.array([np.percentile(rgb[..., c][footprint], sky_percent) if footprint.any() else 0.0 for c in range(3)])
    cleaned = np.clip((rgb - sky) / (1 - sky), 0, 1)
    light = cleaned * window[..., None]
    alpha = np.clip(light.max(-1) * gain, 0, 1)
    colour = np.clip(light / np.maximum(alpha, 1e-6)[..., None], 0, 1)
    colour = np.where(alpha[..., None] > 1e-4, colour, cleaned)
    # where the picture is nearly clear its colour barely shows, and a boosted noise costs bytes: there the colour is the smoothed colour of what is round it
    weight = ndimage.gaussian_filter(alpha, 3)
    blurred = np.stack([ndimage.gaussian_filter(colour[..., c] * alpha, 3) for c in range(3)], -1) / np.maximum(weight, 1e-6)[..., None]
    mix = np.clip(alpha * 1.5, 0, 1)[..., None]
    colour = np.clip(colour * mix + blurred * (1 - mix), 0, 1)
    return Image.fromarray((np.clip(np.dstack([colour, alpha]), 0, 1) * 255 + 0.5).astype(np.uint8), "RGBA")


def encode(image, path):
    """Saves the picture as WebP at the best quality that keeps the file within BUDGET_BYTES, then with fewer pixels if it must. Returns the image as saved."""
    for shrink in (1.0, 0.92, 0.85, 0.78, 0.7, 0.62, 0.55):
        size = (max(64, round(image.width * shrink)), max(64, round(image.height * shrink)))
        smaller = image if size == image.size else image.resize(size, Image.LANCZOS)
        for quality in (80, 72, 65, 58, 50):
            smaller.save(path, "WEBP", quality=quality, method=6, alpha_quality=max(60, quality))
            if path.stat().st_size <= BUDGET_BYTES:
                return smaller, quality
    raise RuntimeError(f"{path.name} is {path.stat().st_size} bytes at the lowest setting")


def measure_galaxy(light, placement, obj):
    """Where the galaxy is in the picture itself, from its light and not from the placement: the centre of the bright inner part (the light above 45% of the way from the sky to the peak, stars taken out by a median), and the position angle
    of the disc, which is the angle at which the catalogue's own ellipse (its major and minor axes, a falling light) best correlates with the picture's light. The outer disc is wider than a photograph that holds only its middle,
    so the moments of the light would lean to the frame's diagonal and the inner part of M31 turns from the outer disc: the model fit is the measure that does neither. Returns (right ascension, declination, position angle
    east of north in degrees 0 up to 180, the share of the picture the bright part holds)."""
    grey = light.mean(-1)
    height, width = grey.shape
    smooth = ndimage.gaussian_filter(ndimage.median_filter(ndimage.gaussian_filter(grey, 1.0), size=max(3, round(width / 140) | 1)), max(2, width / 110))
    sky, peak = np.percentile(smooth, 20), np.percentile(smooth, 99.8)
    level = sky + 0.45 * (peak - sky)
    labels, count = ndimage.label(smooth > level)
    if count == 0:
        return None
    middle = labels[height // 2, width // 2]
    if middle == 0:
        middle = 1 + int(np.argmax(ndimage.sum(smooth > level, labels, range(1, count + 1))))
    mask = labels == middle
    ys, xs = np.nonzero(mask)
    weights = smooth[ys, xs] - level
    mx, my = (weights * xs).sum() / weights.sum(), (weights * ys).sum() / weights.sum()
    ra, dec = placement.sky_of(mx, my)
    angle = None
    if obj["major"] is not None and obj["minor"] is not None:
        yy, xx = np.mgrid[0:height, 0:width]
        east, north = placement.std_of(xx, yy)
        east, north = (east - float(placement.std_of(mx, my)[0])) / 60, (north - float(placement.std_of(mx, my)[1])) / 60
        best = None
        centred = smooth - smooth.mean()
        for pa in np.arange(0, 180, 0.5):
            th = math.radians(pa)
            u = east * math.sin(th) + north * math.cos(th)
            v = -east * math.cos(th) + north * math.sin(th)
            model = np.exp(-3 * np.sqrt((u / (obj["major"] / 2)) ** 2 + (v / (obj["minor"] / 2)) ** 2))
            model = model - model.mean()
            score = (model * centred).sum() / math.sqrt((model * model).sum() * (centred * centred).sum())
            if best is None or score > best[0]:
                best = (score, pa)
        angle = best[1]
    return float(ra), float(dec), angle, float(mask.mean())


def object_table():
    """Every deep-sky object's id, position and, where it has them, its size and angle: read from the package itself, by node."""
    script = (
        "import { deepSkyObject } from './src/deep-sky-ngc-ic.ts'; import { deepSkyShape } from './src/deep-sky-shape-ngc-ic.ts';"
        "const out = {}; for (const id of %s) { const o = deepSkyObject(id); const s = deepSkyShape(o); out[id] = { ra: o.rightAscension, dec: o.declination, major: s.majorArcmin ?? null, minor: s.minorArcmin ?? null, pa: s.positionAngle ?? null }; }"
        "console.log(JSON.stringify(out));" % json.dumps([p["id"] for p in PICTURES])
    )
    return json.loads(subprocess.run(["node", "--input-type=module", "-e", script], check=True, capture_output=True, text=True, cwd=ROOT).stdout)


def make(spec, objects, cache):
    site = SITES[spec["site"]]
    page_text = get(site["page"].format(id=spec["image"]), cache, binary=False)
    page_credit = credit_of(spec["site"], page_text)
    jpeg = get(site["file"].format(id=spec["image"], variant=spec.get("variant", "screen")), cache)
    tags = avm(jpeg)
    # the credit line is the one in the image's own metadata where it has one (the same words as the page's, without the page's spacing), else the page's; ESA/Hubble's carry the release's name after it
    credit = re.sub(r"\)(?=[A-Z])", ") ", re.sub(r"\s*/\s*$", "", " ".join(html.unescape(tags["credit"] or "").split())))
    credit = (credit + " (ESA/Hubble)") if credit and spec["site"] == "hubble" else (credit or page_credit)
    if tags["projection"] != "TAN":
        raise RuntimeError(f"{spec['image']}: not a tangent-plane image")
    image = Image.open(io.BytesIO(jpeg)).convert("RGB")
    width, height = image.size
    prior = from_avm(tags, width, height)
    reach = 0.5 * math.hypot(width, height) * prior.scale / 60 / 60 * 1.1
    found, numbers = fit(image, prior, reach)
    avm_centre = prior.about_centre()
    if found is not None and numbers["matched"] >= 8 and numbers["rmsPixels"] <= 1.5:
        placement, how = found, "fit"
    else:
        # too few of our stars to fit the turn and the scale: fit the shift alone from what there are (the release's own turn and scale kept), else keep the release's placement
        shifted, small = fit(image, prior, reach, full=False)
        if shifted is not None and small["matched"] >= 3 and small["rmsPixels"] <= 1.2:
            placement, how, numbers = shifted, "shift", small
        else:
            placement, how = prior, "avm"
    # the difference between the placement used and the tags, at the middle of the picture, in arc-seconds
    fitted_centre = placement.about_centre()
    ex, ey = to_std(fitted_centre.ra0, fitted_centre.dec0, avm_centre.ra0, avm_centre.dec0)
    numbers.update({"agree": agree(image, placement, reach), "placement": how, "avmShiftArcsec": float(math.hypot(ex, ey)), "avmScale": prior.scale, "fitScale": placement.scale, "avmRotation": prior.rotation, "fitRotation": placement.rotation})
    obj = objects[spec["id"]]
    # the box of the photograph the picture is cut from, in this image's pixels
    box = (0, 0, width, height)
    if spec.get("centre"):
        ox, oy = placement.pixel_of(obj["ra"], obj["dec"])
        half_w = min(ox, width - 1 - ox)
        half_h = min(oy, height - 1 - oy)
        # a box about the object, axis-aligned in the picture's pixels; as large as the photograph allows
        box = (int(round(ox - half_w)), int(round(oy - half_h)), int(round(ox + half_w)) + 1, int(round(oy + half_h)) + 1)
    crop = image.crop(box)
    cw, ch = crop.size
    factor = spec["long"] / max(cw, ch)
    size = (max(64, round(cw * factor)), max(64, round(ch * factor)))
    small = crop.resize(size, Image.LANCZOS)
    rgb = np.asarray(small, dtype=np.float64) / 255
    rgba = to_rgba(rgb, sky_percent=spec.get("sky", 15))
    # the placement of the saved picture, after any shrinking in encode, is made from the cut box: its middle and its pixel scale
    cut = Placement(placement.ra0, placement.dec0, placement.cx - box[0], placement.cy - box[1], placement.scale, placement.rotation, cw, ch)
    return {"spec": spec, "credit": credit, "numbers": numbers, "rgb": rgb, "image": rgba, "cut": cut, "address": site["page"].format(id=spec["image"]), "box": box, "size": (cw, ch), "object": obj}


def pid(spec):
    """The picture's id: the object's own id for the widest picture of it, and the object's id and the image's for a finer picture of part of it (drawn over the wide one)."""
    return f"{spec['id']}-{spec['image']}" if spec.get("finer") else spec["id"]


def file_of(ident):
    return ident.replace(" ", "-") + ".webp"


def galaxy_numbers(made):
    """For a galaxy: the centre and angle measured in the saved picture, and the catalogue's, so the test can hold the one to the other."""
    obj = made["object"]
    saved = made["saved"]
    rgba = np.asarray(saved, dtype=np.float64) / 255
    result = measure_galaxy(rgba[..., :3] * rgba[..., 3:4], made["final"], obj)
    if result is None:
        return None
    ra, dec, angle, share = result
    ex, ey = to_std(ra, dec, obj["ra"], obj["dec"])
    return {"measuredRa": round(ra, 5), "measuredDec": round(dec, 5), "measuredPositionAngle": angle, "brightShare": round(share, 3), "catalogueRa": obj["ra"], "catalogueDec": obj["dec"], "cataloguePositionAngle": obj["pa"],
            "centreOffsetArcmin": round(float(math.hypot(ex, ey)) / 60, 2)}


def corners_of(final):
    """The corners of the saved picture (top left, top right, bottom right, bottom left) as the fitted placement puts them, before the index rounds it, in degrees [right ascension, declination]: what pictureCorners must give, to a pixel."""
    w, h = final.width, final.height
    return [[round(float(v), 6) for v in final.sky_of(x - 0.5, y - 0.5)] for x, y in ((0, 0), (w, 0), (w, h), (0, h))]


def main():
    args = sys.argv[1:]
    only = {fold(x) for x in args[args.index("--only") + 1].split(",")} if "--only" in args else None
    cache = raw_dir(args)
    dry = "--dry" in args
    objects = object_table()
    OUT.mkdir(exist_ok=True)
    if "--feather-finer" in args:
        feather_finer(json.loads(MANIFEST.read_text(encoding="utf-8")))
        return
    specs = [p for p in PICTURES if only is None or fold(p["id"]) in only]
    done = []
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8")) if MANIFEST.exists() else {}
    for spec in specs:
        print(f"{spec['id']}: {spec['site']} {spec['image']}")
        made = make(spec, objects, cache)
        n = made["numbers"]
        print(f"  placement {n['placement']}: matched {n.get('matched')}/{n.get('detected')} detected, {n.get('catalogue')} ours; rms {n.get('rmsArcsec', float('nan')):.2f} arcsec; fit differs from the tags by {n['avmShiftArcsec']:.1f} arcsec, scale {n['avmScale']:.4f} vs {n['fitScale']:.4f}, turn {n['avmRotation']:.3f} vs {n['fitRotation']:.3f}")
        path = OUT / file_of(pid(spec))
        if dry:
            continue
        saved, quality = encode(made["image"], path)
        # saved is a resized copy of the cut box: the placement of what is saved
        cut = made["cut"]
        factor = saved.width / cut.width
        final = Placement(cut.ra0, cut.dec0, (cut.cx + 0.5) * factor - 0.5, (cut.cy + 0.5) * factor - 0.5, cut.scale / factor, cut.rotation, saved.width, saved.height)
        made["saved"], made["final"] = saved, final
        row = final.about_centre()
        made["row"] = row
        made["quality"] = quality
        entry = {"site": spec["site"], "image": spec["image"], "credit": made["credit"], "address": made["address"], "width": saved.width, "height": saved.height, "bytes": path.stat().st_size, "quality": quality,
                 "centre": [round(row.ra0, 5), round(row.dec0, 5)], "arcsecPerPixel": round(row.scale, 2), "rotation": round(row.rotation, 1), "wcsCorners": corners_of(final),
                 **made["numbers"]}
        if spec.get("galaxy"):
            entry["galaxy"] = galaxy_numbers(made)
            g = entry["galaxy"]
            print(f"  galaxy: bright part's centre off the catalogue's by {g['centreOffsetArcmin']:.2f} arcmin, disc angle {g['measuredPositionAngle']} vs catalogue {g['cataloguePositionAngle']}")
        manifest[pid(spec)] = entry
        done.append(made)
        print(f"  {file_of(pid(spec))}: {saved.width} x {saved.height} px, {row.scale:.2f}\"/px, turn {row.rotation:.2f}, {path.stat().st_size // 1024} kB (quality {quality})")
    if dry or not done:
        return
    MANIFEST.write_text(json.dumps(manifest, indent=1, ensure_ascii=False, sort_keys=True) + "\n", encoding="utf-8")
    write_data(done)
    if "--sheet" in args:
        contact_sheet(done, args[args.index("--sheet") + 1])


FINER_SHARE = 0.14


def feather_finer(natural):
    """The finer ESA/Hubble pictures (`<object>-<release>.webp`) are laid over a wider picture, and their straight edges, where the data of the release ends, show as lines. Fade each one's alpha from the edge of its data over
    FINER_SHARE of its smaller side, with the same soft mask as the photographs: the footprint is where it has any light (closed and filled), the fade is the distance from its edge. Done to the saved file, once: scripts/finer-feathered.json says which have been (make-deep-sky-pictures.py makes them with the narrow fade; run this after it)."""
    done = json.loads(FEATHERED.read_text(encoding="utf-8")) if FEATHERED.exists() else {}
    rows = parse_data()[2]
    for row in rows:
        p = row.split("|")
        if p[0] == p[1] or p[8] != "3" or p[0] in done or p[0] in natural:
            continue
        path = OUT / file_of(p[0])
        image = Image.open(path).convert("RGBA")
        data = np.asarray(image, dtype=np.float64) / 255
        alpha = data[..., 3]
        footprint = ndimage.binary_fill_holes(ndimage.binary_closing(alpha > 0.05, iterations=6))
        inside = ndimage.distance_transform_edt(np.pad(footprint, 1, constant_values=False))[1:-1, 1:-1]
        ramp = np.clip(inside / max(4, min(image.size) * FINER_SHARE), 0, 1)
        window = ramp * ramp * (3 - 2 * ramp)
        window = window * window * (3 - 2 * window)
        data[..., 3] = alpha * window
        faded = Image.fromarray((np.clip(data, 0, 1) * 255 + 0.5).astype(np.uint8), "RGBA")
        before = path.stat().st_size
        saved = None
        for quality in (60, 55, 50, 45, 40):
            faded.save(path, "WEBP", quality=quality, method=6, alpha_quality=quality)
            if path.stat().st_size <= 90_000:
                saved = quality
                break
        if saved is None:
            raise RuntimeError(f"{path.name} is {path.stat().st_size} bytes at the lowest setting")
        done[p[0]] = {"share": FINER_SHARE, "quality": saved}
        print(f"  {p[0]}: faded at its edge, {before // 1024} kB -> {path.stat().st_size // 1024} kB (quality {saved})")
    FEATHERED.write_text(json.dumps(done, indent=1, sort_keys=True) + "\n", encoding="utf-8")


def parse_data():
    text = DATA_OUT.read_text(encoding="utf-8")
    sources_block = re.search(r"export const PICTURE_SOURCES = \[\n(.*?)\n\] as const;", text, re.S).group(1)
    sources = [line.rstrip(",") for line in sources_block.split("\n")]
    rows = re.search(r"export const PICTURE_ROWS = `(.*?)`;", text, re.S).group(1).split("\n")
    head = text[: text.index("/** Where the pictures come from")]
    return head, sources, rows


def source_line(source):
    return "  { " + ", ".join(f"{k}: {json.dumps(source[k], ensure_ascii=False)}" for k in ("name", "colour", "credit", "licence", "page")) + " }"


def write_data(done):
    head, sources, rows = parse_data()
    names = [re.search(r'name: "(.*?)"', s).group(1) for s in sources]
    for made in done:
        source = SITES[made["spec"]["site"]]["source"]
        if source["name"] not in names:
            sources.append(source_line(source))
            names.append(source["name"])
    by_id = {r.split("|")[0]: i for i, r in enumerate(rows)}
    for made in done:
        spec, row = made["spec"], made["row"]
        source = SITES[spec["site"]]["source"]
        line = "|".join([pid(spec), spec["id"], str(round(row.ra0 * 100000)), str(round(row.dec0 * 100000)), str(made["saved"].width), str(made["saved"].height), str(round(row.scale * 100)), str(round(row.rotation * 10)), str(names.index(source["name"])), made["address"].replace("|", "%7C"), made["credit"]])
        if pid(spec) in by_id:
            rows[by_id[pid(spec)]] = line
        else:
            rows.append(line)
    DATA_OUT.write_text(head + "/** Where the pictures come from: what each is called, how its colours are made, who is credited, its licence and its page. */\nexport const PICTURE_SOURCES = [\n" + ",\n".join(sources)
                        + "\n] as const;\n\n/** One picture a line: the survey pictures first, then the finer pictures. */\nexport const PICTURE_ROWS = `" + "\n".join(rows) + "`;\n", encoding="utf-8")
    # NOTICE.md: the table's row of each of these pictures
    text = NOTICE.read_text(encoding="utf-8")
    begin, end = "<!-- pictures:begin -->", "<!-- pictures:end -->"
    table = re.search(re.escape(begin) + r"\n(.*?)\n" + re.escape(end), text, re.S).group(1).split("\n")
    today = date.today().isoformat()
    for made in done:
        spec = made["spec"]
        source = SITES[spec["site"]]["source"]
        mine = f"| pictures/{file_of(pid(spec))} |"
        line = f"{mine} {spec['id']} | {source['name']} | {made['address']} | {made['credit']} | {source['licence']} | {today} |"
        hit = [i for i, r in enumerate(table) if r.startswith(mine)]
        if hit:
            table[hit[0]] = line
        else:
            table.append(line)
    block = begin + "\n" + "\n".join(table) + "\n" + end
    NOTICE.write_text(re.sub(re.escape(begin) + r".*?" + re.escape(end), lambda _: block, text, flags=re.S), encoding="utf-8")
    print(f"{len(done)} pictures written")


def contact_sheet(done, path):
    cell = 400
    columns = 4
    rows = math.ceil(len(done) / columns)
    sheet = Image.new("RGB", (columns * cell, rows * cell), (11, 16, 32))
    for i, m in enumerate(done):
        tile = m["saved"].copy()
        tile.thumbnail((cell - 4, cell - 4))
        sheet.paste(tile, ((i % columns) * cell + 2, (i // columns) * cell + 2), tile)
    sheet.save(path)


if __name__ == "__main__":
    main()
