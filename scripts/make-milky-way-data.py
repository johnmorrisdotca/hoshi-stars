#!/usr/bin/env python3
"""Write src/data/milky-way.ts: a small brightness grid of the Milky Way in galactic coordinates, made from three public sources.

1. Star counts. The SAO Star Catalog (Smithsonian Astrophysical Observatory, 258,944 stars to about visual magnitude 9.3), as NASA's HEASARC serves it
   (table sao, https://heasarc.gsfc.nasa.gov/W3Browse/star-catalog/sao.html). The catalogue states no licence: it is used with credit, and removed on request (NOTICE.md).
   The stars of visual magnitude 7.0 to 9.0 are counted on an equal-area grid (equal steps in longitude and in the sine of the latitude, so every cell has the same
   area). The catalogue's depth differs from one declination zone to the next, so each star is weighted by the density of the stars in its declination band
   at galactic latitudes over 40 degrees, where the sky is empty of Milky Way: what is left is the count compared with the same zone's own sky background.
2. Dust. The IRAS Sky Survey Atlas 100 micron map (NASA/IPAC, public domain), as NASA's SkyView serves it, https://skyview.gsfc.nasa.gov, survey "IRAS 100".
   Where the atlas has holes (ISSA left some unobserved strips) COBE DIRBE's zodi-subtracted 100 micron map (the COBE Team, NASA, public domain, SkyView
   survey "COBE DIRBE/ZSMA") fills them. The dust lanes of a photograph are dark because dust in front of the stars is thick: the 100 micron glow of that dust,
   compared with the dust glow of its surroundings, says where the lanes are.
3. The bright core. The bulge toward Sagittarius is deeper than the SAO stars go, so it is added as a smooth shape from the published size of the Galactic bulge,
   our own figures (see BULGE below).

The three are put together as: brightness = (stars + bulge) * exp(-dust). The grid is then cut to galactic latitudes within 30 degrees, set to 32 levels and written as
packed 5-bit numbers (base64). Nothing here is a picture of the sky: no image is read, copied or traced.

    python3 -I scripts/make-milky-way-data.py                       # downloads what it needs into a temporary folder (needs the network), writes src/data/milky-way.ts
    python3 -I scripts/make-milky-way-data.py --cache DIR           # keeps the downloads in DIR for the next run
    python3 -I scripts/make-milky-way-data.py --preview DIR         # also writes PNG previews to DIR
    python3 -I scripts/make-milky-way-data.py --no-sao              # the fallback without the SAO star counts: writes data-no-sao/milky-way.ts (MODULES-780)
    python3 -I scripts/make-milky-way-data.py --no-sao --out src/data/milky-way.ts   # the same, written where the package reads it: this is the one change that swaps it in

The fallback (--no-sao) builds the grid without any star catalogue, from the dust above, our own bulge and disk below, and in place of the star counts COBE DIRBE's
zodi-subtracted mission average at 1.25 micron (the COBE Team, NASA Goddard; LAMBDA, https://lambda.gsfc.nasa.gov/data/cobe/dirbe/zsma/DIRBE_BAND1A_ZSMA.FITS), which is the
starlight of the Galaxy itself, seen through the same dust at a wavelength the dust dims less. Its bright single stars are removed (they are spikes one or two pixels wide)
and what is left stands where the counts stood: it says where the Galaxy's stars are thick (the bulge, the disk's glow) and where near dust hides the stars behind it.

Needs only Python 3 and its standard library. It does not run in the test.
"""
import argparse
import base64
import gzip
import math
import struct
import sys
import tempfile
import urllib.request
import zlib
from pathlib import Path

SAO_URL = "https://heasarc.gsfc.nasa.gov/FTP/heasarc/dbase/tdat_files/heasarc_sao.tdat.gz"
SKYVIEW = "https://skyview.gsfc.nasa.gov/cgi-bin/images?Survey={survey}&Position=0,0&Coordinates=Galactic&Projection=Car&Size=360,100&Pixels={w},{h}&Sampler=Clip&Return=FITS"
IRAS_URL = SKYVIEW.format(survey="IRAS+100", w=1440, h=400)
DIRBE_URL = SKYVIEW.format(survey="COBE+DIRBE%2FZSMA", w=720, h=200)
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "src" / "data" / "milky-way.ts"
OUT_NO_SAO = ROOT / "data-no-sao" / "milky-way.ts"
# The fallback's star light: COBE DIRBE's zodi-subtracted mission average at 1.25 micron (band 1A), a table of 393,216 pixels of the COBE sky cube (NASA LAMBDA).
DIRBE_NIR_URL = "https://lambda.gsfc.nasa.gov/data/cobe/dirbe/zsma/DIRBE_BAND1A_ZSMA.FITS"

