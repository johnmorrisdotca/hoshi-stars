import { writeFileSync } from "node:fs";
import { chartSvg } from "@johnmorrisdotca/hoshi-stars/chart";
import { japanese } from "@johnmorrisdotca/hoshi-stars/cultures/japanese";

const svg = chartSvg({ width: 800, height: 500, ra: 56.9, dec: 24.1, zoom: 8, culture: japanese, lang: "ja", constellation: "subaru" });
writeFileSync(new URL("subaru.svg", import.meta.url), svg);
console.log("subaru.svg", svg.length > 10000, svg.includes('aria-label="星図"'));
