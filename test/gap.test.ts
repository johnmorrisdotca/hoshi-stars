// The fill of the gap between the bright stars and UCAC4's own stars (MODULES-660): the SAO Star Catalog and APASS with 2MASS, built by scripts/make-gap-sao.py and scripts/make-gap-apass.py, compared by scripts/compare-gap.py
// (docs/research/gap-6.5-8.md). Neither is in faint-tiles/ yet: SAO waits on NASA HEASARC's answer about its terms, and APASS + 2MASS leaves the sky north of +20 empty. The tests check that the report adds up,
// that faint-tiles/index.json says what is merged and nothing from SAO is merged while its terms are unconfirmed, that no Hipparcos, Tycho or Gaia table or number is read, and, where the tiles on file are on this computer
// (`~/Projects/backups/hoshi-stars/2026-11-09-gap-tiles/`, or under HOSHI_STARS_BACKUP_DIR), the counts, three named stars of each source, and no duplicate of a bright star or of a UCAC4 star.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { decodeFaintTile, faintStarsIn, faintTilesFor, type FaintTile, type FaintTileId } from "../src/faint.ts";
import { stars } from "../src/stars.ts";

const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const report = JSON.parse(read("docs/research/gap-6.5-8.json")) as {
  compare: { perQuarter: Array<Record<string, number>> };
  buildReports: Record<string, Record<string, number>>;
  gapTiles: Record<string, { stars: number; tiles: number; bytes: number; from: number; to: number }>;
  knownStars: { sao: Array<{ sao: number; ra: number; dec: number; v: number; type: string }>; apass2mass: Array<{ apass: string; twomass: string; ra: number; dec: number; v: number; bv: number }> };
};
const index = JSON.parse(read("faint-tiles/index.json")) as { stars: number; levels: Array<{ stars: number }>; gapFill: { level: number; stars: number; sources: Array<{ name: string; starsBuilt: number; starsKept: number }> } };
const ARC_SECOND = 1 / 3600;
const sum = (key: string): number => report.compare.perQuarter.reduce((a, q) => a + q[key]!, 0);

test("the comparison adds up to the two build reports", () => {
  assert.equal(sum("saoNew"), report.buildReports.sao!["kept"]);
  assert.equal(sum("saoAll"), report.buildReports.sao!["visual magnitude from 6.0 to 9.0"]);
  assert.equal(sum("apass2massNew"), report.buildReports["apass-2mass"]!["kept"]);
  assert.equal(sum("apass2massAll"), report.buildReports["apass-2mass"]!["matched, V from 6.0 to 9.0"]);
  for (const name of ["sao", "apass-2mass"]) {
    const r = report.buildReports[name]!;
    const matched = r["visual magnitude from 6.0 to 9.0"] ?? r["matched, V from 6.0 to 9.0"]!;
    assert.equal(matched - r["dropped: already one of the 5,080 bright stars"]! - r["dropped: already a star UCAC4 keeps"]!, r["kept"], `${name}: matched less the two drops is kept`);
    assert.equal(report.gapTiles[name]!.stars, r["kept"], `${name}: the tiles on file hold what the build kept`);
    assert.equal(report.gapTiles[name]!.bytes, 6 * r["kept"]!, `${name}: six bytes a star`);
  }
  // the quarter magnitudes run from 6.0 by a quarter, and the band the ticket names (6.5 to 8) is in them
  assert.deepEqual(report.compare.perQuarter.map((q) => q["from"]), Array.from({ length: 12 }, (_, i) => 6 + i * 0.25));
});

test("faint-tiles/index.json says what is merged, and SAO is not merged while its terms are unconfirmed", () => {
  assert.equal(index.gapFill.level, 0);
  assert.equal(index.gapFill.stars, index.gapFill.sources.reduce((a, s) => a + s.starsKept, 0));
  const notice = read("NOTICE.md");
  assert.match(notice, /SAO[^\n]*confirmation requested 2026-11-09/);
  if (index.gapFill.sources.some((s) => s.name === "sao")) assert.doesNotMatch(notice, /SAO[^\n]*confirmation requested 2026-11-09/, "SAO ships only once NASA HEASARC has confirmed its terms and NOTICE.md says so");
  assert.equal(index.levels.reduce((a, l) => a + l.stars, 0), index.stars);
});