STEP = 0.5  # degrees: the working grid, 720 by 180 for galactic latitudes within 45 degrees
NL = int(360 / STEP)
HALF = 45.0
NB = int(2 * HALF / STEP)
OUT_L = 1.0  # degrees of galactic longitude in one stored column
OUT_B = 0.5  # degrees of galactic latitude in one stored row
OUT_HALF = 30.0  # stored latitudes run from -30 to +30 degrees
LEVELS = 31  # stored values 0..31

# SAO stars used and the high latitude that gives each declination band its own background
V_LOW, V_HIGH = 7.0, 9.0
BACKGROUND_B = 40.0
# Galactic pole of the J2000 equator (IAU): right ascension and declination of the north pole, and the longitude of the north celestial pole
GP_RA, GP_DEC, GP_L = math.radians(192.85948), math.radians(27.12825), math.radians(122.93192)

# Smoothing (degrees, one sigma) of the star counts and of the dust map's large-scale part
SIGMA_STARS = 1.2
SIGMA_STARS_AROUND, SIGMA_STARS_AROUND_B = 8.0, 1.5  # the counts are compared with the plane in the same longitudes, not with the sky above and below
SHORT_FLOOR, SHORT_CEIL, SHORT_POWER = 0.25, 1.15, 1.6
SIGMA_DUST_BACKGROUND = 2.0
SIGMA_DUST_SOFT = 0.35

# Combining. The glow of the stars is the count ratio's excess over the background raised to GLOW_POWER; the bulge is a Gaussian
# (our own figures, from the Galactic bulge's size on the sky: some 10 degrees along the plane and 5 across); the dust darkens by exp(-DUST_K * excess).
GLOW_POWER = 1.4
SIGMA_PROFILE = 6.0  # degrees of longitude over which the ridge amplitude and height are smoothed
H_LOW, H_HIGH = 2.0, 4.5  # degrees: the range the ridge height may take
DISK_SUN, DISK_SCALE = 8.2, 2.6  # kpc: the Sun's distance from the Galactic centre, and the stellar disk's scale length (published values, rounded)
DISK_POWER, COUNT_POWER = 0.32, 0.4
SIGMA_NEIGHBOURHOOD = 25.0
BULGE = {"l": 0.0, "b": 0.0, "sigma_l": 7.0, "sigma_b": 3.0, "weight": 0.9}
DUST_K, DUST_FLOOR, DUST_CEIL = 4.0, -0.15, 0.5
TONE = 0.45  # stored level = LEVELS * brightness ** TONE


def fetch(url: str, dest: Path) -> Path:
    if not dest.exists():
        print(f"fetching {url}", file=sys.stderr)
        request = urllib.request.Request(url, headers={"User-Agent": "hoshi-stars-data/1 (+https://github.com/johnmorrisdotca/hoshi-stars)"})
        with urllib.request.urlopen(request, timeout=900) as r:
            body = r.read()
        if dest.suffix.lower() in (".fits", ".gz") and not (body[:6] == b"SIMPLE" or body[:2] == b"\x1f\x8b"):
            raise SystemExit(f"{url} did not return a data file (the server said: {body[:200]!r}); try again later")
        dest.write_bytes(body)
    return dest


def galactic(ra: float, dec: float) -> tuple[float, float]:
    """Galactic longitude and latitude, degrees, from J2000 right ascension and declination, degrees."""
    ra, dec = math.radians(ra), math.radians(dec)
    sb = math.sin(dec) * math.sin(GP_DEC) + math.cos(dec) * math.cos(GP_DEC) * math.cos(ra - GP_RA)
    y = math.cos(dec) * math.sin(ra - GP_RA)
    x = math.sin(dec) * math.cos(GP_DEC) - math.cos(dec) * math.sin(GP_DEC) * math.cos(ra - GP_RA)
    return math.degrees(GP_L - math.atan2(y, x)) % 360, math.degrees(math.asin(max(-1, min(1, sb))))


def read_sao(path: Path) -> list[tuple[float, float, float]]:
    """(right ascension, declination, visual magnitude) of every SAO star that has a magnitude, J2000, degrees."""
    stars = []
    started = False
    with gzip.open(path, "rt", encoding="latin-1") as f:
        for line in f:
            if not started:
                started = line.startswith("<DATA>")
                continue
            if line.startswith("<END>"):
                break
            p = line.split("|")
            try:
                stars.append((float(p[1]), float(p[5]), float(p[13])))
            except ValueError:
                continue
    return stars


def gaussian(sigma: float) -> tuple[list[float], int]:
    k = max(1, int(3 * sigma + 0.999))
    w = [math.exp(-0.5 * (x / sigma) ** 2) for x in range(-k, k + 1)]
    s = sum(w)
    return [x / s for x in w], k


