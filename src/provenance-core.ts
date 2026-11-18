// Where each object and name comes from (MODULES-665): who found a Messier, NGC or IC object and when, which catalogue its number is from, the day the IAU approved a star's name and the language the name comes from. Every fact says which
// source it was read from. The shared parts: the sources, the catalogues, and the reading of the rows. Pure: no DOM, no clock, no state beyond the parsed tables.

/**
 * A source of a fact: its name, its address, the day it was read, and its licence.
 *
 * @example
 * ```ts
 * import { PROVENANCE_SOURCES, type ProvenanceSource } from "@johnmorrisdotca/hoshi-stars/provenance";
 *
 * const wikidata: ProvenanceSource = PROVENANCE_SOURCES["wikidata"];
 * console.log(wikidata.name, wikidata.read, wikidata.licence);
 * ```
 */
export interface ProvenanceSource {
  name: string;
  address: string;
  read: string;
  licence: string;
}

/**
 * Every source the facts are read from, by key: `wikidata` (the discoverers and dates of the objects), `iau-csn` (the day a star's name was approved), `wikipedia-star-names` (the language a name comes from) and the three Wikipedia
 * pages the catalogues' own facts are read from.
 *
 * @example
 * ```ts
 * import { PROVENANCE_SOURCES } from "@johnmorrisdotca/hoshi-stars/provenance";
 *
 * for (const [key, source] of Object.entries(PROVENANCE_SOURCES)) console.log(key, source.address);
 * ```
 */
export const PROVENANCE_SOURCES = {
  wikidata: { name: "Wikidata: the discoverer or inventor (P61) and the date of discovery or invention (P575) of each object", address: "https://www.wikidata.org/", read: "2026-11-18", licence: "CC0 1.0" },
  "iau-csn": { name: "IAU Catalog of Star Names (IAU-CSN), IAU Working Group on Star Names, updated 2022-04-04", address: "https://www.pas.rochester.edu/~emamajek/WGSN/IAU-CSN.txt", read: "2026-11-18", licence: "Creative Commons Attribution (the IAU's own terms for its products)" },
  "wikipedia-star-names": { name: "Wikipedia: List of proper names of stars (the column \"Name origin\")", address: "https://en.wikipedia.org/wiki/List_of_proper_names_of_stars", read: "2026-11-18", licence: "CC BY-SA 4.0" },
  "wikipedia-messier-object": { name: "Wikipedia: Messier object", address: "https://en.wikipedia.org/wiki/Messier_object", read: "2026-11-18", licence: "CC BY-SA 4.0" },
  "wikipedia-new-general-catalogue": { name: "Wikipedia: New General Catalogue", address: "https://en.wikipedia.org/wiki/New_General_Catalogue", read: "2026-11-18", licence: "CC BY-SA 4.0" },
} as const;

/**
 * The key of a source in `PROVENANCE_SOURCES`.
 *
 * @example
 * ```ts
 * import { PROVENANCE_SOURCES, type ProvenanceSourceKey } from "@johnmorrisdotca/hoshi-stars/provenance";
 *
 * const key: ProvenanceSourceKey = "iau-csn";
 * console.log(PROVENANCE_SOURCES[key].name);
 * ```
 */
export type ProvenanceSourceKey = keyof typeof PROVENANCE_SOURCES;

/**
 * Where a catalogue comes from: who made it, and when, as the catalogue's own Wikipedia article gives it.
 *
 * @example
 * ```ts
 * import { CATALOGUE_ORIGINS, type CatalogueOrigin } from "@johnmorrisdotca/hoshi-stars/provenance";
 *
 * const ngc: CatalogueOrigin = CATALOGUE_ORIGINS.ngc;
 * console.log(ngc.compiler, ngc.years.join(", "), ngc.objects);
 * ```
 */
export interface CatalogueOrigin {
  name: string;
  compiler: string;
  /** The years it was published: Messier's in 1774 (a preliminary version, 45 objects) and 1781 (103), Dreyer's NGC in 1888, and the Index Catalogue in 1895 and 1908. */
  years: readonly number[];
  /** How many objects it holds as the compiler left it. */
  objects: number;
  note: string;
  source: ProvenanceSourceKey;
}

/**
 * The three catalogues the objects' numbers are from: `messier`, `ngc` and `ic`.
 *
 * @example
 * ```ts
 * import { CATALOGUE_ORIGINS } from "@johnmorrisdotca/hoshi-stars/provenance";
 *
 * console.log(CATALOGUE_ORIGINS.messier.years, CATALOGUE_ORIGINS.ic.years);
 * ```
 */
