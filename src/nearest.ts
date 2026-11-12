// What is near a star, a deep-sky object or a point: by angle on the sky, or by distance in space, and which constellations touch which.
// The nearest tier (`@johnmorrisdotca/hoshi-stars/nearest`): it reads the bright-star table and the Messier table, and the boundary rings for the neighbours. A query looks at every candidate (about a millisecond over all 5,080 stars). Pure: no DOM, no clock, no state beyond the cached neighbour table.
import { BOUNDARY_RINGS } from "./data/boundaries.ts";
import { constellation, constellations, type Constellation } from "./constellations.ts";
import { deepSkyObject, messier, type DeepSkyObject } from "./deep-sky.ts";
import type { NearbyStar } from "./nearby.ts";
import { checkGrade, gradeAtLeast, starGrade, type StarGrade } from "./accuracy.ts";
import { starByName, starDistance, starDistanceLightYears, starPosition, stars, type Star } from "./stars.ts";
import { moment, type When } from "./when.ts";

const RADIANS = Math.PI / 180;
const LIGHT_YEARS_PER_PARSEC = 3.261563777;

/**
 * Where a query starts: a star, a deep-sky object, a name `starByName` or `deepSkyObject` (the Messier objects) finds, or a point in J2000 degrees. A point may carry `lightYears` to be used with `by: "space"`. A point in space is `{ x, y, z }` in parsecs on the J2000 equatorial axes with the Sun at the origin (x toward right ascension 0, z toward the north pole), like the star browser of a planetarium; it works by angle too, as the direction from the Sun.
 *
 * @example
 * ```ts
 * import { nearest, type NearestTarget } from "@johnmorrisdotca/hoshi-stars/nearest";
 *
 * const target: NearestTarget = { rightAscension: 83.8, declination: -5.4 };
 * console.log(nearest(target, { count: 1 })[0]?.thing.name);
 * ```
 */
export type NearestTarget = Star | NearbyStar | DeepSkyObject | string | { rightAscension: number; declination: number; lightYears?: number } | { x: number; y: number; z: number };

/**
 * Something a query can find: a bright star, a nearby star (from `/nearby`, passed in `among`) or a deep-sky object.
 *
 * @example
 * ```ts
 * import { nearest, type NearestThing } from "@johnmorrisdotca/hoshi-stars/nearest";
 *
 * const thing: NearestThing = nearest("Sirius", { count: 1 })[0]!.thing;
 * console.log(thing.rightAscension.toFixed(1));
 * ```
 */
export type NearestThing = Star | NearbyStar | DeepSkyObject;

/**
 * One answer of a query by angle: the thing and its angle from the target, in degrees.
 *
 * @example
 * ```ts
 * import { nearest, type NearestInSky } from "@johnmorrisdotca/hoshi-stars/nearest";
 *
 * const first: NearestInSky = nearest("Mizar", { count: 1 })[0]!;
 * console.log(first.thing.name, first.angle.toFixed(2));
 * ```
 */
export interface NearestInSky<T extends NearestThing = Star> {
  /** The star or deep-sky object. */
  thing: T;
  /** The angle on the sky from the target, in degrees, 0 to 180. */
  angle: number;
}

/**
 * One answer of a query by distance in space.
 *
 * @example
 * ```ts
 * import { nearest, type NearestInSpace } from "@johnmorrisdotca/hoshi-stars/nearest";
 *
 * const first: NearestInSpace = nearest("Sirius", { by: "space", count: 1 })[0]!;
 * console.log(first.thing.name, first.distance.toFixed(1), "light-years");
 * ```
 */
export interface NearestInSpace<T extends Star | NearbyStar = Star> {
  /** The star. */
  thing: T;
  /** The distance from the target in light-years, from the two parallaxes and the angle between them. */
  distance: number;
  /** The same distance in parsecs. */
  parsecs: number;
  /** The uncertainty of `distance` in light-years, or `undefined` where the star or the target has no parallax error (`parallaxErrorMas`): the 2,329 bright stars with a measured parallax have one, the Bright Star Catalogue's own parallaxes do not. A target that is a point is taken as exact. */
  error: number | undefined;
  /** The nearest and the farthest the distance can be within one `error`, in light-years (the nearest is never below 0), or `undefined` where `error` is. */
  range: readonly [number, number] | undefined;
  /** `true` where this answer's `range` overlaps the range of the answer before it or after it in the full list: the order of the two is then not settled by the data, so call it a tie. `false` where there is no `error` to compare. */
  tied: boolean;
}

