import { constellationIn3D } from "@johnmorrisdotca/hoshi-stars/constellation-3d";

// Orion in space: every star of the figure with the range its parallax error allows. A star with no parallax has no distance and no place; it is never given a guess.
const orion = constellationIn3D("Ori");
for (const { star, lightYears, range, quality } of orion.stars) {
  const far = range === undefined ? "" : Number.isFinite(range[1]) ? `, between ${Math.round(range[0])} and ${Math.round(range[1])}` : `, at least ${Math.round(range[0])}`;
  console.log(`${star.name} (${quality}): ${lightYears === undefined ? "distance unknown" : `${Math.round(lightYears)} ly${far}`}`);
}
console.log(orion.counts);
