import { writeFileSync } from "node:fs";
import { chartSvg } from "@johnmorrisdotca/hoshi-stars/chart";

// The Moon and a planet as your own code worked them out: where (right ascension and declination, in degrees), how bright, and how much is lit.
const bodies = [
  { id: "moon", names: { en: "Moon", ja: "月" }, ra: 258.14, dec: -27.57, magnitude: -6.9, phase: 0.07, brightLimb: 282.5, size: 1773 },
  { id: "venus", names: { en: "Venus", ja: "金星" }, ra: 200.07, dec: -10.76, magnitude: -4.5, phase: 0.11 },
];

// A wide view with the Sun's yearly path, the ecliptic, drawn dashed under them.
const svg = chartSvg({ width: 640, height: 400, projection: "equirectangular", ra: 230, dec: -15, zoom: 1.5, layers: ["milky", "lines", "names", "ecliptic"], bodies });
writeFileSync(new URL("planets.svg", import.meta.url), svg);

console.log("planets.svg", (svg.match(/data-body=/g) ?? []).length, "bodies,", svg.includes('data-layer="ecliptic"') ? "with" : "without", "the ecliptic");
// planets.svg 2 bodies, with the ecliptic
