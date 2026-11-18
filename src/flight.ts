// A flight through space: where the camera is, which way it goes and how fast, in multiples of the speed of light; one step of it; a flight to a place that slows and stops there; what to say about
// where it is; and a place relative to the camera, so a page draws what is near in small numbers however far from the Sun the camera has gone.
// The flight tier (`@johnmorrisdotca/hoshi-stars/flight`): arithmetic only. It reads no table, so it adds no data; the stars come from the other tiers. Pure: no DOM, no clock, no state.
// A place is `{ x, y, z }` in parsecs on the J2000 equatorial axes with the Sun at the origin (x toward right ascension 0, z toward the north pole): the same point `skyFrom` takes, so the
// sky from where the flight is now is `skyFrom(state.position)`.

const RADIANS = Math.PI / 180;
const LIGHT_YEARS_PER_PARSEC = 3.261563777;
const KILOMETRES_PER_PARSEC = 3.085677581491367e13;
const KILOMETRES_PER_ASTRONOMICAL_UNIT = 149_597_870.7;
/** The speed of light in km/s (exact, by definition of the metre). */
const LIGHT_KILOMETRES_PER_SECOND = 299_792.458;

/**
 * The speed of light in parsecs a second: about 9.716e-9. A flight at 1 c covers this much each second.
 *
 * @example
 * ```ts
 * import { LIGHT_SPEED } from "@johnmorrisdotca/hoshi-stars/flight";
 *
 * console.log((1 / LIGHT_SPEED / 31_557_600).toFixed(2)); // 3.26: the years light takes to cross a parsec
 * ```
 */
export const LIGHT_SPEED = LIGHT_KILOMETRES_PER_SECOND / KILOMETRES_PER_PARSEC;

/**
 * The speeds of the dial, in multiples of the speed of light, slowest first: 1 c (the Moon in 1.3 seconds, the Sun in 8 minutes) to 10 million million c (the Andromeda galaxy in 8 seconds).
 * Each is ten times the one before.
 *
 * @example
 * ```ts
 * import { FLIGHT_SPEEDS } from "@johnmorrisdotca/hoshi-stars/flight";
 *
 * console.log(FLIGHT_SPEEDS[0], FLIGHT_SPEEDS.length); // 1, 14
 * ```
 */
export const FLIGHT_SPEEDS: readonly number[] = Object.freeze(Array.from({ length: 14 }, (_, power) => 10 ** power));

/**
 * A place in space: parsecs on the J2000 equatorial axes, the Sun at the origin, x toward right ascension 0 and z toward the north pole.
 *
 * @example
 * ```ts
 * import type { FlightPoint } from "@johnmorrisdotca/hoshi-stars/flight";
 *
 * const sun: FlightPoint = { x: 0, y: 0, z: 0 };
 * console.log(sun.x);
 * ```
 */
export interface FlightPoint {
  x: number;
  y: number;
  z: number;
}

/**
 * A flight at one moment: where the camera is, the direction it moves in, and its speed.
 *
 * @example
 * ```ts
 * import { flightStart, type FlightState } from "@johnmorrisdotca/hoshi-stars/flight";
 *
 * const state: FlightState = flightStart();
 * console.log(state.speed); // 1
 * ```
 */
export interface FlightState {
  /** Where the camera is. */
  position: FlightPoint;
  /** The direction of travel: a vector of length 1 on the same axes. */
  heading: FlightPoint;
  /** The speed, in multiples of the speed of light. 0 is at rest. */
  speed: number;
}

/**
 * What a flight toward a place did in one step.
 *
 * @example
 * ```ts
 * import { flightStart, flyToward, type FlightLeg } from "@johnmorrisdotca/hoshi-stars/flight";
 *
 * const leg: FlightLeg = flyToward(flightStart(), { x: 1.3, y: 0, z: 0 }, 1);
 * console.log(leg.arrived, leg.remaining.toFixed(2));
 * ```
 */
export interface FlightLeg {
  /** The flight after the step: turned toward the place, moved, and stopped (speed kept) where it arrived. */
  state: FlightState;
  /** True once the camera is at the stopping distance. */
  arrived: boolean;
  /** How far the place still is, in parsecs. */
  remaining: number;
  /** How far the camera moved in this step, in parsecs: less than the speed allows while it slows to arrive. */
  moved: number;
}

