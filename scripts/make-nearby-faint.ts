// Write src/data/nearby-faint.ts: which nearby stars (src/data/nearby.ts, the Yale parallax catalogue's) the faint tiles (faint-tiles/, UCAC4's) also hold, so that a page drawing both counts each star once;
// and src/data/nearby-ucac4.ts: a UCAC4 position, with UCAC4's own error, for the nearby stars on the Yale catalogue's coarse position whose match is sure enough.
//
// Both are at J2000 and epoch 2000: UCAC4's positions are its J2000.0 ICRS positions, a nearby star's is a 2MASS position carried to 2000 by its motion, or the Yale catalogue's carried from 1900 (coarse).
// The positions read here are always the table's own (src/data/nearby.ts), never a UCAC4 position this script gave before, so a second run gives the same answer.
// A faint star is the nearby star when it lies within the window (3 times the nearby star's position error, at least 2 and at most 60 arc-seconds) and its magnitude is within the tolerance of the nearby star's
// (the tile's V or UCAC4's model magnitude, minus the Yale V: -1.5 to +1.5; minus a Yale photographic blue magnitude, which reads fainter than V for a red star: -3.0 to +1.5). Exactly one such faint star: matched.
// Two or more, or one faint star that two nearby stars both take: ambiguous. An ambiguous star is then settled by the nearest pair first: every pair of an ambiguous nearby star and a faint star that fits it, nearest first,
// is a match where neither is taken yet (by a clear match or a nearer pair); an ambiguous star whose faint stars are all taken stays unmatched. None: new (the tiles do not hold it; most are fainter than 12).
// A nearby star with no magnitude is not matched. Only a clear match gives a UCAC4 position (below).
// The tolerances come from the 1,892 nearby stars with a 2MASS position and a single faint star within 3 arc-seconds: 99 in 100 of their differences lie inside them (`--spread` prints the spread).
//
// A coarse star takes the UCAC4 position when its match lies within twice its position error (at least 2 arc-seconds) and the chance that an unrelated faint star of that brightness lies in its window is under
// 1 in 20 (the count of such stars within 15 arc-minutes, times the window's area). The position is then read from UCAC4 itself (NASA/IPAC IRSA's TAP service, table ucac4_sources: the tiles round a position to
// a fraction of an arc-second and keep no error): the one UCAC4 star within 1.5 arc-seconds of the tile's, not of object type 4, 6 or 7 (the same rows make-faint-data.py drops). Its error is UCAC4's own at its
// central epoch carried to 2000 by the error of its proper motion, the larger of the two axes. The answer is kept in .cache/nearby-faint/ (git-ignored), so a second run is offline.
//
//     node scripts/make-nearby-faint.ts             # writes both files (asks IRSA once, then reads the cache)
//     node scripts/make-nearby-faint.ts --offline   # only what the cache holds
//     node scripts/make-nearby-faint.ts --spread    # prints the spread of the magnitude differences and writes nothing
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { NEARBY_ROWS } from "../src/data/nearby.ts";
import { decodeFaintTile, faintTilePath, faintTilesFor, type FaintTile } from "../src/faint-core.ts";
import { nearbyStars } from "../src/nearby.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const TILES = join(ROOT, "faint-tiles");
const CACHE = join(ROOT, ".cache", "nearby-faint");
const OUT = join(ROOT, "src", "data", "nearby-faint.ts");
const OUT_UCAC4 = join(ROOT, "src", "data", "nearby-ucac4.ts");
const TAP = "https://irsa.ipac.caltech.edu/TAP/sync";
const USER_AGENT = "hoshi-stars make-nearby-faint.ts (https://github.com/johnmorrisdotca/hoshi-stars)";

const WINDOW_SIGMAS = 3;
const WINDOW_MIN_ARCSEC = 2;
const WINDOW_MAX_ARCSEC = 60;
const MAGNITUDE: Readonly<Record<string, readonly [number, number]>> = { photoelectric: [-1.5, 1.5], visual: [-1.5, 1.5], blue: [-3.0, 1.5] };
const ADOPT_SIGMAS = 2;
const ADOPT_CHANCE = 0.05;
const DENSITY_RADIUS_DEG = 0.25;
const UCAC4_RADIUS_ARCSEC = 1.5;
const UCAC4_DROP_TYPES = new Set([4, 6, 7]);
const RADIANS = Math.PI / 180;

