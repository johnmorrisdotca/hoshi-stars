import { exoplanetHostByName } from "@johnmorrisdotca/hoshi-stars/exoplanet-hosts";
import { nearStarByName, nearStars } from "@johnmorrisdotca/hoshi-stars/near-stars";

const near = nearStars();
console.log(`${near.length} systems within 20 light-years, the nearest ${near[0].name}`);

const barnard = nearStarByName("Barnard's Star");
console.log(`${barnard.name} (${barnard.nameJa}): ${barnard.lightYears.toFixed(2)} light-years, ${barnard.spectralType}`);
console.log(`position from ${barnard.sources.position}, distance from ${barnard.sources.distance}, ${barnard.constellation}`);

const trappist = exoplanetHostByName("TRAPPIST-1");
console.log(`${trappist.name}: ${trappist.planetCount} planets, periods ${trappist.planets.map((p) => p.periodDays.toFixed(2)).join(", ")} days`);
