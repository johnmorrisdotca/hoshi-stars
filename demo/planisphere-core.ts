// The planisphere page's sums, apart from the DOM: where the wheel's horizon window is, where a star lands on the sheet for a turn of the disc, how a moment turns the disc and a turn of the disc moves the moment, and which named stars are inside the window.
// The sheet is the printable star wheel's (src/sheets/wheel.ts, a normal-type wheel drawn 200 mm wide): the same pole-centred stereographic chart, the window a circle of it. Pure: numbers in, numbers out, no DOM and no clock.
import { stars as allStars, type Star } from "../src/stars.ts";
import { localSiderealTime } from "../src/sky.ts";

const RAD = Math.PI / 180;
/** Degrees the sky turns in a day of 86,400 seconds: 360.98564736629 (a sidereal day is 23 h 56 min 4 s). */
export const SIDEREAL_DEGREES_A_DAY = 360.98564736629;

/**
 * The sheet a wheel is drawn on, in millimetres: the middle, the disc's radius and the radius where the stars stop and the ring of dates begins. These are the numbers `starWheelDisc` uses for a normal-type wheel 200 mm wide (a disc of 97 and 7 mm of ring).
 *
 * @example
 * ```ts
 * import { WHEEL_SHEET } from "./planisphere-core.ts";
 *
 * console.log(WHEEL_SHEET.radius - WHEEL_SHEET.inner); // 7: the ring of dates
 * ```
 */
export const WHEEL_SHEET = { width: 200, cx: 100, cy: 100, radius: 97, inner: 90 } as const;

/**
 * The wheel's geometry for a latitude: whether it is the north's or the south's, the scale of its chart and the window, which is the horizon: a circle of radius `k / sin(latitude)` whose middle is `k / tan(latitude)` above the pole, on the sheet's vertical.
 * The latitude is moved to 20 to 70 degrees as the printable wheel moves it.
 *
 * @param latitude - Degrees north of the equator, negative south.
 * @returns `north`, the latitude in degrees `phi` (20 to 70, no sign), the chart's scale `k` in millimetres and the window `{ x, y, r }` on the sheet.
 * @throws RangeError if the latitude is not a number from -90 to 90.
 *
 * @example
 * ```ts
 * import { wheelGeometry } from "./planisphere-core.ts";
 *
 * const g = wheelGeometry(45);
 * console.log(g.window.r.toFixed(2), g.window.y.toFixed(2)); // 52.72 62.72
 * ```
 */
export function wheelGeometry(latitude: number): { north: boolean; phi: number; k: number; window: { x: number; y: number; r: number } } {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) throw new RangeError(`latitude must be a number from -90 to 90, got ${String(latitude)}`);
  const phi = Math.min(70, Math.max(20, Math.abs(latitude)));
  const k = WHEEL_SHEET.inner * Math.tan((phi * RAD) / 2);
  return { north: latitude >= 0, phi, k, window: { x: WHEEL_SHEET.cx, y: WHEEL_SHEET.cy - k / Math.tan(phi * RAD), r: k / Math.sin(phi * RAD) } };
}

/**
 * The degrees, clockwise, the star disc is turned for a moment: minus the local sidereal time in the north's view, plus it in the south's. The moment is read as local mean solar time on the wheel's own meridian (longitude 0), because a wheel has a latitude and no time zone.
 *
 * @param latitude - Degrees north, negative south; only its sign is used.
 * @param when - Milliseconds since 1970, read as the clock of the wheel's meridian.
 * @returns Degrees, -360 up to 360.
 * @throws RangeError if `when` is not finite.
 *
 * @example
 * ```ts
 * import { discTurn } from "./planisphere-core.ts";
 *
 * // at midnight on the September equinox the sidereal time is about 0 h, so the disc is hardly turned
 * console.log(discTurn(45, Date.UTC(2026, 8, 23, 0, 0)).toFixed(0), discTurn(-45, Date.UTC(2026, 8, 23, 0, 0)).toFixed(0));
 * ```
 */
export function discTurn(latitude: number, when: number): number {
  const lst = localSiderealTime(when, 0);
  return latitude >= 0 ? -lst : lst;
}

/**
 * The moment after the disc is turned a further `degrees` clockwise: the north's sky turns the other way from the south's, and a degree is 1/360.98564736629 of a day.
 *
 * @param latitude - Degrees north, negative south.
 * @param when - Milliseconds since 1970.
 * @param degrees - Degrees clockwise, positive or negative.
 * @returns Milliseconds since 1970.
 * @throws RangeError if `when` or `degrees` is not finite.
 *
 * @example
 * ```ts
 * import { momentAfterTurn } from "./planisphere-core.ts";
 *
 * // 15 degrees anticlockwise is an hour later in the north (a sidereal hour, 59 min 50 s of the clock)
 * console.log((momentAfterTurn(45, 0, -15) / 60000).toFixed(2)); // 59.84
 * ```
 */
export function momentAfterTurn(latitude: number, when: number, degrees: number): number {
  if (!Number.isFinite(when) || !Number.isFinite(degrees)) throw new RangeError(`when and degrees must be finite, got ${String(when)} and ${String(degrees)}`);
  const sidereal = latitude >= 0 ? -degrees : degrees;
  return when + (sidereal / SIDEREAL_DEGREES_A_DAY) * 86_400_000;
}