/** A nearby star as the table holds it: the GCTP number, the position and its error, the magnitude and its kind. */
interface Own {
  gctp: string;
  rightAscension: number;
  declination: number;
  errorArcsec: number;
  coarse: boolean;
  magnitude: number | undefined;
  kind: string | undefined;
}
const kinds = new Map(nearbyStars().map((star) => [star.gctp, star.magnitudeKind]));
const own: Own[] = NEARBY_ROWS.split("\n").map((row) => {
  const p = row.split("|");
  return { gctp: p[0]!, rightAscension: Number(p[7]) / 360000, declination: Number(p[8]) / 360000, errorArcsec: Number(p[9]) / 10, coarse: p[6] === "", magnitude: p[13] === "" ? undefined : Number(p[13]) / 100, kind: kinds.get(p[0]!) };
});

const decoded = new Map<string, FaintTile | null>();
function tile(id: FaintTile["id"]): FaintTile | null {
  const path = faintTilePath(id);
  if (!decoded.has(path)) decoded.set(path, existsSync(join(TILES, path)) ? decodeFaintTile(id, new Uint8Array(readFileSync(join(TILES, path)))) : null);
  return decoded.get(path)!;
}

function arcsec(ra1: number, dec1: number, ra2: number, dec2: number): number {
  const cos = Math.sin(dec1 * RADIANS) * Math.sin(dec2 * RADIANS) + Math.cos(dec1 * RADIANS) * Math.cos(dec2 * RADIANS) * Math.cos((ra1 - ra2) * RADIANS);
  return (Math.acos(Math.min(1, cos)) / RADIANS) * 3600;
}

interface Candidate {
  key: string;
  rightAscension: number;
  declination: number;
  magnitude: number;
  separation: number;
}

/** The faint stars within `radius` arc-seconds of a star, with the key that names one: its decoded position to a millionth of a degree. */
function around(star: Own, radius: number): Candidate[] {
  const found: Candidate[] = [];
  for (const id of faintTilesFor({ rightAscension: star.rightAscension, declination: star.declination, radius: radius / 3600 })) {
    const t = tile(id);
    if (t === null) continue;
    for (let i = 0; i < t.count; i += 1) {
      if (Math.abs(t.declination[i]! - star.declination) * 3600 > radius) continue;
      const separation = arcsec(star.rightAscension, star.declination, t.rightAscension[i]!, t.declination[i]!);
      if (separation <= radius) found.push({ key: `${t.rightAscension[i]!.toFixed(6)},${t.declination[i]!.toFixed(6)}`, rightAscension: t.rightAscension[i]!, declination: t.declination[i]!, magnitude: t.magnitude[i]!, separation });
    }
  }
  return found;
}

const windowOf = (star: Own): number => Math.min(WINDOW_MAX_ARCSEC, Math.max(WINDOW_MIN_ARCSEC, WINDOW_SIGMAS * star.errorArcsec));
const fitsMagnitude = (star: Own, magnitude: number): boolean => {
  const [low, high] = MAGNITUDE[star.kind!]!;
  return magnitude - star.magnitude! >= low && magnitude - star.magnitude! <= high;
};

if (process.argv.includes("--spread")) {
  const spread: Record<string, number[]> = {};
  for (const star of own) {
    if (star.coarse || star.magnitude === undefined) continue;
    const near = around(star, 3);
    if (near.length === 1) (spread[star.kind!] ??= []).push(near[0]!.magnitude - star.magnitude);
  }
  for (const [kind, all] of Object.entries(spread)) {
    const sorted = all.sort((a, b) => a - b);
    const at = (f: number): string => sorted[Math.floor(f * (sorted.length - 1))]!.toFixed(2);
    const [low, high] = MAGNITUDE[kind]!;
    console.log(`${kind}: ${sorted.length} stars; 1, 5, 50, 95 and 99 in 100 at ${[0.01, 0.05, 0.5, 0.95, 0.99].map(at).join(", ")}; inside ${low} to ${high}: ${sorted.filter((d) => d >= low && d <= high).length}`);
  }
  process.exit(0);
}

