import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { starColour, stars } from "@johnmorrisdotca/hoshi-stars";
import { figureOf } from "@johnmorrisdotca/hoshi-stars/lines";
import { project } from "@johnmorrisdotca/hoshi-stars/projection";

// A server draws the same SVG a browser does: pure, no DOM, no clock. Here the whole sky as an oval, to a file.
const view = { centre: { rightAscension: 180, declination: 0 }, scale: 180 };
const place = (star) => {
  const at = project("hammer", star, view);
  return at && { x: 600 + at.x, y: 320 - at.y };
};

let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 640" role="img" aria-label="The sky"><rect width="1200" height="640" fill="#0b1020"/>`;
for (const star of stars({ magnitude: 5 })) {
  const at = place(star);
  if (at) svg += `<circle cx="${at.x.toFixed(1)}" cy="${at.y.toFixed(1)}" r="${Math.max(0.8, 3.6 - star.magnitude * 0.6).toFixed(1)}" fill="${starColour(star)}"/>`;
}
writeFileSync(join(tmpdir(), "hoshi-sky.svg"), svg + "</svg>");
console.log("hoshi-sky.svg", figureOf("UMa").segments.length, "lines in the Great Bear");
