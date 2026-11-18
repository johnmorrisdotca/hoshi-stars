// The places a flight can go to: a star, a nearby star or a galaxy of the package's own tables as a point of the flight, with how well its distance is known, and a short list to start from.
// The flight places tier (`@johnmorrisdotca/hoshi-stars/flight/places`): it imports the bright stars, the nearby table (about 240 kB gzipped) and the Messier galaxies' distances, so it is its
// own import and `/flight` stays arithmetic. Pure: no DOM, no clock, no state.
import { deepSkyObject, galaxyDistance } from "./deep-sky.ts";
import { certaintyOf, type Certainty } from "./distance.ts";
import { flightPoint, type FlightPoint } from "./flight.ts";
import { nearbyStarByName, type NearbyStar } from "./nearby.ts";
import { starByName, starDistance, type Star } from "./stars.ts";
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
  /** A key that stays the same: `hr-2491` for a bright star, `gctp-3278` for a nearby star, `M31` for a deep-sky object. */
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
