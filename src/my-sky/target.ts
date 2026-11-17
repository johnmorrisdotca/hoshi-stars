// Turning "my sky" to one thing: what a target is (a star, a planet, the Moon, the Sun, a constellation or a point a page gives), where it stands over a place, whether it is up, when it rises and sets next, and the view that puts it
// in the middle (a single thing centred, a constellation framed whole). Pure: no DOM, no clock reads and no star table; `target-stars.ts` turns a star's or a constellation's id into a position and this file does the rest.
import type { Observer } from "../sky.ts";
import { moment, type When } from "../when.ts";
import { altitudeAzimuth, localFrame, type Direction } from "./frame.ts";
import { moonHorizontal, moonRiseSet } from "./moon.ts";
import { NAKED_EYE_PLANETS, planetPlaces, type NakedEyePlanet } from "./planets.ts";
import { sunPlace } from "./sun.ts";
import { clampView, FOV_MAX, FOV_MIN } from "./view.ts";

const DEG = 180 / Math.PI;
const HOUR_MS = 3_600_000;

/**
 * A point a page gives the sky as it stands over the place: a direction as an azimuth (degrees from north through east) and an altitude (degrees above the horizon), and the words to say beside it. A satellite's place, the way a page's own
 * thing is turned to.
 *
 * @example
 * ```ts
 * import type { SkyPoint } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * const station: SkyPoint = { azimuth: 250, altitude: 42, label: "ISS" };
 * console.log(station.label);
 * ```
 */
export interface SkyPoint {
  /** Degrees from north through east. */
  azimuth: number;
  /** Degrees above the horizon, negative below it. */
  altitude: number;
  /** What to call it: shown in the ring. Left out, the ring has no name. */
  label?: string;
}

/**
 * What `target` takes: a text (a star's id such as `betelgeuse`, `alpha-orionis` or `hr-2061`; `planet:mars`; `moon`; `sun`; `constellation:Ori`) or, as a property only, a `SkyPoint`.
 *
 * @example
 * ```ts
 * import type { SkyTarget } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * const targets: SkyTarget[] = ["betelgeuse", "planet:mars", "moon", "sun", "constellation:Ori", { azimuth: 120, altitude: 30, label: "Probe" }];
 * console.log(targets.length);
 * ```
 */
export type SkyTarget = string | SkyPoint;

/**
 * What a target is, read from its text: a planet, the Moon, the Sun, a constellation (its abbreviation or name), a star or deep-sky object by id, or a point a page gave.
 *
 * @example
 * ```ts
 * import type { ParsedTarget } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * const parsed: ParsedTarget = { kind: "planet", id: "mars" };
 * console.log(parsed.kind);
 * ```
 */
export type ParsedTarget =
  | { kind: "planet"; id: NakedEyePlanet }
  | { kind: "moon" }
  | { kind: "sun" }
  | { kind: "constellation"; name: string }
  | { kind: "star"; id: string }
  | { kind: "point"; point: SkyPoint };

/**
 * Read a target: `planet:mars` (or `planet:Mars`), `moon`, `sun`, `constellation:Ori` (the abbreviation or any name a constellation has), a point `{ azimuth, altitude, label }`, and anything else as the id of a star
 * (`betelgeuse`, `alpha-orionis`, `hr-2061`; a Messier object such as `m31` works as well). Spaces round the text and the case of the kind are ignored. Nothing is looked up here, so an id that names nothing still parses as a star.
 *
 * @param target - The text or the point.
 * @returns What it is, or `undefined` for an empty text, a planet that is not one of the five, a point with a number that is not finite or anything that is not a text or a point.
 *
 * @example
 * ```ts
 * import { parseTarget } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * console.log(parseTarget("planet:Mars"), parseTarget(" Moon ")?.kind, parseTarget("constellation:Ori"), parseTarget("betelgeuse")?.kind, parseTarget("planet:pluto"));
 * ```
 */
