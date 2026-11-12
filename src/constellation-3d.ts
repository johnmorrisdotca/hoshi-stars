// A constellation in three dimensions: the stars of its figure placed in space from their positions and parallaxes, each with the range its parallax error allows, and the Earth's lines of sight.
// The constellation-3d tier (`@johnmorrisdotca/hoshi-stars/constellation-3d`): it reads the lines tier and the bright-star table and adds no data of its own. Pure: no DOM, no three.js, no clock.
// A star is never put at a guessed distance. A star with no parallax has no position: it keeps its line of sight from the Earth (a ray) and says so.
import { constellation, constellations, type Constellation } from "./constellations.ts";
import { figureOf } from "./lines.ts";
import type { NearbyStar } from "./nearby.ts";
import { starByName, starDistance, type Star, type StarDistance } from "./stars.ts";
import { distanceQuality, DISTANCE_QUALITIES, QUALITY_LIMITS, type DistanceQuality } from "./distance-quality.ts";

export { distanceQuality, DISTANCE_QUALITIES, QUALITY_LIMITS, type DistanceQuality };

const RADIANS = Math.PI / 180;
const LIGHT_YEARS_PER_PARSEC = 3.261563777;

/**
 * A point in space in light-years on the J2000 equatorial axes: x toward right ascension 0, y toward 6 hours, z toward the north celestial pole.
 *
 * @example
 * ```ts
 * import { type Point3 } from "@johnmorrisdotca/hoshi-stars/constellation-3d";
 *
 * const there: Point3 = [10, 0, 0];
 * console.log(there[0]);
 * ```
 */
export type Point3 = readonly [x: number, y: number, z: number];

/**
 * One star of a figure in space, as seen from the viewpoint (the Earth, or another star).
 *
 * @example
 * ```ts
 * import { constellationIn3D, type StarIn3D } from "@johnmorrisdotca/hoshi-stars/constellation-3d";
 *
 * const star: StarIn3D = constellationIn3D("Ori").stars[0]!;
 * console.log(star.id, star.quality);
 * ```
 */
export interface StarIn3D {
  /** The catalogue's star. */
  star: Star;
  /** A key that stays the same: `hr-2061`. */
  id: string;
  /** How well the distance is known. */
  quality: DistanceQuality;
  /** The parallax's error as a share of the parallax (0.05 is 5%), or `undefined` where the parallax has no stated error or there is no parallax. */
  relativeError: number | undefined;
  /** The Earth's line of sight to the star: it starts at the Earth and runs along `direction`, and the star lies somewhere on it. The distances below are measured along it from the Earth (`atLightYears`). */
  sight: { origin: Point3; direction: Point3; near: number | undefined; best: number | undefined; far: number | undefined };
  /** The star's place: `undefined` for a star with no parallax, which is never put at a guessed distance. */
  position: Point3 | undefined;
  /** The nearest and the farthest place one standard error of the parallax allows; `undefined` where there is no error. The farthest is `undefined` too where the error reaches the parallax and the star could be any distance beyond. */
  nearPosition: Point3 | undefined;
  farPosition: Point3 | undefined;
  /** The distance from the viewpoint in light-years, or `undefined` where there is no parallax. */
  lightYears: number | undefined;
  /** The nearest and farthest distance from the viewpoint within one standard error; `undefined` where there is no error. The farthest is `Infinity` where the error reaches the parallax. */
  range: readonly [near: number, far: number] | undefined;
  /** True when the error bar is wider than the distance (the error is over 41% of the parallax, or reaches it): the star could be anywhere along a long stretch, so a picture shows the whole range and no point in the middle. */
  wide: boolean;
}

/**
 * A constellation's figure in space.
 *
 * @example
 * ```ts
 * import { constellationIn3D, type Constellation3D } from "@johnmorrisdotca/hoshi-stars/constellation-3d";
 *
 * const orion: Constellation3D = constellationIn3D("Ori");
 * console.log(orion.stars.length, orion.segments.length, orion.counts);
 * ```
 */
export interface Constellation3D {
  /** The constellation. */
  constellation: Constellation;
  /** The viewpoint: its name where it is a star, and where the Earth is (`earth`), both relative to the viewpoint, which is the origin. */
  viewpoint: { name: string | undefined; earth: Point3 };
  /** The stars of the figure, each once, in the figure's order (the viewpoint star itself is left out). */
  stars: StarIn3D[];
  /** The lines of the figure as pairs of indexes into `stars`. */
  segments: Array<[number, number]>;
  /** How many stars have each quality of distance. */
  counts: Record<DistanceQuality, number>;
  /** The direction from the viewpoint to the middle of the figure, and the direction of "up" (celestial north, turned square to it): a unit vector each. From the middle of the figure looking along `centre` with `up` up, east is on the left, as on a sky chart. */
  frame: { centre: Point3; up: Point3 };
  /** How far the figure's stars lie from `centre`, in degrees, at the most: the figure's angular radius. */
  radius: number;
}

