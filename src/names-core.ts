// The part the two names entry points share: what a row of the names index is, how a name becomes a key and an address-safe id, and the lookups over a list of rows. Not an entry point itself: no star table is imported here,
// so the entry point for the NGC and IC objects loads none. Pure: no DOM, no clock, no state beyond the rows it is given.
import { deepSkyAliases, type DeepSkyObject, type DeepSkyType } from "./deep-sky-core.ts";
import type { Constellation } from "./constellations.ts";
import { CONSTELLATION_ROWS } from "./data/constellations.ts";
import type { Star } from "./stars.ts";

/** The fields of a star a names row is made from: a part of `Star`, so that the small `/names/named` chunk need not load the bright-star table. */
export type NameStar = Pick<Star, "hr" | "name" | "nameJa" | "designation" | "constellation" | "rightAscension" | "declination" | "magnitude" | "spectralType">;
/** The fields of a constellation a names row is made from. */
export type NameConstellation = Pick<Constellation, "abbreviation" | "name" | "genitive" | "japanese">;

let byAbbreviation: Map<string, NameConstellation> | undefined;
/** The 88 constellations by IAU abbreviation, read from the small constellation table alone (`constellations()` would load the star table with it). */
export function constellationsByAbbreviation(): ReadonlyMap<string, NameConstellation> {
  if (byAbbreviation === undefined) {
    byAbbreviation = new Map();
    for (const row of CONSTELLATION_ROWS.split("\n")) {
      const [abbreviation, name, genitive, , stem] = row.split("|") as [string, string, string, string, string];
      byAbbreviation.set(abbreviation, { abbreviation, name, genitive, japanese: `${stem}座` });
    }
  }
  return byAbbreviation;
}


/**
 * The kinds of row in the names index: `star`, `cluster` (open and globular), `nebula` (emission, reflection, planetary, supernova remnant), `galaxy` and `other` (an asterism, a double star Messier listed, a source that is none of those).
 *
 * @example
 * ```ts
 * import { NAME_KINDS } from "@johnmorrisdotca/hoshi-stars/names";
 *
 * console.log(NAME_KINDS.join(", "));
 * ```
 */
export const NAME_KINDS = ["star", "cluster", "nebula", "galaxy", "other"] as const;
/**
 * One kind of row: `star`, `cluster`, `nebula`, `galaxy` or `other`.
 *
 * @example
 * ```ts
 * import { NAME_KINDS, type NameKind } from "@johnmorrisdotca/hoshi-stars/names";
 *
 * const kind: NameKind = NAME_KINDS[0];
 * console.log(kind);
 * ```
 */
export type NameKind = (typeof NAME_KINDS)[number];

/**
 * One row of the names index: a star or a deep-sky object with the names a search box would try, and where to turn the sky to it.
 *
 * @example
 * ```ts
 * import { nameRowById, type NameRow } from "@johnmorrisdotca/hoshi-stars/names";
 *
 * const row: NameRow = nameRowById("betelgeuse")!;
 * console.log(row.name.en, row.name.ja, row.designations, row.pick);
 * ```
 */
