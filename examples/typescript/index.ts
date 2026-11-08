import { starByName, starDistanceLightYears, type Star } from "@johnmorrisdotca/hoshi-stars";
import { constellation, type Constellation } from "@johnmorrisdotca/hoshi-stars/constellations";
import { figureOf, type Figure } from "@johnmorrisdotca/hoshi-stars/lines";
import { PROJECTIONS, project, type Projection } from "@johnmorrisdotca/hoshi-stars/projection";

const sirius: Star = starByName("Sirius")!;
const dog: Constellation = constellation("CMa")!;
const figure: Figure = figureOf(dog.abbreviation);
const kind: Projection = "mollweide";
const at = project(kind, sirius, { centre: { rightAscension: 90, declination: 0 }, scale: 100 });
console.log(sirius.name, Math.round(starDistanceLightYears(sirius) ?? 0), figure.segments.length > 0, at !== undefined, PROJECTIONS.length);

export function refused(): void {
  // @ts-expect-error "square" is not a projection
  project("square", sirius, { centre: { rightAscension: 0, declination: 0 } });
}
