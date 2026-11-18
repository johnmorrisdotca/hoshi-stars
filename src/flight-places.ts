// The places a flight can go to: a star, a nearby star or a galaxy of the package's own tables as a point of the flight, with how well its distance is known, and a short list to start from.
// The flight places tier (`@johnmorrisdotca/hoshi-stars/flight/places`): it imports the bright stars, the nearby table (about 240 kB gzipped) and the Messier galaxies' distances, so it is its
// own import and `/flight` stays arithmetic. Pure: no DOM, no clock, no state.
import { deepSkyObject, galaxyDistance } from "./deep-sky.ts";
import { certaintyOf, type Certainty } from "./distance.ts";
import { flightPoint, flightPointOf, flightPointText, type FlightPoint } from "./flight.ts";
import { nearbyStarByName, nearbyStars, type NearbyStar } from "./nearby.ts";
import { starByHr, starByName, starDistance, type Star } from "./stars.ts";
import type { DeepSkyObject } from "./deep-sky-core.ts";

/**
 * A place a flight can go to.
 *
 * @example
 * ```ts
 * import { flightPlaces, type FlightPlace } from "@johnmorrisdotca/hoshi-stars/flight/places";
 *
 * const first: FlightPlace = flightPlaces()[0]!;
 * console.log(first.id, first.lightYears.toFixed(2), first.certainty);
 * ```
 */
export interface FlightPlace {
  /** A key that stays the same: `hr-2491` for a bright star, `gctp-3278` for a nearby star, `M31` for a deep-sky object, `sun` for the Sun. */
  id: string;
  /** The English name, where there is one. */
  name: string | undefined;
  /** What it is. */
  kind: "star" | "nearby" | "deep-sky";
  /** Where it is, in parsecs, the Sun at the origin. */
  position: FlightPoint;
  /** Its distance from the Sun in light-years. */
  lightYears: number;
  /** The distance's error in light-years, or `undefined` where the source states none. */
  lightYearsError: number | undefined;
  /** How well the distance is known: good under 5%, fair to 20%, rough above that or with no error (the `/distance` tier's rule). */
  certainty: Certainty;
  /** Set where the distance is another thing's: the Pleiades take the distance of their brightest star, because the tables have no distance for a cluster. */
  distanceOf?: string;
}

/**
 * A star, a nearby star or a Messier galaxy as a place of the flight.
 *
 * @param thing - A bright star, a nearby star (from `/nearby`) or a deep-sky object.
 * @returns The place, or `undefined` where the package has no distance for it (a star with no parallax; a cluster, a nebula, or a galaxy outside the Messier list).
 *
 * @example
 * ```ts
 * import { starByName } from "@johnmorrisdotca/hoshi-stars";
 * import { flightPlace } from "@johnmorrisdotca/hoshi-stars/flight/places";
 *
 * console.log(flightPlace(starByName("Betelgeuse")!)?.certainty); // "fair"
 * ```
 */
export function flightPlace(thing: Star | NearbyStar | DeepSkyObject): FlightPlace | undefined {
  if (thing === null || typeof thing !== "object" || typeof thing.rightAscension !== "number" || typeof thing.declination !== "number") throw new TypeError("a flight place is made from a star, a nearby star or a deep-sky object");
  if ("type" in thing) {
    const distance = galaxyDistance(thing);
    if (distance === null) return undefined;
    const error = distance.error === null ? undefined : distance.error.lightYears;
    return { id: thing.id, name: thing.name, kind: "deep-sky", position: flightPoint(thing.rightAscension, thing.declination, distance.lightYears), lightYears: distance.lightYears, lightYearsError: error, certainty: certaintyOf(error === undefined ? undefined : error / distance.lightYears) };
  }
  const distance = starDistance(thing);
  if (distance === undefined) return undefined;
  const nearby = "id" in thing;
  return {
    id: nearby ? thing.id : `hr-${thing.hr}`,
    name: thing.name,
    kind: nearby ? "nearby" : "star",
    position: flightPoint(thing.rightAscension, thing.declination, distance.lightYears),
    lightYears: distance.lightYears,
    lightYearsError: distance.lightYearsError,
    certainty: certaintyOf(distance.lightYearsError === undefined ? undefined : distance.lightYearsError / distance.lightYears),
  };
}

/**
 * A short list of places to fly to, nearest first: Proxima Centauri, Sirius, the Pleiades, Betelgeuse and the Andromeda galaxy. Every distance is the package's own. The Pleiades are
 * placed in the cluster's direction at the distance of Alcyone, their brightest star, whose parallax here is poor: the place is marked `rough` and says whose distance it is.
 *
 * @returns New places, nearest first.
 *
 * @example
 * ```ts
 * import { flightPlaces } from "@johnmorrisdotca/hoshi-stars/flight/places";
 *
 * console.log(flightPlaces().map((place) => `${place.name}: ${Math.round(place.lightYears)} light-years, ${place.certainty}`));
 * ```
 */
