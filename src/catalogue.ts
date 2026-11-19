// The stars of the package's tiers as one catalogue: each star once, under an id that stays the same, with its grade and its distance with the range its error allows.
// The catalogue tier (`@johnmorrisdotca/hoshi-stars/catalogue`): it loads the bright stars only. The nearby tier (`/catalogue/nearby`) and the faint tier (`/catalogue/faint`) are layers a page imports when it needs them and hands in
// through `layers`, so this entry point stays the size of the bright table. Pure: no DOM, no clock.
// No star is in two tiers: the nearby tier was built without the Yale parallax catalogue's stars that the bright tier holds, the faint tiles without the bright stars, and a faint star that is a nearby star
// carries that star's id in `sameAs` and is left out of a list that holds the nearby layer.
import { CATALOGUE_LAYERS, catalogueId, entryOf, layersOf, listOf, type CatalogueCount, type CatalogueLayer, type CatalogueSource, type CatalogueStar } from "./catalogue-core.ts";
import type { StarGrade } from "./accuracy.ts";
import { stars } from "./stars.ts";

export { CATALOGUE_LAYERS, catalogueId, type CatalogueCount, type CatalogueLayer, type CatalogueSource, type CatalogueStar };

/**
 * The layers to read: `"bright"`, and the layers a page brought in, `nearbyLayer` from `/catalogue/nearby` and a `faintLayer(stars)` from `/catalogue/faint`.
 *
 * @example
 * ```ts
 * import { catalogueStars, type CatalogueLayers } from "@johnmorrisdotca/hoshi-stars/catalogue";
 *
 * const layers: CatalogueLayers = ["bright"];
 * console.log(catalogueStars({ layers }).length); // 5080
 * ```
 */
export type CatalogueLayers = ReadonlyArray<"bright" | CatalogueSource>;

let brightRecords: readonly CatalogueStar[] | undefined;
const bright = { layer: "bright" as const, stars: (): readonly CatalogueStar[] => (brightRecords ??= Object.freeze(stars().map((star) => entryOf(star)))) };

/**
 * The stars of the layers asked for as one list, each star once, brightest first (the few with no magnitude last). The bright stars alone unless `layers` says more.
 *
 * @param options - `layers`: `"bright"` and the layers brought in (`["bright"]` where left out). `magnitude`: the faintest to include (a star with no magnitude is then left out). `minGrade`: the worst grade to include (`"B"` keeps grades A and B).
 * @returns A fresh array of the shared, frozen records.
 * @throws TypeError if `layers` is not an array or `magnitude` not a number; RangeError if `layers` holds anything else (the name `"nearby"` or `"faint"` too: those layers load on request) or one layer twice, or if `minGrade` is not `"A"`, `"B"` or `"C"`.
 *
 * @example
 * ```ts
 * import { catalogueStars } from "@johnmorrisdotca/hoshi-stars/catalogue";
 *
 * const { nearbyLayer } = await import("@johnmorrisdotca/hoshi-stars/catalogue/nearby");
 * const sure = catalogueStars({ layers: ["bright", nearbyLayer], minGrade: "A" });
 * console.log(catalogueStars().length, sure.length, sure.filter((one) => one.layer === "nearby").length);
 * ```
 */
export function catalogueStars(options: { layers?: CatalogueLayers; magnitude?: number; minGrade?: StarGrade } = {}): CatalogueStar[] {
  return listOf(layersOf(options?.layers, bright), options?.magnitude, options?.minGrade);
}

/**
 * A star of the catalogue by its id, ignoring case, among the layers asked for: `hr-2491` (Sirius) among the bright stars, `gctp-3278` (Proxima Centauri) once `nearbyLayer` is handed in.
 *
 * @param id - The id, as `catalogueId` gives it.
 * @param options - `layers`, as for `catalogueStars` (`["bright"]` where left out).
 * @returns The star, or `undefined` where no star of those layers has that id.
 * @throws TypeError or RangeError for a bad `layers`, as `catalogueStars`.
 *
 * @example
 * ```ts
 * import { catalogueStar } from "@johnmorrisdotca/hoshi-stars/catalogue";
 * import { nearbyLayer } from "@johnmorrisdotca/hoshi-stars/catalogue/nearby";
 *
 * console.log(catalogueStar("hr-2491")?.name, catalogueStar("gctp-4098"), catalogueStar("gctp-4098", { layers: [nearbyLayer] })?.name); // Sirius undefined Barnard's Star
 * ```
 */
export function catalogueStar(id: string, options: { layers?: CatalogueLayers } = {}): CatalogueStar | undefined {
  const text = String(id).trim().toLowerCase();
  for (const one of layersOf(options?.layers, bright)) {
    const found = one.stars().find((entry) => entry.id.toLowerCase() === text);
    if (found !== undefined) return found;
  }
  return undefined;
}

/**
 * The stars of each layer asked for, and of each grade: the headline counts. A faint star that is a nearby star is counted with the nearby layer when both are asked for.
 *
 * @param options - `layers`, as for `catalogueStars` (`["bright"]` where left out).
 * @returns One count for each layer, in the order of `layers`.
 * @throws TypeError or RangeError for a bad `layers`, as `catalogueStars`.
 *
 * @example
 * ```ts
 * import { catalogueCounts } from "@johnmorrisdotca/hoshi-stars/catalogue";
 *
 * for (const count of catalogueCounts()) console.log(`${count.layer}: ${count.stars} (A ${count.grades.A}, B ${count.grades.B}, C ${count.grades.C})`);
 * ```
 */
export function catalogueCounts(options: { layers?: CatalogueLayers } = {}): CatalogueCount[] {
  const layers = layersOf(options?.layers, bright);
  const all = listOf(layers, undefined, undefined);
  return layers.map(({ layer }) => {
    const grades: Record<StarGrade, number> = { A: 0, B: 0, C: 0 };
    let count = 0;
    for (const one of all) {
      if (one.layer !== layer) continue;
      grades[one.grade] += 1;
      count += 1;
    }
    return { layer, stars: count, grades: Object.freeze(grades) };
  });
}