/**
 * A list of answers, nearest first, with `skipped`: how many candidates had no usable distance and so were left out of a query `by: "space"` (a parallax of 0 or less, or a deep-sky object). It is 0 for a query by angle.
 *
 * @example
 * ```ts
 * import { nearest } from "@johnmorrisdotca/hoshi-stars/nearest";
 *
 * const found = nearest("Sirius", { by: "space", count: 3 });
 * console.log(found.length, found.skipped > 2000);
 * ```
 */
export type NearestList<T> = T[] & { skipped: number };

/**
 * The options of `nearest` and `within`.
 *
 * @example
 * ```ts
 * import { nearest, type NearestOptions } from "@johnmorrisdotca/hoshi-stars/nearest";
 *
 * const options: NearestOptions = { count: 5, magnitude: 3 };
 * console.log(nearest("Sirius", options).map((found) => found.thing.name));
 * ```
 */
export interface NearestOptions {
  /** How many to return, nearest first (default 10; `within` returns all it finds unless this is set). */
  count?: number;
  /** Only answers this near: degrees by angle, light-years by space. */
  within?: number;
  /** What to look through: `"star"` (the default, the Yale bright stars) or `"deep-sky"` (the Messier objects). */
  kind?: "star" | "deep-sky";
  /** `"sky"` (the default) sorts by the angle on the sky; `"space"` sorts by the distance in space, from the parallaxes. */
  by?: "sky" | "space";
  /** A moment: the stars are carried to it by their proper motion before the angles are measured. Precession turns every object the same way, so it does not change an angle. J2000 when left out. */
  date?: When;
  /** The faintest to include, as in `stars({ magnitude })`: a thing of exactly that magnitude is in. A thing with no magnitude is left out. */
  magnitude?: number;
  /** Look through this list instead of the table that `kind` names, for example `deepSky()` from `/deep-sky/ngc-ic`, or `[...stars(), ...nearbyStars()]` to count the nearby stars with the bright ones. */
  among?: readonly NearestThing[];
  /** Only stars of this grade or better (`"B"` keeps A and B; see `starAccuracy` in `/accuracy`). A deep-sky object has no grade and is left out; with `kind: "deep-sky"` it is an error. */
  minGrade?: StarGrade;
}

type SkyOptions = Omit<NearestOptions, "by" | "kind" | "among"> & { by?: "sky" };
type Vector = [number, number, number];

const isStar = (thing: NearestThing): thing is Star => "hr" in thing;
const isNearby = (thing: NearestThing): thing is NearbyStar => "gctp" in thing;
const lightYearsOf = (thing: NearestThing): number | undefined => (isStar(thing) ? starDistanceLightYears(thing) : isNearby(thing) ? thing.lightYears : undefined);

function unit(rightAscension: number, declination: number): Vector {
  const ra = rightAscension * RADIANS;
  const dec = declination * RADIANS;
  const cosine = Math.cos(dec);
  return [cosine * Math.cos(ra), cosine * Math.sin(ra), Math.sin(dec)];
}

function placeOf(thing: NearestThing, date: number | undefined): { rightAscension: number; declination: number } {
  return (isStar(thing) || isNearby(thing)) && date !== undefined ? starPosition(thing, date) : thing;
}

function same(a: NearestThing, b: NearestThing): boolean {
  if (a === b) return true;
  return isStar(a) && isStar(b) ? a.hr === b.hr : !isStar(a) && !isStar(b) && a.id === b.id;
}

type Point3 = { x: number; y: number; z: number };

