// Who found each Messier, NGC and IC object and when (MODULES-665): the large tier (`@johnmorrisdotca/hoshi-stars/provenance/ngc-ic`), about 35 kB gzipped, so the Messier-only `/provenance` stays small. Pure: no DOM, no clock, no state beyond the
// parsed tables.
import { DISCOVERERS, MESSIER_DISCOVERY } from "./data/discovery-messier.ts";
import { NGC_IC_DISCOVERY } from "./data/discovery-ngc-ic.ts";
import { discoveryFrom, rowTable, shortOf, type ObjectDiscovery } from "./provenance-core.ts";

export { CATALOGUE_ORIGINS, PROVENANCE_SOURCES, type CatalogueOrigin, type Discoverer, type DiscoveryDate, type ObjectDiscovery, type ProvenanceSource, type ProvenanceSourceKey } from "./provenance-core.ts";

const rows = rowTable(`${MESSIER_DISCOVERY}\n${NGC_IC_DISCOVERY}`);

/**
 * Who found a Messier, NGC or IC object and when, from Wikidata, with the catalogue it is from and a note where Wikidata gives more than one date or one that cannot be right. About two in three of the 11,898 objects have a discoverer
 * and a date; about 4,000 have neither, and `undefined` is their answer.
 *
 * @param id - The object's id as `deepSkyObject` writes it: `M1`, `NGC 7000`, `IC 434`, or `NGC7000`, in any case.
 * @returns The fact, or `undefined`.
 *
 * @example
 * ```ts
 * import { objectDiscovery } from "@johnmorrisdotca/hoshi-stars/provenance/ngc-ic";
 *
 * const nebula = objectDiscovery("NGC 7000");
 * console.log(nebula?.discoverers.map((one) => one.name).join(", "), nebula?.date?.value, nebula?.catalogue.compiler);
 * ```
 */
export function objectDiscovery(id: string): ObjectDiscovery | undefined {
  const short = shortOf(id);
  const row = rows.get(short);
  return row === undefined ? undefined : discoveryFrom(id.trim().toUpperCase().replace(/^(NGC|IC)(?=\d)/, "$1 "), row, DISCOVERERS);
}

/**
 * The ids (as `M1`, `N7000`, `I434` the rows write them) of every object that has a fact: the Messier objects, then the NGC and IC objects.
 *
 * @example
 * ```ts
 * import { DISCOVERY_OBJECT_COUNT } from "@johnmorrisdotca/hoshi-stars/provenance/ngc-ic";
 *
 * console.log(DISCOVERY_OBJECT_COUNT);
 * ```
 */
export const DISCOVERY_OBJECT_COUNT: number = rows.size;
