// Write src/data/near-stars.ts and src/data/exoplanet-hosts.ts.
//
// Near stars: the star systems within 20 light-years that the two Yale tables already in this package hold (the Bright Star Catalogue's parallaxes and positions, and the nearby tier from the
// Yale General Catalogue of Trigonometric Stellar Parallaxes with 2MASS positions), grouped into systems by the typed table below, with the Japanese names and the companions that are
// not in either table typed from the literature. Nothing is read from Gaia, Hipparcos or Tycho.
//
// Exoplanet hosts: the confirmed planets of the NASA Exoplanet Archive (name, letter, orbital period, year and method of discovery, and the reference of the period: values from the discovery
// papers). The Archive's own position, distance and parallax columns are NOT used: they come from the TESS Input Catalog (Gaia DR2) and the Hipparcos catalogue, and Gaia and Hipparcos data are
// not passed on by this package (AGENTS.md). The Archive's position is used only as a key, to find which Yale star a host is, after the Yale star's own proper motion has moved it;
// the position, distance, spectral type and magnitude written are the Yale tables' and 2MASS's. A host the Yale tables do not hold is left out, except TRAPPIST-1, typed from its papers.
//
//     node scripts/make-near-stars-data.ts            # fetches the Archive into .cache/near-stars (git-ignored) when it is not there
//     node scripts/make-near-stars-data.ts --offline  # only what the cache holds
//
// Never runs in the test.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { constellationAt } from "../src/boundaries.ts";
import { nearbyStars } from "../src/nearby.ts";
import { stars } from "../src/stars.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(ROOT, ".cache", "near-stars");
const OFFLINE = process.argv.includes("--offline");
const TAP = "https://exoplanetarchive.ipac.caltech.edu/TAP/sync";
const READ_ON = "2026-11-11";
const LY_PER_PC = 3.261563777;
const NEAR_LY = 20;
const MAX_RELATIVE_ERROR = 0.1;
const HOST_LY = 50;

type Source = "BSC" | "GCTP" | "2MASS" | "typed";

/** One star of either Yale table, in one shape. */
interface Rec {
  id: string;
  name: string | undefined;
  nameJa: string | undefined;
  designation: string | undefined;
  aliases: string[];
  ra: number;
  dec: number;
  posSrc: Source;
  posErr: number | undefined;
  plx: number;
  plxErr: number | undefined;
  ly: number;
  lyErr: number | undefined;
  distSrc: "GCTP" | "BSC" | "dynamical";
  sp: string | undefined;
  spSrc: Source | undefined;
  mag: number | undefined;
  magSrc: Source | undefined;
  pm: [number, number] | undefined;
  pmSrc: Source | undefined;
  flags: string[];
  constellation: string | undefined;
}

// The Yale catalogue's text columns are fixed-width: names are cut short, a name's space is lost before a number and a spectral type can end in a stray mark. These put back what is certain.
const TRUNCATED: Record<string, string> = { "Barnard sta": "Barnard's Star", "Kapteyn sta": "Kapteyn's Star", "van Maanen": "van Maanen's Star" };
function cleanName(text: string): string {
  if (TRUNCATED[text] !== undefined) return TRUNCATED[text]!;
  let m = /^(CD|BD|CPD|AC|CoD)([+-]\d{2})(\d{4,})([A-Za-z]?)$/.exec(text);
  if (m !== null) return `${m[1]}${m[2]} ${m[3]}${m[4]}`;
  m = /^NSV(\d+)([A-Z]?)$/.exec(text);
  if (m !== null) return `NSV ${m[1]}${m[2] === "" ? "" : ` ${m[2]}`}`;
  m = /^(V\d+)([A-Z][a-z]{1,2})$/.exec(text);
  if (m !== null) return `${m[1]} ${m[2]}`;
  m = /^CI(\d{2}-\d+)$/.exec(text);
  if (m !== null) return `CI ${m[1]}`;
  return text;
}
// Two Yale types that are malformed (a doubled mark and a stray comma), set by hand to what the star is (M5.5 V, GJ 1002; M5.5 Ve, G 12-43).
const SPECTRAL_FIXES: Record<string, string> = { "g9.01": "M5.5 V", g2890: "M5.5 Ve" };
function cleanSpectral(id: string, text: string): string | undefined {
  const fixed = SPECTRAL_FIXES[id] ?? text.trim().replace(/[,;:.]+$/, "").trim();
  return fixed === "" ? undefined : fixed;
}