function resolve(target: NearestTarget): NearestThing | { rightAscension: number; declination: number; lightYears?: number } | Point3 {
  if (typeof target === "string") {
    const found = starByName(target) ?? deepSkyObject(target);
    if (found === undefined) throw new RangeError(`"${target}" is not a star or a Messier object this package knows (pass the object or a point)`);
    return found;
  }
  const { rightAscension, declination, x, y, z } = (target ?? {}) as { rightAscension?: unknown; declination?: unknown; x?: unknown; y?: unknown; z?: unknown };
  if (rightAscension === undefined && declination === undefined && x !== undefined) {
    if (typeof x !== "number" || typeof y !== "number" || typeof z !== "number") throw new TypeError("a point in space is { x, y, z } in parsecs");
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) throw new RangeError(`x, y and z must be finite numbers of parsecs, got ${x}, ${y}, ${z}`);
    return target as Point3;
  }
  if (typeof rightAscension !== "number" || typeof declination !== "number") throw new TypeError("target must be a star, a deep-sky object, a name or { rightAscension, declination } in degrees");
  if (!Number.isFinite(rightAscension)) throw new RangeError(`rightAscension must be a finite number of degrees, got ${rightAscension}`);
  if (!Number.isFinite(declination) || declination < -90 || declination > 90) throw new RangeError(`declination must be from -90 to 90 degrees, got ${declination}`);
  return target;
}

function number(name: string, value: unknown, least: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) throw new TypeError(`${name} must be a number, got ${String(value)}`);
  if (value < least) throw new RangeError(`${name} must be ${least} or more, got ${value}`);
  return value;
}