/**
 * A viewpoint: a star (with a distance), a name `starByName` finds, or a point `{ x, y, z }` in parsecs with the Sun at the origin.
 *
 * @example
 * ```ts
 * import { constellationIn3D, type Viewpoint3D } from "@johnmorrisdotca/hoshi-stars/constellation-3d";
 *
 * const from: Viewpoint3D = "Rigil Kentaurus";
 * console.log(constellationIn3D("Cas", { from }).viewpoint.name);
 * ```
 */
export type Viewpoint3D = Star | NearbyStar | string | { x: number; y: number; z: number };

const length = (v: Point3): number => Math.hypot(v[0], v[1], v[2]);
const scaled = (v: Point3, k: number): Point3 => [v[0] * k, v[1] * k, v[2] * k];
const minus = (a: Point3, b: Point3): Point3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const plus = (a: Point3, b: Point3): Point3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const dot = (a: Point3, b: Point3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (v: Point3): Point3 => scaled(v, 1 / length(v));

/**
 * The place in space of a direction and a distance: right ascension and declination in degrees, distance in light-years, on the J2000 equatorial axes with the viewpoint at the origin.
 *
 * @param rightAscension - Degrees.
 * @param declination - Degrees, -90 to 90.
 * @param lightYears - The distance.
 * @returns `[x, y, z]` in light-years.
 *
 * @example
 * ```ts
 * import { positionIn3D } from "@johnmorrisdotca/hoshi-stars/constellation-3d";
 *
 * console.log(positionIn3D(90, 0, 10)); // about [0, 10, 0]
 * ```
 */
export function positionIn3D(rightAscension: number, declination: number, lightYears: number): Point3 {
  const ra = rightAscension * RADIANS;
  const dec = declination * RADIANS;
  const flat = Math.cos(dec) * lightYears;
  return [flat * Math.cos(ra), flat * Math.sin(ra), Math.sin(dec) * lightYears];
}

function viewpointOf(from: Viewpoint3D | undefined): { name: string | undefined; at: Point3; key: string | undefined } {
  if (from === undefined) return { name: undefined, at: [0, 0, 0], key: undefined };
  let target = from;
  if (typeof target === "string") {
    const found = starByName(target);
    if (found === undefined) throw new RangeError(`"${target}" is not a star this package knows (pass the star or a point { x, y, z } in parsecs)`);
    target = found;
  }
  if ("x" in target) {
    const { x, y, z } = target;
    if (typeof x !== "number" || typeof y !== "number" || typeof z !== "number" || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) throw new RangeError("a point in space is { x, y, z } in parsecs, finite numbers");
    return { name: undefined, at: [x * LIGHT_YEARS_PER_PARSEC, y * LIGHT_YEARS_PER_PARSEC, z * LIGHT_YEARS_PER_PARSEC], key: undefined };
  }
  if (target === null || typeof target !== "object" || typeof target.rightAscension !== "number") throw new TypeError("the viewpoint must be a star, a name or { x, y, z } in parsecs");
  const distance = starDistance(target);
  if (distance === undefined) throw new RangeError("the viewpoint star has no distance: a star with a parallax above 0 is needed");
  const hr = (target as Star).hr;
  return { name: target.name, at: positionIn3D(target.rightAscension, target.declination, distance.lightYears), key: typeof hr === "number" ? `hr-${hr}` : undefined };
}

/**
 * A constellation's figure in space: each star of the figure placed from its right ascension, declination and parallax, with the nearest and farthest places its parallax error allows, and the Earth's line of sight to it.
 * The positions are the catalogue's, so they are as good as its parallaxes (see `distanceQuality`): the Yale catalogue's are ground-based and many carry errors larger than the parallax. A star with no parallax is never given a
 * guessed distance: it has no `position`, only its line of sight (`sight`). Seen from the Earth, the stars appear where the sky chart puts them, whatever their distances.
 *
 * With `from`, the viewpoint moves to another star or point: every position is relative to it, so the figure is seen from there. A star with no parallax has no place to be seen from there, but its Earth line of sight is still a line in space.
 *
 * @param text - The constellation, as the IAU abbreviation (`Ori`) or any other name `constellation` accepts.
 * @param options - `from`: a star (with a parallax), its name, or `{ x, y, z }` in parsecs (the Sun at the origin); the Earth when left out. The viewpoint is taken at its best distance, with no error.
 * @returns The figure in space.
 * @throws RangeError if `text` is not one of the 88 constellations, or `from` names no star or a star with no distance.
 *
 * @example
 * ```ts
 * import { constellationIn3D } from "@johnmorrisdotca/hoshi-stars/constellation-3d";
 *
 * const orion = constellationIn3D("Ori");
 * for (const { star, lightYears, range, quality } of orion.stars) console.log(star.name ?? star.designation, lightYears?.toFixed(0), range?.map((n) => n.toFixed(0)), quality);
 * ```
 *
 * @example
 * ```ts
 * import { constellationIn3D } from "@johnmorrisdotca/hoshi-stars/constellation-3d";
 *
 * const fromProxima = constellationIn3D("Cas", { from: "Rigil Kentaurus" });
 * console.log(fromProxima.viewpoint.earth.map((n) => n.toFixed(1)), fromProxima.counts);
 * ```
 */
export function constellationIn3D(text: string, options: { from?: Viewpoint3D } = {}): Constellation3D {
  const found = constellation(text);
  if (found === undefined) throw new RangeError(`"${text}" is not one of the 88 constellations (use the IAU abbreviation such as "Ori")`);
  const viewpoint = viewpointOf(options?.from);
  const earth: Point3 = [0 - viewpoint.at[0], 0 - viewpoint.at[1], 0 - viewpoint.at[2]];
  const figure = figureOf(found.abbreviation);
  const members = figure.stars.filter((star) => `hr-${star.hr}` !== viewpoint.key);
  const index = new Map(members.map((star, i) => [star.hr, i]));
  const placed: StarIn3D[] = members.map((star): StarIn3D => {
    const distance: StarDistance | undefined = starDistance(star);
    const direction = unit(positionIn3D(star.rightAscension, star.declination, 1));
    const at = (t: number): Point3 => plus(earth, scaled(direction, t));
    const best = distance?.lightYears;
    const range = distance?.lightYearsRange;
    const position = best === undefined ? undefined : at(best);
    const nearPosition = range === undefined ? undefined : at(range[0]);
    const farPosition = range === undefined || !Number.isFinite(range[1]) ? undefined : at(range[1]);
    let seen: readonly [number, number] | undefined;
    if (range !== undefined && best !== undefined) {
      // The distance from the viewpoint along the line of sight: smallest at the point nearest to it, largest at an end.
      const from = (t: number): number => length(at(t));
      const closest = Math.min(Math.max(-dot(earth, direction), range[0]), range[1]);
      seen = [from(closest), Number.isFinite(range[1]) ? Math.max(from(range[0]), from(range[1])) : Number.POSITIVE_INFINITY];
    }
    return {
      star,
      id: `hr-${star.hr}`,
      quality: distanceQuality(star),
      relativeError: best !== undefined && star.parallaxErrorMas !== undefined ? star.parallaxErrorMas / star.parallaxMas : undefined,
      sight: { origin: earth, direction, near: range?.[0], best, far: range === undefined ? undefined : range[1] },
      position,
      nearPosition,
      farPosition,
      lightYears: position === undefined ? undefined : length(position),
      range: seen,
      wide: range !== undefined && best !== undefined && (!Number.isFinite(range[1]) || range[1] - range[0] > best),
    };
  });
  const counts: Record<DistanceQuality, number> = { good: 0, fair: 0, rough: 0, none: 0 };
  for (const one of placed) counts[one.quality] += 1;
  // The middle of the figure: the mean direction as seen from the viewpoint, from the stars it can place there (all of them, from the Earth); else the Earth's directions.
  const fromEarth = length(viewpoint.at) === 0;
  const seenFrom = placed.flatMap((one): Point3[] => (fromEarth ? [one.sight.direction] : one.position === undefined ? [] : [unit(one.position)]));
  const directions = seenFrom.length > 0 ? seenFrom : placed.map((one) => one.sight.direction);
  const sum = directions.reduce<Point3>((total, d) => plus(total, d), [0, 0, 0]);
  const centre = length(sum) < 1e-9 ? ([1, 0, 0] as Point3) : unit(sum);
  const north: Point3 = [0, 0, 1];
  const raised = minus(north, scaled(centre, dot(north, centre)));
  const up = length(raised) < 1e-6 ? ([0, 1, 0] as Point3) : unit(raised);
  const radius = Math.max(0, ...directions.map((d) => Math.acos(Math.min(1, Math.max(-1, dot(d, centre)))) / RADIANS));
  const segments = figure.segments.flatMap(([a, b]): Array<[number, number]> => {
    const from = index.get(a.hr);
    const to = index.get(b.hr);
    return from === undefined || to === undefined ? [] : [[from, to]];
  });
  return { constellation: found, viewpoint: { name: viewpoint.name, earth }, stars: placed, segments, counts, frame: { centre, up }, radius };
}

/**
 * How many stars of each figure have each quality of distance: the table that says which constellations are worth looking at in space today.
 *
 * @returns One row for each of the 88 constellations, in the order of `constellations()`.
 *
 * @example
 * ```ts
 * import { distanceQualityTable } from "@johnmorrisdotca/hoshi-stars/constellation-3d";
 *
 * const orion = distanceQualityTable().find((row) => row.abbreviation === "Ori")!;
 * console.log(orion.stars, orion.counts);
 * ```
 */
export function distanceQualityTable(): Array<{ abbreviation: string; name: string; stars: number; counts: Record<DistanceQuality, number> }> {
  return constellations().map((c) => {
    const figure = constellationIn3D(c.abbreviation);
    return { abbreviation: c.abbreviation, name: c.name, stars: figure.stars.length, counts: figure.counts };
  });
}
