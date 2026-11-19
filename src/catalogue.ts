// The stars of the bright tier and the nearby tier as one catalogue: each star once, under an id that stays the same (`hr-` and the Bright Star Catalogue number, or `gctp-` and the Yale parallax catalogue's),
// with its grade and its distance with the range its error allows. The catalogue tier (`@johnmorrisdotca/hoshi-stars/catalogue`): it loads both tables, so a page that wants one tier imports that one. Pure: no DOM, no clock.
// The two tiers never hold the same star: the nearby tier was built without the Yale parallax catalogue's stars that the bright tier holds (by HD number, else by position and magnitude), so the union counts every star once.
import { checkGrade, starGrade, type StarGrade } from "./accuracy.ts";
import { nearbyStarByName, nearbyStars, type NearbyStar } from "./nearby.ts";
import { starByHr, starDistance, stars, type Star, type StarDistance } from "./stars.ts";

/**
 * The tier a star of the catalogue is from: `bright` (the 5,080 of the Yale Bright Star Catalogue, the main import) or `nearby` (the Yale parallax catalogue's stars the bright tier leaves out, `/nearby`).
 *
 * @example
 * ```ts
 * import { type CatalogueLayer } from "@johnmorrisdotca/hoshi-stars/catalogue";
 *
 * const layer: CatalogueLayer = "nearby";
 * console.log(layer);
 * ```
 */
export type CatalogueLayer = "bright" | "nearby";

/**
 * The tiers the catalogue joins, in the order it reads them.
 *
 * @example
 * ```ts
 * import { CATALOGUE_LAYERS } from "@johnmorrisdotca/hoshi-stars/catalogue";
 *
 * console.log(CATALOGUE_LAYERS.join(", ")); // bright, nearby
 * ```
 */
export const CATALOGUE_LAYERS: readonly CatalogueLayer[] = Object.freeze(["bright", "nearby"]);

/**
 * One star of the catalogue: the same few values for a star of either tier, its grade, its distance, and the tier's own record in `star` for everything else.
 *
 * @example
 * ```ts
 * import { catalogueStar, type CatalogueStar } from "@johnmorrisdotca/hoshi-stars/catalogue";
 *
 * const proxima: CatalogueStar = catalogueStar("gctp-3278")!;
 * console.log(proxima.layer, proxima.name, proxima.grade, proxima.distance?.lightYears.toFixed(2));
 * ```
 */
export interface CatalogueStar {
  /** The id that stays the same: `hr-` and the HR number for a bright star (`hr-2491`, Sirius), `gctp-` and the catalogue number for a nearby star (`gctp-3278`, Proxima Centauri). The same ids `/distance`, `/names` and `/sky-from` use. */
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
  /** The V magnitude, or `undefined` for the few nearby stars the Yale parallax catalogue gives none (`starAccuracy(star).magnitude` says what kind it is). */
  magnitude: number | undefined;
  /** The grade, A, B or C, by `GRADE_RULES` of `/accuracy`. */
  grade: StarGrade;
  /** The distance, its error and its range in light-years (`starDistance`), or `undefined` where there is no parallax or it is 0 or less. */
  distance: StarDistance | undefined;
  /** The tier's own record: a `Star` for `bright`, a `NearbyStar` for `nearby`. `starAccuracy(star)` gives the source and error of each value. */
  star: Star | NearbyStar;
}