export const CATALOGUE_ORIGINS = {
  messier: {
    name: "Messier catalogue",
    compiler: "Charles Messier",
    years: [1774, 1781],
    objects: 103,
    note: "A preliminary version of 45 objects appeared in 1774 in the Memoirs of the French Academy of Sciences for 1771; the final version of 103 objects was published in 1781 in the Connaissance des Temps for 1784. Other astronomers, using side notes in Messier's texts, later expanded the list to 110 objects.",
    source: "wikipedia-messier-object",
  },
  ngc: {
    name: "New General Catalogue of Nebulae and Clusters of Stars",
    compiler: "John Louis Emil Dreyer",
    years: [1888],
    objects: 7840,
    note: "It consolidated the cataloguing work of William and Caroline Herschel and John Herschel's General Catalogue of Nebulae and Clusters of Stars.",
    source: "wikipedia-new-general-catalogue",
  },
  ic: {
    name: "Index Catalogue of Nebulae and Clusters of Stars",
    compiler: "John Louis Emil Dreyer",
    years: [1895, 1908],
    objects: 5386,
    note: "Two supplements to the NGC by Dreyer, in 1895 and 1908, describing a further 5,386 objects.",
    source: "wikipedia-new-general-catalogue",
  },
} as const satisfies Readonly<Record<string, CatalogueOrigin>>;

/**
 * A person Wikidata names as a discoverer: the name as its English label has it, and the Wikidata item (`Q` and its number).
 *
 * @example
 * ```ts
 * import type { Discoverer } from "@johnmorrisdotca/hoshi-stars/provenance";
 *
 * const herschel: Discoverer = { name: "William Herschel", wikidata: "Q14277" };
 * console.log(herschel.name);
 * ```
 */
export interface Discoverer {
  name: string;
  wikidata: string;
}

/**
 * When an object was found, as Wikidata gives it: the date as text (`1731`, `1779-01-31`, or `-0259` for 259 BC), the finest unit it names, and its year as a number.
 *
 * @example
 * ```ts
 * import type { DiscoveryDate } from "@johnmorrisdotca/hoshi-stars/provenance";
 *
 * const when: DiscoveryDate = { value: "1731", grain: "year", year: 1731 };
 * console.log(when.value);
 * ```
 */
export interface DiscoveryDate {
  value: string;
  grain: "year" | "month" | "day";
  year: number;
}

/**
 * Who found a Messier, NGC or IC object and when, with the catalogue its number comes from and the notes where a source gives more than one answer or an unlikely one. `discoverers` and `date` are as empty as the source is: most of the
 * objects have a discoverer, about two in three have both, and some have neither (they are not listed).
 *
 * @example
 * ```ts
 * import { objectDiscovery } from "@johnmorrisdotca/hoshi-stars/provenance";
 *
 * const crab = objectDiscovery("M1")!;
 * console.log(crab.discoverers.map((one) => one.name).join(", "), crab.date?.value, crab.catalogue.compiler);
 * ```
 */
export interface ObjectDiscovery {
  id: string;
  discoverers: readonly Discoverer[];
  date: DiscoveryDate | null;
  /** The catalogue of the object's own number: Messier's for a Messier object, else the NGC's or the IC's. */
  catalogue: CatalogueOrigin;
  /** Where Wikidata gives more than one date, or a date that cannot be right, and what the package did with it. */
  notes: readonly string[];
  source: "wikidata";
}

export const TEXT_OF_FLAGS = {
  m: "Wikidata gives more than one date for it; the earliest is shown.",
  c: "Wikidata gives a date coarser than a year; the year is shown.",
  x: "The date is later than the catalogue the object is in, so it cannot be its discovery; it is shown as Wikidata gives it, and no other source was read to correct it.",
} as const;

/** The short id of a deep-sky object (`M31`, `N7000`, `I434`) as the rows write it, from its id (`M31`, `NGC 7000`, `IC 434`). */
export const shortOf = (id: string): string => id.replace(/^NGC ?/i, "N").replace(/^IC ?/i, "I").replace(/\s+/g, "").toUpperCase();

/** The rows of a table, one object a line, by short id: the discoverer indexes, the date and the flags. */
export function rowTable(text: string): Map<string, readonly [string, string, string]> {
  const out = new Map<string, readonly [string, string, string]>();
  for (const line of text.split("\n")) {
    const p = line.split("|");
    out.set(p[0]!, [p[1]!, p[2]!, p[3]!]);
  }
  return out;
}

/** Read a row into the fact. */
export function discoveryFrom(id: string, row: readonly [string, string, string], people: readonly (readonly [string, number])[]): ObjectDiscovery {
  const [who, when, flags] = row;
  const catalogue = /^M\d/.test(shortOf(id)) ? CATALOGUE_ORIGINS.messier : shortOf(id).startsWith("N") ? CATALOGUE_ORIGINS.ngc : CATALOGUE_ORIGINS.ic;
  const found = when === "" ? null : { value: when, grain: when.replace(/^-/, "").length === 4 ? ("year" as const) : when.replace(/^-/, "").length === 7 ? ("month" as const) : ("day" as const), year: Number(when.replace(/^(-?\d+).*$/, "$1")) };
  return {
    id,
    discoverers: who === "" ? [] : who.split(",").map((n) => ({ name: people[Number(n)]![0], wikidata: `Q${people[Number(n)]![1]}` })),
    date: found,
    catalogue,
    notes: [...flags].map((f) => TEXT_OF_FLAGS[f as keyof typeof TEXT_OF_FLAGS]),
    source: "wikidata",
  };
}
