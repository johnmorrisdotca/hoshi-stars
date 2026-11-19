// The nearby layer of the catalogue (`@johnmorrisdotca/hoshi-stars/catalogue/nearby`): the Yale parallax catalogue's stars that the bright tier leaves out, as catalogue records. A page imports it when it needs it
// and hands `nearbyLayer` to `/catalogue` through `layers`; it loads the nearby table and not the bright one. Pure: no DOM, no clock.
import { entryOf, type CatalogueSource, type CatalogueStar } from "./catalogue-core.ts";
import { nearbyStars } from "./nearby.ts";

let records: readonly CatalogueStar[] | undefined;

/**
 * The nearby layer: hand it to `catalogueStars`, `catalogueStar` or `catalogueCounts` of `/catalogue` in `layers`. Its 5,593 stars are those of `nearbyStars()`, nearest first.
 *
 * @example
 * ```ts
 * import { catalogueCounts } from "@johnmorrisdotca/hoshi-stars/catalogue";
 * import { nearbyLayer } from "@johnmorrisdotca/hoshi-stars/catalogue/nearby";
 *
 * console.log(nearbyLayer.layer, nearbyLayer.stars().length, catalogueCounts({ layers: ["bright", nearbyLayer] }).map((count) => count.stars)); // nearby 5593 [ 5080, 5593 ]
 * ```
 */
export const nearbyLayer: CatalogueSource = Object.freeze({
  layer: "nearby" as const,
  stars: (): readonly CatalogueStar[] => (records ??= Object.freeze(nearbyStars().map((star) => entryOf(star)))),
});
