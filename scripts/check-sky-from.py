#!/usr/bin/env python3
"""Check `skyFrom` (src/sky-from.ts) against astropy: the same stars moved to the same viewpoints in a second, independent way.

For three viewpoints (Rigil Kentaurus, Sirius, Vega) every star the package moves is moved again here with astropy: each star's ICRS position and the distance astropy works out
from its parallax (`Distance(parallax=...)`) give a point in space, the viewpoint's point is subtracted, astropy turns what is left back into right ascension, declination and
distance, and the apparent magnitude is the absolute magnitude plus astropy's distance modulus. The Sun is added at the origin with absolute magnitude 4.83. The answers must agree
with the package's to a micro-arcsecond-ish tolerance and a millionth of a magnitude, and the same stars must be there.

Run by hand, offline once astropy is installed; CI does not run it (it needs Python and astropy):

    python3 -m venv /tmp/hoshi-astropy && /tmp/hoshi-astropy/bin/pip install astropy numpy
    /tmp/hoshi-astropy/bin/python scripts/check-sky-from.py

Needs Node 22.18 or later (it reads the TypeScript source directly). Exits 1 on a difference.
"""
import json
import subprocess
import sys
from pathlib import Path

import astropy.units as u
import numpy as np
from astropy.coordinates import Distance, SkyCoord

ROOT = Path(__file__).resolve().parent.parent
VIEWPOINTS = ["Rigil Kentaurus", "Sirius", "Vega"]
SUN_ABSOLUTE_MAGNITUDE = 4.83
ANGLE_TOLERANCE_ARCSEC = 1e-3
MAGNITUDE_TOLERANCE = 1e-5

DUMP = """
import { skyFrom } from "%s/src/sky-from.ts";
import { starByName, stars } from "%s/src/stars.ts";
const names = %s;
const table = stars().filter((s) => s.parallaxMas > 0).map((s) => ({ hr: s.hr, ra: s.rightAscension, dec: s.declination, parallax: s.parallaxMas, magnitude: s.magnitude, error: s.parallaxErrorMas ?? null }));
const answers = Object.fromEntries(names.map((name) => [name, { hr: starByName(name).hr, sky: skyFrom(name).map((s) => ({ id: s.id, ra: s.rightAscension, dec: s.declination, ly: s.lightYears, magnitude: s.magnitude })) }]));
console.log(JSON.stringify({ table, answers }));
""" % (ROOT, ROOT, json.dumps(VIEWPOINTS))


def main() -> int:
    out = subprocess.run(["node", "--input-type=module", "-e", DUMP], check=True, capture_output=True, text=True).stdout
    data = json.loads(out)
    table = data["table"]
    coords = SkyCoord(
        ra=np.array([s["ra"] for s in table]) * u.deg,
        dec=np.array([s["dec"] for s in table]) * u.deg,
        distance=Distance(parallax=np.array([s["parallax"] for s in table]) * u.mas),
        frame="icrs",
    )
    xyz = coords.cartesian.xyz.to(u.pc).value.T  # one row a star
    m = np.array([s["magnitude"] for s in table])
    absolute = m - Distance(coords.distance).distmod.value
    ids = [f"hr-{s['hr']}" for s in table]
    worst_angle = 0.0
    worst_magnitude = 0.0
    failed = False
    for name, answer in data["answers"].items():
        here = xyz[ids.index(f"hr-{answer['hr']}")]
        offset = xyz - here
        far = np.linalg.norm(offset, axis=1)
        seen = SkyCoord(x=offset[:, 0] * u.pc, y=offset[:, 1] * u.pc, z=offset[:, 2] * u.pc, representation_type="cartesian", frame="icrs").spherical
        expected = {}
        for k, star_id in enumerate(ids):
            if far[k] == 0:
                continue
            expected[star_id] = (seen.lon[k].deg, seen.lat[k].deg, far[k] * 3.261563777, absolute[k] + 5 * np.log10(far[k] / 10))
        # the Sun, at the origin
        sun_offset = -here
        sun_far = np.linalg.norm(sun_offset)
        sun = SkyCoord(x=sun_offset[0] * u.pc, y=sun_offset[1] * u.pc, z=sun_offset[2] * u.pc, representation_type="cartesian", frame="icrs").spherical
        expected["sun"] = (sun.lon.deg, sun.lat.deg, sun_far * 3.261563777, SUN_ABSOLUTE_MAGNITUDE + 5 * np.log10(sun_far / 10))
        got = {s["id"]: s for s in answer["sky"]}
        # the package leaves out the stars nearer than the error of the viewpoint's distance: they are the only ones it may lack
        missing = set(expected) - set(got)
        extra = set(got) - set(expected)
        near = [i for i in missing if expected[i][2] <= 0.5]
        if extra or len(missing) != len(near):
            print(f"{name}: the stars differ: {len(missing)} missing ({sorted(missing)[:5]}), {len(extra)} extra")
            failed = True
        for star_id, (ra, dec, ly, magnitude) in expected.items():
            if star_id not in got:
                continue
            ours = got[star_id]
            d_ra = ((ours["ra"] - ra + 180) % 360) - 180
            angle = np.hypot(d_ra * np.cos(np.radians(dec)), ours["dec"] - dec) * 3600
            worst_angle = max(worst_angle, angle)
            worst_magnitude = max(worst_magnitude, abs(ours["magnitude"] - magnitude))
        sun_ours = got["sun"]
        print(f"{name}: {len(got)} stars, the Sun at {sun_ours['ra'] / 15:.2f} h {sun_ours['dec']:+.1f} deg, magnitude {sun_ours['magnitude']:.2f}, {sun_ours['ly']:.2f} light-years")
    print(f"worst difference: {worst_angle:.2e} arc-seconds, {worst_magnitude:.2e} magnitudes")
    if worst_angle > ANGLE_TOLERANCE_ARCSEC or worst_magnitude > MAGNITUDE_TOLERANCE:
        failed = True
    print("FAILED" if failed else "ok")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