function run(target: NearestTarget, options: NearestOptions, defaultCount: number): NearestList<NearestInSky<NearestThing> | NearestInSpace<Star | NearbyStar>> {
  const { by = "sky", kind = "star", date, magnitude, among } = options ?? {};
  if (by !== "sky" && by !== "space") throw new RangeError(`by must be "sky" or "space", got ${String(by)}`);
  if (kind !== "star" && kind !== "deep-sky") throw new RangeError(`kind must be "star" or "deep-sky", got ${String(kind)}`);
  const count = options?.count === undefined ? defaultCount : number("count", options.count, 0);
  if (!Number.isInteger(count) && count !== Number.POSITIVE_INFINITY) throw new RangeError(`count must be a whole number or Infinity, got ${count}`);
  const limit = options?.within === undefined ? Number.POSITIVE_INFINITY : number("within", options.within, 0);
  const faintest = magnitude === undefined ? Number.POSITIVE_INFINITY : number("magnitude", magnitude, Number.NEGATIVE_INFINITY);
  const minGrade = options?.minGrade === undefined ? undefined : checkGrade(options.minGrade, "minGrade");
  if (minGrade !== undefined && kind === "deep-sky" && among === undefined) throw new RangeError("minGrade grades stars: a deep-sky object has no grade");
  const when = date === undefined ? undefined : moment(date, "date");
  const from = resolve(target);
  const cartesian = "x" in from ? (from as Point3) : undefined;
  let here: Vector;
  if (cartesian !== undefined) {
    const length = Math.hypot(cartesian.x, cartesian.y, cartesian.z);
    if (by === "sky" && length === 0) throw new RangeError("a point at the Sun has no direction: use by: \"space\"");
    here = by === "space" ? [cartesian.x * LIGHT_YEARS_PER_PARSEC, cartesian.y * LIGHT_YEARS_PER_PARSEC, cartesian.z * LIGHT_YEARS_PER_PARSEC] : [cartesian.x / length, cartesian.y / length, cartesian.z / length];
  } else {
    const origin = placeOf(from as NearestThing, when);
    here = unit(origin.rightAscension, origin.declination);
  }
  let hereLightYears = 0;
  let hereError: number | undefined = 0;
  if (by === "space" && cartesian !== undefined) hereLightYears = 1;
  else if (by === "space") {
    const known = typeof (from as { lightYears?: unknown }).lightYears === "number" ? (from as { lightYears: number }).lightYears : isStar(from as NearestThing) ? starDistanceLightYears(from as Star) : undefined;
    if (isStar(from as NearestThing)) hereError = starDistance(from as Star)?.lightYearsError;
    else if (isNearby(from as NearestThing)) hereError = (from as NearbyStar).lightYearsError;
    if (known === undefined || !(known > 0)) throw new RangeError("the target has no distance: a star with a parallax, a point with lightYears or a point { x, y, z } is needed for by: \"space\"");
    hereLightYears = known;
  }
  const named = "hr" in from || "id" in from;
  const candidates = among ?? (kind === "star" ? stars() : messier());
  const found: Array<{ thing: NearestThing; key: number; error: number | undefined }> = [];
  let skipped = 0;
  for (const thing of candidates) {
    if (named && same(from as NearestThing, thing)) continue;
    if (thing.magnitude === undefined ? faintest !== Number.POSITIVE_INFINITY : thing.magnitude > faintest) continue;
    if (minGrade !== undefined && (!(isStar(thing) || isNearby(thing)) || !gradeAtLeast(starGrade(thing), minGrade))) continue;
    const place = placeOf(thing, when);
    const there = unit(place.rightAscension, place.declination);
    if (by === "sky") {
      const cx = here[1] * there[2] - here[2] * there[1];
      const cy = here[2] * there[0] - here[0] * there[2];
      const cz = here[0] * there[1] - here[1] * there[0];
      const angle = Math.atan2(Math.hypot(cx, cy, cz), here[0] * there[0] + here[1] * there[1] + here[2] * there[2]) / RADIANS;
      if (angle <= limit) found.push({ thing, key: angle, error: undefined });
    } else {
      const lightYears = lightYearsOf(thing);
      if (lightYears === undefined) {
        skipped++;
        continue;
      }
      const distance = Math.hypot(there[0] * lightYears - here[0] * hereLightYears, there[1] * lightYears - here[1] * hereLightYears, there[2] * lightYears - here[2] * hereLightYears);
      if (distance > limit) continue;
      // Each distance's error moves the answer only along the line between the two stars: the part of it that points along the line of sight.
      const thereError = isNearby(thing) ? thing.lightYearsError : isStar(thing) ? starDistance(thing)?.lightYearsError : undefined;
      let error: number | undefined;
      if (hereError !== undefined && thereError !== undefined) {
        const along = (a: Vector) => (distance === 0 ? 1 : Math.abs(((there[0] * lightYears - here[0] * hereLightYears) * a[0] + (there[1] * lightYears - here[1] * hereLightYears) * a[1] + (there[2] * lightYears - here[2] * hereLightYears) * a[2]) / distance));
        error = Math.hypot(thereError * along(there), hereError * along(here));
      }
      found.push({ thing, key: distance, error });
    }
  }
  found.sort((a, b) => a.key - b.key);
  // Sorted by distance, a range that overlaps a later one overlaps the next one too, so the neighbours settle every tie.
  const ranges = found.map(({ key, error }): [number, number] | undefined => (error === undefined ? undefined : [Math.max(0, key - error), key + error]));
  const overlap = (a: [number, number] | undefined, b: [number, number] | undefined): boolean => a !== undefined && b !== undefined && a[0] <= b[1] && b[0] <= a[1];
  const list = found.slice(0, count).map(({ thing, key, error }, index) => (by === "sky" ? { thing, angle: key } : { thing: thing as Star | NearbyStar, distance: key, parsecs: key / LIGHT_YEARS_PER_PARSEC, error, range: ranges[index], tied: overlap(ranges[index], ranges[index - 1]) || overlap(ranges[index], ranges[index + 1]) }));
  return Object.assign(list, { skipped });
}