const recs = new Map<string, Rec>();
for (const s of stars()) {
  if (!(s.parallaxMas > 0) || s.parallaxSource === undefined) continue;
  const ly = LY_PER_PC * 1000 / s.parallaxMas;
  recs.set(`hr${s.hr}`, {
    id: `hr${s.hr}`, name: s.name, nameJa: s.nameJa, designation: s.designation, aliases: [`HR ${s.hr}`], ra: s.rightAscension, dec: s.declination, posSrc: "BSC", posErr: undefined,
    plx: s.parallaxMas, plxErr: s.parallaxErrorMas, ly, lyErr: s.parallaxErrorMas === undefined ? undefined : ly * s.parallaxErrorMas / s.parallaxMas, distSrc: s.parallaxSource === "dynamical" ? "dynamical" : s.parallaxSource === "BSC" ? "BSC" : "GCTP",
    sp: cleanSpectral(`hr${s.hr}`, s.spectralType), spSrc: "BSC", mag: s.magnitude, magSrc: "BSC", pm: [s.properMotionRaMas, s.properMotionDecMas], pmSrc: "BSC", flags: [], constellation: s.constellation,
  });
}
for (const s of nearbyStars()) {
  if (s.lightYears === undefined) continue;
  const flags = [s.flags.coarsePosition ? "coarse-position" : "", s.flags.ambiguousMatch ? "ambiguous-match" : ""].filter((f) => f !== "");
  recs.set(`g${s.gctp}`, {
    id: `g${s.gctp}`, name: s.name, nameJa: undefined, designation: s.designation === undefined ? undefined : cleanName(s.designation), aliases: [...s.aliases.map(cleanName), ...(s.gliese === undefined ? [] : [s.gliese]), ...(s.hd === undefined ? [] : [`HD ${s.hd}`])],
    ra: s.rightAscension, dec: s.declination, posSrc: s.positionSource === "2MASS" ? "2MASS" : "GCTP", posErr: s.positionErrorArcsec, plx: s.parallaxMas, plxErr: s.parallaxErrorMas,
    ly: s.lightYears, lyErr: s.lightYearsError, distSrc: "GCTP", sp: cleanSpectral(`g${s.gctp}`, s.spectralType), spSrc: "GCTP", mag: s.magnitude, magSrc: s.magnitude === undefined ? undefined : "GCTP",
    pm: s.properMotionSource === undefined ? undefined : [s.properMotionRaMas, s.properMotionDecMas], pmSrc: s.properMotionSource === undefined ? undefined : "GCTP", flags, constellation: undefined,
  });
}
// Wolf 1055 is GJ 752 A (HD 180617, V1298 Aql): the Gliese number is an identifier only, no catalogue data is read.
recs.get("g4494")!.aliases.push("GJ 752 A");
const constellationOf = (r: { ra: number; dec: number; constellation?: string | undefined }): string => r.constellation ?? constellationAt({ rightAscension: r.ra, declination: r.dec }).abbreviation;

// ---- The Archive ----
function csv(text: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  const head = rows[0]!;
  return rows.slice(1).filter((r) => r.length === head.length).map((r) => Object.fromEntries(head.map((k, i) => [k, r[i]!])));
}

async function archive(name: string, query: string): Promise<Array<Record<string, string>>> {
  const path = join(CACHE, `${name}.csv`);
  if (!existsSync(path)) {
    if (OFFLINE) throw new Error(`--offline: ${path} is not in the cache`);
    mkdirSync(CACHE, { recursive: true });
    const response = await fetch(`${TAP}?${new URLSearchParams({ query, format: "csv" })}`);
    if (!response.ok) throw new Error(`the Archive answered ${response.status}`);
    writeFileSync(path, await response.text());
  }
  return csv(readFileSync(path, "utf8"));
}

