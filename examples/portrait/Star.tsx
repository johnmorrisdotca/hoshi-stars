import { starByName } from "@johnmorrisdotca/hoshi-stars";
import { starPortrait } from "@johnmorrisdotca/hoshi-stars/portrait";
import { starProfile } from "@johnmorrisdotca/hoshi-stars/profile";

const svg = starPortrait(starProfile(starByName("Sirius")!), { name: "Sirius", size: 320 }) ?? "";

export function Star() {
  return <div dangerouslySetInnerHTML={{ __html: svg }} />;
}