export interface NameRow {
  /** An address-safe id that stays the same: lower-case letters, digits and hyphens (`betelgeuse`, `alpha-orionis`, `hr-1234`, `m31`, `ngc7000`). A star with a name takes it, one with a Bayer letter or Flamsteed number takes that spelt out, the rest take `hr-` and the catalogue number. Unique in the index. */
  id: string;
  /** What the row is. */
  kind: NameKind;
  /** More exactly what: the deep-sky object's own type (`globular cluster`, `planetary nebula`), or the star's spectral type as the catalogue gives it (`M1-2Ia-Iab`). */
  detail: string;
  /** The name to show: `en` is the common name, else the designation (`Betelgeuse`, `α Ori`, `M31`); `ja` is the name in katakana where the package has one (`ベテルギウス`), else for a star with a Bayer letter the usual `オリオン座α星`, else `undefined` (the package holds no Japanese name for a deep-sky object). */
  name: { en: string; ja: string | undefined };
  /** Every other name and designation a reader might type, once each, in the spellings the package knows: for a star `α Ori`, `alpha Ori`, `alpha Orionis`, `Alp Ori`, `58 Ori`, `HR 2061`; for a deep-sky object `M31`, `Messier 31`, `NGC 224`, the other NGC and IC numbers and its other common names (`Andromeda Nebula`). Excludes the two names shown. */
  otherNames: string[];
  /** The designations alone, as printed: `α Ori`, `58 Ori`, `HR 2061`, or `M31`, `NGC 224`, `IC 434`. */
  designations: string[];
  /** The IAU abbreviation of the constellation it lies in (`Ori`), or `undefined` for a deep-sky object with none. */
  constellation: string | undefined;
  /** The constellation's name in English (`Orion`) and in Japanese (`オリオン座`), or `undefined`. */
  constellationName: { en: string; ja: string } | undefined;
  /** Visual magnitude, or `undefined` where there is none (many NGC and IC objects). Smaller is brighter. */
  magnitude: number | undefined;
  /** A rank for ordering results, larger first: how bright the thing is (8 less its magnitude, between 0 and 14), plus 3 for a common name and 2 for a Messier number. Brighter and better-known things come first; it is not a measure of anything else. */
  weight: number;
  /** Right ascension in degrees at J2000, 0 up to 360. */
  rightAscension: number;
  /** Declination in degrees at J2000, -90 to 90. */
  declination: number;
  /** The key the demo's address uses to pick it on the map (`pick=` in the address): `S:2061` for a star by HR number, `D:M31` for a deep-sky object by id. */
  pick: string;
  /** The Bright Star Catalogue (HR) number of a star, else `undefined`. */
  hr: number | undefined;
}

/**
 * What an index of rows offers: the rows, one by id, one by any name, and a ranked search.
 *
 * @example
 * ```ts
 * import { searchNames, type NameIndex } from "@johnmorrisdotca/hoshi-stars/names";
 *
 * const found: ReturnType<NameIndex["search"]> = searchNames("andromeda", { limit: 3 });
 * console.log(found.map((row) => row.id));
 * ```
 */
export interface NameIndex {
  /** The rows, brightest and best-known first, as a fresh array. */
  rows(kinds?: readonly NameKind[]): NameRow[];
  /** The row with that id, or `undefined`. */
  byId(id: string): NameRow | undefined;
  /** The row a text names exactly (ignoring case, spacing, accents and the Greek letter's spelling), or `undefined` if none or more than one does. */
  find(text: string): NameRow | undefined;
  /** The rows whose names match: those that start with the text first, then those that contain it, each by weight; at most `limit` (20 by default). */
  search(text: string, options?: { limit?: number; kinds?: readonly NameKind[] }): NameRow[];
}

const GREEK: Readonly<Record<string, string>> = { α: "alpha", β: "beta", γ: "gamma", δ: "delta", ε: "epsilon", ζ: "zeta", η: "eta", θ: "theta", ι: "iota", κ: "kappa", λ: "lambda", μ: "mu", ν: "nu", ξ: "xi", ο: "omicron", π: "pi", ρ: "rho", σ: "sigma", τ: "tau", υ: "upsilon", φ: "phi", χ: "chi", ψ: "psi", ω: "omega" };
/** The IAU's three-letter spellings of the Greek letters, as the Bright Star Catalogue and star atlases abbreviate them. */
const GREEK_SHORT: Readonly<Record<string, string>> = { alpha: "Alp", beta: "Bet", gamma: "Gam", delta: "Del", epsilon: "Eps", zeta: "Zet", eta: "Eta", theta: "The", iota: "Iot", kappa: "Kap", lambda: "Lam", mu: "Mu", nu: "Nu", xi: "Xi", omicron: "Omi", pi: "Pi", rho: "Rho", sigma: "Sig", tau: "Tau", upsilon: "Ups", phi: "Phi", chi: "Chi", psi: "Psi", omega: "Ome" };

