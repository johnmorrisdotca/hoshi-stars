#!/usr/bin/env python3
"""Write src/data/boundaries.ts: the IAU constellation boundaries, as Roman's table and as closed outlines.

Source: Roman, N. G., 1987, "Identification of a Constellation from a Position", Publications of the Astronomical Society of the Pacific 99, 695;
VizieR catalogue VI/42, file data.dat (357 rows), from Delporte, E., 1930, "Delimitation scientifique des constellations" (Cambridge University
Press), put into electronic form by Barry Rappaport. The table gives the boundaries on the equator and equinox of B1875.0. The catalogue states no
licence; NOTICE.md says so and says it is removed on request. Read on 2026-11-08 from the Harvard VizieR mirror, because the CDS hosts refused the
connection (the same files, https://vizier.cfa.harvard.edu/ftp/cats/VI/42/).

The table is a list of rectangles in (right ascension, declination), south edge and RA range, newest-lowest first: a position is in the first row
whose RA range holds it and whose declination is not below the row's. This script keeps those rows for the lookup, and also works out each
constellation's outline: it cuts the sky into the cells the rows' edges make, gives each cell its constellation, and walks the edges between cells of
different constellations. Every edge lies on a line of constant right ascension or constant declination, so an outline is a closed rectilinear ring
with the constellation on its left as right ascension grows. The ring of a constellation that holds a pole runs once around it.

    python3 -I scripts/make-boundary-data.py                 # fetches data.dat from the Harvard mirror (needs the network)
    python3 -I scripts/make-boundary-data.py --from FILE     # reads a data.dat saved earlier

Neither runs in the test.
"""
import math
import sys
import urllib.request
from pathlib import Path

SOURCE = "https://vizier.cfa.harvard.edu/ftp/cats/VI/42/data.dat"
OUT = Path(__file__).resolve().parent.parent / "src" / "data" / "boundaries.ts"
HOURS = 24.0


def fetch() -> str:
    with urllib.request.urlopen(SOURCE, timeout=120) as response:
        return response.read().decode("ascii")


def parse(text: str) -> list[tuple[float, float, float, str]]:
    rows = []
    for line in text.splitlines():
        if not line.strip():
            continue
        low, up, south, name = line.split()
        rows.append((float(low), float(up), float(south), name))
    return rows


def number(value: float) -> str:
    """A number as short as it can be: 3.5083, 24, -86.1667."""
    text = f"{value:.4f}".rstrip("0").rstrip(".")
    return "0" if text in ("", "-0") else text


def constellation_at(rows, ra: float, dec: float) -> str:
    for low, up, south, name in rows:
        if low <= ra < up and dec >= south:
            return name
    raise SystemExit(f"no constellation for {ra} {dec}")


def outlines(rows) -> dict[str, list[list[tuple[float, float]]]]:
    xs = sorted({0.0, HOURS} | {r[0] for r in rows} | {r[1] for r in rows})
    ys = sorted({-90.0, 90.0} | {r[2] for r in rows})
    n, m = len(xs) - 1, len(ys) - 1
    cell = [[constellation_at(rows, xs[i], ys[j]) for j in range(m)] for i in range(n)]
    # Directed edges, each with the cell on its left: (start, end) with x in hours (24 allowed) and y in degrees.
    edges: dict[str, list[tuple[tuple[float, float], tuple[float, float]]]] = {}
    for i in range(n):
        for j in range(m):
            name = cell[i][j]
            mine = edges.setdefault(name, [])
            if j > 0 and cell[i][j - 1] != name:
                mine.append(((xs[i], ys[j]), (xs[i + 1], ys[j])))
            if j < m - 1 and cell[i][j + 1] != name:
                mine.append(((xs[i + 1], ys[j + 1]), (xs[i], ys[j + 1])))
            if cell[(i + 1) % n][j] != name:
                mine.append(((xs[i + 1], ys[j]), (xs[i + 1], ys[j + 1])))
            if cell[(i - 1) % n][j] != name:
                mine.append(((xs[i], ys[j + 1]), (xs[i], ys[j])))
    result = {}
    for name, mine in edges.items():
        out_of: dict[tuple[float, float], list] = {}
        for edge in mine:
            out_of.setdefault((edge[0][0] % HOURS, edge[0][1]), []).append(edge)
        rings = []
        while any(out_of.values()):
            start = min(k for k, v in out_of.items() if v)
            edge = out_of[start].pop()
            ring = [edge]
            while True:
                key = (edge[1][0] % HOURS, edge[1][1])
                if key == start:
                    break
                options = out_of.get(key, [])
                if len(options) != 1:
                    raise SystemExit(f"{name}: {len(options)} ways out of {key}")
                edge = options.pop()
                ring.append(edge)
            rings.append(ring)
        result[name] = [simplify(ring) for ring in rings]
    return result


