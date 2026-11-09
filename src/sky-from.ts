// The sky as seen from another star, or from any point in space: every star with a distance moved to where it would appear, with the brightness it would have, and the Sun among them.
// The sky-from tier (`@johnmorrisdotca/hoshi-stars/sky-from`): it reads the bright-star table and nothing else, so it adds no data of its own. Pure: no DOM, no clock, no state.
import type { NearbyStar } from "./nearby.ts";
import { starByName, starDistance, stars, type Star } from "./stars.ts";

const RADIANS = Math.PI / 180;
const LIGHT_YEARS_PER_PARSEC = 3.261563777;

/** The Sun's absolute visual magnitude (the brightness it has at 10 parsecs): 4.83. */
const SUN_ABSOLUTE_MAGNITUDE = 4.83;
/** The Sun's B-V colour index: 0.65. */
const SUN_COLOUR_INDEX = 0.65;

/**
 * Where a sky is seen from: a bright star, a nearby star (from `/nearby`), a name `starByName` finds, or a point `{ x, y, z }` in parsecs on the J2000 equatorial axes with the Sun at the origin (x toward right ascension 0, z toward the north pole). A star must have a distance (a parallax above 0).
 *
 * @example
 * ```ts
 * import { skyFrom, type SkyFromViewpoint } from "@johnmorrisdotca/hoshi-stars/sky-from";
 *
 * const viewpoint: SkyFromViewpoint = "Rigil Kentaurus";
 * console.log(skyFrom(viewpoint, { magnitude: 1 }).length);
 * ```
 */
export type SkyFromViewpoint = Star | NearbyStar | string | { x: number; y: number; z: number };

/**
 * One star as seen from a viewpoint: where it is in that sky, how far, and how bright.
 *
 * @example
 * ```ts
 * import { skyFrom, type SeenStar } from "@johnmorrisdotca/hoshi-stars/sky-from";
 *
 * const sun: SeenStar = skyFrom("Rigil Kentaurus").find((star) => star.id === "sun")!;
 * console.log(sun.magnitude.toFixed(2));
 * ```
 */
export interface SeenStar {
  /** A key that stays the same: `hr-2491` for a bright star, `gctp-3278` for a nearby star, `sun` for the Sun. */
  id: string;
  /** The common name, `Sun` for the Sun, else `undefined`. */
  name: string | undefined;
  /** The Bayer letter or Flamsteed number and constellation (`α CMa`) where there is one, else `undefined`. */
  designation: string | undefined;
  /** Right ascension in degrees seen from the viewpoint, 0 up to 360, on the same J2000 equatorial axes as the Earth's sky. */
  rightAscension: number;
  /** Declination in degrees seen from the viewpoint, -90 to 90. */
  declination: number;
  /** The distance from the viewpoint in light-years. */
  lightYears: number;
  /** The same distance in parsecs. */
  parsecs: number;
  /** The apparent visual magnitude from the viewpoint: smaller is brighter. It is the absolute magnitude plus 5 log10(distance / 10 parsecs). */
  magnitude: number;
  /** The visual magnitude the star would have at 10 parsecs, worked out from its magnitude and distance from the Sun. */
  absoluteMagnitude: number;
  /** The colour index B-V, or `undefined` where the catalogue has none. Colour does not change with distance. */
  colourIndex: number | undefined;
  /** The catalogue's star, or `undefined` for the Sun. Its position, magnitude and distance are the view from the Sun; the ones above are from the viewpoint. */
  star: Star | NearbyStar | undefined;
}

/**
 * A list of seen stars, brightest first, with `skipped`: how many stars of the table could not be moved: they have no distance (a parallax of 0 or less) or, for a nearby star, no magnitude, or they lie nearer to the viewpoint than the error of its distance. They are left out.
 *
 * @example
 * ```ts
 * import { skyFrom, type SeenSky } from "@johnmorrisdotca/hoshi-stars/sky-from";
 *
 * const sky: SeenSky = skyFrom("Sirius");
 * console.log(sky.length, sky.skipped);
 * ```
 */
export type SeenSky = SeenStar[] & { skipped: number };

/**
 * The options of `skyFrom`.
 *
 * @example
 * ```ts
 * import { skyFrom, type SkyFromOptions } from "@johnmorrisdotca/hoshi-stars/sky-from";
 *
 * const options: SkyFromOptions = { magnitude: 3 };
 * console.log(skyFrom("Vega", options).length);
 * ```
 */
export interface SkyFromOptions {
  /** The faintest apparent magnitude from the viewpoint to include (a star of exactly that magnitude is in). All of them when left out. */
  magnitude?: number;
  /** Move this list instead of the 5,080 bright stars, for example `[...stars(), ...nearbyStars()]`. The Sun is added either way. */
  among?: readonly (Star | NearbyStar)[];
}

type Vector = [number, number, number];

const isStar = (thing: Star | NearbyStar): thing is Star => "hr" in thing;
const keyOf = (thing: Star | NearbyStar): string => (isStar(thing) ? `hr-${thing.hr}` : thing.id);

function toVector(rightAscension: number, declination: number, length: number): Vector {
  const ra = rightAscension * RADIANS;
  const dec = declination * RADIANS;
  const flat = Math.cos(dec) * length;
  return [flat * Math.cos(ra), flat * Math.sin(ra), Math.sin(dec) * length];
}