/**
 * How far from the Sun a place is, in every unit a readout may want, and the time light takes to come from the Sun to it.
 *
 * @example
 * ```ts
 * import { flightReadout, type FlightReadout } from "@johnmorrisdotca/hoshi-stars/flight";
 *
 * const readout: FlightReadout = flightReadout({ x: 1, y: 0, z: 0 });
 * console.log(readout.scale, readout.lightYears.toFixed(2)); // "light-years", 3.26
 * ```
 */
export interface FlightReadout {
  parsecs: number;
  lightYears: number;
  astronomicalUnits: number;
  kilometres: number;
  /** The time light takes from the Sun to here, in seconds. In years it is `lightYears`. */
  lightSeconds: number;
  /**
   * The unit a reader would say the distance in: kilometres under a hundredth of an astronomical unit (about four times the Moon's distance), astronomical units under a tenth of a
   * light-year (the Oort cloud's edge), then light-years.
   */
  scale: "kilometres" | "astronomical-units" | "light-years";
}

const finite = (name: string, value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new TypeError(`${name} must be a finite number, got ${String(value)}`);
  return value;
};

const point = (name: string, value: FlightPoint): FlightPoint => {
  if (value === null || typeof value !== "object") throw new TypeError(`${name} must be a point { x, y, z } in parsecs`);
  return { x: finite(`${name}.x`, value.x), y: finite(`${name}.y`, value.y), z: finite(`${name}.z`, value.z) };
};

const stateOf = (state: FlightState): FlightState => {
  if (state === null || typeof state !== "object") throw new TypeError("state must be a flight state");
  const speed = finite("speed", state.speed);
  if (speed < 0) throw new RangeError(`speed must be 0 or more, got ${speed}`);
  const heading = point("heading", state.heading);
  const length = Math.hypot(heading.x, heading.y, heading.z);
  if (length === 0) throw new RangeError("heading must not be the zero vector");
  return { position: point("position", state.position), heading: { x: heading.x / length, y: heading.y / length, z: heading.z / length }, speed };
};

/**
 * The place of a direction and a distance: what a star's right ascension, declination and distance are as a point of the flight.
 *
 * @param rightAscension - Degrees.
 * @param declination - Degrees, -90 to 90.
 * @param lightYears - The distance from the Sun.
 * @returns The point, in parsecs.
 *
 * @example
 * ```ts
 * import { starByName, starDistance } from "@johnmorrisdotca/hoshi-stars";
 * import { flightPoint } from "@johnmorrisdotca/hoshi-stars/flight";
 *
 * const sirius = starByName("Sirius")!;
 * console.log(flightPoint(sirius.rightAscension, sirius.declination, starDistance(sirius)!.lightYears));
 * ```
 */
export function flightPoint(rightAscension: number, declination: number, lightYears: number): FlightPoint {
  const ra = finite("rightAscension", rightAscension) * RADIANS;
  const dec = finite("declination", declination) * RADIANS;
  const parsecs = finite("lightYears", lightYears) / LIGHT_YEARS_PER_PARSEC;
  if (parsecs < 0) throw new RangeError(`lightYears must be 0 or more, got ${lightYears}`);
  const flat = Math.cos(dec) * parsecs;
  return { x: flat * Math.cos(ra), y: flat * Math.sin(ra), z: Math.sin(dec) * parsecs };
}

/**
 * A flight at its start: at the Sun, heading toward right ascension 0 on the equator, at the speed of light.
 *
 * @returns A new state.
 *
 * @example
 * ```ts
 * import { flightStart } from "@johnmorrisdotca/hoshi-stars/flight";
 *
 * console.log(flightStart()); // { position: { x: 0, y: 0, z: 0 }, heading: { x: 1, y: 0, z: 0 }, speed: 1 }
 * ```
 */
export function flightStart(): FlightState {
  return { position: { x: 0, y: 0, z: 0 }, heading: { x: 1, y: 0, z: 0 }, speed: 1 };
}