def smooth(grid: list[list[float]], sigma_deg: float, weights: list[list[float]] | None = None, sigma_b: float | None = None) -> list[list[float]]:
    """Gaussian smoothing of a grid of NB rows (latitude -45 to 45) by NL columns (longitude 0 to 360, wrapping), in degrees on the sky:
    the longitude kernel is widened toward the poles. With `weights`, a weighted mean (cells with no weight are ignored); with `sigma_b`, the latitude sigma differs from the longitude's."""
    wt = weights if weights is not None else [[1.0] * NL for _ in range(NB)]
    num = [[grid[i][j] * wt[i][j] for j in range(NL)] for i in range(NB)]
    tmp_n = [[0.0] * NL for _ in range(NB)]
    tmp_w = [[0.0] * NL for _ in range(NB)]
    for i in range(NB):
        b = -HALF + (i + 0.5) * STEP
        kernel, k = gaussian(max(0.3, sigma_deg / STEP / max(0.2, math.cos(math.radians(b)))))
        rn, rw = num[i], wt[i]
        for j in range(NL):
            sn = sw = 0.0
            for t, x in enumerate(kernel):
                jj = (j + t - k) % NL
                sn += x * rn[jj]
                sw += x * rw[jj]
            tmp_n[i][j], tmp_w[i][j] = sn, sw
    kernel, k = gaussian((sigma_b if sigma_b is not None else sigma_deg) / STEP)
    out = [[0.0] * NL for _ in range(NB)]
    for i in range(NB):
        for j in range(NL):
            sn = sw = 0.0
            for t, x in enumerate(kernel):
                ii = i + t - k
                if 0 <= ii < NB:
                    sn += x * tmp_n[ii][j]
                    sw += x * tmp_w[ii][j]
            out[i][j] = sn / sw if sw > 1e-12 else 0.0
    return out


def star_ratio(stars: list[tuple[float, float, float]]) -> list[list[float]]:
    """The SAO count of stars between V_LOW and V_HIGH compared with the count at galactic latitudes over BACKGROUND_B in the same declination band, on the working grid."""
    used = [(ra, dec) for ra, dec, v in stars if V_LOW <= v < V_HIGH]
    bands = 90  # declination bands two degrees wide
    # the area of each band that lies beyond the background latitude, found on an equal-area grid of cells half a degree square (0.25 square degrees)
    cell = 0.25
    area = [0.0] * bands
    for i in range(int(2 / math.radians(STEP))):
        dec = math.degrees(math.asin(-1 + (i + 0.5) * math.radians(STEP)))
        band = min(bands - 1, int((dec + 90) / 2))
        for j in range(NL):
            if abs(galactic((j + 0.5) * STEP, dec)[1]) > BACKGROUND_B:
                area[band] += cell
    beyond = [0] * bands
    for ra, dec in used:
        if abs(galactic(ra, dec)[1]) > BACKGROUND_B:
            beyond[min(bands - 1, int((dec + 90) / 2))] += 1
    density = [beyond[k] / area[k] if area[k] >= 40 else None for k in range(bands)]
    for k in range(bands):
        if density[k] is None:
            near = [density[x] for d in range(1, bands) for x in (k - d, k + d) if 0 <= x < bands and density[x] is not None][:2]
            density[k] = sum(near) / len(near)
    rows = int(2 / math.radians(STEP))  # latitude rows of an equal-area grid, in the sine of the latitude
    counts = [[0.0] * NL for _ in range(rows)]
    expected = [[0.0] * NL for _ in range(rows)]
    sine = math.radians(STEP)

    def put(ra: float, dec: float, count: float, base: float) -> None:
        l, b = galactic(ra, dec)
        i = min(rows - 1, int((math.sin(math.radians(b)) + 1) / sine))
        j = int(l / STEP) % NL
        counts[i][j] += count
        expected[i][j] += base

    for ra, dec in used:
        put(ra, dec, 1.0, 0.0)
    # what each equatorial cell of 0.25 square degrees would hold if it were at the background of its band
    for i in range(rows):
        dec = math.degrees(math.asin(-1 + (i + 0.5) * sine))
        base = density[min(bands - 1, int((dec + 90) / 2))] * cell
        for j in range(NL):
            put((j + 0.5) * STEP, dec, 0.0, base)
    # resample the equal-area rows onto equal steps of latitude
    num = [[0.0] * NL for _ in range(NB)]
    den = [[0.0] * NL for _ in range(NB)]
    for i in range(NB):
        b = -HALF + (i + 0.5) * STEP
        r = min(rows - 1, int((math.sin(math.radians(b)) + 1) / sine))
        for j in range(NL):
            num[i][j], den[i][j] = counts[r][j], expected[r][j]
    return smooth(num, SIGMA_STARS, den)


