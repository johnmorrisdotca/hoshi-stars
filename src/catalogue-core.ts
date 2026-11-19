// The catalogue's shapes and the work every layer shares: one record for a star of any tier, the id that stays the same, and the list, the lookup and the counts over the layers a page asks for.
// Not an entry point: `./catalogue.ts` (the bright layer), `./catalogue-nearby.ts` and `./catalogue-faint.ts` import it, so that a layer loads no table of another. Pure: no DOM, no clock, no data.
import { checkGrade, gradeAtLeast, starGrade, type StarGrade } from "./accuracy.ts";
import type { FaintStar } from "./faint-core.ts";
import type { NearbyStar } from "./nearby.ts";
import { starDistance, type StarDistance } from "./star-distance.ts";
import type { Star } from "./stars.ts";

/**
 * The tier a star of the catalogue is from: `bright` (the 5,080 of the Yale Bright Star Catalogue, always loaded), `nearby` (the Yale parallax catalogue's stars the bright tier leaves out) or `faint` (UCAC4's, from the tiles a page loaded).
 *
 * @example
 * ```ts
 * import { type CatalogueLayer } from "@johnmorrisdotca/hoshi-stars/catalogue";
 *
 * const layer: CatalogueLayer = "nearby";
 * console.log(layer);
 * ```
 */
export type CatalogueLayer = "bright" | "nearby" | "faint";

/**
 * The tiers, brightest first. Only `bright` is loaded with `/catalogue`; `nearbyLayer` (`/catalogue/nearby`) and `faintLayer` (`/catalogue/faint`) bring the others.
 *
 * @example
 * ```ts
 * import { CATALOGUE_LAYERS } from "@johnmorrisdotca/hoshi-stars/catalogue";
 *
 * console.log(CATALOGUE_LAYERS.join(", ")); // bright, nearby, faint
 * ```
 */
export const CATALOGUE_LAYERS: readonly CatalogueLayer[] = Object.freeze(["bright", "nearby", "faint"]);

/**
 * One star of the catalogue: the same few values for a star of any tier, its grade, its distance, and the tier's own record in `star` for everything else.
 *
 * @example
 * ```ts
 * import { catalogueStar, type CatalogueStar } from "@johnmorrisdotca/hoshi-stars/catalogue";
 *
 * const sirius: CatalogueStar = catalogueStar("hr-2491")!;
 * console.log(sirius.layer, sirius.name, sirius.grade, sirius.distance?.lightYears.toFixed(2));
 * ```
 */
export interface CatalogueStar {
  /** The id that stays the same: `hr-` and the HR number for a bright star (`hr-2491`, Sirius), `gctp-` and the catalogue number for a nearby star (`gctp-3278`, Proxima Centauri; `gctp-5077b` for a companion listed under a bright star's number), the same ids `/distance`, `/names` and `/sky-from` use.
   * A faint star's is `faint-` and its position as the tile gives it, to a millionth of a degree (`faint-154.901115_19.869993`, the faint copy of AD Leonis): it holds while the tiles are not rebuilt. */
  id: string;
  /** The tier the star is from. */
  layer: CatalogueLayer;
  /** The common name, or `undefined`. */
  name: string | undefined;
  /** The Bayer letter or Flamsteed number and constellation (`α CMa`), or `undefined`. */
  designation: string | undefined;
  /** The Henry Draper number, or `undefined`. */
  hd: number | undefined;
  /** Right ascension in degrees at J2000 (epoch 2000), 0 up to 360. */
  rightAscension: number;
  /** Declination in degrees at J2000 (epoch 2000), -90 to 90. */
  declination: number;
  /** The magnitude, or `undefined` for the few nearby stars the Yale parallax catalogue gives none (`starAccuracy(star).magnitude` says what kind a bright or nearby star's is; a faint star's is APASS's V or UCAC4's model magnitude). */
  magnitude: number | undefined;
  /** The grade, A, B or C, by `GRADE_RULES` of `/accuracy`. A faint star has no parallax, so it is C. */
  grade: StarGrade;
  /** The distance, its error and its range in light-years (`starDistance`), or `undefined` where there is no parallax or it is 0 or less. */
  distance: StarDistance | undefined;
  /** The id of the same star in another layer, where one holds it too (a faint star that is a nearby star: `gctp-…`), else `undefined`. A list that holds that layer leaves this record out, so the star is counted once. */
  sameAs: string | undefined;
  /** The tier's own record: a `Star`, a `NearbyStar` or a `FaintStar`. `starAccuracy(star)` gives the source and error of each value of a bright or nearby star. */
  star: Star | NearbyStar | FaintStar;
}

/**
 * A layer handed to the catalogue: `nearbyLayer` of `/catalogue/nearby`, or what `faintLayer` of `/catalogue/faint` makes. A page imports one when it needs it, so `/catalogue` alone loads only the bright stars.
 *
 * @example
 * ```ts
 * import { catalogueStars, type CatalogueSource } from "@johnmorrisdotca/hoshi-stars/catalogue";
 *
 * const { nearbyLayer } = await import("@johnmorrisdotca/hoshi-stars/catalogue/nearby");
 * const nearby: CatalogueSource = nearbyLayer;
 * console.log(catalogueStars({ layers: ["bright", nearby] }).length); // 10673
 * ```
 */
export interface CatalogueSource {
  /** The tier. */
  readonly layer: "nearby" | "faint";
  /** Its stars, as records, in its own order. */
  stars(): readonly CatalogueStar[];
}

