import { absoluteMagnitude, starByName } from "@johnmorrisdotca/hoshi-stars";
import { starProfile } from "@johnmorrisdotca/hoshi-stars/profile";

for (const name of ["Sirius", "Aldebaran", "Betelgeuse"]) {
  const star = starByName(name);
  const profile = starProfile(star);
  console.log(`${name}: B-V ${star.colourIndex}, absolute magnitude ${absoluteMagnitude(star).toFixed(1)}, ${Math.round(profile.temperature.value / 100) * 100} K, ${Math.round(profile.luminosity.value)} suns`);
}