// ---- Typed facts ----
// The names are facts (which star people call what); the Japanese is as NAOJ and Japanese astronomy writing give it, and is read by the Japanese reviewer before release.
// `starsAtLeast` is the number of stars in the system as published for these well-known multiples; a star the Yale tables do not hold is a typed member below.
interface Group {
  id: string;
  name: string;
  nameJa: string | undefined;
  members: string[];
  starsAtLeast: number;
  designation?: string;
  extras?: Extra[];
}
interface Extra {
  name: string;
  nameJa?: string;
  spectralType: string;
  note?: string;
}
const GROUPS: Group[] = [
  { id: "alpha-centauri", name: "Alpha Centauri", nameJa: "ケンタウルス座α星", designation: "α Cen", members: ["hr5459", "hr5460", "g3278"], starsAtLeast: 3 },
  { id: "sirius", name: "Sirius", nameJa: "シリウス", members: ["hr2491"], starsAtLeast: 2, extras: [{ name: "Sirius B", nameJa: "シリウスB", spectralType: "DA2", note: "a white dwarf" }] },
  { id: "procyon", name: "Procyon", nameJa: "プロキオン", members: ["hr2943"], starsAtLeast: 2, extras: [{ name: "Procyon B", nameJa: "プロキオンB", spectralType: "DQZ", note: "a white dwarf" }] },
  { id: "61-cygni", name: "61 Cygni", nameJa: "はくちょう座61番星", members: ["hr8085"], starsAtLeast: 2, extras: [{ name: "61 Cygni B", nameJa: "はくちょう座61番星B", spectralType: "K7V" }] },
  { id: "epsilon-indi", name: "Epsilon Indi", nameJa: "インディアン座ε星", members: ["hr8387"], starsAtLeast: 3, extras: [{ name: "Epsilon Indi Ba", spectralType: "T1V", note: "a brown dwarf" }, { name: "Epsilon Indi Bb", spectralType: "T6V", note: "a brown dwarf" }] },
  { id: "36-ophiuchi", name: "36 Ophiuchi", nameJa: "へびつかい座36番星", members: ["hr6402", "hr6401", "g3913"], starsAtLeast: 3 },
  { id: "70-ophiuchi", name: "70 Ophiuchi", nameJa: "へびつかい座70番星", members: ["hr6752"], starsAtLeast: 2 },
  { id: "keid", name: "Keid", nameJa: "ケイド", members: ["hr1325"], starsAtLeast: 3, extras: [{ name: "Omicron-2 Eridani B", spectralType: "DA", note: "a white dwarf" }, { name: "Omicron-2 Eridani C", spectralType: "M4.5e" }] },
  { id: "achird", name: "Achird", nameJa: "アキルド", members: ["hr219"], starsAtLeast: 2 },
  { id: "uv-ceti", name: "UV Ceti", nameJa: "くじら座UV星", members: ["g343.10"], starsAtLeast: 2 },
  { id: "kruger-60", name: "Kruger 60", nameJa: "クルーガー60", members: ["g5438"], starsAtLeast: 2 },
  { id: "groombridge-34", name: "Groombridge 34", nameJa: "グルームブリッジ34", members: ["g49"], starsAtLeast: 2 },
  { id: "struve-2398", name: "Struve 2398", nameJa: "ストルーベ2398", members: ["g4330"], starsAtLeast: 2 },
  { id: "ez-aquarii", name: "EZ Aquarii", nameJa: "みずがめ座EZ星", members: ["g5475"], starsAtLeast: 3 },
  { id: "ross-614", name: "Ross 614", nameJa: "ロス614", members: ["g1509"], starsAtLeast: 2 },
];
const NAMES: Record<string, { name: string; nameJa?: string }> = {
  g4494: { name: "Wolf 1055" },
  g3278: { name: "Proxima Centauri", nameJa: "プロキシマ・ケンタウリ" },
  g4098: { name: "Barnard's Star", nameJa: "バーナード星" },
  g2553: { name: "Wolf 359", nameJa: "ウォルフ359" },
  g2576: { name: "Lalande 21185", nameJa: "ラランド21185" },
  g4338: { name: "Ross 154", nameJa: "ロス154" },
  g5736: { name: "Ross 248", nameJa: "ロス248" },
  hr1084: { name: "Epsilon Eridani", nameJa: "エリダヌス座ε星" },
  g2730: { name: "Ross 128", nameJa: "ロス128" },
  g5584: { name: "Lacaille 9352", nameJa: "ラカーユ9352" },
  hr509: { name: "Tau Ceti", nameJa: "くじら座τ星" },
  "g2016.01": { name: "DX Cancri", nameJa: "かに座DX星" },
  "g248.01": { name: "YZ Ceti", nameJa: "くじら座YZ星" },
  g1755: { name: "Luyten's Star", nameJa: "ルイテン星" },
  g5117: { name: "Lacaille 8760", nameJa: "ラカーユ8760" },
  g1181: { name: "Kapteyn's Star", nameJa: "カプタイン星" },
  g3746: { name: "Wolf 1061", nameJa: "ウォルフ1061" },
  g160: { name: "van Maanen's Star", nameJa: "ファン・マーネン星" },
  g2390: { name: "Groombridge 1618", nameJa: "グルームブリッジ1618" },
  g2420: { name: "AD Leonis", nameJa: "しし座AD星" },
  g5520: { name: "EV Lacertae", nameJa: "とかげ座EV星" },
  g1827: { name: "YZ Canis Minoris", nameJa: "こいぬ座YZ星" },
  hr8387: { name: "Epsilon Indi A" },
  hr8085: { name: "61 Cygni A" },
  hr7557: { name: "Altair" },
  hr7665: { name: "Delta Pavonis", nameJa: "くじゃく座δ星" },
};
const GREEK: Record<string, string> = { alf: "α", bet: "β", gam: "γ", del: "δ", eps: "ε", zet: "ζ", eta: "η", tet: "θ", iot: "ι", kap: "κ", lam: "λ", mu: "μ", nu: "ν", ksi: "ξ", xi: "ξ", omi: "ο", pi: "π", rho: "ρ", sig: "σ", tau: "τ", ups: "υ", phi: "φ", chi: "χ", psi: "ψ", ome: "ω" };
const prettyHost = (host: string): string => host.replace(/^([a-z]{3})([0-9]?) /, (all, g: string, n: string) => (GREEK[g] === undefined ? all : `${GREEK[g]}${n === "" ? "" : n.replace(/[0-9]/, (d) => "¹²³⁴⁵⁶⁷⁸⁹"[Number(d) - 1]!)} `));