/**
 * Where a star lands on the sheet, in millimetres, when the disc is turned `turn` degrees clockwise: the pole is at the middle, the stars' distance from it is the stereographic `k * tan(polar distance / 2)`, and the angle is the right ascension, clockwise in the north and the other way in the south.
 *
 * @param star - A right ascension and declination in degrees.
 * @param latitude - Degrees north, negative south (it chooses the hemisphere and the scale).
 * @param turn - Degrees clockwise.
 * @returns `{ x, y }` on the 200 mm sheet, y downward.
 * @throws RangeError as `wheelGeometry` does.
 *
 * @example
 * ```ts
 * import { sheetPosition } from "./planisphere-core.ts";
 *
 * // the pole is at the middle of the sheet
 * const pole = sheetPosition({ rightAscension: 0, declination: 90 }, 45, 0);
 * console.log(pole.x, pole.y); // 100 100
 * ```
 */
export function sheetPosition(star: { rightAscension: number; declination: number }, latitude: number, turn: number): { x: number; y: number } {
  const g = wheelGeometry(latitude);
  const r = g.k * Math.tan(((g.north ? 90 - star.declination : 90 + star.declination) * RAD) / 2);
  const angle = ((g.north ? star.rightAscension : -star.rightAscension) + turn) * RAD;
  return { x: WHEEL_SHEET.cx + r * Math.sin(angle), y: WHEEL_SHEET.cy - r * Math.cos(angle) };
}

/**
 * Whether a place on the sheet is inside the window, which is the horizon: a star there is above it.
 *
 * @param spot - A place on the sheet in millimetres.
 * @param latitude - Degrees north, negative south.
 * @returns True when it is inside or on the window's edge.
 * @throws RangeError as `wheelGeometry` does.
 *
 * @example
 * ```ts
 * import { insideWindow } from "./planisphere-core.ts";
 *
 * console.log(insideWindow({ x: 100, y: 100 }, 45), insideWindow({ x: 100, y: 5 }, 45)); // true false
 * ```
 */
export function insideWindow(spot: { x: number; y: number }, latitude: number): boolean {
  const w = wheelGeometry(latitude).window;
  return Math.hypot(spot.x - w.x, spot.y - w.y) <= w.r;
}

/** The brightest stars that have a name, brightest first, for the labels and the list: magnitude 2.5 or brighter (about seventy). */
let named: Star[] | undefined;
function namedStars(): Star[] {
  named ??= allStars().filter((s) => s.name !== undefined && s.magnitude <= 2.5).sort((a, b) => a.magnitude - b.magnitude);
  return named;
}

/**
 * The named stars, brighter than magnitude 2.5, that are inside the window when the disc is turned for a moment: the ones a reader can read off the wheel. Brightest first.
 *
 * @param latitude - Degrees north, negative south.
 * @param when - Milliseconds since 1970, the clock of the wheel's meridian.
 * @returns The stars.
 * @throws RangeError as `discTurn` and `wheelGeometry` do.
 *
 * @example
 * ```ts
 * import { namedStarsInWindow } from "./planisphere-core.ts";
 *
 * // Sirius is up over latitude 45 north on a December evening, and Canopus never is
 * const names = namedStarsInWindow(45, Date.UTC(2026, 11, 20, 21, 0)).map((s) => s.name);
 * console.log(names.includes("Sirius"), names.includes("Canopus")); // true false
 * ```
 */
export function namedStarsInWindow(latitude: number, when: number): Star[] {
  const turn = discTurn(latitude, when);
  return namedStars().filter((s) => insideWindow(sheetPosition(s, latitude, turn), latitude));
}

/**
 * The named stars that get a label on the wheel: the brightest, magnitude 1.9 or brighter.
 *
 * @returns The stars, brightest first.
 *
 * @example
 * ```ts
 * import { labelledStars } from "./planisphere-core.ts";
 *
 * console.log(labelledStars()[0]!.name); // Sirius
 * ```
 */
export function labelledStars(): Star[] {
  return namedStars().filter((s) => s.magnitude <= 1.9);
}

/**
 * A moment from the address's `date` (`2026-11-08`) and `time` (`21:00`), as milliseconds since 1970 on the wheel's own clock; `undefined` if either is missing or is not a real date and time.
 *
 * @param date - `YYYY-MM-DD`.
 * @param time - `HH:MM`, 00:00 to 23:59.
 * @returns Milliseconds, or `undefined`.
 *
 * @example
 * ```ts
 * import { parseMoment, momentText } from "./planisphere-core.ts";
 *
 * const ms = parseMoment("2026-11-08", "21:30")!;
 * console.log(momentText(ms)); // { date: '2026-11-08', time: '21:30' }
 * console.log(parseMoment("2026-02-30", "21:30")); // undefined
 * ```
 */
export function parseMoment(date: string | null | undefined, time: string | null | undefined): number | undefined {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date ?? "");
  const t = /^(\d{2}):(\d{2})$/.exec(time ?? "");
  if (d === null || t === null) return undefined;
  const [y, mo, day, h, mi] = [d[1], d[2], d[3], t[1], t[2]].map(Number) as [number, number, number, number, number];
  if (h > 23 || mi > 59) return undefined;
  const ms = Date.UTC(y, mo - 1, day, h, mi);
  const back = new Date(ms);
  return back.getUTCFullYear() === y && back.getUTCMonth() === mo - 1 && back.getUTCDate() === day ? ms : undefined;
}

/**
 * A moment as the address and the page's date and time boxes write it, to the minute.
 *
 * @param ms - Milliseconds since 1970.
 * @returns `{ date: 'YYYY-MM-DD', time: 'HH:MM' }`.
 * @throws RangeError if `ms` is not finite.
 *
 * @example
 * ```ts
 * import { momentText } from "./planisphere-core.ts";
 *
 * console.log(momentText(Date.UTC(2026, 10, 8, 21, 0)).time); // 21:00
 * ```
 */
export function momentText(ms: number): { date: string; time: string } {
  if (!Number.isFinite(ms)) throw new RangeError(`ms must be finite, got ${String(ms)}`);
  const iso = new Date(Math.round(ms / 60_000) * 60_000).toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}
