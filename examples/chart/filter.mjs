import { chartSvg } from "@johnmorrisdotca/hoshi-stars/chart";
import { starFilterFromText, starPasses } from "@johnmorrisdotca/hoshi-stars/star-filter";

// Orion with only the stars within 100 light-years that are no fainter than magnitude 4.5: the lines of the figures stay.
const all = chartSvg({ width: 640, height: 400, constellation: "Ori" });
const near = chartSvg({ width: 640, height: 400, constellation: "Ori", distanceMax: 100, magnitudeLimit: 4.5 });
const dots = (svg) => (svg.match(/<circle/g) ?? []).length;
console.log(dots(near) < dots(all), near.includes("<path"));

// The same limits as the text of the attributes, and the rule for one star: with a distance limit set, a star with no known distance is hidden.
const filter = starFilterFromText("20", "any", "4.5");
console.log(JSON.stringify(filter), starPasses(filter, 3, 40), starPasses(filter, 3, undefined));
// true true
// {"distanceMin":20,"magnitudeLimit":4.5} true false
