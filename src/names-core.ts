// The part the two names entry points share: what a row of the names index is, how a name becomes a key and an address-safe id, and the lookups over a list of rows. Not an entry point itself: no star table is imported here,
// so the entry point for the NGC and IC objects loads none. Pure: no DOM, no clock, no state beyond the rows it is given.
import { deepSkyAliases, type DeepSkyObject, type DeepSkyType } from "./deep-sky-core.ts";
import type { Constellation } from "./constellations.ts";

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
export function deepSkyRow(object: DeepSkyObject, constellations: ReadonlyMap<string, Constellation>): NameRow {
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