/**
 * The things nearest a star, a deep-sky object or a point, nearest first. By angle (`by: "sky"`, the default) it measures the angle on the sky with the form `atan2(|a x b|, a . b)` of unit vectors,
 * which keeps its accuracy at 0 and at 180 degrees and across right ascension 0 and 360. By space (`by: "space"`) it places each star from its parallax and finds the straight-line distance, in
 * light-years and in parsecs; it needs a target with a distance and leaves out every candidate without one, counting them in `skipped`. The target itself is never in its own answer.
 *
 * By default the three-dimensional answers cover only the bright stars: the 2,563 of the 5,080 Yale stars that have a positive parallax, so the neighbours are bright stars, not the nearest ones. Their parallaxes are
 * good to a tenth of a milliarcsecond at best, so a distance is good to a few per cent for a star within 100 light-years and not at all for a faint, far one; `error` is `undefined` for the ones whose parallax has no error. To include the stars of `/nearby` (Proxima
 * Centauri, Barnard's Star, the red dwarfs, with a parallax error each) pass `among: [...stars(), ...nearbyStars()]`; `error` is then worked out whenever both ends have a parallax error.
 *
 * Every candidate is looked at (no index); one query over all the stars takes about a millisecond.
 *
 * @param target - A star, a deep-sky object, a name (`"Mizar"`, `"M31"`) or `{ rightAscension, declination }` in degrees (with `lightYears` for a query by space).
 * @param options - `count` (default 10), `within` (degrees by sky, light-years by space), `kind` (`"star"` or `"deep-sky"`), `by`, `date`, `magnitude` (the faintest to include), `among` and `minGrade` (only stars of this grade or better).
 * @returns A new list of `{ thing, angle }` or `{ thing, distance, parsecs, error, range, tied }` with a `skipped` count. By space, `range` is the distance within one `error` and `tied` says that it overlaps a neighbour's range, so the order of the two is not settled.
 * @throws TypeError or RangeError, naming the argument, if the target, the name or an option is not valid, or the target has no distance for `by: "space"`.
 *
 * @example
 * ```ts
 * import { nearest } from "@johnmorrisdotca/hoshi-stars/nearest";
 *
 * const near = nearest("Mizar", { count: 1 });
 * console.log(near[0]?.thing.name, near[0]?.angle.toFixed(2)); // Alcor 0.20
 * const close = nearest("Sirius", { by: "space", count: 1 });
 * console.log(close[0]?.thing.designation, close[0]?.distance.toFixed(1)); //
 * ```
 */
export function nearest(target: NearestTarget, options: SkyOptions & { kind: "deep-sky"; among?: undefined }): NearestList<NearestInSky<DeepSkyObject>>;
export function nearest<T extends NearestThing>(target: NearestTarget, options: SkyOptions & { kind?: "star" | "deep-sky"; among: readonly T[] }): NearestList<NearestInSky<T>>;
export function nearest(target: NearestTarget, options?: SkyOptions & { kind?: "star"; among?: undefined }): NearestList<NearestInSky>;
export function nearest<T extends NearestThing>(target: NearestTarget, options: NearestOptions & { by: "space"; among: readonly T[] }): NearestList<NearestInSpace<Extract<T, Star | NearbyStar>>>;
export function nearest(target: NearestTarget, options: NearestOptions & { by: "space" }): NearestList<NearestInSpace>;
export function nearest(target: NearestTarget, options: NearestOptions): NearestList<NearestInSky<NearestThing> | NearestInSpace<Star | NearbyStar>>;
export function nearest(target: NearestTarget, options: NearestOptions = {}): NearestList<NearestInSky<NearestThing> | NearestInSpace<Star | NearbyStar>> {
  return run(target, options, 10);
}

/**
 * Everything within a radius of a target, nearest first: `nearest` with no count limit and `within` set to the radius.
 *
 * @param target - As for `nearest`.
 * @param radius - Degrees by angle, light-years by space (0 or more).
 * @param options - As for `nearest`; `count` limits the list if it is set.
 * @returns As for `nearest`.
 * @throws As for `nearest`; RangeError if `radius` is negative.
 *
 * @example
 * ```ts
 * import { within } from "@johnmorrisdotca/hoshi-stars/nearest";
 *
 * console.log(within("Alcyone", 2, { magnitude: 5 }).length);
 * ```
 */