/**
 * How many stars a tier holds, and how many of them have each grade.
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

const made = new Map<Star | NearbyStar, CatalogueStar>();

/**
 * A star's id in the catalogue: `hr-` and its HR number for a bright star, its own `id` (`gctp-` and its number) for a nearby star.
 *
 * @param star - A bright star or a nearby star.
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
export function catalogueId(star: Star | NearbyStar): string {
  return "hr" in star ? `hr-${star.hr}` : star.id;
}

function entryOf(star: Star | NearbyStar): CatalogueStar {
  let entry = made.get(star);
  if (entry === undefined) {
    entry = Object.freeze({
      id: catalogueId(star),
      layer: "hr" in star ? "bright" : "nearby",
      name: star.name,
      designation: star.designation,
      hd: star.hd,
      rightAscension: star.rightAscension,
      declination: star.declination,
      magnitude: star.magnitude,
      grade: starGrade(star),
      distance: starDistance(star),
      star,
    });
    made.set(star, entry);
  }
  return entry;
}

function checkLayers(layers: unknown): readonly CatalogueLayer[] {
  if (layers === undefined) return CATALOGUE_LAYERS;
  if (!Array.isArray(layers)) throw new TypeError(`layers must be an array, got ${String(layers)}`);
  for (const layer of layers) if (!CATALOGUE_LAYERS.includes(layer)) throw new RangeError(`layers must hold only "bright" and "nearby", got ${String(layer)}`);
  return layers;
}

/**
 * The stars of both tiers as one list, each star once, brightest first (the few with no magnitude last).
 *
 * @param options - `layers`: the tiers to include (both where left out). `magnitude`: the faintest V to include (a star with no magnitude is then left out). `minGrade`: the worst grade to include (`"B"` keeps grades A and B).
 * @returns A fresh array of the shared, frozen records.
 * @throws TypeError if `layers` is not an array or `magnitude` not a number; RangeError if `layers` names another tier or `minGrade` is not `"A"`, `"B"` or `"C"`.
 *
 * @example
 * ```ts
 * import { catalogueStars } from "@johnmorrisdotca/hoshi-stars/catalogue";
 *
 * const sure = catalogueStars({ minGrade: "A" });
 * console.log(sure.length, sure.filter((one) => one.layer === "nearby").length); // 303 235
 * ```
 */
export function catalogueStars(options: { layers?: readonly CatalogueLayer[]; magnitude?: number; minGrade?: StarGrade } = {}): CatalogueStar[] {
  const layers = checkLayers(options?.layers);
  const minGrade = options?.minGrade === undefined ? undefined : checkGrade(options.minGrade, "minGrade");
  const filter = { ...(options?.magnitude === undefined ? {} : { magnitude: options.magnitude }), ...(minGrade === undefined ? {} : { minGrade }) };
  const found: CatalogueStar[] = [];
  if (layers.includes("bright")) for (const star of stars(filter)) found.push(entryOf(star));
  if (layers.includes("nearby")) for (const star of nearbyStars(filter)) found.push(entryOf(star));
  return found.sort((a, b) => (a.magnitude ?? Number.POSITIVE_INFINITY) - (b.magnitude ?? Number.POSITIVE_INFINITY));
}

/**
 * A star of the catalogue by its id, ignoring case: `hr-2491` (Sirius) or `gctp-3278` (Proxima Centauri).
 *
 * @param id - The id, as `catalogueId` gives it.
 * @returns The star, or `undefined` where no star of either tier has that id.
 *
 * @example
 * ```ts
 * import { catalogueStar } from "@johnmorrisdotca/hoshi-stars/catalogue";
 *
 * console.log(catalogueStar("hr-2491")?.name, catalogueStar("gctp-4098")?.name, catalogueStar("hr-0")); // Sirius Barnard's Star undefined
 * ```
 */
export function catalogueStar(id: string): CatalogueStar | undefined {
  const text = String(id).trim().toLowerCase();
  const bright = /^hr-([1-9]\d*)$/.exec(text);
  if (bright !== null) {
    const star = starByHr(Number(bright[1]));
    return star === undefined ? undefined : entryOf(star);
  }
  const nearby = /^gctp-(\d+(?:\.\d+)?)$/.exec(text);
  if (nearby === null) return undefined;
  const star = nearbyStarByName(`gctp ${nearby[1]}`);
  return star === undefined || star.id !== `gctp-${nearby[1]}` ? undefined : entryOf(star);
}

/**
 * The stars of each tier and of each grade: the headline counts.
 *
 * @returns One count for each tier, in the order of `CATALOGUE_LAYERS`.
 *
 * @example
 * ```ts
 * import { catalogueCounts } from "@johnmorrisdotca/hoshi-stars/catalogue";
 *
 * for (const count of catalogueCounts()) console.log(`${count.layer}: ${count.stars} (A ${count.grades.A}, B ${count.grades.B}, C ${count.grades.C})`);
 * ```
 */
export function catalogueCounts(): CatalogueCount[] {
  return CATALOGUE_LAYERS.map((layer) => {
    const grades: Record<StarGrade, number> = { A: 0, B: 0, C: 0 };
    const all = catalogueStars({ layers: [layer] });
    for (const one of all) grades[one.grade] += 1;
    return { layer, stars: all.length, grades: Object.freeze(grades) };
  });
}