/** The Greek letter's English name for a letter of a designation (`alpha` for `α`), or the text itself. */
export const greekName = (letter: string): string => GREEK[letter] ?? letter;
/** The three-letter spelling for a Greek letter's English name (`Alp` for `alpha`). */
export const greekShort = (name: string): string => GREEK_SHORT[name] ?? name;

/**
 * A text folded to compare, as `findName` does: lower case, no accents, Greek letters spelt out and one space, a superscript as its digit; `M 31`, `Messier 31` and `m31` give `m31`, `NGC 0224` gives `ngc224`, `HR 2061` and `hr2061` give `hr2061`.
 *
 * @param text - Any text.
 * @returns The key.
 *
 * @example
 * ```ts
 * import { nameKey } from "@johnmorrisdotca/hoshi-stars/names";
 *
 * console.log(nameKey("Messier 31"), nameKey("α Ori"), nameKey("NGC 0224"));
 * ```
 */
export function nameKey(text: string): string {
  // NFKD turns a superscript (π³) into its digit, and a Bayer number written apart (pi 3 Ori) is joined to its letter
  const spelt = [...text.normalize("NFKD").replace(/[̀-ͯ]/g, "")].map((ch) => GREEK[ch.toLowerCase()] ?? ch).join("");
  const folded = spelt.replace(/\s+/g, " ").trim().toLowerCase().replace(/^(alpha|beta|gamma|delta|epsilon|zeta|eta|theta|iota|kappa|lambda|mu|nu|xi|omicron|pi|rho|sigma|tau|upsilon|phi|chi|psi|omega) (\d{1,2}) (?=[a-z])/, "$1$2 ");
  const designation = /^(m|messier|ngc|ic|hr|hd) ?0*(\d+) ?([a-z]?)$/.exec(folded);
  return designation === null ? folded : `${designation[1] === "messier" ? "m" : designation[1]}${designation[2]}${designation[3]}`;
}

/**
 * An address-safe id from a text: lower-case ASCII letters and digits in runs joined by one hyphen; an accent is dropped (`Boötes` gives `bootes`) and a Greek letter is spelt out (`α1 Centauri` gives `alpha1-centauri`).
 *
 * @param text - Any text.
 * @returns The id: letters, digits and hyphens only, or an empty string if the text has none.
 *
 * @example
 * ```ts
 * import { slugOf } from "@johnmorrisdotca/hoshi-stars/names";
 *
 * console.log(slugOf("Rigil Kentaurus"), slugOf("α Orionis"));
 * ```
 */