/**
 * The next speed of the dial: the nearest of `FLIGHT_SPEEDS` above (or below) a speed, held at the ends.
 *
 * @param speed - A speed in multiples of the speed of light.
 * @param direction - 1 for faster, -1 for slower.
 * @returns A speed of the dial.
 *
 * @example
 * ```ts
 * import { stepFlightSpeed } from "@johnmorrisdotca/hoshi-stars/flight";
 *
 * console.log(stepFlightSpeed(1, 1), stepFlightSpeed(250, -1)); // 10, 100
 * ```
 */
export function stepFlightSpeed(speed: number, direction: 1 | -1): number {
  finite("speed", speed);
  if (direction !== 1 && direction !== -1) throw new RangeError(`direction must be 1 or -1, got ${String(direction)}`);
  if (direction === 1) return FLIGHT_SPEEDS.find((one) => one > speed) ?? FLIGHT_SPEEDS[FLIGHT_SPEEDS.length - 1]!;
  return [...FLIGHT_SPEEDS].reverse().find((one) => one < speed) ?? FLIGHT_SPEEDS[0]!;
}

/**
 * One step of a flight: the camera moves along its heading for a time at its speed. The heading and the speed stay as they are.
 *
 * @param state - The flight now. It is not changed.
 * @param seconds - How long the step lasts, 0 or more.
 * @returns The flight after the step.
 *
 * @example
 * ```ts
 * import { flightReadout, flightStart, flyStep } from "@johnmorrisdotca/hoshi-stars/flight";
 *
 * const after = flyStep({ ...flightStart(), speed: 1 }, 499); // light reaches the Earth's distance in 499 seconds
 * console.log(flightReadout(after.position).astronomicalUnits.toFixed(2)); // 1.00
 * ```
 */
export function flyStep(state: FlightState, seconds: number): FlightState {
  const now = stateOf(state);
  if (finite("seconds", seconds) < 0) throw new RangeError(`seconds must be 0 or more, got ${seconds}`);
  const far = now.speed * LIGHT_SPEED * seconds;
  return { position: { x: now.position.x + now.heading.x * far, y: now.position.y + now.heading.y * far, z: now.position.z + now.heading.z * far }, heading: now.heading, speed: now.speed };
}

/**
 * One step of a flight to a place: the heading turns to the place, the camera moves toward it, and it stops at the stopping distance instead of passing it. Call it each frame until
 * `arrived`. The speed is kept, so a page chooses it (a far place wants a fast dial: `flightTime` says how long a leg takes).
 *
 * @param state - The flight now. It is not changed.
 * @param target - The place to fly to.
 * @param seconds - How long the step lasts, 0 or more.
 * @param options - `stopAt`: how far from the place to stop, in parsecs (default 0: at the place itself). A star wants a little room. `easeSeconds`: slow down to arrive: a step covers no more
 *   than the share of what is left that `1 - exp(-seconds / easeSeconds)` is, so the last of the way is flown ever slower, whatever the frame rate, and a star grows from a point to a ball
 *   instead of jumping (default 0: full speed to the stop).
 * @returns The flight after the step, whether it has arrived, how far the place still is and how far the step moved.
 *
 * @example
 * ```ts
 * import { flightStart, flyToward } from "@johnmorrisdotca/hoshi-stars/flight";
 *
 * let flight = { ...flightStart(), speed: 1e8 };
 * const proxima = { x: -0.47, y: -0.36, z: -1.16 };
 * for (let frame = 0; frame < 60; frame += 1) flight = flyToward(flight, proxima, 1 / 30, { stopAt: 0.001 }).state;
 * console.log(flight.position);
 * ```
 */
