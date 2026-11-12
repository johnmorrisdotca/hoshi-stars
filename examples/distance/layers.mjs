import { stars } from "@johnmorrisdotca/hoshi-stars";
import { galaxyDistance, messier } from "@johnmorrisdotca/hoshi-stars/deep-sky";
import { deepSkyInput, layersByDistance, nearbyInput, starInput, stepLimit } from "@johnmorrisdotca/hoshi-stars/distance";
import { nearbyStars } from "@johnmorrisdotca/hoshi-stars/nearby";

// Everything that has a place on the sky: the bright stars, the nearby stars and the Messier objects, each with the distance its table gives (or none).
const everything = [...stars().map(starInput), ...nearbyStars().map(nearbyInput), ...messier().map((object) => deepSkyInput(object, galaxyDistance(object)))];

// Step the limit out, 10 light-years at a time to start with, and see the sky fill shell by shell.
let limit = 10;
for (let step = 0; step < 6; step += 1) {
  const layers = layersByDistance(everything, { limit });
  console.log(`${limit}: ${layers.things.length} things; bands ${layers.counts.join(" ")}; ${layers.uncertain} uncertain; ${layers.unknown} with no distance`);
  limit = stepLimit(limit, 1);
}

// A star whose distance is uncertain is in no band: it is kept apart, with the range its error allows.
const rigel = layersByDistance(everything, { limit: 700 }).things.find((thing) => thing.name === "Rigel");
console.log(rigel.uncertain, Math.round(rigel.low), Math.round(rigel.high));

// 10: 9 things; bands 9 0 0 0 0 0; 0 uncertain; 3083 with no distance
// 50: 897 things; bands 9 665 0 0 0 0; 223 uncertain; 3083 with no distance
// 100: 4130 things; bands 9 665 870 0 0 0; 2586 uncertain; 3083 with no distance
// 500: 7498 things; bands 9 665 870 329 0 0; 5625 uncertain; 3083 with no distance
// 1000: 7568 things; bands 9 665 870 329 10 0; 5685 uncertain; 3083 with no distance
// Infinity: 7672 things; bands 9 665 870 329 10 37; 5752 uncertain; 3083 with no distance
// true 593 1483