// ---- Match the Archive's hosts to the Yale stars ----
const SEP = (a: { ra: number; dec: number }, b: { ra: number; dec: number }): number => {
  const d = Math.PI / 180;
  const c = Math.sin(a.dec * d) * Math.sin(b.dec * d) + Math.cos(a.dec * d) * Math.cos(b.dec * d) * Math.cos((a.ra - b.ra) * d);
  return (Math.acos(Math.min(1, c)) / d) * 3600;
};
const planetRows = await archive("planets", "select pl_name,hostname,pl_letter,pl_orbper,pl_orbper_reflink,discoverymethod,disc_year,ra,dec,pl_controv_flag from pscomppars");
const refText = (link: string): string | undefined => {
  const m = /target=ref>\s*([^<]*?)\s*<\/a>/.exec(link);
  const ENTITIES: Record<string, string> = { amp: "&", Aacute: "Á", aacute: "á", eacute: "é", iacute: "í", ntilde: "ñ", oacute: "ó" };
  return m === null || m[1] === "" ? undefined : m[1]!.replace(/&([a-zA-Z]+);/g, (all, name: string) => ENTITIES[name] ?? all);
};
const byHost = new Map<string, Array<Record<string, string>>>();
for (const p of planetRows) {
  if (p.pl_controv_flag === "1") continue;
  if (!byHost.has(p.hostname!)) byHost.set(p.hostname!, []);
  byHost.get(p.hostname!)!.push(p);
}
const candidates = [...recs.values()];
const hostOf = new Map<string, string[]>();
const matched = new Map<string, Rec>();
const unmatched: string[] = [];
for (const [host, planets] of byHost) {
  const key = { ra: Number(planets[0]!.ra), dec: Number(planets[0]!.dec) };
  let best: Rec | undefined;
  let bestSep = Infinity;
  for (const c of candidates) {
    if (SEP(key, c) > 3600) continue; // a quick cut; the proper motion below never carries a star this far in 17 years except Barnard's Star, which is 3 arc-minutes
    for (const years of [-1, 0, 1, 15, 16, 17]) {
      const dec = c.dec + ((c.pm?.[1] ?? 0) * years) / 3.6e6;
      const ra = c.ra + ((c.pm?.[0] ?? 0) * years) / 3.6e6 / Math.cos((c.dec * Math.PI) / 180);
      const d = SEP(key, { ra, dec });
      if (d < bestSep) { bestSep = d; best = c; }
    }
  }
  if (best !== undefined && bestSep < 25) {
    matched.set(host, best);
    hostOf.set(best.id, [...(hostOf.get(best.id) ?? []), host]);
  } else unmatched.push(host);
}