/**
 * How many stars a tier holds in a list, and how many of them have each grade.
 *
 * @example
 * ```ts
 * import { catalogueCounts, type CatalogueCount } from "@johnmorrisdotca/hoshi-stars/catalogue";
 *
 * const bright: CatalogueCount = catalogueCounts()[0]!;
 * console.log(bright.layer, bright.stars, bright.grades.A);
 * ```
 */
export interface CatalogueCount {
  /** The tier. */
  layer: CatalogueLayer;
  /** The stars it holds. */
  stars: number;
  /** The stars of each grade. */
  grades: Readonly<Record<StarGrade, number>>;
}

/**
 * A star's id in the catalogue: `hr-` and its HR number for a bright star, its own `id` (`gctp-` and its number) for a nearby star, and `faint-` and its position to a millionth of a degree for a faint star.
 *
 * @param star - A bright star, a nearby star or a faint star.
 * @returns The id.
 *
 * @example
 * ```ts
 * import { starByName } from "@johnmorrisdotca/hoshi-stars";
 * import { catalogueId } from "@johnmorrisdotca/hoshi-stars/catalogue";
 *
 * console.log(catalogueId(starByName("Vega")!)); // hr-7001
 * ```
 */
export function catalogueId(star: Star | NearbyStar | FaintStar): string {
  if ("hr" in star) return `hr-${star.hr}`;
  if ("gctp" in star) return star.id;
  return `faint-${faintKey(star).replace(",", "_")}`;
}

/** A faint star's position to a millionth of a degree: the key the match with the nearby stars uses. */
export const faintKey = (star: Pick<FaintStar, "rightAscension" | "declination">): string => `${star.rightAscension.toFixed(6)},${star.declination.toFixed(6)}`;

const made = new WeakMap<object, CatalogueStar>();

/** The record of a star, made once and shared. */
export function entryOf(star: Star | NearbyStar | FaintStar, sameAs?: string): CatalogueStar {
  let entry = made.get(star);
  if (entry === undefined) {
    const known = "hr" in star || "gctp" in star;
    entry = Object.freeze({
      id: catalogueId(star),
      layer: "hr" in star ? "bright" : "gctp" in star ? "nearby" : "faint",
      name: known ? star.name : undefined,
      designation: known ? star.designation : undefined,
      hd: known ? star.hd : undefined,
      rightAscension: star.rightAscension,
      declination: star.declination,
      magnitude: star.magnitude,
      grade: starGrade(star),
      distance: known ? starDistance(star) : undefined,
      sameAs,
      star,
    });
    made.set(star, entry);
  }
  return entry;
}

/** The layers of an option: `"bright"` (the default) and the sources handed in, each once. */
export function layersOf(layers: unknown, bright: CatalogueSource | { readonly layer: "bright"; stars(): readonly CatalogueStar[] }): Array<{ layer: CatalogueLayer; stars(): readonly CatalogueStar[] }> {
  if (layers === undefined) return [bright];
  if (!Array.isArray(layers)) throw new TypeError(`layers must be an array, got ${String(layers)}`);
  const out: Array<{ layer: CatalogueLayer; stars(): readonly CatalogueStar[] }> = [];
  for (const layer of layers) {
    if (layer === "bright") out.push(bright);
    else if (layer === "nearby" || layer === "faint") throw new RangeError(`the ${layer} layer loads on request: pass ${layer}Layer${layer === "faint" ? "(stars)" : ""} from @johnmorrisdotca/hoshi-stars/catalogue/${layer} in layers`);
    else if (typeof layer === "object" && layer !== null && (layer.layer === "nearby" || layer.layer === "faint") && typeof layer.stars === "function") out.push(layer);
    else throw new RangeError(`layers must hold "bright", nearbyLayer or a faintLayer, got ${String(layer)}`);
  }
  const names = out.map((one) => one.layer);
  if (new Set(names).size !== names.length) throw new RangeError(`layers holds the ${names.find((name, i) => names.indexOf(name) !== i)} layer twice`);
  return out;
}

/** The records of the layers, each star once (a record whose `sameAs` names a star of another layer in the list is left out), filtered by magnitude and grade, brightest first. */
export function listOf(layers: ReadonlyArray<{ layer: CatalogueLayer; stars(): readonly CatalogueStar[] }>, magnitude: unknown, minGrade: unknown): CatalogueStar[] {
  if (magnitude !== undefined && (typeof magnitude !== "number" || Number.isNaN(magnitude))) throw new TypeError(`magnitude must be a number, got ${String(magnitude)}`);
  const worst = minGrade === undefined ? undefined : checkGrade(minGrade, "minGrade");
  const prefixes = layers.map((one) => (one.layer === "bright" ? "hr-" : one.layer === "nearby" ? "gctp-" : "faint-"));
  const found: CatalogueStar[] = [];
  for (const one of layers) {
    for (const entry of one.stars()) {
      if (entry.sameAs !== undefined && prefixes.some((prefix) => entry.sameAs!.startsWith(prefix))) continue;
      if (magnitude !== undefined && (entry.magnitude === undefined || entry.magnitude > magnitude)) continue;
      if (worst !== undefined && !gradeAtLeast(entry.grade, worst)) continue;
      found.push(entry);
    }
  }
  return found.sort((a, b) => (a.magnitude ?? Number.POSITIVE_INFINITY) - (b.magnitude ?? Number.POSITIVE_INFINITY) || 0);
}
