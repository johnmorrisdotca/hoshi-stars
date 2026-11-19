// The faint layer of the catalogue (`@johnmorrisdotca/hoshi-stars/catalogue/faint`): the faint stars a page has loaded from the tiles (`/faint`), as catalogue records, each marked where it is a nearby star too.
// It holds no star itself: the page loads the tiles of the sky it shows (`faintSky`) and hands the stars to `faintLayer`. It loads the table of the nearby stars the tiles also hold (`./data/nearby-faint.ts`,
// made by scripts/make-nearby-faint.ts), and neither the bright nor the nearby table. Pure: no DOM, no clock, no fetch.
import { entryOf, faintKey, type CatalogueSource } from "./catalogue-core.ts";
import { NEARBY_FAINT_COUNTS, NEARBY_FAINT_ROWS } from "./data/nearby-faint.ts";
import type { FaintStar } from "./faint-core.ts";

let nearbyOf: Map<string, string> | undefined;
const loaded = (): Map<string, string> => (nearbyOf ??= new Map(NEARBY_FAINT_ROWS.split("\n").map((row) => row.split("|")).map(([gctp, key]) => [key!, `gctp-${gctp}`])));

/**
 * How the nearby stars were matched in the faint tiles: `nearby` stars in all, `matched` (the tiles hold exactly one faint star that fits; it is the same star), `ambiguous` (several fit, or two nearby stars want one;
 * nothing is left out), `new` (the tiles hold none: most are fainter than 12), `noMagnitude` (no magnitude to match by), `matchedCoarse` (matched while on the Yale catalogue's coarse position) and
 * `ucac4Positions` (of those, the ones whose match was sure enough to take UCAC4's position: `positionSource` `"UCAC4"` of `/nearby`).
 *
 * @example
 * ```ts
 * import { NEARBY_IN_FAINT } from "@johnmorrisdotca/hoshi-stars/catalogue/faint";
 *
 * console.log(NEARBY_IN_FAINT.matched, NEARBY_IN_FAINT.ambiguous, NEARBY_IN_FAINT.new); // 2135 55 3368
 * ```
 */
export const NEARBY_IN_FAINT: Readonly<{ nearby: number; matched: number; ambiguous: number; new: number; noMagnitude: number; matchedCoarse: number; ucac4Positions: number }> = Object.freeze({ ...NEARBY_FAINT_COUNTS });

/**
 * The id of the nearby star a faint star is, or `undefined` where it is none of them. The faint star must be one the tiles decode (from `faintSky`, `decodeFaintTile` or the data door's UCAC4 source).
 *
 * @param star - A faint star.
 * @returns `gctp-` and the nearby star's number, or `undefined`.
 *
 * @example
 * ```ts
 * import { nearbyIdOfFaint } from "@johnmorrisdotca/hoshi-stars/catalogue/faint";
 *
 * console.log(nearbyIdOfFaint({ rightAscension: 154.901115, declination: 19.869993 }), nearbyIdOfFaint({ rightAscension: 0, declination: 0 })); // gctp-2420 undefined
 * ```
 */
export function nearbyIdOfFaint(star: Pick<FaintStar, "rightAscension" | "declination">): string | undefined {
  return loaded().get(faintKey(star));
}

/**
 * A faint layer of the stars a page has loaded: hand it to `catalogueStars`, `catalogueStar` or `catalogueCounts` of `/catalogue` in `layers`. Every faint star is grade C (it has no parallax); one that is a nearby star
 * has that star's id in `sameAs` and is left out of a list that holds `nearbyLayer` too.
 *
 * @param stars - The faint stars, as `faintSky().stars(field, limit).stars` gives them.
 * @returns The layer.
 * @throws TypeError if `stars` is not iterable.
 *
 * @example
 * ```ts no-run
 * import { catalogueStars } from "@johnmorrisdotca/hoshi-stars/catalogue";
 * import { faintSky } from "@johnmorrisdotca/hoshi-stars/faint";
 * import { faintLayer } from "@johnmorrisdotca/hoshi-stars/catalogue/faint";
 * import { nearbyLayer } from "@johnmorrisdotca/hoshi-stars/catalogue/nearby";
 *
 * const sky = faintSky();
 * const field = { rightAscension: 154.9, declination: 19.87, radius: 0.2 };
 * await sky.load(field, 12);
 * const here = catalogueStars({ layers: ["bright", nearbyLayer, faintLayer(sky.stars(field, 12).stars)] });
 * console.log(here.filter((one) => one.name === "AD Leonis").map((one) => one.layer)); // [ 'nearby' ]: the faint copy is left out
 * ```
 */
export function faintLayer(stars: Iterable<FaintStar>): CatalogueSource {
  if (stars === null || typeof (stars as Iterable<FaintStar>)?.[Symbol.iterator] !== "function") throw new TypeError(`stars must be iterable, got ${String(stars)}`);
  const records = Object.freeze([...stars].map((star) => entryOf(star, nearbyIdOfFaint(star))));
  return Object.freeze({ layer: "faint" as const, stars: () => records });
}