test("no Hipparcos, Tycho or Gaia table, column or catalogue number is read by the gap scripts", () => {
  for (const file of ["scripts/make-gap-sao.py", "scripts/make-gap-apass.py", "scripts/compare-gap.py", "scripts/gap_common.py"]) {
    const code = read(file)
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("#"))
      .join("\n")
      .replace(/"""[\s\S]*?"""/g, "");
    assert.doesNotMatch(code, /\b(?:hip|hipparcos|tyc|tycho|gaia)\w*/i, `${file} names a Hipparcos, Tycho or Gaia table or column`);
  }
  // the tables the downloads read, by name
  const apass = read("scripts/make-gap-apass.py");
  assert.match(apass, /APASS_TABLE = "apass\.dr10"/);
  assert.match(apass, /TWOMASS_TABLE = "fp_psc"/);
  assert.match(apass, /APASS_COLUMNS = "id, ra, dec, ra_error, dec_error, nobs_v, mag_v, err_mag_v, nobs_b, mag_b, err_mag_b"/);
  assert.match(apass, /TWOMASS_COLUMNS = "designation, ra, dec, err_maj, err_min, j_m, h_m, k_m, ph_qual, cc_flg, jdate"/);
  for (const key of Object.keys(report.buildReports.sao!).concat(Object.keys(report.buildReports["apass-2mass"]!))) assert.doesNotMatch(key, /hipparcos|tycho|gaia/i, key);
});

// ----- the tiles on file -----
const BACKUPS = process.env["HOSHI_STARS_BACKUP_DIR"] ?? join(homedir(), "Projects", "backups", "hoshi-stars");
const GAP = join(BACKUPS, "2026-11-09-gap-tiles");
const onFile = existsSync(join(GAP, "sao", "index.json")) && existsSync(join(GAP, "apass-2mass", "index.json"));

function gapTiles(name: string): FaintTile[] {
  const out: FaintTile[] = [];
  const grid = JSON.parse(readFileSync(join(GAP, name, "index.json"), "utf8")) as { tiles: number };
  const dir = join(GAP, name, "L0");
  for (let band = 0; band < 18; band++) {
    for (let column = 0; column < 36; column++) {
      const path = join(dir, `${band}-${column}.bin`);
      if (!existsSync(path)) continue;
      const id: FaintTileId = { level: 0, band, column };
      out.push(decodeFaintTile(id, new Uint8Array(readFileSync(path))));
    }
  }
  assert.equal(out.length, grid.tiles, `${name}: tile files`);
  return out;
}
const separation = (ra1: number, dec1: number, ra2: number, dec2: number): number => {
  const r = Math.PI / 180;
  const h = Math.sin(((dec2 - dec1) * r) / 2) ** 2 + Math.cos(dec1 * r) * Math.cos(dec2 * r) * Math.sin(((ra2 - ra1) * r) / 2) ** 2;
  return (2 * Math.asin(Math.min(1, Math.sqrt(h)))) / r;
};
function find(tiles: FaintTile[], ra: number, dec: number, arcsec: number): Array<{ magnitude: number; colour: number }> {
  const found: Array<{ magnitude: number; colour: number }> = [];
  for (const t of tiles) {
    for (let i = 0; i < t.count; i++) {
      if (Math.abs(t.declination[i]! - dec) < 0.01 && separation(t.rightAscension[i]!, t.declination[i]!, ra, dec) <= arcsec * ARC_SECOND) found.push({ magnitude: t.magnitude[i]!, colour: t.colourIndex[i]! });
    }
  }
  return found;
}