export function flightPlaces(): FlightPlace[] {
  const places: FlightPlace[] = [];
  const add = (place: FlightPlace | undefined): void => {
    if (place !== undefined) places.push(place);
  };
  const proxima = nearbyStarByName("Proxima Centauri");
  if (proxima !== undefined) add(flightPlace(proxima));
  for (const name of ["Sirius", "Betelgeuse"]) {
    const star = starByName(name);
    if (star !== undefined) add(flightPlace(star));
  }
  const pleiades = deepSkyObject("M45");
  const alcyone = starByName("Alcyone");
  const alcyoneDistance = alcyone === undefined ? undefined : starDistance(alcyone);
  if (pleiades !== undefined && alcyone !== undefined && alcyoneDistance !== undefined) {
    places.push({ id: pleiades.id, name: pleiades.name, kind: "deep-sky", position: flightPoint(pleiades.rightAscension, pleiades.declination, alcyoneDistance.lightYears), lightYears: alcyoneDistance.lightYears, lightYearsError: alcyoneDistance.lightYearsError, certainty: "rough", distanceOf: `hr-${alcyone.hr}` });
  }
  const andromeda = deepSkyObject("M31");
  if (andromeda !== undefined) add(flightPlace(andromeda));
  return places.sort((a, b) => a.lightYears - b.lightYears);
}

/**
 * The place an id names: the id of a `FlightPlace`, which is also the id `skyFrom` gives a seen star. `sun` is the Sun, at the origin; `hr-7001` is the bright star HR 7001 (Vega);
 * `gctp-3278` is a nearby star; `M31` is a deep-sky object. Upper and lower case are the same.
 *
 * @param id - The id.
 * @returns The place, or `undefined` where nothing has that id or the package has no distance for it.
 *
 * @example
 * ```ts
 * import { flightPlaceById } from "@johnmorrisdotca/hoshi-stars/flight/places";
 *
 * console.log(flightPlaceById("hr-7001")?.name, flightPlaceById("sun")?.lightYears); // "Vega", 0
 * ```
 */
export function flightPlaceById(id: string): FlightPlace | undefined {
  if (typeof id !== "string") throw new TypeError(`id must be a string, got ${String(id)}`);
  const key = id.trim().toLowerCase();
  if (key === "sun") return { id: "sun", name: "Sun", kind: "star", position: { x: 0, y: 0, z: 0 }, lightYears: 0, lightYearsError: 0, certainty: "good" };
  const hr = /^hr-([0-9]+)$/.exec(key);
  if (hr !== null) {
    const star = starByHr(Number(hr[1]));
    return star === undefined ? undefined : flightPlace(star);
  }
  if (key.startsWith("gctp-")) {
    const star = nearbyStars().find((near) => near.id === key);
    return star === undefined ? undefined : flightPlace(star);
  }
  const listed = flightPlaces().find((place) => place.id.toLowerCase() === key);
  if (listed !== undefined) return listed;
  const object = /^[a-z]+ ?[0-9]+$/.test(key) ? deepSkyObject(key) : undefined;
  return object === undefined ? undefined : flightPlace(object);
}

/**
 * Where a camera is, as an address carries it.
 *
 * @example
 * ```ts
 * import { flightAddress, type FlightAddress } from "@johnmorrisdotca/hoshi-stars/flight/places";
 *
 * const vega: FlightAddress = flightAddress("HR-7001")!;
 * console.log(vega.at, vega.place?.name); // "hr-7001", "Vega"
 * ```
 */
export interface FlightAddress {
  /** The one way to write it: the place's id as `FlightPlace` has it, or `pc_<x>_<y>_<z>` for a point with no name. */
  at: string;
  /** The place, where the text is an id. A view puts the camera at its own stopping distance from it. */
  place: FlightPlace | undefined;
  /** The place's position, or the point itself. */
  position: FlightPoint;
}

/**
 * Read where a camera is from the text of an address: a place's id (`sun`, `hr-7001`, `gctp-3278`, `M31`) or a point in parsecs (`pc_1.5_-2_0.25`, what `flightPointText` writes).
 * `at` is the one form to write back, so two addresses of the same place are the same text.
 *
 * @param text - The id or the point.
 * @returns The address, or `undefined` where the text is neither.
 *
 * @example
 * ```ts
 * import { flightAddress } from "@johnmorrisdotca/hoshi-stars/flight/places";
 *
 * console.log(flightAddress("m31")?.at, flightAddress("pc_1.50_-2_0")?.at); // "M31", "pc_1.5_-2_0"
 * ```
 */
export function flightAddress(text: string): FlightAddress | undefined {
  if (typeof text !== "string") throw new TypeError(`text must be a string, got ${String(text)}`);
  const position = flightPointOf(text);
  if (position !== undefined) return { at: flightPointText(position), place: undefined, position };
  const place = flightPlaceById(text);
  return place === undefined ? undefined : { at: place.id, place, position: place.position };
}