// ----- the match -----
const picks = new Map<string, Candidate>();
const ambiguous = new Set<string>();
const fitsOf = new Map<string, Candidate[]>();
const takenBy = new Map<string, string[]>();
let noMagnitude = 0;
for (const star of own) {
  if (star.magnitude === undefined) {
    noMagnitude += 1;
    continue;
  }
  const fits = around(star, windowOf(star)).filter((c) => fitsMagnitude(star, c.magnitude));
  fitsOf.set(star.gctp, fits);
  if (fits.length > 1) ambiguous.add(star.gctp);
  if (fits.length !== 1) continue;
  picks.set(star.gctp, fits[0]!);
  takenBy.set(fits[0]!.key, [...(takenBy.get(fits[0]!.key) ?? []), star.gctp]);
}
for (const gctps of takenBy.values()) {
  if (gctps.length < 2) continue;
  for (const gctp of gctps) {
    picks.delete(gctp);
    ambiguous.add(gctp);
  }
}

// the ambiguous ones, nearest pair first
const taken = new Set([...picks.values()].map((c) => c.key));
const settled = new Map<string, Candidate>();
const pairs = [...ambiguous].flatMap((gctp) => (fitsOf.get(gctp) ?? []).map((c) => ({ gctp, c }))).sort((a, b) => a.c.separation - b.c.separation || a.gctp.localeCompare(b.gctp));
for (const { gctp, c } of pairs) {
  if (settled.has(gctp) || taken.has(c.key)) continue;
  settled.set(gctp, c);
  taken.add(c.key);
}

// ----- the coarse stars that take a UCAC4 position -----
/** How many unrelated faint stars of the star's brightness its window can be expected to hold: their count within DENSITY_RADIUS_DEG, times the window's share of that area. */
function chanceOf(star: Own): number {
  let count = 0;
  const radius = DENSITY_RADIUS_DEG * 3600;
  for (const id of faintTilesFor({ rightAscension: star.rightAscension, declination: star.declination, radius: DENSITY_RADIUS_DEG })) {
    const t = tile(id);
    if (t === null) continue;
    for (let i = 0; i < t.count; i += 1) {
      if (Math.abs(t.declination[i]! - star.declination) * 3600 > radius || !fitsMagnitude(star, t.magnitude[i]!)) continue;
      if (arcsec(star.rightAscension, star.declination, t.rightAscension[i]!, t.declination[i]!) <= radius) count += 1;
    }
  }
  return count * (windowOf(star) / radius) ** 2;
}
const adopt = own.filter((star) => star.coarse && picks.has(star.gctp) && picks.get(star.gctp)!.separation <= Math.max(WINDOW_MIN_ARCSEC, ADOPT_SIGMAS * star.errorArcsec) && chanceOf(star) < ADOPT_CHANCE);

