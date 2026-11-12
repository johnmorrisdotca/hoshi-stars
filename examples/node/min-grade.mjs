import { starByName, stars } from "@johnmorrisdotca/hoshi-stars";
import { nearbyStars } from "@johnmorrisdotca/hoshi-stars/nearby";
import { nearest } from "@johnmorrisdotca/hoshi-stars/nearest";

console.log(`${stars({ minGrade: "A" }).length} of ${stars().length} bright stars are grade A; ${nearbyStars({ minGrade: "B" }).length} nearby stars are B or better`);

const found = nearest(starByName("Sirius"), { by: "space", count: 4, minGrade: "B" });
for (const one of found) {
  const range = one.range === undefined ? "no range" : `${one.range[0].toFixed(1)} to ${one.range[1].toFixed(1)} light-years`;
  console.log(`${one.thing.name ?? one.thing.designation}: ${one.distance.toFixed(1)}, ${range}${one.tied ? ", tied with a neighbour" : ""}`);
}
