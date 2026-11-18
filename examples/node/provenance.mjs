import { objectDiscovery, starNameFacts, CATALOGUE_ORIGINS, PROVENANCE_SOURCES } from "@johnmorrisdotca/hoshi-stars/provenance";
import { objectDiscovery as anyDiscovery } from "@johnmorrisdotca/hoshi-stars/provenance/ngc-ic";

const crab = objectDiscovery("M1");
console.log(crab.discoverers.map((one) => one.name).join(", "), crab.date.value, crab.catalogue.compiler);

const nebula = anyDiscovery("NGC 7000");
console.log(nebula.id, nebula.discoverers[0].name, nebula.date.value, nebula.catalogue.years.join());

const star = starNameFacts("Betelgeuse");
console.log(star.name, star.approved, star.origin, PROVENANCE_SOURCES[star.sources.approved].address);

console.log(objectDiscovery("M31").notes[0]);
console.log(CATALOGUE_ORIGINS.ic.objects, "objects in the IC");