def read_fits(path: Path, width: int, height: int) -> list[float]:
    data = path.read_bytes()
    start = (data.find(b"END") // 2880 + 1) * 2880
    header = data[:start].decode("ascii", "replace")
    if "BITPIX  =                  -32" not in header or f"NAXIS1  = {width:>20}" not in header or f"NAXIS2  = {height:>20}" not in header:
        raise SystemExit(f"{path} is not the {width} by {height} 32-bit image that was asked for")
    return list(struct.unpack(f">{width * height}f", data[start : start + 4 * width * height]))


def clean(image: list[float], width: int, height: int) -> list[float]:
    """The image with each value that is missing, or far from the middle of the 5 by 5 pixels round it, replaced by that middle."""
    out = list(image)
    for y in range(height):
        for x in range(width):
            near = sorted(v for dy in range(-2, 3) for dx in range(-2, 3) if 0 <= y + dy < height and 0 < (v := image[(y + dy) * width + (x + dx) % width]) < 1e5)
            if not near:
                continue
            middle = near[len(near) // 2]
            v = image[y * width + x]
            if not 0 < v < 1e5 or not middle / 3 < v < middle * 3:
                out[y * width + x] = middle
    return out


def dust_log(iras: list[float], dirbe: list[float]) -> list[list[float]]:
    """log10 of the 100 micron glow on the working grid, with ISSA's holes filled from DIRBE."""
    dirbe = clean(dirbe, 720, 200)
    edge = 50.0

    def at(image: list[float], width: int, size: float, l: float, b: float) -> float | None:
        x = round(width / 2 - 0.5 - (l if l <= 180 else l - 360) / size) % width
        y = round((b + edge) / size - 0.5)
        if not 0 <= y < width * 100 // 360:
            return None
        v = image[y * width + x]
        return v if 0 < v < 1e5 else None

    # DIRBE and ISSA are in different units on SkyView: the ratio of their medians over the plane puts them on one scale
    ratios = []
    for i in range(0, NB, 3):
        for j in range(0, NL, 3):
            l, b = (j + 0.5) * STEP, -HALF + (i + 0.5) * STEP
            a, d = at(iras, 1440, 0.25, l, b), at(dirbe, 720, 0.5, l, b)
            if a is not None and d is not None and abs(b) < 20:
                ratios.append(a / d)
    ratios.sort()
    scale = ratios[len(ratios) // 2]
    grid = [[0.0] * NL for _ in range(NB)]
    filled = 0
    for i in range(NB):
        for j in range(NL):
            l, b = (j + 0.5) * STEP, -HALF + (i + 0.5) * STEP
            parts = [at(iras, 1440, 0.25, l + dl, b + db) for dl in (-STEP / 4, STEP / 4) for db in (-STEP / 4, STEP / 4)]
            d = at(dirbe, 720, 0.5, l, b)
            d = d * scale if d is not None else None
            mean = sum(parts) / 4 if all(p is not None for p in parts) else None
            if mean is not None and (d is None or 0.35 < mean / d < 2.8):
                grid[i][j] = math.log10(mean)
            elif d is not None:
                grid[i][j] = math.log10(d)
                filled += 1
            else:
                grid[i][j] = math.nan
    print(f"dust map: {filled} cells filled from DIRBE (ratio ISSA/DIRBE {scale:.1f})", file=sys.stderr)
    # any cell still without a value takes its neighbours' mean
    for i in range(NB):
        for j in range(NL):
            if math.isnan(grid[i][j]):
                near = [grid[ii][(j + dj) % NL] for ii in (i - 1, i, i + 1) for dj in (-1, 0, 1) if 0 <= ii < NB and not math.isnan(grid[ii][(j + dj) % NL])]
                grid[i][j] = sum(near) / len(near) if near else 1.0
    return grid


def bulge(l: float, b: float) -> float:
    dl = ((l - BULGE["l"] + 180) % 360) - 180
    return BULGE["weight"] * math.exp(-0.5 * ((dl / BULGE["sigma_l"]) ** 2 + ((b - BULGE["b"]) / BULGE["sigma_b"]) ** 2))


def profile(ratio: list[list[float]]) -> tuple[list[float], list[float]]:
    """The star counts' excess over the background as a ridge along the plane, exp(-|b| / h) * a, with the amplitude a and the height h found for each longitude and smoothed along it."""
    near_rows = [i for i in range(NB) if abs(-HALF + (i + 0.5) * STEP) < 4]
    far_rows = [i for i in range(NB) if 6 <= abs(-HALF + (i + 0.5) * STEP) <= 14]
    near = [max(0.02, sum(ratio[i][j] - 1 for i in near_rows) / len(near_rows)) for j in range(NL)]
    far = [max(0.01, sum(ratio[i][j] - 1 for i in far_rows) / len(far_rows)) for j in range(NL)]
    kernel, k = gaussian(SIGMA_PROFILE / STEP)

    def along(v: list[float]) -> list[float]:
        return [sum(x * v[(j + t - k) % NL] for t, x in enumerate(kernel)) for j in range(NL)]

    near, far = along(near), along(far)
    height = [max(H_LOW, min(H_HIGH, 8 / math.log(max(1.05, n / f)))) for n, f in zip(near, far)]
    height = along(height)
    counted = [n * math.exp(2 / h) for n, h in zip(near, height)]
    # The counts are of stars brighter than ninth magnitude, which are mostly near the Sun, so they miss the glow of the inner Galaxy.
    # The amplitude along the plane is a disk's, found by adding up an exponential disk along each line of sight (DISK_*), and the counts
    # change it only by how much each direction is richer or poorer than its neighbourhood within SIGMA_NEIGHBOURHOOD degrees.
    disk = []
    for j in range(NL):
        l = math.radians((j + 0.5) * STEP)
        disk.append(sum(math.exp(-math.sqrt(DISK_SUN**2 + (k * 0.05) ** 2 - 2 * DISK_SUN * k * 0.05 * math.cos(l)) / DISK_SCALE) for k in range(1, 500)))
    kernel, k = gaussian(SIGMA_NEIGHBOURHOOD / STEP)
    around = [sum(x * counted[(j + t - k) % NL] for t, x in enumerate(kernel)) for j in range(NL)]
    top = max(disk)
    amplitude = [(d / top) ** DISK_POWER * (c / a) ** COUNT_POWER for d, c, a in zip(disk, counted, around)]
    return amplitude, height


def combine(ratio: list[list[float]], dust: list[list[float]]) -> list[list[float]]:
    background = smooth(dust, SIGMA_DUST_BACKGROUND)
    soft = smooth(dust, SIGMA_DUST_SOFT)
    amplitude, height = profile(ratio)
    # near dust (the Coalsack is some 600 light-years away) hides the stars behind it, so where the counts fall short of their surroundings the sky is darker
    around = smooth(ratio, SIGMA_STARS_AROUND, sigma_b=SIGMA_STARS_AROUND_B)
    top = max(amplitude)
    out = [[0.0] * NL for _ in range(NB)]
    for i in range(NB):
        b = -HALF + (i + 0.5) * STEP
        for j in range(NL):
            l = (j + 0.5) * STEP
            glow = (amplitude[j] / top * math.exp(-abs(b) / height[j])) ** GLOW_POWER
            excess = max(DUST_FLOOR, min(DUST_CEIL, soft[i][j] - background[i][j]))
            short = max(SHORT_FLOOR, min(SHORT_CEIL, ratio[i][j] / around[i][j])) if around[i][j] > 0.3 else 1.0
            out[i][j] = (glow + bulge(l, b)) * math.exp(-DUST_K * excess) * short**SHORT_POWER
    return out


def store(grid: list[list[float]]) -> list[list[int]]:
    """Cut to the stored latitudes, 1 degree of longitude by 0.5 of latitude, and set to levels 0 to LEVELS."""
    top = max(max(row) for row in grid)
    rows = int(2 * OUT_HALF / OUT_B)
    cols = int(360 / OUT_L)
    first = int((HALF - OUT_HALF) / STEP)
    cells = []
    for r in range(rows):
        i = first + int(r * OUT_B / STEP)
        line = []
        for c in range(cols):
            j = int(c * OUT_L / STEP)
            v = sum(grid[i][(j + t) % NL] for t in range(int(OUT_L / STEP))) / int(OUT_L / STEP) / top
            line.append(max(0, min(LEVELS, round(LEVELS * max(0.0, v) ** TONE))))
        cells.append(line)
    return cells


def encode(cells: list[list[int]]) -> str:
    """Run-length coded 5-bit numbers: a byte is a value (high five bits) and a run length less one (low three bits), 1 to 8 in a row; read row by row from the lowest latitude, longitude 0 first."""
    flat = [v for row in cells for v in row]
    out = bytearray()
    k = 0
    while k < len(flat):
        n = 1
        while k + n < len(flat) and flat[k + n] == flat[k] and n < 8:
            n += 1
        out.append(flat[k] << 3 | (n - 1))
        k += n
    return base64.b64encode(bytes(out)).decode()


# ---------------------------------------------------------------------------------------------------------------------------------------------------------------------
# The fallback (--no-sao): the star light from COBE DIRBE's 1.25 micron map instead of the SAO star counts.
#
# DIRBE's maps are on the COBE sky cube: six square faces (0 the north ecliptic pole, 1 to 4 round the ecliptic at longitudes 0, 90, 180 and 270 degrees, 5 the south pole) of
# 256 by 256 pixels, J2000 ecliptic. The pixel's number is its face times 65,536 plus its column and row bits interleaved (column bit k at bit 2k, row bit k at bit 2k + 1). A pixel's
# place in its face is (x, y) from -1 to 1, and the direction is the face's centre plus xi along the face's x axis and eta along its y axis, with (xi, eta) the polynomial of the cube's
# projection that takes (x, y) to them: E. W. Greisen and M. R. Calabretta, "Representations of celestial coordinates in FITS" (A&A 395, 1077, 2002), section 5.6.2, whose 28
# coefficients P_ij are those below (the paper's text was read on 2026-11-09 and the table compared with this one by program) and whose table of faces gives the axes below. The axes
# were also found without the paper, by laying the cube over SkyView's COBE DIRBE 100 micron map, which is in galactic coordinates, and taking, for each face, the one of the 96 ways
# of putting it down that agreed best: the same six. The polynomial's cells are within 7 percent of equal in area, as the cube's are meant to be.
CUBE_FACES = (
    ((0, 0, 1), (0, 1, 0), (-1, 0, 0)),
    ((1, 0, 0), (0, 1, 0), (0, 0, 1)),
    ((0, 1, 0), (-1, 0, 0), (0, 0, 1)),
    ((-1, 0, 0), (0, -1, 0), (0, 0, 1)),
    ((0, -1, 0), (1, 0, 0), (0, 0, 1)),
    ((0, 0, -1), (0, 1, 0), (1, 0, 0)),
)  # each face: its centre, its x axis, its y axis, as unit vectors in ecliptic coordinates
CUBE_POLY = {
    (0, 0): -0.27292696, (1, 0): -0.07629969, (2, 0): -0.22797056, (3, 0): 0.54852384, (4, 0): -0.62930065, (5, 0): 0.25795794, (6, 0): 0.02584375,
    (0, 1): -0.02819452, (1, 1): -0.01471565, (2, 1): 0.48051509, (3, 1): -1.74114454, (4, 1): 1.71547508, (5, 1): -0.53022337,
    (0, 2): 0.27058160, (1, 2): -0.56800938, (2, 2): 0.30803317, (3, 2): 0.98938102, (4, 2): -0.83180469,
    (0, 3): -0.60441560, (1, 3): 1.50880086, (2, 3): -0.93678576, (3, 3): 0.08693841,
    (0, 4): 0.93412077, (1, 4): -1.41601920, (2, 4): 0.33887446,
    (0, 5): -0.63915306, (1, 5): 0.52032238,
    (0, 6): 0.14381585,
}
ECLIPTIC_OBLIQUITY = math.radians(23.4392911)  # J2000, IAU 2006
CUBE_SIDE = 256
CUBE_ROWS = 6 * CUBE_SIDE * CUBE_SIDE
# Which of a cell's neighbours the bright single stars are measured against, and how far above them a cell may stand: a star in the 1.25 micron map is a spike a cell or two across
NIR_WINDOW_L, NIR_WINDOW_B, NIR_SPIKE = 7, 1, 1.3
NIR_FLOOR_B = 35.0  # degrees: above this latitude the map is the sky's floor (what is not the Galaxy's disk), taken away before the glow is measured
# The 1.25 micron glow stands where the star count ratio stood (a number near 1 off the plane, higher in it), and goes through the same combining unchanged. Its scale is the one choice: the ratio
# the disk's glow (|b| under 4, 30 to 330 degrees of longitude) is given; with 2.0 the profile, the bulge and the lanes come out as the counts' did to within a correlation of 0.95 (docs/research/milky-no-sao.md).
NIR_DISK_RATIO = 2.0


def galactic_axes_in_ecliptic() -> tuple[tuple[float, float, float], tuple[float, float, float], tuple[float, float, float]]:
    """The galactic frame's axes (toward the centre, toward longitude 90, toward the north pole) as unit vectors in J2000 ecliptic coordinates, from the same IAU numbers as `galactic`."""

    def axis(l: float, b: float) -> tuple[float, float, float]:
        l, b = math.radians(l), math.radians(b)
        dec = math.asin(math.sin(b) * math.sin(GP_DEC) + math.cos(b) * math.cos(GP_DEC) * math.cos(GP_L - l))
        ra = GP_RA + math.atan2(math.cos(b) * math.sin(GP_L - l), math.sin(b) * math.cos(GP_DEC) - math.cos(b) * math.sin(GP_DEC) * math.cos(GP_L - l))
        x, y, z = math.cos(dec) * math.cos(ra), math.cos(dec) * math.sin(ra), math.sin(dec)
        return x, y * math.cos(ECLIPTIC_OBLIQUITY) + z * math.sin(ECLIPTIC_OBLIQUITY), -y * math.sin(ECLIPTIC_OBLIQUITY) + z * math.cos(ECLIPTIC_OBLIQUITY)

    return axis(0, 0), axis(90, 0), axis(0, 90)


def read_dirbe_cube(path: Path) -> list[float]:
    """The 393,216 mission-average residual intensities (MJy/sr) of a DIRBE ZSMA file, in pixel order; a pixel DIRBE flagged is nan."""
    data = path.read_bytes()
    cards, at = {}, 0
    for _ in range(2):  # the primary header, then the table's
        while True:
            block = data[at : at + 2880].decode("ascii", "replace")
            at += 2880
            ended = False
            for k in range(0, 2880, 80):
                card = block[k : k + 80]
                if card.startswith("END") and card[3:].strip() == "":
                    ended = True
                    break
                if "=" in card[:10]:
                    cards[card[:8].strip()] = card[10:].split("/")[0].strip().strip("'").strip()
            if ended:
                break
    if cards.get("PIXRESOL") != "9" or cards.get("NAXIS1") != "17" or cards.get("NAXIS2") != str(CUBE_ROWS) or cards.get("TTYPE2") != "Resid":
        raise SystemExit(f"{path} is not a DIRBE ZSMA map at resolution 9 ({cards.get('PIXRESOL')}, {cards.get('NAXIS1')}, {cards.get('NAXIS2')})")
    row = struct.Struct(">ifIBf")  # pixel number, residual, observations, weeks, sigma
    out = []
    for n, (pixel, residual, _, _, _) in enumerate(row.iter_unpack(data[at : at + 17 * CUBE_ROWS])):
        if pixel != n:
            raise SystemExit(f"{path}: row {n} holds pixel {pixel}; the cube is read in pixel order")
        out.append(residual if residual > -16375 else math.nan)
    return out


def cube_directions() -> list[tuple[float, float]]:
    """(xi, eta) of each of the 65,536 pixels of a face, in the order of their numbers inside it."""
    spread = [sum(((x >> k) & 1) << (2 * k) for k in range(8)) for x in range(CUBE_SIDE)]
    place = [(0.0, 0.0)] * (CUBE_SIDE * CUBE_SIDE)
    terms = list(CUBE_POLY.items())

    def chi(xf2: float, yf2: float, xf: float) -> float:
        return xf + xf * (1 - xf2) * sum(c * xf2**i * yf2**j for (i, j), c in terms)

    for iy in range(CUBE_SIDE):
        yf = (iy + 0.5) / (CUBE_SIDE / 2) - 1
        for ix in range(CUBE_SIDE):
            xf = (ix + 0.5) / (CUBE_SIDE / 2) - 1
            place[spread[ix] | spread[iy] << 1] = (chi(xf * xf, yf * yf, xf), chi(yf * yf, xf * xf, yf))
    return place


def dirbe_grid(cube: list[float]) -> list[list[float]]:
    """The DIRBE cube on the working grid (0.5 degree, latitudes within 45 degrees): each pixel shared between the four nearest cells, a cell the mean of what it received."""
    gx, gy, gz = galactic_axes_in_ecliptic()
    place = cube_directions()
    num = [[0.0] * NL for _ in range(NB)]
    den = [[0.0] * NL for _ in range(NB)]
    for f, (centre, ax, ay) in enumerate(CUBE_FACES):
        for p, (xi, eta) in enumerate(place):
            v = cube[f * CUBE_SIDE * CUBE_SIDE + p]
            if math.isnan(v):
                continue
            d = [centre[k] + xi * ax[k] + eta * ay[k] for k in range(3)]
            norm = math.sqrt(d[0] ** 2 + d[1] ** 2 + d[2] ** 2)
            b = math.degrees(math.asin(max(-1.0, min(1.0, (d[0] * gz[0] + d[1] * gz[1] + d[2] * gz[2]) / norm))))
            if abs(b) >= HALF:
                continue
            l = math.degrees(math.atan2(d[0] * gy[0] + d[1] * gy[1] + d[2] * gy[2], d[0] * gx[0] + d[1] * gx[1] + d[2] * gx[2])) % 360
            fi, fj = (b + HALF) / STEP - 0.5, l / STEP - 0.5
            i0, j0 = math.floor(fi), math.floor(fj)
            ti, tj = fi - i0, fj - j0
            for di, wi in ((0, 1 - ti), (1, ti)):
                if 0 <= i0 + di < NB:
                    for dj, wj in ((0, 1 - tj), (1, tj)):
                        num[i0 + di][(j0 + dj) % NL] += wi * wj * v
                        den[i0 + di][(j0 + dj) % NL] += wi * wj
    return [[num[i][j] / den[i][j] if den[i][j] > 0.05 else math.nan for j in range(NL)] for i in range(NB)]


def remove_stars(grid: list[list[float]]) -> list[list[float]]:
    """The grid with each cell that stands more than NIR_SPIKE times above the median of the strip of cells along the plane round it set to that. A single bright star is a spike a cell or
    two across; the Galaxy's own glow changes slowly along the plane, so the strip's median (some 3.5 degrees long) is the glow without the stars."""
    out = [row[:] for row in grid]
    for i in range(NB):
        rows = [grid[ii] for ii in range(max(0, i - NIR_WINDOW_B), min(NB, i + NIR_WINDOW_B + 1))]
        for j in range(NL):
            near = sorted(r[(j + dj) % NL] for r in rows for dj in range(-NIR_WINDOW_L, NIR_WINDOW_L + 1) if not math.isnan(r[(j + dj) % NL]))
            middle = near[len(near) // 2] if near else math.nan
            v = grid[i][j]
            if math.isnan(v) or v > NIR_SPIKE * middle:
                out[i][j] = NIR_SPIKE * middle if not math.isnan(middle) else 0.0
    return out


def nir_ratio(grid: list[list[float]]) -> list[list[float]]:
    """The 1.25 micron glow as a ratio like the star counts', 1 for the sky's floor and NIR_DISK_RATIO for the disk's glow, on the working grid."""
    high = sorted(v for i in range(NB) if abs(-HALF + (i + 0.5) * STEP) > NIR_FLOOR_B for v in grid[i])
    floor = high[len(high) // 2]
    excess = [[max(0.0, v - floor) for v in row] for row in grid]
    disk = sorted(excess[i][j] for i in range(NB) if abs(-HALF + (i + 0.5) * STEP) < 4 for j in range(NL) if 30 <= (j + 0.5) * STEP <= 330)
    reference = disk[len(disk) // 2]
    print(f"1.25 micron map: floor {floor:.3f} MJy/sr, the disk's glow {reference:.3f}", file=sys.stderr)
    return [[1 + (NIR_DISK_RATIO - 1) * v / reference for v in row] for row in excess]


def write_png(path: Path, rows: list[list[int]]) -> None:
    """A grey-scale PNG of rows of 0 to 255 (standard library only)."""

    def chunk(kind: bytes, body: bytes) -> bytes:
        return struct.pack(">I", len(body)) + kind + body + struct.pack(">I", zlib.crc32(kind + body))

    raw = b"".join(b"\x00" + bytes(r) for r in rows)
    path.write_bytes(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", len(rows[0]), len(rows), 8, 0, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


def preview(directory: Path, name: str, grid: list[list[float]], low: float, high: float, columns: int = NL) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    rows = len(grid)
    cols = len(grid[0])
    shown = [[max(0, min(255, int((grid[r][(cols // 2 - c) % cols] - low) / (high - low) * 255))) for c in range(cols) for _ in range(2)] for r in range(rows - 1, -1, -1) for _ in range(3)]
    write_png(directory / f"{name}.png", shown)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--cache", type=Path, default=Path(tempfile.gettempdir()) / "hoshi-milky-way")
    parser.add_argument("--preview", type=Path)
    parser.add_argument("--no-sao", action="store_true", help="build without the SAO star counts: COBE DIRBE 1.25 micron, the dust and our own bulge and disk; writes data-no-sao/milky-way.ts")
    parser.add_argument("--out", type=Path, help="where to write the data (default src/data/milky-way.ts, or data-no-sao/milky-way.ts with --no-sao)")
    args = parser.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)
    if args.no_sao:
        nir = remove_stars(dirbe_grid(read_dirbe_cube(fetch(DIRBE_NIR_URL, args.cache / "DIRBE_BAND1A_ZSMA.FITS"))))
        ratio = smooth(nir_ratio(nir), SIGMA_STARS)
    else:
        stars = read_sao(fetch(SAO_URL, args.cache / "heasarc_sao.tdat.gz"))
        print(f"{len(stars)} SAO stars with a magnitude", file=sys.stderr)
        ratio = star_ratio(stars)
    iras = read_fits(fetch(IRAS_URL, args.cache / "iras100.fits"), 1440, 400)
    dirbe = read_fits(fetch(DIRBE_URL, args.cache / "dirbe-zsma-100.fits"), 720, 200)
    dust = dust_log(iras, dirbe)
    grid = combine(ratio, dust)
    cells = store(grid)
    text = encode(cells)
    if args.preview:
        preview(args.preview, "stars", ratio, 0.8, 3.0)
        preview(args.preview, "dust", dust, 0.7, 3.7)
        preview(args.preview, "combined", grid, 0, max(max(r) for r in grid))
        preview(args.preview, "stored", [[float(v) for v in row] for row in cells], 0, LEVELS)
    out = args.out if args.out is not None else (OUT_NO_SAO if args.no_sao else OUT)
    out.parent.mkdir(parents=True, exist_ok=True)
    if args.no_sao:
        source = "COBE DIRBE 1.25 micron starlight (NASA LAMBDA), the IRAS 100 micron dust map and COBE DIRBE 100 micron (NASA), and a bulge and disk of our own; no star catalogue"
    else:
        source = "SAO star counts (NASA HEASARC), the IRAS 100 micron dust map and COBE DIRBE (NASA), and a bulge of our own"
    out.write_text(
        "// Written by scripts/make-milky-way-data.py" + (" --no-sao" if args.no_sao else "") + ": do not edit by hand.\n"
        f"// The Milky Way's brightness in galactic coordinates. {source}; see NOTICE.md.\n"
        f"export const MILKY_WAY_COLUMNS = {int(360 / OUT_L)};\n"
        f"export const MILKY_WAY_ROWS = {int(2 * OUT_HALF / OUT_B)};\n"
        f"export const MILKY_WAY_LATITUDE = {OUT_HALF};\n"
        f"export const MILKY_WAY_LEVELS = {LEVELS};\n"
        f'export const MILKY_WAY_PACKED = "{text}";\n'
    )
    print(f"wrote {out} ({len(text)} characters)", file=sys.stderr)


if __name__ == "__main__":
    main()