export function parseTarget(target: unknown): ParsedTarget | undefined {
  if (typeof target === "object" && target !== null) {
    const { azimuth, altitude, label } = target as Record<string, unknown>;
    if (typeof azimuth !== "number" || typeof altitude !== "number" || !Number.isFinite(azimuth) || !Number.isFinite(altitude)) return undefined;
    return { kind: "point", point: { azimuth: (((azimuth % 360) + 360) % 360), altitude: Math.max(-90, Math.min(90, altitude)), ...(typeof label === "string" ? { label } : {}) } };
  }
  if (typeof target !== "string") return undefined;
  const text = target.trim();
  if (text === "") return undefined;
  const lower = text.toLowerCase();
  if (lower === "moon") return { kind: "moon" };
  if (lower === "sun") return { kind: "sun" };
  const colon = text.indexOf(":");
  if (colon > 0) {
    const head = text.slice(0, colon).trim().toLowerCase();
    const rest = text.slice(colon + 1).trim();
    if (head === "planet") {
      const id = rest.toLowerCase();
      return (NAKED_EYE_PLANETS as readonly string[]).includes(id) ? { kind: "planet", id: id as NakedEyePlanet } : undefined;
    }
    if (head === "constellation") return rest === "" ? undefined : { kind: "constellation", name: rest };
  }
  return { kind: "star", id: lower };
}

/**
 * Where a target is in the sky, as the maths needs it: a planet (by name), the Moon, the Sun, a fixed place among the stars (a star's or a constellation's middle, at J2000) or a fixed direction over the place.
 *
 * @example
 * ```ts
 * import type { SkyLocator } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * const sirius: SkyLocator = { kind: "star", rightAscension: 101.287, declination: -16.716 };
 * console.log(sirius.kind);
 * ```
 */
export type SkyLocator =
  | { kind: "planet"; id: NakedEyePlanet }
  | { kind: "moon" }
  | { kind: "sun" }
  | { kind: "star"; rightAscension: number; declination: number }
  | { kind: "point"; azimuth: number; altitude: number };

/** The altitude of the middle of a star or a planet when it touches the horizon: the air bends the light up by 34 arc-minutes. */
const STAR_HORIZON = -34 / 60;
/** The Sun's and the Moon's: the air's 34 arc-minutes and a disc's radius of about 16 more (the Moon's altitude is already the one seen from the place). */
const DISC_HORIZON = -50 / 60;

/** The altitude at which a locator counts as having risen or set. */
function horizonOf(locator: SkyLocator): number {
  return locator.kind === "star" || locator.kind === "planet" ? STAR_HORIZON : locator.kind === "point" ? 0 : DISC_HORIZON;
}

/**
 * Where a target stands over a place at a moment.
 *
 * @param locator - What to find.
 * @param observer - Latitude north and longitude east in degrees.
 * @param when - The moment, a `Date` or milliseconds since 1970.
 * @returns `{ altitude, azimuth }` in degrees, the azimuth from north through east. A point stays where it was given.
 * @throws TypeError or RangeError for an observer or moment that is not valid.
 *
 * @example
 * ```ts
 * import { locate } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * // Polaris from Vancouver stands as high as the latitude, a little less than 50 degrees, in the north
 * const polaris = locate({ kind: "star", rightAscension: 37.95, declination: 89.26 }, { latitude: 49.28, longitude: -123.12 }, new Date("2026-11-08T06:00:00Z"));
 * console.log(polaris.altitude.toFixed(1), polaris.azimuth < 2 || polaris.azimuth > 358);
 * ```
 */
export function locate(locator: SkyLocator, observer: Observer, when: When): { altitude: number; azimuth: number } {
  const ms = moment(when);
  if (locator.kind === "point") return { altitude: locator.altitude, azimuth: (((locator.azimuth % 360) + 360) % 360) };
  if (locator.kind === "moon") return moonHorizontal(observer, ms);
  const frame = localFrame(observer, ms);
  const spot = { east: 0, north: 0, up: 0 };
  if (locator.kind === "sun") {
    const sun = sunPlace(ms);
    return altitudeAzimuth(frame.fromDate(sun.rightAscension, sun.declination, spot));
  }
  if (locator.kind === "planet") {
    const planet = planetPlaces(ms).find((p) => p.id === locator.id)!;
    return altitudeAzimuth(frame.fromJ2000(planet.rightAscension, planet.declination, spot));
  }
  return altitudeAzimuth(frame.fromJ2000(locator.rightAscension, locator.declination, spot));
}

/**
 * When a target rises and sets next, and whether it never does.
 *
 * @example
 * ```ts
 * import type { RiseAndSet } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * const said = (r: RiseAndSet): string => (r.always ? "always up" : r.never ? "never rises" : "rises and sets");
 * console.log(typeof said);
 * ```
 */
export interface RiseAndSet {
  /** Whether it is above the horizon at the moment asked. */
  up: boolean;
  /** The next rise and the next set after the moment, in milliseconds since 1970, or `null` for none in the window. */
  rise: number | null;
  set: number | null;
  /** Up at the moment and neither rising nor setting in the window: for a star, always above the horizon here (circumpolar). */
  always: boolean;
  /** Down at the moment and neither rising nor setting in the window: for a star, never above the horizon here. */
  never: boolean;
}

