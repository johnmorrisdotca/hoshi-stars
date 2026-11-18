// Where the Messier objects and the named stars come from (MODULES-665): who found a Messier object and when, the day the IAU approved a star's name and the language it comes from. The small tier (`@johnmorrisdotca/hoshi-stars/provenance`):
// about 10 kB; the NGC and IC objects are `provenance/ngc-ic`. Pure: no DOM, no clock, no state beyond the parsed tables.
import { DISCOVERERS, MESSIER_DISCOVERY } from "./data/discovery-messier.ts";
import { STAR_NAME_FACTS } from "./data/star-name-facts.ts";
import { STAR_NAMES } from "./data/stars.ts";
import { discoveryFrom, rowTable, shortOf, type ObjectDiscovery } from "./provenance-core.ts";

export { CATALOGUE_ORIGINS, PROVENANCE_SOURCES, type CatalogueOrigin, type Discoverer, type DiscoveryDate, type ObjectDiscovery, type ProvenanceSource, type ProvenanceSourceKey } from "./provenance-core.ts";

const messier = rowTable(MESSIER_DISCOVERY);

/**
 * Who found a Messier object and when, from Wikidata, with the catalogue it is from and a note where the date is doubtful. For the NGC and IC objects, import `provenance/ngc-ic`. `undefined` for an id that is no Messier object or that
 * Wikidata gives no discoverer or date.
 *
 * @param id - The object's id: `M1`, or `m1`, in any case.
 * @returns The fact, or `undefined`.
 *
 * @example
 * ```ts
 * import { objectDiscovery } from "@johnmorrisdotca/hoshi-stars/provenance";
 *
 * const crab = objectDiscovery("M1");
 * console.log(crab?.discoverers[0]?.name, crab?.date?.value, crab?.catalogue.years.join(" and "));
 * ```
 */
export function objectDiscovery(id: string): ObjectDiscovery | undefined {
  const short = shortOf(id);
  const row = messier.get(short);
  return row === undefined ? undefined : discoveryFrom(short, row, DISCOVERERS);
}

/**
 * What is known of where a star's name comes from: the day the IAU Working Group on Star Names approved it and the language or culture it comes from. Each is `null` where its source has none, and `notes` says when the IAU-CSN does not
 * hold the name.
 *
 * @example
 * ```ts
 * import type { StarNameFacts } from "@johnmorrisdotca/hoshi-stars/provenance";
 *
 * const facts: StarNameFacts = { hr: 2061, name: "Betelgeuse", approved: "2016-06-30", origin: "Arabic", notes: [], sources: { approved: "iau-csn", origin: "wikipedia-star-names" } };
 * console.log(facts.name, facts.approved, facts.origin);
 * ```
 */
export interface StarNameFacts {
  hr: number;
  name: string;
  approved: string | null;
  origin: string | null;
  notes: readonly string[];
  sources: { approved: "iau-csn"; origin: "wikipedia-star-names" };
}

const names = new Map<number, readonly [string, string, string]>();
for (const line of STAR_NAME_FACTS.split("\n")) {
  const p = line.split("|");
  names.set(Number(p[0]), [p[1]!, p[2]!, p[3]!]);
}

/**
 * The facts of a named star's name, by HR number or by the name (any case, ignoring spaces): `starNameFacts(2061)` and `starNameFacts("betelgeuse")`. `undefined` for a star the package gives no common name.
 *
 * @param star - The star's HR number, or its common name.
 * @returns The facts, or `undefined`.
 *
 * @example
 * ```ts
 * import { starNameFacts } from "@johnmorrisdotca/hoshi-stars/provenance";
 *
 * const sirius = starNameFacts("Sirius");
 * console.log(sirius?.approved, sirius?.origin);
 * ```
 */
export function starNameFacts(star: number | string): StarNameFacts | undefined {
  let hr: number | undefined;
  if (typeof star === "number") hr = star;
  else {
    const key = star.toLowerCase().replace(/\s+/g, "");
    hr = Object.entries(STAR_NAMES).map(([n, name]) => [Number(n), name] as const).find(([, name]) => name.toLowerCase().replace(/\s+/g, "") === key)?.[0];
  }
  const row = hr === undefined ? undefined : names.get(hr);
  const name = hr === undefined ? undefined : STAR_NAMES[hr];
  if (hr === undefined || row === undefined || name === undefined) return undefined;
  return {
    hr,
    name,
    approved: row[0] === "" ? null : row[0],
    origin: row[1] === "" ? null : row[1],
    notes: row[2].includes("u") ? ["The IAU Catalog of Star Names does not hold this name: it is in the package's own list, so it has no approval day, and the Wikipedia table gives it no origin."] : [],
    sources: { approved: "iau-csn", origin: "wikipedia-star-names" },
  };
}

/**
 * The HR numbers of the stars whose names have facts: all of the package's named stars.
 *
 * @example
 * ```ts
 * import { NAMED_STAR_FACT_IDS } from "@johnmorrisdotca/hoshi-stars/provenance";
 *
 * console.log(NAMED_STAR_FACT_IDS.length);
 * ```
 */
export const NAMED_STAR_FACT_IDS: readonly number[] = [...names.keys()];