test("the SAO and APASS + 2MASS tiles on file hold what the builds say, in the band, with three named stars each as the source gives them", { skip: !onFile && "the gap tiles are not on this computer" }, () => {
  const sao = gapTiles("sao");
  const apass = gapTiles("apass-2mass");
  assert.equal(sao.reduce((a, t) => a + t.count, 0), report.buildReports.sao!["kept"]);
  assert.equal(apass.reduce((a, t) => a + t.count, 0), report.buildReports["apass-2mass"]!["kept"]);
  for (const tiles of [sao, apass]) {
    for (const t of tiles) for (let i = 0; i < t.count; i++) assert.ok(t.magnitude[i]! >= 6 - 1e-9 && t.magnitude[i]! < 9, `magnitude ${t.magnitude[i]}`);
  }
  // SAO: the HEASARC row's J2000 position and visual magnitude; the colour is from the spectral type (B9, B5, K0), so a blue star is blue and a K star is red
  for (const k of report.knownStars.sao) {
    const hit = find(sao, k.ra, k.dec, 0.5);
    assert.equal(hit.length, 1, `SAO ${k.sao}`);
    assert.ok(Math.abs(hit[0]!.magnitude - k.v) <= 0.026, `SAO ${k.sao}: ${hit[0]!.magnitude} against ${k.v}`);
    assert.ok(k.type.startsWith("K") ? hit[0]!.colour > 0.7 : hit[0]!.colour < 0.1, `SAO ${k.sao} colour ${hit[0]!.colour}`);
  }
  // APASS + 2MASS: the 2MASS position, APASS's V and B-V
  for (const k of report.knownStars.apass2mass) {
    const hit = find(apass, k.ra, k.dec, 0.5);
    assert.equal(hit.length, 1, `APASS ${k.apass}`);
    assert.ok(Math.abs(hit[0]!.magnitude - k.v) <= 0.026, `APASS ${k.apass}: ${hit[0]!.magnitude} against ${k.v}`);
    assert.ok(Math.abs(hit[0]!.colour - k.bv) <= 0.0126, `APASS ${k.apass}: B-V ${hit[0]!.colour} against ${k.bv}`);
    // the 2MASS designation names the position: hhmmssss, then the sign and ddmmsss (J2000), so 05283322-0441493 is 05h 28m 33.22s, -04d 41m 49.3s
    const m = /^(\d\d)(\d\d)(\d\d)(\d\d)([+-])(\d\d)(\d\d)(\d\d)(\d)$/.exec(k.twomass)!;
    const ra = (Number(m[1]) + Number(m[2]) / 60 + Number(`${m[3]}.${m[4]}`) / 3600) * 15;
    const dec = (m[5] === "-" ? -1 : 1) * (Number(m[6]) + Number(m[7]) / 60 + Number(`${m[8]}.${m[9]}`) / 3600);
    assert.ok(separation(ra, dec, k.ra, k.dec) < 0.6 * ARC_SECOND, `${k.twomass} is the position of ${k.apass}`);
  }
});

test("none of the tiles on file holds a bright star or one of UCAC4's own stars a second time", { skip: !onFile && "the gap tiles are not on this computer" }, () => {
  const bright = stars();
  const byDegree = new Map<number, Array<{ ra: number; dec: number; v: number }>>();
  for (const s of bright) {
    const key = Math.floor(s.declination);
    byDegree.set(key, [...(byDegree.get(key) ?? []), { ra: s.rightAscension, dec: s.declination, v: s.magnitude }]);
  }
  const cache = new Map<string, FaintTile>();
  const tileOf = (id: FaintTileId): FaintTile => {
    const key = `${id.level}/${id.band}-${id.column}`;
    let t = cache.get(key);
    if (t === undefined) {
      t = decodeFaintTile(id, new Uint8Array(readFileSync(new URL(`../faint-tiles/L${id.level}/${id.band}-${id.column}.bin`, import.meta.url))));
      cache.set(key, t);
    }
    return t;
  };
  for (const name of ["sao", "apass-2mass"]) {
    let checked = 0;
    for (const t of gapTiles(name)) {
      for (let i = 0; i < t.count; i++) {
        const ra = t.rightAscension[i]!;
        const dec = t.declination[i]!;
        const v = t.magnitude[i]!;
        for (const d of [Math.floor(dec) - 1, Math.floor(dec), Math.floor(dec) + 1]) {
          for (const b of byDegree.get(d) ?? []) if (Math.abs(b.v - v) <= 1.5 && separation(ra, dec, b.ra, b.dec) <= 19 * ARC_SECOND) assert.fail(`${name}: a star at ${ra}, ${dec} is bright star ${b.ra}, ${b.dec} again`);
        }
        // UCAC4's own stars in the shipped tiles (none of them is a gap star while no source is merged)
        if (index.gapFill.stars === 0 && checked % 7 === 0) {
          const field = { rightAscension: ra, declination: dec, radius: 4.5 * ARC_SECOND };  // the build's 5 arc-seconds, less the half arc-second that a tile's grid rounds a position by
          const twin = faintStarsIn(faintTilesFor(field, 10).map(tileOf), field, 10).stars.find((f) => Math.abs(f.magnitude - v) <= 1.9);
          assert.equal(twin, undefined, `${name}: a star at ${ra}, ${dec} is a UCAC4 star again`);
        }
        checked++;
      }
    }
    assert.ok(checked > 10000);
  }
});
