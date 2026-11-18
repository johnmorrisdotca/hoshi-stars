// The places a flight can go to: the short list is nearest first with the package's own distances, each place is where its star is in the sky, a thing with no distance is no place,
// and the Pleiades say whose distance they carry.
import assert from "node:assert/strict";
import { test } from "node:test";
import { deepSkyObject } from "../src/deep-sky.ts";
import { flightReadout } from "../src/flight.ts";
import { flightPlace, flightPlaces } from "../src/flight-places.ts";
import { nearbyStarByName } from "../src/nearby.ts";
import { skyFrom } from "../src/sky-from.ts";
import { starByName, starDistance, stars } from "../src/stars.ts";

test("the short list is Proxima, Sirius, the Pleiades, Betelgeuse and Andromeda, nearest first", () => {
  const places = flightPlaces();
  assert.deepEqual(places.map((place) => place.name), ["Proxima Centauri", "Sirius", "Pleiades", "Betelgeuse", "Andromeda Galaxy"]);
  assert.deepEqual(places.map((place) => place.kind), ["nearby", "star", "deep-sky", "star", "deep-sky"]);
  for (let i = 1; i < places.length; i += 1) assert.ok(places[i]!.lightYears > places[i - 1]!.lightYears);
  assert.ok(Math.abs(places[0]!.lightYears - 4.24) < 0.01);
  assert.ok(Math.abs(places[1]!.lightYears - 8.55) < 0.01);
  assert.ok(places[4]!.lightYears > 2_000_000 && places[4]!.lightYears < 3_000_000);
  assert.equal(places[0]!.certainty, "good");
  assert.equal(places[3]!.certainty, "fair");
  assert.notEqual(flightPlaces(), flightPlaces()); // a new list each time
});

test("a place is as far from the Sun as its distance says, and from the Sun it is seen where the star is", () => {
  for (const place of flightPlaces()) assert.ok(Math.abs(flightReadout(place.position).lightYears - place.lightYears) < place.lightYears * 1e-9, place.id);
  const sirius = starByName("Sirius")!;
  const place = flightPlace(sirius)!;
  assert.equal(place.id, "hr-2491");
  assert.equal(place.lightYearsError, starDistance(sirius)!.lightYearsError);
  // from a point a thousandth of the way from the Sun to it, Sirius is in the same direction
  const seen = skyFrom({ x: place.position.x / 1000, y: place.position.y / 1000, z: place.position.z / 1000 }).find((star) => star.id === "hr-2491")!;
  assert.ok(Math.abs(seen.rightAscension - sirius.rightAscension) < 1e-6 && Math.abs(seen.declination - sirius.declination) < 1e-6);
});

test("the Pleiades carry Alcyone's distance, say so, and are rough", () => {
  const pleiades = flightPlaces().find((place) => place.id === "M45")!;
  const alcyone = starByName("Alcyone")!;
  assert.equal(pleiades.distanceOf, `hr-${alcyone.hr}`);
  assert.equal(pleiades.lightYears, starDistance(alcyone)!.lightYears);
  assert.equal(pleiades.certainty, "rough");
  for (const place of flightPlaces()) if (place.id !== "M45") assert.equal(place.distanceOf, undefined);
});

test("a thing the tables have no distance for is no place; a nearby star and a galaxy are", () => {
  assert.equal(flightPlace(deepSkyObject("M45")!), undefined); // a cluster
  assert.equal(flightPlace(deepSkyObject("M42")!), undefined); // a nebula
  const without = stars().find((star) => starDistance(star) === undefined)!;
  assert.equal(flightPlace(without), undefined);
  assert.equal(flightPlace(nearbyStarByName("Proxima Centauri")!)!.id, "gctp-3278");
  const andromeda = flightPlace(deepSkyObject("M31")!)!;
  assert.equal(andromeda.kind, "deep-sky");
  assert.equal(andromeda.certainty, "rough"); // the source states no error for it
  assert.throws(() => flightPlace({} as never), TypeError);
});
