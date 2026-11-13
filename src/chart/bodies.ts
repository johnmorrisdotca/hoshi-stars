// Planets, the Moon and anything else that moves, on the chart: a plain list the page passes in, each with a place, a brightness and a phase. The pure part: the shape of an entry, the cleaning of a list
// that came as text, the ecliptic (the Sun's yearly path) from the package's own frame maths, and the radius a body is drawn at. No DOM, no clock, no other package: this package never imports the one
// that computes where the planets are; the page that has it calls it and hands this one the list. The drawing is bodies-draw.ts.
import type { SkyPoint } from "../projection.ts";

/**
 * The names of a body in the two languages of the chart.
 *
 * @example
 * ```ts
 * import type { SkyBodyNames } from "@johnmorrisdotca/hoshi-stars/chart";
 *
 * const names: SkyBodyNames = { en: "Jupiter", ja: "木星" };
 * console.log(names.ja);
 * // 木星
 * ```
 */
export interface SkyBodyNames {
  en: string;
  ja: string;
}

/**
 * One body to draw over the stars: a planet, the Moon, a dwarf planet. Everything is given by the page (this package computes no positions).
 *
 * `phase` is the lit fraction of the disc, 0 (new, dark) to 1 (full, or a planet with no visible phase). A body drawn as a disc (the Moon, always; any other whose disc is 4 pixels wide or more) shows it:
 * the lit part is a crescent below 0.5 and gibbous above. `brightLimb` says on which side it is lit.
 *
 * @example
 * ```ts
 * import type { SkyBody } from "@johnmorrisdotca/hoshi-stars/chart";
 *
 * const moon: SkyBody = { id: "moon", names: { en: "Moon", ja: "月" }, ra: 83.2, dec: 21.4, magnitude: -11.7, phase: 0.25, brightLimb: 250, size: 1860 };
 * console.log(moon.names.en, moon.phase);
 * // Moon 0.25
 * ```
 */
export interface SkyBody {
  /** What a pick says it was (`hoshi-pick`'s `id`). The Moon is `moon`: it is drawn as a disc with its phase, a little larger than its true size so that the phase can be seen. */
  id: string;
  /** The name written beside it, in English and in Japanese; the chart's language chooses. */
  names: SkyBodyNames;
  /** Where, in degrees: right ascension 0 to 360 and declination -90 to 90 (J2000, the frame the stars are in). A body whose number is not finite is not drawn. */
  ra: number;
  dec: number;
  /** The apparent visual magnitude (the Moon's is about -12.7 when full, Venus's about -4, Mars's 1.8 at its faintest). A body fainter than the chart's magnitude setting (5), made fainter by 2.5 for each tenfold of zoom as a telescope does, is left out. */
  magnitude: number;
  /** The lit fraction of the disc, 0 to 1. A value outside it is held to it; one that is not a number counts as 1 (full). */
  phase: number;
  /** Where the lit side is: the position angle of the middle of the bright limb in degrees, measured from celestial north through east (the Almanac's convention; 90 is east, the side of the next star to rise). When left out, the lit side is the right of the chart. */
  brightLimb?: number | undefined;
  /** The apparent diameter in arc-seconds. Left out, the body is a dot sized by its magnitude like a star; given, the disc is drawn at its true size where that is bigger than the dot. */
  size?: number | undefined;
}

const object = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

/**
 * Cleans a list that came as text (the `bodies` attribute is JSON): an entry with no id, no place or no brightness is dropped; a missing name falls back to the other language, else the id; a bad phase counts as full;
 * a bad `size` or `brightLimb` is dropped. Anything that is not a list gives an empty one.
 *
 * @param value - The parsed JSON, or anything.
 * @returns The bodies that can be drawn.
 *
 * @example
 * ```ts
 * import { normaliseBodies } from "@johnmorrisdotca/hoshi-stars/chart";
 *
 * const list = normaliseBodies([{ id: "mars", names: { en: "Mars" }, ra: 10, dec: -5, magnitude: 1.1, phase: 0.9 }, { id: "bad" }]);
 * console.log(list.length, list[0]?.names.ja);
 * // 1 Mars
 * ```
 */
