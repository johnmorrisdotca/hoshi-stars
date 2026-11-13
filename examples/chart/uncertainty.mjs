import { writeFileSync } from "node:fs";
import { chartSvg, pickAccuracy } from "@johnmorrisdotca/hoshi-stars/chart";
import { starByName } from "@johnmorrisdotca/hoshi-stars";

// Orion with the stars of grade C (a rough or missing distance) drawn dimmer.
const svg = chartSvg({ width: 640, height: 400, constellation: "Ori", showUncertainty: true });
writeFileSync(new URL("orion-uncertain.svg", import.meta.url), svg);

// What a pick says of Betelgeuse: its grade, the distance range in light-years and the position resolution in arc-seconds.
const { grade, lightYearsRange, positionResolutionArcsec } = pickAccuracy(starByName("Betelgeuse"));
console.log("orion-uncertain.svg", svg.includes('data-uncertain="C"'), grade, lightYearsRange.map(Math.round).join("-"), Math.round(positionResolutionArcsec * 10) / 10);
// orion-uncertain.svg true B 480-640 1.5