export function slugOf(text: string): string {
  const spelt = [...text.normalize("NFD").replace(/[̀-ͯ]/g, "")].map((ch) => GREEK[ch.toLowerCase()] ?? ch).join("");
  return spelt.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

const weightOf = (magnitude: number | undefined, named: boolean, messier: boolean): number => Math.round((Math.max(0, Math.min(14, 8 - (magnitude ?? 8))) + (named ? 3 : 0) + (messier ? 2 : 0)) * 10) / 10;
/** The rank weight of a star: its brightness, plus 3 for a common name. */
export const starWeight = (magnitude: number, named: boolean): number => weightOf(magnitude, named, false);

const KINDS: Readonly<Record<DeepSkyType, NameKind>> = { galaxy: "galaxy", "globular cluster": "cluster", "open cluster": "cluster", nebula: "nebula", "planetary nebula": "nebula", "supernova remnant": "nebula", other: "other" };

/**
 * The row of a deep-sky object. The id is its Messier number, else its NGC, else its IC number, without spaces and in lower case (`m31`, `ngc7000`, `ic434`).
 *
 * @param object - A deep-sky object from `/deep-sky` or `/deep-sky/ngc-ic`.
 * @param constellations - The constellations by abbreviation, for the names of the one it lies in.
 * @returns The row.
 *
 * @example
 * ```ts
 * import { constellations } from "@johnmorrisdotca/hoshi-stars/constellations";
 * import { deepSkyObject } from "@johnmorrisdotca/hoshi-stars/deep-sky";
 * import { deepSkyRow } from "@johnmorrisdotca/hoshi-stars/names";
 *
 * const byAbbreviation = new Map(constellations().map((c) => [c.abbreviation, c]));
 * console.log(deepSkyRow(deepSkyObject("M31")!, byAbbreviation).id);
 * ```
 */
export function deepSkyRow(object: DeepSkyObject, constellations: ReadonlyMap<string, NameConstellation>): NameRow {
  const numbers = [object.messier, object.ngc, object.ic, ...object.otherIds].filter((text): text is string => text !== undefined);
  const shown = object.name ?? object.id;
  const others = [object.id, ...numbers, ...(object.messier === undefined ? [] : [`Messier ${object.messier.slice(1)}`]), ...deepSkyAliases(object)];
  const c = object.constellation === undefined ? undefined : constellations.get(object.constellation);
  return {
    id: slugOf(object.id.replace(/\s+/g, "")),
    kind: KINDS[object.type],
    detail: object.type,
    name: { en: shown, ja: undefined },
    otherNames: others.filter((text, i, all) => text !== shown && all.indexOf(text) === i),
    designations: numbers,
    constellation: object.constellation,
    constellationName: c === undefined ? undefined : { en: c.name, ja: c.japanese },
    magnitude: object.magnitude,
    weight: weightOf(object.magnitude, object.name !== undefined, object.messier !== undefined),
    rightAscension: object.rightAscension,
    declination: object.declination,
    pick: `D:${object.id}`,
    hr: undefined,
  };
}

const BAYER = /^(\D+?)(\d*) (\S+)$/u;
const DATABASE_SHORT: Readonly<Record<string, string>> = { alpha: "alf", theta: "tet", xi: "ksi" };
const FLAMSTEED = /^(\d+) (\S+)$/u;

/** The id a star would have before any clash is settled: its name, else its Bayer letter or Flamsteed number spelt out with the constellation's genitive, else `hr-` and its number. */
export function starSlug(star: NameStar, c: NameConstellation | undefined): string {
  if (star.name !== undefined) return slugOf(star.name);
  const text = star.designation;
  if (text !== undefined && c !== undefined) {
    const bayer = BAYER.exec(text);
    if (bayer !== null) return slugOf(`${greekName(bayer[1]!)}${bayer[2]!} ${c.genitive}`);
    const flamsteed = FLAMSTEED.exec(text);
    if (flamsteed !== null) return slugOf(`${flamsteed[1]!} ${c.genitive}`);
  }
  return `hr-${star.hr}`;
}

/** The row of a star. The id is given, not made here, because a clash between two stars is settled over the whole table, which a small chunk may not hold. */
export function starRow(star: NameStar, c: NameConstellation | undefined, id: string): NameRow {
  const others = new Set<string>();
  const designations: string[] = [];
  let ja = star.nameJa;
  const text = star.designation;
  if (text !== undefined) designations.push(text);
  designations.push(`HR ${star.hr}`);
  if (text !== undefined && c !== undefined) {
    const bayer = BAYER.exec(text);
    const flamsteed = FLAMSTEED.exec(text);
    if (bayer !== null) {
      const letter = bayer[1]!;
      const number = bayer[2]!;
      for (const place of [c.abbreviation, c.genitive]) {
        others.add(`${letter}${number} ${place}`);
        others.add(`${greekName(letter)}${number} ${place}`);
        others.add(`${greekShort(greekName(letter))}${number} ${place}`);
        // the three-letter forms that differ in the astronomy databases (alf Ori, tet Eri, ksi Ori)
        const database = DATABASE_SHORT[greekName(letter)];
        if (database !== undefined) others.add(`${database}${number} ${place}`);
        // a component of a pair (α1 Cen) is also what people mean by the pair's letter (alpha Centauri): the text then names two rows, and `findName` gives none
        if (number !== "") others.add(`${greekName(letter)} ${place}`);
      }
      ja ??= `${c.japanese}${letter}${number}星`;
    } else if (flamsteed !== null) {
      for (const place of [c.abbreviation, c.genitive]) others.add(`${flamsteed[1]!} ${place}`);
    }
  }
  const shown = star.name ?? text ?? `HR ${star.hr}`;
  for (const one of designations) others.add(one);
  if (star.name !== undefined && text !== undefined) others.add(text);
  others.delete(shown);
  if (ja !== undefined) others.delete(ja);
  return {
    id,
    kind: "star",
    detail: star.spectralType,
    name: { en: shown, ja },
    otherNames: [...others],
    designations,
    constellation: star.constellation,
    constellationName: c === undefined ? undefined : { en: c.name, ja: c.japanese },
    magnitude: star.magnitude,
    weight: starWeight(star.magnitude, star.name !== undefined),
    rightAscension: star.rightAscension,
    declination: star.declination,
    pick: `S:${star.hr}`,
    hr: star.hr,
  };
}

/**
 * An index over rows: by id, by exact name and by a ranked search. The rows are put in order, largest weight first and the id to break a tie.
 *
 * @param input - The rows. Their ids must be unique.
 * @returns The lookups.
 * @throws Error if two rows have the same id.
 *
 * @example
 * ```ts
 * import { nameRows, nameIndex } from "@johnmorrisdotca/hoshi-stars/names";
 *
 * console.log(nameIndex(nameRows().slice(0, 100)).find("Sirius")?.id);
 * ```
 */
export function nameIndex(input: readonly NameRow[]): NameIndex {
  const rows = [...input].sort((a, b) => b.weight - a.weight || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const byId = new Map<string, NameRow>();
  for (const row of rows) {
    if (byId.has(row.id)) throw new Error(`two rows have the id "${row.id}"`);
    byId.set(row.id, row);
  }
  let keys: Map<string, NameRow | null> | undefined;
  let texts: { key: string; row: NameRow }[] | undefined;
  const load = (): void => {
    if (keys !== undefined) return;
    keys = new Map();
    texts = [];
    for (const row of rows) {
      const seen = new Set<string>();
      for (const text of [row.name.en, row.name.ja, ...row.otherNames, ...row.designations, row.id]) {
        if (text === undefined || text === "") continue;
        const key = nameKey(text);
        if (seen.has(key)) continue;
        seen.add(key);
        keys.set(key, keys.has(key) && keys.get(key) !== row ? null : row);
        texts.push({ key, row });
      }
    }
  };
  const allowed = (row: NameRow, kinds: readonly NameKind[] | undefined): boolean => kinds === undefined || kinds.includes(row.kind);
  return {
    rows: (kinds) => rows.filter((row) => allowed(row, kinds)),
    byId: (id) => byId.get(id),
    find(text) {
      load();
      return keys!.get(nameKey(text)) ?? undefined;
    },
    search(text, options = {}) {
      load();
      const q = nameKey(text);
      if (q === "") return [];
      const limit = options.limit ?? 20;
      const starts = new Map<NameRow, number>();
      const holds = new Map<NameRow, number>();
      for (const one of texts!) {
        if (!allowed(one.row, options.kinds)) continue;
        if (one.key === q) starts.set(one.row, 0);
        else if (one.key.startsWith(q)) starts.set(one.row, Math.min(starts.get(one.row) ?? 1, 1));
        else if (one.key.includes(q) && !starts.has(one.row)) holds.set(one.row, 2);
      }
      const order = (a: NameRow, b: NameRow): number => b.weight - a.weight || (a.id < b.id ? -1 : 1);
      const first = [...starts.entries()].sort((a, b) => a[1] - b[1] || order(a[0], b[0])).map(([row]) => row);
      return [...first, ...[...holds.keys()].filter((row) => !starts.has(row)).sort(order)].slice(0, limit);
    },
  };
}
