import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { starByName } from "@johnmorrisdotca/hoshi-stars";
import { starComparison, starPortrait } from "@johnmorrisdotca/hoshi-stars/portrait";
import { starProfile } from "@johnmorrisdotca/hoshi-stars/profile";

// A server draws the same picture a browser does: pure, no DOM, no clock. Here Betelgeuse's portrait and its size beside the Sun, to two files.
const profile = starProfile(starByName("Betelgeuse"));
writeFileSync(join(tmpdir(), "betelgeuse-portrait.svg"), starPortrait(profile, { name: "Betelgeuse", size: 320 }));
writeFileSync(join(tmpdir(), "betelgeuse-and-the-sun.svg"), starComparison(profile, { name: "Betelgeuse", size: 360 }));
console.log(`Betelgeuse ${Math.round(profile.radius.value)} Suns across, from ${Math.round(profile.radius.range[0])} to ${Math.round(profile.radius.range[1])}`);