export function within(target: NearestTarget, radius: number, options: SkyOptions & { kind: "deep-sky"; among?: undefined }): NearestList<NearestInSky<DeepSkyObject>>;
export function within<T extends NearestThing>(target: NearestTarget, radius: number, options: SkyOptions & { kind?: "star" | "deep-sky"; among: readonly T[] }): NearestList<NearestInSky<T>>;
export function within(target: NearestTarget, radius: number, options?: SkyOptions & { kind?: "star"; among?: undefined }): NearestList<NearestInSky>;
export function within<T extends NearestThing>(target: NearestTarget, radius: number, options: NearestOptions & { by: "space"; among: readonly T[] }): NearestList<NearestInSpace<Extract<T, Star | NearbyStar>>>;
export function within(target: NearestTarget, radius: number, options: NearestOptions & { by: "space" }): NearestList<NearestInSpace>;
export function within(target: NearestTarget, radius: number, options: NearestOptions): NearestList<NearestInSky<NearestThing> | NearestInSpace<Star | NearbyStar>>;
export function within(target: NearestTarget, radius: number, options: NearestOptions = {}): NearestList<NearestInSky<NearestThing> | NearestInSpace<Star | NearbyStar>> {
  return run(target, { ...options, within: radius }, Number.POSITIVE_INFINITY);
}

let neighbours: Map<string, Set<string>> | undefined;

function neighbourTable(): Map<string, Set<string>> {
  if (neighbours !== undefined) return neighbours;
  // Every edge of every boundary ring runs along a line of constant right ascension (hours) or constant declination: two constellations touch where an edge of one overlaps an edge of the other by more than a point.
  const runs = new Map<string, Array<{ low: number; high: number; owner: string }>>();
  for (const line of BOUNDARY_RINGS.split("\n")) {
    const [owner, text] = line.split("|") as [string, string];
    for (const ring of text.split("/")) {
      const corners = ring.split(" ").map((corner) => corner.split(",").map(Number) as [number, number]);
      corners.forEach(([hours, degrees], index) => {
        const [nextHours, nextDegrees] = corners[(index + 1) % corners.length]!;
        if (degrees === nextDegrees && hours % 24 === nextHours % 24) return;
        const key = degrees === nextDegrees ? `d${degrees}` : hours % 24 === nextHours % 24 ? `h${hours % 24}` : undefined;
        if (key === undefined) return;
        const [low, high] = key.startsWith("d") ? [Math.min(hours, nextHours), Math.max(hours, nextHours)] : [Math.min(degrees, nextDegrees), Math.max(degrees, nextDegrees)];
        if (!runs.has(key)) runs.set(key, []);
        runs.get(key)!.push({ low, high, owner });
      });
    }
  }
  const table = new Map<string, Set<string>>(constellations().map((c) => [c.abbreviation, new Set<string>()]));
  for (const along of runs.values()) {
    for (let i = 0; i < along.length; i++) {
      for (let j = i + 1; j < along.length; j++) {
        const a = along[i]!;
        const b = along[j]!;
        if (a.owner !== b.owner && Math.min(a.high, b.high) - Math.max(a.low, b.low) > 1e-9) {
          table.get(a.owner)!.add(b.owner);
          table.get(b.owner)!.add(a.owner);
        }
      }
    }
  }
  neighbours = table;
  return table;
}

/**
 * The constellations that share a piece of boundary with one constellation, in alphabetical order of their Latin names. Two constellations that meet only at a corner are not neighbours. The table is worked out from
 * the IAU boundaries the first time it is needed (a few milliseconds) and kept.
 *
 * @param text - The constellation, as the IAU abbreviation (`Ori`) or any other name `constellation` accepts.
 * @returns A new list of the shared, frozen constellations.
 * @throws TypeError if `text` is not a string. RangeError if it is not one of the 88 constellations.
 *
 * @example
 * ```ts
 * import { neighbouringConstellations } from "@johnmorrisdotca/hoshi-stars/nearest";
 *
 * console.log(neighbouringConstellations("Ori").map((c) => c.abbreviation)); // ["Eri", "Gem", "Lep", "Mon", "Tau"]
 * ```
 */
export function neighbouringConstellations(text: string): Constellation[] {
  const found = constellation(text);
  if (found === undefined) throw new RangeError(`"${text}" is not one of the 88 constellations (use the IAU abbreviation such as "Ori")`);
  return constellations().filter((c) => neighbourTable().get(found.abbreviation)!.has(c.abbreviation));
}