/**
 * The next rise and set of a target after a moment. A star, a constellation's middle, a planet or the Sun is followed for 26 hours in steps of six minutes and each crossing found to the second (a star or a planet at the altitude where its light
 * is bent by the air, the Sun at its upper edge); the Moon is `moonRiseSet`'s. A star that crosses nothing in a whole turn of the Earth is `always` up or `never` up there. A point has no rise or set.
 *
 * @param locator - What to follow.
 * @param observer - Latitude north and longitude east in degrees.
 * @param when - The moment, a `Date` or milliseconds since 1970.
 * @returns The times and the two flags.
 * @throws TypeError or RangeError for an observer or moment that is not valid.
 *
 * @example
 * ```ts
 * import { riseAndSet } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * // Sirius from Vancouver on the evening of 17 November 2026: still below the horizon, up in a few hours
 * const sirius = { kind: "star" as const, rightAscension: 101.287, declination: -16.716 };
 * const next = riseAndSet(sirius, { latitude: 49.28, longitude: -123.12 }, new Date("2026-11-17T04:00:00Z"));
 * console.log(next.up, next.rise !== null && next.rise > Date.UTC(2026, 10, 17, 4), next.never);
 * ```
 */
export function riseAndSet(locator: SkyLocator, observer: Observer, when: When): RiseAndSet {
  const start = moment(when);
  if (locator.kind === "point") return { up: locator.altitude > 0, rise: null, set: null, always: false, never: false };
  if (locator.kind === "moon") {
    const next = moonRiseSet(observer, start);
    return { up: next.up, rise: next.rise, set: next.set, always: next.up && next.rise === null && next.set === null, never: !next.up && next.rise === null && next.set === null };
  }
  const horizon = horizonOf(locator);
  const height = (ms: number): number => locate(locator, observer, ms).altitude - horizon;
  const step = 6 * 60_000;
  const end = start + 26 * HOUR_MS;
  let rise: number | null = null;
  let set: number | null = null;
  let before = height(start);
  const up = before > 0;
  for (let t = start + step; t <= end + step && (rise === null || set === null); t += step) {
    const now = height(t);
    if ((before <= 0) !== (now <= 0)) {
      let low = t - step;
      let high = t;
      let lowValue = before;
      for (let i = 0; i < 22; i++) {
        const mid = (low + high) / 2;
        const value = height(mid);
        if ((value <= 0) === (lowValue <= 0)) {
          low = mid;
          lowValue = value;
        } else high = mid;
      }
      const found = Math.round((low + high) / 2);
      if (found <= end) {
        if (now > 0 && rise === null) rise = found;
        if (now <= 0 && set === null) set = found;
      }
    }
    before = now;
  }
  return { up, rise, set, always: up && rise === null && set === null, never: !up && rise === null && set === null };
}

/**
 * A target in the sky of a place: where it stands, whether it is up, and its next rise and set.
 *
 * @example
 * ```ts
 * import type { TargetInSky } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * const below = (t: TargetInSky): boolean => !t.up;
 * console.log(typeof below);
 * ```
 */
export interface TargetInSky extends RiseAndSet {
  /** Degrees above the horizon (negative below it) and from north through east. */
  altitude: number;
  azimuth: number;
}

/**
 * Where a target is and when it rises and sets, in one answer. `up` is whether it is above its horizon (the one a rise and set mean), so it agrees with `rise` and `set`.
 *
 * @param locator - What to find.
 * @param observer - Latitude north and longitude east in degrees.
 * @param when - The moment, a `Date` or milliseconds since 1970.
 * @param times - The rise and set already worked out for a moment not long before (a page that asks every ten seconds keeps them, since a rise stays the same until it has passed); left out, they are worked out.
 * @returns The place and the times. With `times` given, `up` is still read from the place at `when`.
 * @throws TypeError or RangeError for an observer or moment that is not valid.
 *
 * @example
 * ```ts
 * import { targetInSky } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * // Saturn from Vancouver on the evening of 17 November 2026 is up in the south
 * const saturn = targetInSky({ kind: "planet", id: "saturn" }, { latitude: 49.28, longitude: -123.12 }, new Date("2026-11-17T04:00:00Z"));
 * console.log(saturn.up, saturn.azimuth > 120 && saturn.azimuth < 240, saturn.set !== null);
 * ```
 */
