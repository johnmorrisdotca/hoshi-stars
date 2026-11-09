import { blackHole, blackHoles } from "@johnmorrisdotca/hoshi-stars/black-holes";

const counts = ["stellar", "quiet", "supermassive"].map((kind) => `${blackHoles({ kind }).length} ${kind}`);
console.log(`${blackHoles().length} black holes: ${counts.join(", ")}`);

const cygnus = blackHole("Cygnus X-1");
const lightYears = Math.round(cygnus.distanceParsecs.value * 3.26156);
console.log(`${cygnus.name}: ${cygnus.massSuns.value} Suns, ${lightYears} light-years, companion ${cygnus.companion}`);
console.log(`mass from ${cygnus.sources.mass[0].citation}`);