// ---- Near stars ----
const inGroup = new Set(GROUPS.flatMap((g) => g.members));
const included = [...recs.values()].filter((r) => r.ly <= NEAR_LY && (r.lyErr === undefined || r.lyErr / r.ly <= MAX_RELATIVE_ERROR));
const systems: Array<{ group: Group | undefined; members: Rec[] }> = [];
for (const g of GROUPS) systems.push({ group: g, members: g.members.map((id) => recs.get(id)!) });
for (const r of included) if (!inGroup.has(r.id)) systems.push({ group: undefined, members: [r] });
for (const s of systems) if (!s.members.some((m) => m.ly <= NEAR_LY)) throw new Error(`system ${s.group?.id} has no member within ${NEAR_LY} ly`);
for (const g of GROUPS) for (const id of g.members) if (!recs.has(id)) throw new Error(`no record ${id}`);

const round = (value: number, digits: number): number => Number(value.toFixed(digits));
const slug = (text: string): string => text.toLowerCase().replace(/['’]/g, "").replace(/\+/g, "p").replace(/[^a-z0-9.]+/g, "-").replace(/^-|-$/g, "");
const bright = (a: Rec, b: Rec): number => (a.mag ?? 99) - (b.mag ?? 99);
const designationOf = (r: Rec): string => r.designation ?? r.aliases.find((a) => /^GJ \d/.test(a)) ?? r.aliases[0] ?? r.id;
const nameOf = (r: Rec): string => NAMES[r.id]?.name ?? r.name ?? (hostOf.get(r.id)?.[0] === undefined ? undefined : prettyHost(hostOf.get(r.id)![0]!)) ?? designationOf(r);

interface MemberRow { name: string; nameJa?: string; role: "primary" | "companion"; ra?: number; dec?: number; ly?: number; sp?: string; mag?: number; src: Source; note?: string }
const rowsNear: string[] = [];
const nearOfRecord = new Map<string, string>();
systems.sort((a, b) => Math.min(...a.members.map((m) => m.ly)) - Math.min(...b.members.map((m) => m.ly)));
for (const { group, members } of systems) {
  const sorted = [...members].sort(bright);
  const primary = group === undefined ? members[0]! : members.find((m) => m.id === group.members[0])!;
  const name = group?.name ?? nameOf(primary);
  const nameJa = group === undefined ? (NAMES[primary.id]?.nameJa ?? primary.nameJa) : group.nameJa;
  const id = group?.id ?? slug(name);
  const flags = [...new Set(members.flatMap((m) => m.flags))];
  const memberRows: MemberRow[] = sorted.map((m, i) => {
    const row: MemberRow = { name: members.length === 1 && group === undefined ? name : (m.name ?? nameOf(m)), role: m.id === primary.id ? "primary" : "companion", ra: round(m.ra, 6), dec: round(m.dec, 6), ly: round(m.ly, 3), ...(m.sp === undefined ? {} : { sp: m.sp }), src: m.spSrc ?? "GCTP" };
    if (m.mag !== undefined) row.mag = m.mag;
    const ja = NAMES[m.id]?.nameJa ?? m.nameJa;
    if (ja !== undefined && !(members.length === 1 && group === undefined)) row.nameJa = ja;
    void i;
    return row;
  });
  for (const e of group?.extras ?? []) memberRows.push({ name: e.name, ...(e.nameJa === undefined ? {} : { nameJa: e.nameJa }), role: "companion", sp: e.spectralType, src: "typed", ...(e.note === undefined ? {} : { note: e.note }) });
  const hostNames = [...new Set(members.flatMap((m) => hostOf.get(m.id) ?? []))];
  const aliases = [...new Set([...members.flatMap((m) => [m.name, m.designation, ...m.aliases]), ...hostNames.map(prettyHost)].filter((a): a is string => a !== undefined && a !== name))];
  const row = {
    id, name, ...(nameJa === undefined ? {} : { nameJa }), designation: (group?.designation ?? primary.designation) ?? designationOf(primary), aliases, constellation: constellationOf(primary), starsAtLeast: group?.starsAtLeast ?? 1,
    ra: round(primary.ra, 6), dec: round(primary.dec, 6), posSrc: primary.posSrc, ...(primary.posErr === undefined ? {} : { posErr: round(primary.posErr, 1) }),
    ly: round(primary.ly, 3), ...(primary.lyErr === undefined ? {} : { lyErr: round(primary.lyErr, 3) }), plx: primary.plx, ...(primary.plxErr === undefined ? {} : { plxErr: primary.plxErr }), distSrc: primary.distSrc,
    ...(primary.sp === undefined ? {} : { sp: primary.sp, spSrc: primary.spSrc }), ...(primary.mag === undefined ? {} : { mag: primary.mag, magSrc: primary.magSrc }),
    ...(primary.pm === undefined ? {} : { pm: primary.pm, pmSrc: primary.pmSrc }), flags, members: memberRows,
  };
  rowsNear.push(`  ${JSON.stringify(row)},`);
  for (const m of members) nearOfRecord.set(m.id, id);
}

// ---- Exoplanet hosts ----
interface PlanetRow { name: string; letter: string; periodDays?: number; periodRef?: string; year?: number; method: string }
const planetOf = (p: Record<string, string>): PlanetRow => ({
  name: p.pl_name!, letter: p.pl_letter!, ...(p.pl_orbper === "" ? {} : { periodDays: Number(Number(p.pl_orbper).toPrecision(10)) }), ...(refText(p.pl_orbper_reflink ?? "") === undefined || p.pl_orbper === "" ? {} : { periodRef: refText(p.pl_orbper_reflink!)! }),
  ...(p.disc_year === "" ? {} : { year: Number(p.disc_year) }), method: p.discoverymethod!,
});
// Other spellings a reader may search for.
const HOST_ALIASES: Record<string, string[]> = { hr8729: ["ヘルヴェティオス"] };
const hostName = (host: string, rec: Rec): string => {
  const base = NAMES[rec.id]?.name ?? rec.name ?? (rec.id.startsWith("hr") ? rec.designation : undefined);
  const component = /\s([A-D])$/.exec(host)?.[1];
  if (base === undefined) return prettyHost(host);
  return component !== undefined && (hostOf.get(rec.id)?.length ?? 0) > 1 ? `${base} ${component}` : base;
};
const hostRows: Array<{ sortLy: number; text: string }> = [];
let near = 0;
let named = 0;
for (const [host, rec] of matched) {
  const isNamed = rec.name !== undefined && rec.id.startsWith("hr");
  if (rec.ly > HOST_LY && !isNamed) continue;
  if (rec.lyErr === undefined || rec.lyErr / rec.ly > MAX_RELATIVE_ERROR) continue;
  const planets = byHost.get(host)!.map(planetOf).sort((a, b) => a.letter.localeCompare(b.letter));
  const nearId = nearOfRecord.get(rec.id);
  const baseJa = NAMES[rec.id]?.nameJa ?? rec.nameJa ?? GROUPS.find((g) => g.members.includes(rec.id))?.nameJa;
  const component = /\s([A-D])$/.exec(host)?.[1];
  const nameJa = baseJa !== undefined && component !== undefined && (hostOf.get(rec.id)?.length ?? 0) > 1 ? `${baseJa}${component}` : baseJa;
  const row = {
    id: slug(host), name: hostName(host, rec), ...(nameJa === undefined ? {} : { nameJa }), designation: prettyHost(host), archiveName: host, ...(HOST_ALIASES[rec.id] === undefined ? {} : { aliases: HOST_ALIASES[rec.id] }), constellation: constellationOf(rec),
    ra: round(rec.ra, 6), dec: round(rec.dec, 6), posSrc: rec.posSrc, ...(rec.posErr === undefined ? {} : { posErr: round(rec.posErr, 1) }), ly: round(rec.ly, 3), ...(rec.lyErr === undefined ? {} : { lyErr: round(rec.lyErr, 3) }), distSrc: rec.distSrc,
    ...(rec.sp === undefined ? {} : { sp: rec.sp, spSrc: rec.spSrc }), ...(rec.mag === undefined ? {} : { mag: rec.mag, magSrc: rec.magSrc }), ...(nearId === undefined ? {} : { nearStarId: nearId }), why: rec.ly <= HOST_LY ? "near" : "named", planets,
  };
  if (rec.ly <= HOST_LY) near++; else named++;
  hostRows.push({ sortLy: rec.ly, text: `  ${JSON.stringify(row)},` });
}
// TRAPPIST-1, typed: the Yale tables do not hold it (it was found in 2000). Position: the 2MASS designation J23062928-0502285 (23h 06m 29.28s, -05d 02m 28.5s, J2000), good to 0.1 arc-second at 2MASS's epoch
// (1999), and its motion is 0.9 arc-seconds a year, so the position is given as good to 1 arc-second. Parallax 82.6 +- 2.6 mas from Costa et al. 2006 (AJ 132, 1234), as Gillon et al. 2016
// (Nature 533, 221) quote it, with V = 18.80 and the type M8.0 +- 0.5 from the same paper; read 2026-11-11 from arXiv:1605.07211.
{
  const planets = (byHost.get("TRAPPIST-1") ?? []).map(planetOf).sort((a, b) => a.letter.localeCompare(b.letter));
  if (planets.length < 7) throw new Error(`TRAPPIST-1 has ${planets.length} planets in the cache`);
  const ra = (23 + 6 / 60 + 29.28 / 3600) * 15;
  const dec = -(5 + 2 / 60 + 28.5 / 3600);
  const plx = 82.6;
  const ly = (LY_PER_PC * 1000) / plx;
  const row = {
    id: "trappist-1", name: "TRAPPIST-1", nameJa: "トラピスト1", designation: "TRAPPIST-1", archiveName: "TRAPPIST-1", constellation: constellationOf({ ra, dec }), ra: round(ra, 6), dec: round(dec, 6), posSrc: "2MASS", posErr: 1, ly: round(ly, 3), lyErr: round(ly * 2.6 / plx, 3),
    distSrc: "typed", sp: "M8", spSrc: "typed", mag: 18.8, magSrc: "typed", why: "typed", planets,
    references: ["Costa et al. 2006, AJ 132, 1234: parallax 82.6 +- 2.6 mas, as quoted by Gillon et al. 2016, Nature 533, 221", "Gillon et al. 2016, Nature 533, 221: V 18.80, spectral type M8.0 +- 0.5", "2MASS Point Source Catalog (Cutri et al. 2003): J23062928-0502285"],
  };
  hostRows.push({ sortLy: ly, text: `  ${JSON.stringify(row)},` });
}
hostRows.sort((a, b) => a.sortLy - b.sortLy);
// A check, printed and never written: the Archive's own distance for a matched host (a Gaia-derived value, not used anywhere else) should be in the same range as the Yale one.
{
  const archiveLy = new Map((await archive("host-distance", "select hostname,max(sy_dist) as d from pscomppars group by hostname")).map((r) => [r.hostname!, Number(r.d) * LY_PER_PC]));
  for (const [host, rec] of matched) {
    const other = archiveLy.get(host);
    if (!hostRows.some((h) => h.text.includes(`"designation":${JSON.stringify(host)}`)) || other === undefined || Number.isNaN(other)) continue;
    if (Math.abs(other - rec.ly) / rec.ly > 0.35) console.log(`CHECK ${host}: Yale ${rec.ly.toFixed(1)} ly, the Archive ${other.toFixed(1)} ly (${rec.id})`);
  }
}

// ---- Write ----
const nearHeader = `// GENERATED by scripts/make-near-stars-data.ts. Do not edit by hand.
// The star systems within 20 light-years that the Yale tables hold (Bright Star Catalogue parallaxes and positions; Yale General Catalogue of Trigonometric Stellar Parallaxes with 2MASS positions),
// grouped into systems, with the companions the tables do not hold typed from the literature. ${rowsNear.length} systems. Read ${READ_ON}. Sources and licences: NOTICE.md.
// One object a system, nearest first. Keys: ra and dec (J2000 degrees), posSrc and posErr (arc-seconds), ly and lyErr, plx and plxErr (milliarcseconds), distSrc, sp and spSrc (spectral type), mag and magSrc (V),
// pm (milliarcseconds a year, J2000 axes) and pmSrc. A source is BSC (Yale Bright Star Catalogue), GCTP (Yale parallax catalogue), 2MASS or typed (a published value typed here).

/** The sources a value can come from. */
export type NearStarSourceCode = "BSC" | "GCTP" | "2MASS" | "typed";

/** One star of a system, as a row. */
export interface NearStarMemberRow {
  name: string;
  nameJa?: string;
  role: "primary" | "companion";
  ra?: number;
  dec?: number;
  ly?: number;
  sp?: string;
  mag?: number;
  src: NearStarSourceCode;
  note?: string;
}

/** One system, as a row. */
export interface NearStarRow {
  id: string;
  name: string;
  nameJa?: string;
  designation: string;
  aliases: string[];
  constellation: string;
  starsAtLeast: number;
  ra: number;
  dec: number;
  posSrc: NearStarSourceCode;
  posErr?: number;
  ly: number;
  lyErr?: number;
  plx: number;
  plxErr?: number;
  distSrc: "GCTP" | "BSC" | "dynamical";
  sp?: string;
  spSrc?: NearStarSourceCode;
  mag?: number;
  magSrc?: NearStarSourceCode;
  pm?: [number, number];
  pmSrc?: NearStarSourceCode;
  flags: string[];
  members: NearStarMemberRow[];
}

/** The systems, nearest first. */
export const NEAR_STAR_ROWS: readonly NearStarRow[] = [
${rowsNear.join("\n")}
];
`;
const hostHeader = `// GENERATED by scripts/make-near-stars-data.ts. Do not edit by hand.
// The host stars of confirmed exoplanets that matter to a visitor: those within ${HOST_LY} light-years by the Yale tables' distance (${near}), the stars with an IAU proper name at any distance (${named}), and TRAPPIST-1 (typed), all with a distance known to 10% or better. ${hostRows.length} hosts.
// Planets: the NASA Exoplanet Archive's confirmed planets (not flagged controversial), read ${READ_ON}: name, letter, orbital period in days and the paper it comes from, year and method of discovery. This research has
// made use of the NASA Exoplanet Archive, which is operated by the California Institute of Technology, under contract with the National Aeronautics and Space Administration under the Exoplanet Exploration Program.
// The star's position, distance, spectral type and magnitude are the Yale tables' and 2MASS's, never the Archive's (which carries Gaia and Hipparcos values). Sources and licences: NOTICE.md.

/** One planet, as a row. */
export interface ExoplanetRow {
  name: string;
  letter: string;
  periodDays?: number;
  periodRef?: string;
  year?: number;
  method: string;
}

/** One host star, as a row. */
export interface ExoplanetHostRow {
  id: string;
  name: string;
  nameJa?: string;
  designation: string;
  archiveName: string;
  aliases?: string[];
  constellation: string;
  ra: number;
  dec: number;
  posSrc: "BSC" | "GCTP" | "2MASS" | "typed";
  posErr?: number;
  ly: number;
  lyErr?: number;
  distSrc: "GCTP" | "BSC" | "dynamical" | "typed";
  sp?: string;
  spSrc?: "BSC" | "GCTP" | "2MASS" | "typed";
  mag?: number;
  magSrc?: "BSC" | "GCTP" | "2MASS" | "typed";
  nearStarId?: string;
  why: "near" | "named" | "typed";
  planets: ExoplanetRow[];
  references?: string[];
}

/** The hosts, nearest first. */
export const EXOPLANET_HOST_ROWS: readonly ExoplanetHostRow[] = [
${hostRows.map((h) => h.text).join("\n")}
];
`;
writeFileSync(join(ROOT, "src", "data", "near-stars.ts"), nearHeader);
writeFileSync(join(ROOT, "src", "data", "exoplanet-hosts.ts"), hostHeader);
console.log(`near stars: ${rowsNear.length} systems, ${included.length} stars within ${NEAR_LY} ly (relative error at most ${MAX_RELATIVE_ERROR * 100}%)`);
console.log(`exoplanet hosts: ${hostRows.length} (${near} within ${HOST_LY} ly, ${named} named, 1 typed); Archive hosts matched ${matched.size}, not in the Yale tables ${unmatched.length}`);
console.log(`planets: ${hostRows.reduce((n, h) => n + (h.text.match(/"letter"/g)?.length ?? 0), 0)}`);