def simplify(ring) -> list[tuple[float, float]]:
    """The ring's corners: the start of each edge, plus the end of an edge that stops at 24 h where the next starts at 0 h; straight runs lose their middle points (not at 0 h or 24 h)."""
    points = []
    for k, (a, b) in enumerate(ring):
        points.append(a)
        following = ring[(k + 1) % len(ring)][0]
        if b != following:
            points.append(b)
    keep = []
    for k, p in enumerate(points):
        before, after = points[k - 1], points[(k + 1) % len(points)]
        straight = (before[0] == p[0] == after[0]) or (before[1] == p[1] == after[1] and p[0] not in (0.0, HOURS))
        if not straight:
            keep.append(p)
    first = min(range(len(keep)), key=lambda k: (keep[k][1], keep[k][0]))
    return keep[first:] + keep[:first]


def ring_area(ring) -> float:
    """Steradians: minus the sum of sin(dec) times the change in right ascension along the horizontal edges, plus 2 pi if the ring goes round a pole."""
    total = 0.0
    turn = 0.0
    for k, a in enumerate(ring):
        b = ring[(k + 1) % len(ring)]
        if a[1] == b[1] and a[0] % HOURS != b[0] % HOURS:
            step = (b[0] - a[0]) * math.pi / 12
            total -= math.sin(math.radians(a[1])) * step
            turn += step
    return total + 2 * math.pi * abs(round(turn / (2 * math.pi)))


def main() -> None:
    args = sys.argv[1:]
    if args[:1] == ["--from"]:
        text = Path(args[1]).read_text(encoding="ascii")
    else:
        text = fetch()
    rows = parse(text)
    if len(rows) != 357:
        raise SystemExit(f"expected 357 rows, got {len(rows)}")
    rings = outlines(rows)
    names = sorted({r[3] for r in rows})
    if len(names) != 88:
        raise SystemExit(f"expected 88 constellations, got {len(names)}")
    total = 0.0
    for name in names:
        areas = [ring_area(r) for r in rings[name]]
        if min(areas) <= 0:
            raise SystemExit(f"{name}: a ring with a hole or a wrong turn ({areas})")
        total += sum(areas)
    if abs(total - 4 * math.pi) > 1e-9:
        raise SystemExit(f"the outlines cover {total} sr, not 4 pi")
    row_text = "\n".join(f"{number(a)} {number(b)} {number(c)} {name}" for a, b, c, name in rows)
    ring_text = "\n".join(
        name + "|" + "/".join(" ".join(f"{number(x)},{number(y)}" for x, y in ring) for ring in rings[name]) for name in names
    )
    OUT.write_text(
        f"""// GENERATED by scripts/make-boundary-data.py. Do not edit by hand.
// The IAU constellation boundaries on the equator and equinox of B1875.0, from N. G. Roman (1987), PASP 99, 695 (VizieR VI/42, after Delporte 1930); see NOTICE.md.

/** The 357 rows of Roman's table, in her order. One row: lower right ascension | upper right ascension (hours) | lower (southern) declination (degrees) | constellation. A position is in the first row whose right ascension range holds it and whose declination is at or above the lower one. */
export const BOUNDARY_ROWS = `{row_text}`;

/** The outlines, one constellation a line: abbreviation | rings separated by /. A ring is its corners, `hours,degrees` and spaces between, in order with the constellation to the left as right ascension grows; edges run along a constant right ascension or a constant declination only, and a ring that crosses 0 h goes through 24 h and 0 h as two corners. */
export const BOUNDARY_RINGS = `{ring_text}`;
""",
        encoding="utf-8",
    )
    print(f"wrote {OUT}: {len(rows)} rows, {sum(len(r) for r in rings.values())} rings, {sum(len(ring) for r in rings.values() for ring in r)} corners")


if __name__ == "__main__":
    main()