export function normaliseBodies(value: unknown): SkyBody[] {
  if (!Array.isArray(value)) return [];
  const out: SkyBody[] = [];
  for (const item of value as unknown[]) {
    if (!object(item) || typeof item["id"] !== "string" || item["id"] === "" || !finite(item["ra"]) || !finite(item["dec"]) || !finite(item["magnitude"])) continue;
    const names = object(item["names"]) ? item["names"] : {};
    const en = typeof names["en"] === "string" && names["en"] !== "" ? names["en"] : undefined;
    const ja = typeof names["ja"] === "string" && names["ja"] !== "" ? names["ja"] : undefined;
    const size = finite(item["size"]) && item["size"] > 0 ? item["size"] : undefined;
    const limb = finite(item["brightLimb"]) ? item["brightLimb"] : undefined;
    out.push({
      id: item["id"],
      names: { en: en ?? ja ?? item["id"], ja: ja ?? en ?? item["id"] },
      ra: item["ra"],
      dec: item["dec"],
      magnitude: item["magnitude"],
      phase: finite(item["phase"]) ? Math.max(0, Math.min(1, item["phase"])) : 1,
      ...(limb === undefined ? {} : { brightLimb: limb }),
      ...(size === undefined ? {} : { size }),
    });
  }
  return out;
}

/**
 * The mean obliquity of the ecliptic at J2000, the tilt of the Earth's axis to its orbit, in degrees: 84,381.406 arc-seconds, the value the IAU 2006 precession model (Capitaine, Wallace and Chapront 2003) fixes.
 * It is a published constant of the J2000 frame the stars are in, so the ecliptic drawn here is the one of that frame.
 *
 * @example
 * ```ts
 * import { OBLIQUITY_J2000 } from "@johnmorrisdotca/hoshi-stars/chart";
 *
 * console.log(OBLIQUITY_J2000.toFixed(4));
 * // 23.4393
 * ```
 */
export const OBLIQUITY_J2000 = 84381.406 / 3600;

const RAD = Math.PI / 180;

/**
 * A point of the ecliptic frame in the equatorial one (both J2000): the rotation of the sphere about the equinox by the obliquity.
 *
 * @param longitude - The ecliptic longitude in degrees, measured from the March equinox.
 * @param latitude - The ecliptic latitude in degrees (0, the ecliptic itself, when left out).
 * @returns The point: right ascension 0 to 360 and declination -90 to 90, in degrees.
 *
 * @example
 * ```ts
 * import { eclipticToEquatorial } from "@johnmorrisdotca/hoshi-stars/chart";
 *
 * // the June solstice point: 6 hours of right ascension, 23.44 degrees north
 * const point = eclipticToEquatorial(90);
 * console.log(point.rightAscension.toFixed(1), point.declination.toFixed(2));
 * // 90.0 23.44
 * ```
 */
export function eclipticToEquatorial(longitude: number, latitude = 0): SkyPoint {
  const l = longitude * RAD;
  const b = latitude * RAD;
  const e = OBLIQUITY_J2000 * RAD;
  const ra = Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l)) / RAD;
  const dec = Math.asin(Math.max(-1, Math.min(1, Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l)))) / RAD;
  return { rightAscension: ((ra % 360) + 360) % 360, declination: dec };
}

/**
 * The ecliptic as points of the equatorial sky, a degree of longitude apart by default, closed (the last is the first). The chart draws it as a dashed line when its `ecliptic` layer is on.
 *
 * @param step - The longitude step in degrees (1 when left out; at least 0.1).
 * @returns The points, from longitude 0 round to 360.
 *
 * @example
 * ```ts
 * import { eclipticLine } from "@johnmorrisdotca/hoshi-stars/chart";
 *
 * const line = eclipticLine(30);
 * console.log(line.length, Math.max(...line.map((p) => p.declination)).toFixed(1));
 * // 13 23.4
 * ```
 */
export function eclipticLine(step = 1): SkyPoint[] {
  const by = Math.max(0.1, step);
  const points: SkyPoint[] = [];
  for (let l = 0; l < 360; l += by) points.push(eclipticToEquatorial(l));
  points.push(eclipticToEquatorial(0));
  return points;
}

/**
 * How big a body's dot is drawn, in pixels: a star's rule (brighter is larger), carried to magnitude -4.6 so that Venus is larger than Sirius. A body with a true `size` is drawn as large as that when it is larger.
 *
 * @param magnitude - The body's magnitude.
 * @param limit - The chart's magnitude setting (the faintest star at the opening zoom).
 * @param grow - How much the zoom enlarges a dot (1 at the opening zoom).
 * @returns The radius in pixels.
 *
 * @example
 * ```ts
 * import { bodyRadius } from "@johnmorrisdotca/hoshi-stars/chart";
 *
 * console.log(bodyRadius(-4.4, 5, 1) > bodyRadius(1.2, 5, 1));
 * // true
 * ```
 */
export const bodyRadius = (magnitude: number, limit: number, grow: number): number => Math.max(1.4, (limit - Math.max(magnitude, -4.6)) * 0.55 + 1.1) * grow;