async function ucac4Rows(): Promise<string> {
  const saved = join(CACHE, "ucac4.csv");
  const points = adopt.map((star, index) => `<TR><TD>${index}</TD><TD>${picks.get(star.gctp)!.rightAscension}</TD><TD>${picks.get(star.gctp)!.declination}</TD></TR>`).join("");
  const asked = join(CACHE, "asked.txt");
  if (existsSync(saved) && existsSync(asked) && readFileSync(asked, "utf8") === points) return readFileSync(saved, "utf8");
  if (process.argv.includes("--offline")) throw new Error(`--offline, and ${saved} does not hold the answer for these ${adopt.length} stars`);
  const votable = `<?xml version="1.0"?><VOTABLE version="1.3" xmlns="http://www.ivoa.net/xml/VOTable/v1.3"><RESOURCE type="results"><TABLE name="cand"><FIELD name="cid" datatype="long"/><FIELD name="cra" datatype="double" unit="deg"/><FIELD name="cdec" datatype="double" unit="deg"/><DATA><TABLEDATA>${points}</TABLEDATA></DATA></TABLE></RESOURCE></VOTABLE>`;
  const form = new FormData();
  form.set("REQUEST", "doQuery");
  form.set("LANG", "ADQL");
  form.set("FORMAT", "csv");
  form.set("UPLOAD", "cand,param:cand");
  form.set("QUERY", `SELECT c.cid, p.ucac4_id, p.ra, p.dec, p.sigra, p.sigdc, p.cepra, p.cepdc, p.sigpmr, p.sigpmd, p.ojt FROM ucac4_sources AS p, TAP_UPLOAD.cand AS c WHERE CONTAINS(POINT('ICRS',p.ra,p.dec),CIRCLE('ICRS',c.cra,c.cdec,${UCAC4_RADIUS_ARCSEC / 3600}))=1`);
  form.set("cand", new Blob([votable], { type: "text/xml" }), "cand.xml");
  const response = await fetch(TAP, { method: "POST", body: form, headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) throw new Error(`IRSA answered ${response.status}`);
  const text = await response.text();
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(saved, text);
  writeFileSync(asked, points);
  return text;
}

const answer = (await ucac4Rows()).trim().split("\n");
const head = answer[0]!.split(",");
const col = (name: string): number => head.indexOf(name);
const found = new Map<number, string[][]>();
for (const line of answer.slice(1)) {
  const cells = line.split(",");
  if (UCAC4_DROP_TYPES.has(Number(cells[col("ojt")]))) continue;
  const cid = Number(cells[col("cid")]);
  found.set(cid, [...(found.get(cid) ?? []), cells]);
}
const ucac4Lines: string[] = [];
let notFound = 0;
for (const [index, star] of adopt.entries()) {
  const rows = found.get(index) ?? [];
  if (rows.length !== 1) {
    notFound += 1;
    continue;
  }
  const r = rows[0]!;
  const ra = Number(r[col("ra")]);
  const dec = Number(r[col("dec")]);
  // the error at 2000: UCAC4's at its central epoch, and the proper motion's error over the years between; mas
  const axis = (sigma: string, pmSigma: string, epoch: string): number => Math.hypot(Number(sigma), Number(pmSigma) * (2000 - Number(epoch)));
  const errorMas = Math.max(axis(r[col("sigra")]!, r[col("sigpmr")]!, r[col("cepra")]!), axis(r[col("sigdc")]!, r[col("sigpmd")]!, r[col("cepdc")]!));
  const offset = arcsec(ra, dec, star.rightAscension, star.declination);
  ucac4Lines.push(`${star.gctp}|${r[col("ucac4_id")]!.trim()}|${ra.toFixed(7)}|${dec.toFixed(7)}|${Math.round(errorMas)}|${offset.toFixed(1)}`);
}

const counts = { nearby: own.length, matched: picks.size, ambiguous: ambiguous.size, ambiguousSettled: settled.size, new: own.length - picks.size - ambiguous.size - noMagnitude, noMagnitude, matchedCoarse: own.filter((star) => star.coarse && picks.has(star.gctp)).length, ucac4Positions: ucac4Lines.length };
const rows = own.flatMap((star) => {
  const pick = picks.get(star.gctp) ?? settled.get(star.gctp);
  return pick === undefined ? [] : [`${star.gctp}|${pick.key}|${pick.separation.toFixed(2)}${settled.has(star.gctp) ? "|n" : ""}`];
});
writeFileSync(
  OUT,
  `// GENERATED by scripts/make-nearby-faint.ts. Do not edit by hand.
// The nearby stars (src/data/nearby.ts) that the faint tiles (faint-tiles/, UCAC4) also hold, by the rules at the top of the script: ${counts.matched} matched (${counts.matchedCoarse} of them on the Yale catalogue's coarse position), ${counts.ambiguous} ambiguous (${counts.ambiguousSettled} of them settled by the nearest pair), ${counts.new} new, ${counts.noMagnitude} with no magnitude.
// One row a matched star: GCTP number | the faint star's right ascension and declination as the tile decodes them, to a millionth of a degree | the arc-seconds between the two | n where an ambiguous star was settled by the nearest pair.
export const NEARBY_FAINT_COUNTS = ${JSON.stringify(counts)} as const;
export const NEARBY_FAINT_ROWS = ${JSON.stringify(rows.join("\n"))};
`,
);
writeFileSync(
  OUT_UCAC4,
  `// GENERATED by scripts/make-nearby-faint.ts. Do not edit by hand.
// A UCAC4 position (Zacharias et al. 2013, AJ 145, 44; VizieR I/322A; read through NASA/IPAC IRSA's TAP service, table ucac4_sources, DOI 10.26131/IRSA17) for the ${ucac4Lines.length} nearby stars on the Yale catalogue's coarse position
// whose match in the faint tiles is sure enough (the rules at the top of the script; ${adopt.length} were asked for, ${notFound} had no single UCAC4 star of its own within ${UCAC4_RADIUS_ARCSEC} arc-seconds).
// One row a star: GCTP number | UCAC4 id | J2000 right ascension and declination in degrees, epoch 2000 | the position's error in milliarcseconds (UCAC4's own, carried to 2000; the larger axis) | arc-seconds from the Yale position.
export const NEARBY_UCAC4_ROWS = ${JSON.stringify(ucac4Lines.join("\n"))};
`,
);
console.log(counts, { asked: adopt.length, notFound });