export function flyToward(state: FlightState, target: FlightPoint, seconds: number, options: { stopAt?: number; easeSeconds?: number } = {}): FlightLeg {
  const now = stateOf(state);
  const to = point("target", target);
  if (finite("seconds", seconds) < 0) throw new RangeError(`seconds must be 0 or more, got ${seconds}`);
  const stopAt = options?.stopAt ?? 0;
  if (finite("stopAt", stopAt) < 0) throw new RangeError(`stopAt must be 0 or more, got ${stopAt}`);
  const ease = options?.easeSeconds ?? 0;
  if (finite("easeSeconds", ease) < 0) throw new RangeError(`easeSeconds must be 0 or more, got ${ease}`);
  const dx = to.x - now.position.x;
  const dy = to.y - now.position.y;
  const dz = to.z - now.position.z;
  const away = Math.hypot(dx, dy, dz);
  if (away <= stopAt) return { state: now, arrived: true, remaining: away, moved: 0 };
  const heading = { x: dx / away, y: dy / away, z: dz / away };
  const left = away - stopAt;
  let far = Math.min(now.speed * LIGHT_SPEED * seconds, left);
  if (ease > 0) {
    const eased = left * -Math.expm1(-seconds / ease);
    // What is left after an eased step never reaches nothing by itself: under a thousandth of the stopping distance, or under what the numbers can hold this far out, the step takes it all.
    const close = stopAt * 1e-3 + (away + Math.hypot(to.x, to.y, to.z)) * 1e-13 + 1e-15;
    if (eased < far) far = left - eased <= close ? left : eased;
  }
  const remaining = away - far;
  return { state: { position: { x: now.position.x + heading.x * far, y: now.position.y + heading.y * far, z: now.position.z + heading.z * far }, heading, speed: now.speed }, arrived: remaining <= stopAt, remaining, moved: far };
}

/**
 * How long a flight takes to cover a distance at a speed.
 *
 * @param parsecs - The distance.
 * @param speed - In multiples of the speed of light, above 0.
 * @returns Seconds.
 *
 * @example
 * ```ts
 * import { flightTime } from "@johnmorrisdotca/hoshi-stars/flight";
 *
 * console.log((flightTime(1.3, 1e8)).toFixed(1)); // 1.3 seconds to Proxima Centauri at 100 million c
 * ```
 */
export function flightTime(parsecs: number, speed: number): number {
  if (finite("parsecs", parsecs) < 0) throw new RangeError(`parsecs must be 0 or more, got ${parsecs}`);
  if (!(finite("speed", speed) > 0)) throw new RangeError(`speed must be above 0, got ${speed}`);
  return parsecs / (speed * LIGHT_SPEED);
}

/**
 * The slowest speed of the dial that covers a distance within a time: the speed a page sets for a flight to a place, so that the Moon and the Andromeda galaxy are both a few seconds away.
 *
 * @param parsecs - The distance, 0 or more.
 * @param seconds - The longest the leg may take, above 0.
 * @returns One of `FLIGHT_SPEEDS`; the fastest of them where none is fast enough.
 *
 * @example
 * ```ts
 * import { flightSpeedFor } from "@johnmorrisdotca/hoshi-stars/flight";
 *
 * console.log(flightSpeedFor(7.68, 10)); // 100000000: Vega in 7.7 seconds
 * ```
 */
export function flightSpeedFor(parsecs: number, seconds: number): number {
  if (finite("parsecs", parsecs) < 0) throw new RangeError(`parsecs must be 0 or more, got ${parsecs}`);
  if (!(finite("seconds", seconds) > 0)) throw new RangeError(`seconds must be above 0, got ${seconds}`);
  return FLIGHT_SPEEDS.find((speed) => parsecs <= speed * LIGHT_SPEED * seconds) ?? FLIGHT_SPEEDS[FLIGHT_SPEEDS.length - 1]!;
}

/**
 * What a readout says about a place: its distance from the Sun in every unit, the time light takes to get there, and which unit suits the distance.
 *
 * @param position - A place.
 * @returns The distances and the light-travel time.
 *
 * @example
 * ```ts
 * import { flightReadout } from "@johnmorrisdotca/hoshi-stars/flight";
 *
 * const moon = flightReadout({ x: 1.2457e-8, y: 0, z: 0 });
 * console.log(moon.scale, Math.round(moon.kilometres), moon.lightSeconds.toFixed(2)); // "kilometres", 384386, 1.28
 * ```
 */
