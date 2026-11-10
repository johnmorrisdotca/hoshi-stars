// The stars of this package in a round patch of sky, as JSON, for the star fit of scripts/make-natural-pictures.py: the Yale stars to magnitude 6.0 and the faint tiles' UCAC4 stars to magnitude 12.
// Nothing from Hipparcos, Tycho or Gaia is read: the fit uses only data this package already passes on (NOTICE.md).
//
//     node scripts/field-stars.ts <right ascension deg> <declination deg> <radius deg> [faintest magnitude, default 12] > stars.json
//
// Output: an array of [right ascension, declination, magnitude] in degrees (J2000), brightest first.
import { readFileSync } from "node:fs";
import process from "node:process";
import { decodeFaintTile, faintStarsIn, faintTilePath, faintTilesFor, type FaintTile } from "../src/faint-core.ts";
import { stars } from "../src/stars.ts";

const [ra, dec, radius, limit] = process.argv.slice(2).map(Number);
if (ra === undefined || dec === undefined || radius === undefined || [ra, dec, radius].some((n) => !Number.isFinite(n))) throw new Error("usage: field-stars.ts <ra> <dec> <radius> [faintest]");
const faintest = limit !== undefined && Number.isFinite(limit) ? limit : 12;
const field = { rightAscension: ra, declination: dec, radius };
const tiles: FaintTile[] = faintTilesFor(field, faintest).map((id) => decodeFaintTile(id, new Uint8Array(readFileSync(new URL(`../faint-tiles/${faintTilePath(id)}`, import.meta.url)))));
const faint = faintStarsIn(tiles, field, faintest).stars.map((s) => [s.rightAscension, s.declination, s.magnitude]);
const rad = Math.PI / 180;
const near = (r: number, d: number): boolean => Math.acos(Math.min(1, Math.sin(dec * rad) * Math.sin(d * rad) + Math.cos(dec * rad) * Math.cos(d * rad) * Math.cos((r - ra) * rad))) / rad <= radius;
const bright = stars({ magnitude: 6 }).filter((s) => near(s.rightAscension, s.declination)).map((s) => [s.rightAscension, s.declination, s.magnitude]);
const all = [...bright, ...faint].sort((a, b) => (a[2] as number) - (b[2] as number));
process.stdout.write(JSON.stringify(all));