/**
 * The sky as seen from another star or point in space. Each star with a distance is placed in three dimensions from its position and parallax, the viewpoint is subtracted, and what is left is its direction and distance from there; its
 * apparent magnitude is `m' = M + 5 log10(d' / 10 parsecs)` from its absolute magnitude `M`. The Sun is among the stars (absolute magnitude 4.83, colour index 0.65): from Alpha Centauri it is a star of magnitude 0.5 in Cassiopeia.
 * The directions are on the same J2000 axes as the Earth's sky, so a chart from there can use the same projections.
 *
 * Only a star with a distance can be moved, so the 2,517 of the 5,080 bright stars with no parallax are left out and counted in `skipped`, and a star too faint to be in the table from the Sun is missing even if it would be bright from the viewpoint.
 * The viewpoint star itself is left out, and so is a star nearer to the viewpoint than the error of the viewpoint's own distance (the other star of Alpha Centauri is 0.00004 light-years away by the positions, and the distance is good to 0.03: where it is from there is not known); it is counted in `skipped`. Distances from the parallaxes have errors (`starDistance` gives them): a star near the viewpoint, with a distance no better than its own error, can be anywhere. Positions are J2000 and are not carried by proper motion.
 *
 * @param viewpoint - A star, a nearby star, a name `starByName` finds, or `{ x, y, z }` in parsecs (Sun at the origin). From `{ x: 0, y: 0, z: 0 }` the sky is the Earth's, without the Sun.
 * @param options - `magnitude` (the faintest apparent magnitude to include) and `among` (the stars to move).
 * @returns A new list of seen stars, brightest first, with a `skipped` count.
 * @throws TypeError or RangeError, naming the argument, if the viewpoint is not valid, is a name no star has, or is a star with no distance.
 *
 * @example
 * ```ts
 * import { skyFrom } from "@johnmorrisdotca/hoshi-stars/sky-from";
 *
 * const sky = skyFrom("Rigil Kentaurus");
 * const sun = sky.find((star) => star.id === "sun")!;
 * console.log(sun.rightAscension.toFixed(1), sun.declination.toFixed(1), sun.magnitude.toFixed(2)); // 39.9 60.8 0.46
 * ```
 */
export function skyFrom(viewpoint: SkyFromViewpoint, options: SkyFromOptions = {}): SeenSky {
  const { magnitude, among } = options ?? {};
  if (magnitude !== undefined && (typeof magnitude !== "number" || Number.isNaN(magnitude))) throw new TypeError(`magnitude must be a number, got ${String(magnitude)}`);
  const faintest = magnitude ?? Number.POSITIVE_INFINITY;
  let here: Vector;
  let hereError = 0;
  let self: string | undefined;
  let target = viewpoint;
  if (typeof target === "string") {
    const found = starByName(target);
    if (found === undefined) throw new RangeError(`"${target}" is not a star this package knows (pass the star or a point { x, y, z } in parsecs)`);
    target = found;
  }
  if ("x" in target) {
    const { x, y, z } = target;
    if (typeof x !== "number" || typeof y !== "number" || typeof z !== "number") throw new TypeError("a point in space is { x, y, z } in parsecs");
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) throw new RangeError(`x, y and z must be finite numbers of parsecs, got ${x}, ${y}, ${z}`);
    here = [x * LIGHT_YEARS_PER_PARSEC, y * LIGHT_YEARS_PER_PARSEC, z * LIGHT_YEARS_PER_PARSEC];
  } else {
    if (target === null || typeof target !== "object" || typeof target.rightAscension !== "number" || typeof target.declination !== "number") throw new TypeError("viewpoint must be a star, a name or { x, y, z } in parsecs");
    const distance = starDistance(target);
    if (distance === undefined) throw new RangeError("the viewpoint star has no distance: a star with a parallax above 0 is needed");
    here = toVector(target.rightAscension, target.declination, distance.lightYears);
    hereError = distance.lightYearsError ?? 0;
    self = keyOf(target);
  }
  const found: SeenStar[] = [];
  let skipped = 0;
  const add = (id: string, name: string | undefined, designation: string | undefined, source: Vector, absoluteMagnitude: number, colourIndex: number | undefined, star: Star | NearbyStar | undefined): void => {
    const x = source[0] - here[0];
    const y = source[1] - here[1];
    const z = source[2] - here[2];
    const lightYears = Math.hypot(x, y, z);
    if (lightYears === 0) return;
    if (lightYears <= hereError) {
      skipped++;
      return;
    }
    const apparent = absoluteMagnitude + 5 * Math.log10(lightYears / LIGHT_YEARS_PER_PARSEC / 10);
    if (apparent > faintest) return;
    found.push({
      id,
      name,
      designation,
      rightAscension: ((Math.atan2(y, x) / RADIANS) % 360 + 360) % 360,
      declination: Math.atan2(z, Math.hypot(x, y)) / RADIANS,
      lightYears,
      parsecs: lightYears / LIGHT_YEARS_PER_PARSEC,
      magnitude: apparent,
      absoluteMagnitude,
      colourIndex,
      star,
    });
  };
  for (const star of among ?? stars()) {
    const key = keyOf(star);
    if (key === self) continue;
    const distance = starDistance(star);
    if (distance === undefined || star.magnitude === undefined) {
      skipped++;
      continue;
    }
    const absolute = star.magnitude - 5 * Math.log10(distance.lightYears / LIGHT_YEARS_PER_PARSEC / 10);
    add(key, star.name, star.designation, toVector(star.rightAscension, star.declination, distance.lightYears), absolute, isStar(star) ? star.colourIndex : undefined, star);
  }
  add("sun", "Sun", undefined, [0, 0, 0], SUN_ABSOLUTE_MAGNITUDE, SUN_COLOUR_INDEX, undefined);
  found.sort((a, b) => a.magnitude - b.magnitude);
  return Object.assign(found, { skipped });
}