export function targetInSky(locator: SkyLocator, observer: Observer, when: When, times?: Pick<RiseAndSet, "rise" | "set" | "always" | "never">): TargetInSky {
  const ms = moment(when);
  const place = locate(locator, observer, ms);
  if (times === undefined) {
    const found = riseAndSet(locator, observer, ms);
    return { ...place, ...found };
  }
  return { ...place, up: locator.kind === "point" ? place.altitude > 0 : place.altitude > horizonOf(locator), ...times };
}

/**
 * The view that puts one thing in the middle: facing its azimuth and tipped up to its altitude. A thing that is just under the horizon is centred on it too; one far under it is faced at the horizon with the head tipped 10 degrees up, so the ground and the compass show
 * which way it is. The field of view stays as it is (narrowed to 90 degrees if it was wider).
 *
 * @param altitude - Degrees above the horizon.
 * @param azimuth - Degrees from north through east.
 * @param fov - The field of view now, in degrees.
 * @returns A heading, a pitch and a field of view, each in its range.
 *
 * @example
 * ```ts
 * import { viewOfObject } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * console.log(viewOfObject(30, 200, 60), viewOfObject(-40, 200, 120));
 * ```
 */
export function viewOfObject(altitude: number, azimuth: number, fov: number): { heading: number; pitch: number; fov: number } {
  return clampView({ heading: azimuth, pitch: altitude > -8 ? altitude : 10, fov: Math.min(fov, 90) });
}

/**
 * The view that frames a whole group of directions (a constellation's stars): faced at the middle of them, tipped to its altitude, and wide enough that the farthest is inside with a margin, held to 20 up to 130 degrees across the smaller side.
 *
 * @param directions - The group's directions (east, north, up), above the horizon or not.
 * @returns A heading, a pitch and a field of view; the sky's own view when there are none.
 *
 * @example
 * ```ts
 * import { viewOfGroup } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * // two stars 40 degrees apart on the meridian, at 30 and 70 degrees up, are framed from the south at 50 up and 52 across
 * const spot = (altitude: number) => ({ east: 0, north: -Math.cos(altitude * Math.PI / 180), up: Math.sin(altitude * Math.PI / 180) });
 * console.log(viewOfGroup([spot(30), spot(70)]));
 * ```
 */
export function viewOfGroup(directions: readonly Direction[]): { heading: number; pitch: number; fov: number } {
  if (directions.length === 0) return clampView({ heading: 180, pitch: 35, fov: 90 });
  let east = 0;
  let north = 0;
  let up = 0;
  for (const d of directions) {
    east += d.east;
    north += d.north;
    up += d.up;
  }
  const size = Math.hypot(east, north, up);
  const middle: Direction = size < 1e-9 ? directions[0]! : { east: east / size, north: north / size, up: up / size };
  let widest = 0;
  for (const d of directions) widest = Math.max(widest, Math.acos(Math.max(-1, Math.min(1, d.east * middle.east + d.north * middle.north + d.up * middle.up))) * DEG);
  const { altitude, azimuth } = altitudeAzimuth(middle);
  const fov = Math.max(FOV_MIN, Math.min(FOV_MAX, widest * 2 * 1.3));
  return clampView({ heading: azimuth, pitch: altitude > -8 ? altitude : 10, fov });
}

/** How far a glide has gone for a fraction of its time: slow at both ends. */
const ease = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/**
 * The view part of the way along a glide from one view to another: the heading goes the short way round (350 to 10 passes through north), the pitch and the field of view in a straight line, slowly at both ends.
 *
 * @param from - The view the glide starts from.
 * @param to - The view it ends at.
 * @param fraction - How much of the time has passed, 0 to 1 (held to that).
 * @returns The view then, in range.
 *
 * @example
 * ```ts
 * import { glideView } from "@johnmorrisdotca/hoshi-stars/my-sky";
 *
 * const from = { heading: 350, pitch: 10, fov: 90 };
 * const to = { heading: 10, pitch: 50, fov: 60 };
 * console.log(glideView(from, to, 0), glideView(from, to, 0.5), glideView(from, to, 1));
 * ```
 */
export function glideView(from: { heading: number; pitch: number; fov: number }, to: { heading: number; pitch: number; fov: number }, fraction: number): { heading: number; pitch: number; fov: number } {
  const t = ease(Math.max(0, Math.min(1, fraction)));
  const turn = ((((to.heading - from.heading) % 360) + 540) % 360) - 180;
  return clampView({ heading: from.heading + turn * t, pitch: from.pitch + (to.pitch - from.pitch) * t, fov: from.fov + (to.fov - from.fov) * t });
}