export function flightReadout(position: FlightPoint): FlightReadout {
  const at = point("position", position);
  const parsecs = Math.hypot(at.x, at.y, at.z);
  const kilometres = parsecs * KILOMETRES_PER_PARSEC;
  const astronomicalUnits = kilometres / KILOMETRES_PER_ASTRONOMICAL_UNIT;
  const lightYears = parsecs * LIGHT_YEARS_PER_PARSEC;
  return { parsecs, lightYears, astronomicalUnits, kilometres, lightSeconds: kilometres / LIGHT_KILOMETRES_PER_SECOND, scale: astronomicalUnits < 0.01 ? "kilometres" : lightYears < 0.1 ? "astronomical-units" : "light-years" };
}

/**
 * A place as the camera's scene sees it: the place less the camera's position, taken in whole (64-bit) numbers first and then divided by the scene's unit. A page hands these to its
 * drawing, so the numbers it draws with are small near the camera however far the camera is from the Sun: a star 2 million light-years out, seen from a camera beside it, is a few units
 * away and keeps its place. (A drawing's own numbers are 32-bit and hold 7 digits; the flight's hold 15, which near the Sun is metres and at the Andromeda galaxy is thousands of kilometres.)
 *
 * @param place - A place.
 * @param camera - Where the camera is.
 * @param unit - The length of one scene unit, in parsecs (default 1).
 * @returns `[x, y, z]` in scene units, the camera at the origin.
 *
 * @example
 * ```ts
 * import { fromCamera } from "@johnmorrisdotca/hoshi-stars/flight";
 *
 * console.log(fromCamera({ x: 770_000.5, y: 0, z: 0 }, { x: 770_000, y: 0, z: 0 })); // [0.5, 0, 0]
 * ```
 */
export function fromCamera(place: FlightPoint, camera: FlightPoint, unit = 1): [x: number, y: number, z: number] {
  const at = point("place", place);
  const eye = point("camera", camera);
  if (!(finite("unit", unit) > 0)) throw new RangeError(`unit must be above 0, got ${unit}`);
  return [(at.x - eye.x) / unit, (at.y - eye.y) / unit, (at.z - eye.z) / unit];
}

const POINT_TEXT = /^pc_(-?[0-9.]+(?:e-?[0-9]+)?)_(-?[0-9.]+(?:e-?[0-9]+)?)_(-?[0-9.]+(?:e-?[0-9]+)?)$/;

/**
 * A place as text for an address: `pc_<x>_<y>_<z>`, the three parsecs written as the shortest numbers that read back the same. It is the one form of a point: `flightPointOf` reads what
 * this writes and gives the same point, and every character is one a query string carries as it is. (A place with a name has its id instead: `flightAddress` of `/flight/places` reads both.)
 *
 * @param position - A place.
 * @returns The text.
 *
 * @example
 * ```ts
 * import { flightPointText } from "@johnmorrisdotca/hoshi-stars/flight";
 *
 * console.log(flightPointText({ x: 1.5, y: -2, z: 0.25 })); // "pc_1.5_-2_0.25"
 * ```
 */
export function flightPointText(position: FlightPoint): string {
  const at = point("position", position);
  // 0 for -0, and no "+" in an exponent: 1e21 parsecs is past anything there is, and is written out in full.
  const text = (value: number): string => (value === 0 ? "0" : Math.abs(value) >= 1e21 ? BigInt(value).toString() : String(value));
  return `pc_${text(at.x)}_${text(at.y)}_${text(at.z)}`;
}

/**
 * The place a text of `flightPointText` names.
 *
 * @param text - `pc_<x>_<y>_<z>`.
 * @returns The point, or `undefined` where the text is not one.
 *
 * @example
 * ```ts
 * import { flightPointOf } from "@johnmorrisdotca/hoshi-stars/flight";
 *
 * console.log(flightPointOf("pc_1.5_-2_0.25")); // { x: 1.5, y: -2, z: 0.25 }
 * ```
 */
export function flightPointOf(text: string): FlightPoint | undefined {
  const found = typeof text === "string" ? POINT_TEXT.exec(text.trim()) : null;
  if (found === null) return undefined;
  const [x, y, z] = [Number(found[1]), Number(found[2]), Number(found[3])];
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return undefined;
  return { x: x === 0 ? 0 : x, y: y === 0 ? 0 : y, z: z === 0 ? 0 : z };
}
